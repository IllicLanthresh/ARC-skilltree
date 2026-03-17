import type { AllocationState, WantedNode } from '$lib/types';
import { skillNodeMap, BASE_SKILL_POINTS, MAX_EXPEDITION_BONUS } from '$lib/data/skillData';
import { computeMultiTargetPaths } from '$lib/algorithms/pathfinder';
import { calculateFillerNeeded, calculateGateDetails, getTreeStats } from '$lib/algorithms/budget';
import { loadFromUrl, syncToUrl } from '$lib/utils/urlState';
import { trackEvent } from '$lib/analytics';

let wantedNodes = $state<WantedNode[]>([]);
let expeditionBonus = $state(0);
let pathOverrides = $state<Map<string, number>>(new Map());

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let skipNextUrlSync = false;

let hasTrackedStart = false;
let hasTrackedComplete = false;

let savedWantedNodes: typeof wantedNodes | null = null;
let savedExpeditionBonus: typeof expeditionBonus | null = null;
let savedPathOverrides: typeof pathOverrides | null = null;

const maxBudget = $derived(BASE_SKILL_POINTS + expeditionBonus);
const computedPaths = $derived(computeMultiTargetPaths(wantedNodes, skillNodeMap, pathOverrides));
const requiredNodes = $derived(new Set(computedPaths.requiredNodes));

const allocations = $derived.by(() => {
  const allocs: AllocationState = {};
  if (wantedNodes.length === 0) return allocs;

  for (const wanted of wantedNodes) {
    allocs[wanted.skillId] = wanted.targetLevel;
  }

  for (const nodeId of computedPaths.requiredNodes) {
    if (!(nodeId in allocs)) {
      allocs[nodeId] = 1;
    }
  }

  return allocs;
});

const treeStats = $derived(getTreeStats(allocations, skillNodeMap));
const fillerNeeded = $derived(calculateFillerNeeded(computedPaths, allocations, skillNodeMap, wantedNodes));
const gateDetails = $derived(calculateGateDetails(computedPaths, allocations, skillNodeMap, wantedNodes));

const costBreakdown = $derived.by(() => {
  let wantedCost = 0;
  let prereqCost = 0;
  const wantedIds = new Set(wantedNodes.map(w => w.skillId));

  for (const wanted of wantedNodes) {
    wantedCost += wanted.targetLevel;
  }

  for (const nodeId of computedPaths.requiredNodes) {
    if (!wantedIds.has(nodeId)) {
      prereqCost += 1;
    }
  }

  return { wantedCost, prereqCost };
});

const autoFilledNodes = $derived.by(() => {
  const filled = new Set<string>();
  for (const nodeId of computedPaths.requiredNodes) {
    if ((allocations[nodeId] ?? 0) > 0 && !wantedNodes.some(w => w.skillId === nodeId)) {
      filled.add(nodeId);
    }
  }
  return filled;
});

function initEffects() {
  if (typeof window === 'undefined') return;

  const initialState = loadFromUrl();
  if (initialState) {
    wantedNodes = initialState.wantedNodes;
    expeditionBonus = initialState.expeditionBonus;
    if (initialState.pathOverrides && initialState.pathOverrides.size > 0) {
      pathOverrides = initialState.pathOverrides;
    }
    skipNextUrlSync = true;
  }

  $effect(() => {
    allocations;
    wantedNodes;
    expeditionBonus;
    pathOverrides;

    if (skipNextUrlSync) {
      skipNextUrlSync = false;
      return;
    }

    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncToUrl({ allocations, wantedNodes, expeditionBonus, pathOverrides });
    }, 300);

    return () => { if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; } };
  });

  $effect(() => {
    if (hasTrackedComplete) return;
    if (wantedNodes.length === 0) return;
    const fillerTotal = (fillerNeeded.conditioning ?? 0) + (fillerNeeded.mobility ?? 0) + (fillerNeeded.survival ?? 0);
    const totalCost = costBreakdown.wantedCost + costBreakdown.prereqCost + fillerTotal;
    if (totalCost > 0 && totalCost >= maxBudget) {
      hasTrackedComplete = true;
      trackEvent('completed_build', 'Completed Build');
    }
  });
}

function incrementWanted(nodeId: string) {
  const node = skillNodeMap.get(nodeId);
  if (!node) return;
  const wasPreviouslyEmpty = wantedNodes.length === 0;
  const existing = wantedNodes.find((w) => w.skillId === nodeId);
  if (!existing) {
    wantedNodes = [...wantedNodes, { skillId: nodeId, targetLevel: 1 }];
  } else if (existing.targetLevel < node.maxPoints) {
    wantedNodes = wantedNodes.map((w) =>
      w.skillId === nodeId ? { ...w, targetLevel: w.targetLevel + 1 } : w
    );
  }
  if (wasPreviouslyEmpty && wantedNodes.length > 0 && !hasTrackedStart) {
    hasTrackedStart = true;
    trackEvent('started_build', 'Started Build');
  }
  trackEvent('skill_level_up', node.name);
}

function decrementWanted(nodeId: string) {
  const existing = wantedNodes.find((w) => w.skillId === nodeId);
  if (!existing) return;
  if (existing.targetLevel <= 1) {
    wantedNodes = wantedNodes.filter((w) => w.skillId !== nodeId);
  } else {
    wantedNodes = wantedNodes.map((w) =>
      w.skillId === nodeId ? { ...w, targetLevel: w.targetLevel - 1 } : w
    );
  }
  const downNode = skillNodeMap.get(nodeId);
  if (downNode) trackEvent('skill_level_down', downNode.name);
}

function removeWanted(nodeId: string) {
  wantedNodes = wantedNodes.filter((w) => w.skillId !== nodeId);
}

function setPathOverride(nodeId: string, optionIndex: number) {
  const currentRequired = computedPaths.requiredNodes;
  const requiredSet = new Set(currentRequired);
  const next = new Map<string, number>();
  for (const [id, idx] of pathOverrides) {
    if (requiredSet.has(id)) {
      next.set(id, idx);
    }
  }
  next.set(nodeId, optionIndex);
  pathOverrides = next;
}

function clearPathOverrides() {
  pathOverrides = new Map();
}

function setExpeditionBonus(value: number) {
  expeditionBonus = Math.max(0, Math.min(MAX_EXPEDITION_BONUS, value));
}

function resetAll() {
  if (wantedNodes.length > 0) trackEvent('reset_build', 'Reset Build');
  wantedNodes = [];
  expeditionBonus = 0;
  pathOverrides = new Map();
}

function saveState() {
  savedWantedNodes = [...wantedNodes];
  savedExpeditionBonus = expeditionBonus;
  savedPathOverrides = new Map(pathOverrides);
  resetAll();
}

function restoreState() {
  if (savedWantedNodes === null) return;
  wantedNodes = savedWantedNodes;
  expeditionBonus = savedExpeditionBonus ?? 0;
  pathOverrides = savedPathOverrides ?? new Map();
  savedWantedNodes = null;
  savedExpeditionBonus = null;
  savedPathOverrides = null;
}

function applySnapshot(nodes: WantedNode[], overrides: Map<string, number>) {
  wantedNodes = nodes;
  pathOverrides = overrides;
}

export const buildStore = {
  get allocations() { return allocations; },
  get wantedNodes() { return wantedNodes; },
  get expeditionBonus() { return expeditionBonus; },
  get pathOverrides() { return pathOverrides; },
  get maxBudget() { return maxBudget; },
  get treeStats() { return treeStats; },
  get computedPaths() { return computedPaths; },
  get requiredNodes() { return requiredNodes; },
  get fillerNeeded() { return fillerNeeded; },
  get gateDetails() { return gateDetails; },
  get costBreakdown() { return costBreakdown; },
  get autoFilledNodes() { return autoFilledNodes; },
  incrementWanted,
  decrementWanted,
  removeWanted,
  setPathOverride,
  clearPathOverrides,
  setExpeditionBonus,
  resetAll,
  saveState,
  restoreState,
  applySnapshot,
  initEffects,
};
