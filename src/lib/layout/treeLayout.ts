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

export const SVG_VIEWBOX = '0 0 1200 1040';

const CATEGORIES: SkillCategory[] = ['CONDITIONING', 'MOBILITY', 'SURVIVAL'];
const SVG_WIDTH = 1200;
const COLUMN_GAP = 24;
const COLUMN_INNER_PAD = 50;
const PADDING_TOP = 60;
const PADDING_BOTTOM = 160;

export function computeNodePositions(nodes: SkillNode[]): Record<string, PositionedNode> {
  if (nodes.length === 0) return {};

  const allYs = nodes.map((n) => n.position.y);
  const minY = Math.min(...allYs);
  const maxY = Math.max(...allYs);
  const rangeY = maxY - minY || 1;
  const availableHeight = 1040 - PADDING_TOP - PADDING_BOTTOM;
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
): { title: string; key: 'conditioning' | 'mobility' | 'survival'; x: number; color: string }[] {
  return CATEGORIES.map((cat) => {
    const catNodes = nodes.filter((n) => n.category === cat);
    const avgX = catNodes.reduce((sum, n) => sum + (positions[n.id]?.x ?? 0), 0) / (catNodes.length || 1);
    return { title: cat, key: cat.toLowerCase() as 'conditioning' | 'mobility' | 'survival', x: avgX, color: TREE_COLORS[cat] };
  });
}

export function computeConnectionPaths(
  nodes: SkillNode[],
  positions: Record<string, { x: number; y: number }>
): ConnectionPath[] {
  const paths: ConnectionPath[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const node of nodes) {
    const to = positions[node.id];
    if (!to) continue;

    for (const prereqId of node.prerequisiteNodeIds) {
      const from = positions[prereqId];
      if (!from) continue;

      // Get node sizes for radius calculations
      const fromNode = nodeMap.get(prereqId);
      const fromRadius = fromNode?.isMajor ? NODE_SIZES.major : NODE_SIZES.minor;
      const toRadius = node.isMajor ? NODE_SIZES.major : NODE_SIZES.minor;

      // Calculate edge endpoints offset to node boundary
      // Tree flows bottom-to-top: parent has higher SVG y, child has lower SVG y
      const startY = from.y - fromRadius; // top of parent
      const endY = to.y + toRadius;       // bottom of child

      // Calculate S-curve control points with vertical tangents
      const verticalGap = startY - endY; // positive: parent is below child in SVG
      const offset = Math.max(30, Math.min(verticalGap * 0.4, 80));
      const cp1x = from.x;       // same X as start → exits straight up
      const cp1y = startY - offset;
      const cp2x = to.x;         // same X as end → enters straight down
      const cp2y = endY + offset;

      // Generate cubic Bézier path string
      const d = `M ${from.x} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${endY}`;

      paths.push({ from: prereqId, to: node.id, d });
    }
  }

  return paths;
}
