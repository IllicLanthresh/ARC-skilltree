import type { ComputedPath, AllocationState, TreeStats } from '$lib/types';
import type { SkillNode, SkillCategory } from '$lib/types';

function categoryPoints(
  category: SkillCategory,
  allocations: AllocationState,
  skillNodeMap: Map<string, SkillNode>
): number {
  let total = 0;
  for (const [nodeId, points] of Object.entries(allocations)) {
    if (points <= 0) continue;
    const node = skillNodeMap.get(nodeId);
    if (node?.category === category) {
      total += points;
    }
  }
  return total;
}

export function validateBudget(
  allocations: AllocationState,
  maxBudget: number,
  _skillNodeMap: Map<string, SkillNode>
): { valid: boolean; totalUsed: number; remaining: number; overBy: number } {
  const totalUsed = Object.values(allocations).reduce((sum, points) => sum + points, 0);
  const remaining = Math.max(0, maxBudget - totalUsed);
  const overBy = Math.max(0, totalUsed - maxBudget);
  return { valid: overBy === 0, totalUsed, remaining, overBy };
}

export function getTreeStats(
  allocations: AllocationState,
  skillNodeMap: Map<string, SkillNode>
): TreeStats {
  let conditioning = 0;
  let mobility = 0;
  let survival = 0;
  for (const [nodeId, points] of Object.entries(allocations)) {
    if (points <= 0) continue;
    const node = skillNodeMap.get(nodeId);
    if (!node) continue;
    if (node.category === 'CONDITIONING') conditioning += points;
    if (node.category === 'MOBILITY') mobility += points;
    if (node.category === 'SURVIVAL') survival += points;
  }
  const total = conditioning + mobility + survival;
  return { conditioning, mobility, survival, total, remaining: 0 };
}

function isBeforeGate(
  nodeId: string,
  gateThreshold: number,
  skillNodeMap: Map<string, SkillNode>,
  cache: Map<string, boolean>
): boolean {
  if (cache.has(nodeId)) return cache.get(nodeId)!;
  const node = skillNodeMap.get(nodeId);
  if (!node) { cache.set(nodeId, false); return false; }
  if (node.gateThreshold !== null && node.gateThreshold >= gateThreshold) {
    cache.set(nodeId, false);
    return false;
  }
  if (node.prerequisiteNodeIds.length === 0) {
    cache.set(nodeId, true);
    return true;
  }
  const result = node.prerequisiteNodeIds.some(pid =>
    isBeforeGate(pid, gateThreshold, skillNodeMap, cache)
  );
  cache.set(nodeId, result);
  return result;
}

function pointsBeforeGate(
  gateThreshold: number,
  category: SkillCategory,
  allocations: AllocationState,
  skillNodeMap: Map<string, SkillNode>
): number {
  const cache = new Map<string, boolean>();
  let total = 0;
  for (const [nodeId, points] of Object.entries(allocations)) {
    if (points <= 0) continue;
    const node = skillNodeMap.get(nodeId);
    if (!node || node.category !== category) continue;
    if (isBeforeGate(nodeId, gateThreshold, skillNodeMap, cache)) {
      total += points;
    }
  }
  return total;
}

export function checkGateThreshold(
  nodeId: string,
  allocations: AllocationState,
  skillNodeMap: Map<string, SkillNode>
): { unlocked: boolean; pointsSpent: number; pointsRequired: number; pointsNeeded: number } {
  const node = skillNodeMap.get(nodeId);
  if (!node) {
    return { unlocked: false, pointsSpent: 0, pointsRequired: 0, pointsNeeded: 0 };
  }
  const pointsRequired = node.gateThreshold ?? 0;
  const pointsSpent = pointsBeforeGate(pointsRequired, node.category, allocations, skillNodeMap);
  const pointsNeeded = Math.max(0, pointsRequired - pointsSpent);
  return { unlocked: pointsNeeded === 0, pointsSpent, pointsRequired, pointsNeeded };
}

export function calculateFillerNeeded(
  computedPath: ComputedPath,
  allocations: AllocationState,
  skillNodeMap: Map<string, SkillNode>,
  wantedNodes: { skillId: string; targetLevel: number }[] = []
): Record<string, number> {
  const fillerByCategory: Record<string, number> = {
    conditioning: 0, mobility: 0, survival: 0,
  };
  const wantedLevels = new Map(wantedNodes.map(w => [w.skillId, w.targetLevel]));

  for (const nodeId of computedPath.requiredNodes) {
    const node = skillNodeMap.get(nodeId);
    if (!node || node.gateThreshold === null) continue;

    const threshold = node.gateThreshold;
    const category = node.category;
    const cache = new Map<string, boolean>();

    let beforePoints = 0;
    for (const [allocId, pts] of Object.entries(allocations)) {
      if (pts <= 0) continue;
      const allocNode = skillNodeMap.get(allocId);
      if (!allocNode || allocNode.category !== category) continue;
      if (isBeforeGate(allocId, threshold, skillNodeMap, cache)) {
        beforePoints += pts;
      }
    }

    for (const reqId of computedPath.requiredNodes) {
      const reqNode = skillNodeMap.get(reqId);
      if (!reqNode || reqNode.category !== category) continue;
      if (!isBeforeGate(reqId, threshold, skillNodeMap, cache)) continue;
      const currentAlloc = allocations[reqId] ?? 0;
      const projected = wantedLevels.get(reqId) ?? 1;
      const addedPoints = Math.max(0, projected - currentAlloc);
      beforePoints += addedPoints;
    }

    const categoryKey = category.toLowerCase();
    const needed = Math.max(0, threshold - beforePoints);
    fillerByCategory[categoryKey] = Math.max(fillerByCategory[categoryKey], needed);
  }
  return fillerByCategory;
}

export interface GateDetail {
  nodeId: string;
  nodeName: string;
  threshold: number;
  pointsBefore: number;
  pointsNeeded: number;
}

export function calculateGateDetails(
  computedPath: ComputedPath,
  allocations: AllocationState,
  skillNodeMap: Map<string, SkillNode>,
  wantedNodes: { skillId: string; targetLevel: number }[] = []
): GateDetail[] {
  const details: GateDetail[] = [];
  const wantedLevels = new Map(wantedNodes.map(w => [w.skillId, w.targetLevel]));

  for (const nodeId of computedPath.requiredNodes) {
    const node = skillNodeMap.get(nodeId);
    if (!node || node.gateThreshold === null) continue;

    const threshold = node.gateThreshold;
    const category = node.category;
    const cache = new Map<string, boolean>();

    let beforePoints = 0;
    for (const [allocId, pts] of Object.entries(allocations)) {
      if (pts <= 0) continue;
      const allocNode = skillNodeMap.get(allocId);
      if (!allocNode || allocNode.category !== category) continue;
      if (isBeforeGate(allocId, threshold, skillNodeMap, cache)) {
        beforePoints += pts;
      }
    }

    for (const reqId of computedPath.requiredNodes) {
      const reqNode = skillNodeMap.get(reqId);
      if (!reqNode || reqNode.category !== category) continue;
      if (!isBeforeGate(reqId, threshold, skillNodeMap, cache)) continue;
      const currentAlloc = allocations[reqId] ?? 0;
      const projected = wantedLevels.get(reqId) ?? 1;
      const addedPoints = Math.max(0, projected - currentAlloc);
      beforePoints += addedPoints;
    }

    const needed = Math.max(0, threshold - beforePoints);
    if (needed > 0) {
      details.push({
        nodeId,
        nodeName: node.name,
        threshold,
        pointsBefore: beforePoints,
        pointsNeeded: needed,
      });
    }
  }

  return details;
}
