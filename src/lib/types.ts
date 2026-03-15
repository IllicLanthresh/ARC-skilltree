export type SkillCategory = 'CONDITIONING' | 'MOBILITY' | 'SURVIVAL';

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  maxPoints: 1 | 5;
  prerequisiteNodeIds: string[];
  iconName: string;
  position: { x: number; y: number };
  isMajor: boolean;
  gateThreshold: 15 | 36 | null;
}

export interface AllocationState {
  [skillId: string]: number;
}

export interface WantedNode {
  skillId: string;
  targetLevel: number;
}

export interface PathChoice {
  nodeId: string;
  options: string[][];
  chosenOptionIndex: number | null;
}

export interface BuildState {
  allocations: AllocationState;
  wantedNodes: WantedNode[];
  pathChoices?: PathChoice[];
  pathOverrides?: Map<string, number>;
  expeditionBonus: number;
}

export interface TreeStats {
  conditioning: number;
  mobility: number;
  survival: number;
  total: number;
  remaining: number;
}

export interface ComputedPath {
  requiredNodes: string[];
  orChoices: PathChoice[];
  totalCost: number;
  fillerNeeded: { [category: string]: number };
}

export interface ConnectionPath {
  from: string;
  to: string;
  d: string;
}
