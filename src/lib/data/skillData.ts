import type { SkillNode, SkillCategory } from '$lib/types';
import rawSkillNodes from './skillNodes.json';

// Gate threshold mapping - which nodes require 15 or 36 points spent in their tree
const GATE_THRESHOLD_MAP: Record<string, 15 | 36> = {
  // Conditioning 15pt gates
  'cond_4l': 15, // Survivor's Stamina
  'cond_4r': 15, // Unburdened Roll
  // Conditioning 36pt gates
  'cond_7l': 36, // Back On Your Feet
  'cond_7r': 36, // Flyswatter
  // Mobility 15pt gates
  'mob_4l': 15,  // Carry The Momentum
  'mob_4r': 15,  // Calming Stroll
  // Mobility 36pt gates
  'mob_7l': 36,  // Vaults on Vaults on Vaults
  'mob_7r': 36,  // Vault Spring
  // Survival 15pt gates
  'surv_4l': 15, // Suffer In Silence
  'surv_4r': 15, // Good As New
  // Survival 36pt gates
  'surv_7l': 36, // Security Breach
  'surv_7r': 36, // Minesweeper
};

// Process raw JSON into typed SkillNode array
export const skillNodes: SkillNode[] = (rawSkillNodes as any[]).map((raw) => ({
  id: raw.id,
  name: raw.name?.en ?? raw.name ?? '',
  description: raw.description?.en ?? raw.description ?? '',
  category: raw.category as SkillCategory,
  maxPoints: raw.maxPoints as 1 | 5,
  prerequisiteNodeIds: raw.prerequisiteNodeIds ?? [],
  iconName: raw.iconName ?? '',
  position: raw.position ?? { x: 0, y: 0 },
  isMajor: raw.isMajor ?? false,
  gateThreshold: GATE_THRESHOLD_MAP[raw.id] ?? null,
}));

// Quick lookup map
export const skillNodeMap = new Map<string, SkillNode>(
  skillNodes.map((node) => [node.id, node])
);

// Group by category
export const skillsByCategory: Record<SkillCategory, SkillNode[]> = {
  CONDITIONING: skillNodes.filter((n) => n.category === 'CONDITIONING'),
  MOBILITY: skillNodes.filter((n) => n.category === 'MOBILITY'),
  SURVIVAL: skillNodes.filter((n) => n.category === 'SURVIVAL'),
};

// Helper: get prerequisite nodes
export function getPrerequisites(nodeId: string): SkillNode[] {
  const node = skillNodeMap.get(nodeId);
  if (!node) return [];
  return node.prerequisiteNodeIds
    .map((id) => skillNodeMap.get(id))
    .filter((n): n is SkillNode => n !== undefined);
}

// Helper: get children (nodes that have this node as prerequisite)
export function getChildren(nodeId: string): SkillNode[] {
  return skillNodes.filter((n) => n.prerequisiteNodeIds.includes(nodeId));
}

// Constants
export const BASE_SKILL_POINTS = 76;
export const MAX_EXPEDITION_BONUS = 25;
export const GATE_THRESHOLDS = [15, 36] as const;
