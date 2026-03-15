import type { ConnectionPath, SkillCategory, SkillNode } from '$lib/types';

type PositionedNode = {
  x: number;
  y: number;
  category: SkillCategory;
};

export const NODE_SIZES = {
  minor: 24,
  major: 32,
  stroke: 2,
} as const;

export const TREE_COLORS: Record<SkillCategory, string> = {
  CONDITIONING: '#2afe7f',
  MOBILITY: '#fdd333',
  SURVIVAL: '#f4101b',
};

export const SVG_VIEWBOX = '0 0 1200 980';

const CATEGORIES: SkillCategory[] = ['CONDITIONING', 'MOBILITY', 'SURVIVAL'];
const SVG_WIDTH = 1200;
const COLUMN_GAP = 24;
const COLUMN_INNER_PAD = 50;
const PADDING_TOP = 60;
const PADDING_BOTTOM = 100;

export function computeNodePositions(nodes: SkillNode[]): Record<string, PositionedNode> {
  if (nodes.length === 0) return {};

  const allYs = nodes.map((n) => n.position.y);
  const minY = Math.min(...allYs);
  const maxY = Math.max(...allYs);
  const rangeY = maxY - minY || 1;
  const availableHeight = 980 - PADDING_TOP - PADDING_BOTTOM;
  const scaleY = availableHeight / rangeY;

  const columnWidth = (SVG_WIDTH - (CATEGORIES.length - 1) * COLUMN_GAP) / CATEGORIES.length;
  const positions: Record<string, PositionedNode> = {};

  CATEGORIES.forEach((cat, colIndex) => {
    const catNodes = nodes.filter((n) => n.category === cat);
    if (catNodes.length === 0) return;

    const localXs = catNodes.map((n) => n.position.x);
    const localMinX = Math.min(...localXs);
    const localMaxX = Math.max(...localXs);
    const localRangeX = localMaxX - localMinX || 1;

    const bandLeft = colIndex * (columnWidth + COLUMN_GAP) + COLUMN_INNER_PAD;
    const bandRight = colIndex * (columnWidth + COLUMN_GAP) + columnWidth - COLUMN_INNER_PAD;
    const bandWidth = bandRight - bandLeft;
    const localScaleX = bandWidth / localRangeX;

    for (const node of catNodes) {
      positions[node.id] = {
        x: bandLeft + (node.position.x - localMinX) * localScaleX,
        y: PADDING_TOP + (node.position.y - minY) * scaleY,
        category: node.category,
      };
    }
  });

  return positions;
}

export function computeTreeLabelPositions(
  nodes: SkillNode[],
  positions: Record<string, PositionedNode>
): { title: string; x: number; color: string }[] {
  return CATEGORIES.map((cat) => {
    const catNodes = nodes.filter((n) => n.category === cat);
    const avgX = catNodes.reduce((sum, n) => sum + (positions[n.id]?.x ?? 0), 0) / (catNodes.length || 1);
    return { title: cat, x: avgX, color: TREE_COLORS[cat] };
  });
}

export function computeConnectionPaths(
  nodes: SkillNode[],
  positions: Record<string, { x: number; y: number }>
): ConnectionPath[] {
  const paths: ConnectionPath[] = [];

  for (const node of nodes) {
    const to = positions[node.id];
    if (!to) continue;

    for (const prereqId of node.prerequisiteNodeIds) {
      const from = positions[prereqId];
      if (!from) continue;

      const controlX = (from.x + to.x) / 2;
      const lift = Math.max(26, Math.abs(to.x - from.x) * 0.18);
      const controlY = Math.min(from.y, to.y) - lift;
      const d = `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;

      paths.push({ from: prereqId, to: node.id, d });
    }
  }

  return paths;
}
