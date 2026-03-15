import type { WantedNode, ComputedPath, PathChoice, AllocationState } from '$lib/types';
import type { SkillNode } from '$lib/types';

function getAllocatedPoints(allocations: AllocationState): number {
  return Object.values(allocations).reduce((sum, points) => sum + points, 0);
}

function getCategoryPoints(
  category: SkillNode['category'],
  allocations: AllocationState,
  skillNodeMap: Map<string, SkillNode>
): number {
  let total = 0;
  for (const [id, points] of Object.entries(allocations)) {
    if (points <= 0) continue;
    const node = skillNodeMap.get(id);
    if (node?.category === category) {
      total += points;
    }
  }
  return total;
}

function isPrerequisiteSatisfied(node: SkillNode, allocations: AllocationState, skillNodeMap: Map<string, SkillNode>): boolean {
  const prereqs = node.prerequisiteNodeIds;
  if (prereqs.length === 0) return true;
  const hasAtLeastOne = (id: string) => (allocations[id] ?? 0) >= 1;
  if (prereqs.length === 1) return hasAtLeastOne(prereqs[0]);
  return prereqs.some(hasAtLeastOne);
}

function gatherBranchNodes(nodeId: string, skillNodeMap: Map<string, SkillNode>, visited = new Set<string>()): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  const node = skillNodeMap.get(nodeId);
  if (!node) return [];
  const collected = [nodeId];
  if (node.prerequisiteNodeIds.length === 0) return collected;
  if (node.prerequisiteNodeIds.length === 1) {
    return collected.concat(gatherBranchNodes(node.prerequisiteNodeIds[0], skillNodeMap, new Set(visited)));
  }
  let bestBranch: string[] = [];
  let bestCost = Number.POSITIVE_INFINITY;
  for (const optionId of node.prerequisiteNodeIds) {
    const optionNodes = gatherBranchNodes(optionId, skillNodeMap, new Set(visited));
    const optionCost = optionNodes.reduce((sum, id) => sum + (skillNodeMap.get(id)?.maxPoints ?? 0), 0);
    if (optionCost < bestCost) { bestCost = optionCost; bestBranch = optionNodes; }
  }
  return collected.concat(bestBranch);
}

interface OrChoiceNode {
  nodeId: string;
  prereqs: string[];
  options: string[][];
}

function collectRequired(
  targetId: string,
  skillNodeMap: Map<string, SkillNode>,
  choiceMap: Map<string, number>,
  orChoiceNodes: Map<string, OrChoiceNode>,
  visited: Set<string> = new Set()
): Set<string> {
  if (visited.has(targetId)) return new Set();
  visited.add(targetId);
  const node = skillNodeMap.get(targetId);
  if (!node) return new Set();
  const required = new Set<string>([targetId]);
  const prereqs = node.prerequisiteNodeIds;
  if (prereqs.length === 0) return required;
  if (prereqs.length === 1) {
    for (const id of collectRequired(prereqs[0], skillNodeMap, choiceMap, orChoiceNodes, visited)) required.add(id);
    return required;
  }
  if (!orChoiceNodes.has(targetId)) {
    const options = prereqs.map((prereqId) => gatherBranchNodes(prereqId, skillNodeMap));
    orChoiceNodes.set(targetId, { nodeId: targetId, prereqs, options });
  }
  const chosenIndex = choiceMap.get(targetId) ?? 0;
  const chosenPrereq = prereqs[chosenIndex] ?? prereqs[0];
  for (const id of collectRequired(chosenPrereq, skillNodeMap, choiceMap, orChoiceNodes, visited)) required.add(id);
  return required;
}

function computeCost(nodeIds: Set<string>, skillNodeMap: Map<string, SkillNode>, wantedLevels: Map<string, number>): number {
  let total = 0;
  for (const id of nodeIds) {
    const node = skillNodeMap.get(id);
    if (!node) continue;
    const wantedLevel = wantedLevels.get(id);
    total += wantedLevel !== undefined ? wantedLevel : 1;
  }
  return total;
}

interface OptimizeResult {
  requiredNodes: Set<string>;
  totalCost: number;
  bestChoiceMap: Map<string, number>;
  orList: OrChoiceNode[];
}

function optimizePaths(
  wantedNodes: WantedNode[],
  skillNodeMap: Map<string, SkillNode>,
  pathOverrides: Map<string, number>,
  forceOverrides: boolean = false
): OptimizeResult | null {
  if (wantedNodes.length === 0) return null;

  const wantedLevels = new Map<string, number>();
  for (const w of wantedNodes) wantedLevels.set(w.skillId, w.targetLevel);

  // Phase 1: iteratively discover ALL OR-choice nodes across all possible traversals.
  // Nested OR nodes only reachable via non-default branches need multiple passes.
  const orChoiceNodes = new Map<string, OrChoiceNode>();
  let previousOrCount = -1;

  while (orChoiceNodes.size !== previousOrCount) {
    previousOrCount = orChoiceNodes.size;
    const currentOrList = Array.from(orChoiceNodes.values());
    const optCounts = currentOrList.map((or) => or.prereqs.length);
    const totalCombos = optCounts.length === 0 ? 1 : optCounts.reduce((p, c) => p * c, 1);

    for (let combo = 0; combo < totalCombos; combo++) {
      const choiceMap = new Map<string, number>();
      let remainder = combo;
      for (let i = currentOrList.length - 1; i >= 0; i--) {
        choiceMap.set(currentOrList[i].nodeId, remainder % optCounts[i]);
        remainder = Math.floor(remainder / optCounts[i]);
      }
      for (const wanted of wantedNodes) {
        collectRequired(wanted.skillId, skillNodeMap, choiceMap, orChoiceNodes);
      }
    }
  }

  const orList = Array.from(orChoiceNodes.values());

  if (orList.length === 0) {
    const allRequired = new Set<string>();
    const emptyChoices = new Map<string, number>();
    for (const wanted of wantedNodes) {
      for (const id of collectRequired(wanted.skillId, skillNodeMap, emptyChoices, orChoiceNodes)) allRequired.add(id);
    }
    return {
      requiredNodes: allRequired,
      totalCost: computeCost(allRequired, skillNodeMap, wantedLevels),
      bestChoiceMap: new Map(),
      orList: [],
    };
  }

  // Phase 2: brute-force all combinations with the COMPLETE set of OR nodes
  const optionCounts = orList.map((or) => or.prereqs.length);
  const totalCombinations = optionCounts.reduce((product, count) => product * count, 1);

  let bestRequired: Set<string> = new Set();
  let bestCost = Number.POSITIVE_INFINITY;
  let bestChoiceMap = new Map<string, number>();
  let bestMatchesOverrides = false;

  for (let combo = 0; combo < totalCombinations; combo++) {
    const choiceMap = new Map<string, number>();
    let remainder = combo;
    let skipCombo = false;
    for (let i = orList.length - 1; i >= 0; i--) {
      choiceMap.set(orList[i].nodeId, remainder % optionCounts[i]);
      remainder = Math.floor(remainder / optionCounts[i]);
    }

    if (forceOverrides) {
      for (const [nodeId, idx] of pathOverrides) {
        if (choiceMap.has(nodeId) && choiceMap.get(nodeId) !== idx) {
          skipCombo = true;
          break;
        }
      }
    }
    if (skipCombo) continue;

    const allRequired = new Set<string>();
    const freshOrNodes = new Map<string, OrChoiceNode>();
    for (const wanted of wantedNodes) {
      for (const id of collectRequired(wanted.skillId, skillNodeMap, choiceMap, freshOrNodes)) allRequired.add(id);
    }
    const cost = computeCost(allRequired, skillNodeMap, wantedLevels);

    const matchesOverrides = !forceOverrides && pathOverrides.size > 0 && Array.from(pathOverrides.entries()).every(
      ([nodeId, idx]) => choiceMap.get(nodeId) === idx
    );

    if (cost < bestCost || (cost === bestCost && matchesOverrides && !bestMatchesOverrides)) {
      bestCost = cost;
      bestRequired = allRequired;
      bestChoiceMap = choiceMap;
      bestMatchesOverrides = matchesOverrides;
    }
  }

  return {
    requiredNodes: bestRequired,
    totalCost: bestCost,
    bestChoiceMap,
    orList,
  };
}

export function computeMultiTargetPaths(
  wantedNodes: WantedNode[],
  skillNodeMap: Map<string, SkillNode>,
  pathOverrides: Map<string, number> = new Map()
): ComputedPath {
  const result = optimizePaths(wantedNodes, skillNodeMap, pathOverrides);
  if (!result) {
    return { requiredNodes: [], orChoices: [], totalCost: 0, fillerNeeded: {} };
  }

  const { requiredNodes: bestRequired, totalCost: bestCost, bestChoiceMap, orList } = result;

  const finalOrChoices: PathChoice[] = [];
  for (const or of orList) {
    if (!bestRequired.has(or.nodeId)) continue;
    if (or.prereqs.length < 2) continue;

    const branchResults: { cost: number; requiredSet: Set<string> }[] = [];
    for (let branchIdx = 0; branchIdx < or.prereqs.length; branchIdx++) {
      const forcedOverrides = new Map<string, number>();
      for (const [overrideId, overrideIdx] of pathOverrides) {
        if (overrideId !== or.nodeId && bestRequired.has(overrideId)) {
          forcedOverrides.set(overrideId, overrideIdx);
        }
      }
      forcedOverrides.set(or.nodeId, branchIdx);
      const branchResult = optimizePaths(wantedNodes, skillNodeMap, forcedOverrides, true);
      if (!branchResult) continue;
      branchResults.push({
        cost: branchResult.totalCost,
        requiredSet: branchResult.requiredNodes,
      });
    }

    if (branchResults.length < 2) continue;

    const baseCost = branchResults[0].cost;
    const baseSet = branchResults[0].requiredSet;
    const allSameCost = branchResults.every((r) => r.cost === baseCost);
    const allSameSet = branchResults.every((r) => {
      if (r.requiredSet.size !== baseSet.size) return false;
      for (const id of r.requiredSet) {
        if (!baseSet.has(id)) return false;
      }
      return true;
    });

    if (allSameSet) continue;
    if (!allSameCost) continue;

    finalOrChoices.push({
      nodeId: or.nodeId,
      options: or.options,
      chosenOptionIndex: bestChoiceMap.get(or.nodeId) ?? 0,
    });
  }

  return {
    requiredNodes: Array.from(bestRequired),
    orChoices: finalOrChoices,
    totalCost: bestCost,
    fillerNeeded: {},
  };
}

export function canAllocate(
  nodeId: string, allocations: AllocationState, maxBudget: number, skillNodeMap: Map<string, SkillNode>
): boolean {
  const node = skillNodeMap.get(nodeId);
  if (!node) return false;
  if ((allocations[nodeId] ?? 0) >= node.maxPoints) return false;
  if (getAllocatedPoints(allocations) + 1 > maxBudget) return false;
  if (!isPrerequisiteSatisfied(node, allocations, skillNodeMap)) return false;
  if (node.gateThreshold !== null) {
    if (getCategoryPoints(node.category, allocations, skillNodeMap) < node.gateThreshold) return false;
  }
  return true;
}

export function canDeallocate(
  nodeId: string, allocations: AllocationState, wantedNodes: WantedNode[], skillNodeMap: Map<string, SkillNode>
): { allowed: boolean; reason?: string } {
  if ((allocations[nodeId] ?? 0) <= 0) return { allowed: false, reason: 'No points allocated' };
  return { allowed: true };
}
