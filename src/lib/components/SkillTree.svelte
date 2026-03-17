<script lang="ts">
  import type { SkillNode } from '$lib/types';
  import { skillNodes, skillNodeMap } from '$lib/data/skillData';
  import { buildStore } from '$lib/state/buildStore.svelte';
  import { checkGateThreshold } from '$lib/algorithms/budget';
  import { computeNodePositions, computeConnectionPaths, computeTreeLabelPositions, NODE_SIZES, TREE_COLORS, SVG_VIEWBOX } from '$lib/layout/treeLayout';
  import { getIconUrl } from '$lib/utils/iconUrl';
  import type { TooltipData } from '$lib/components/Tooltip.svelte';
  import { viewport } from '$lib/stores/viewport.svelte';
  import { untrack } from 'svelte';

  type HoverCallback = (next: TooltipData | null) => void;

  type TreeStats = { conditioning: number; mobility: number; survival: number; total: number };

  let {
    onHover = (() => {}) as HoverCallback,
    treeStats = { conditioning: 0, mobility: 0, survival: 0, total: 0 },
    mobileActiveTree = null as 'conditioning' | 'mobility' | 'survival' | null
  } = $props<{ onHover?: HoverCallback; treeStats?: TreeStats; mobileActiveTree?: 'conditioning' | 'mobility' | 'survival' | null }>();

  let hoveredNodeId = $state<string | null>(null);
  let lastHoverPos: { x: number; y: number } | null = null;

  const positions = computeNodePositions(skillNodes);
  const connections = computeConnectionPaths(skillNodes, positions);
  const TREE_LABELS = computeTreeLabelPositions(skillNodes, positions);

  const allocations = $derived(buildStore.allocations);
  const wantedNodes = $derived(buildStore.wantedNodes);
  const requiredNodes = $derived(buildStore.requiredNodes);

  const autoFilledNodes = $derived(buildStore.autoFilledNodes);
  const wantedSet = $derived(new Set(wantedNodes.map((wanted) => wanted.skillId)));
  const hoverChain = $derived(hoveredNodeId ? collectAncestors(hoveredNodeId) : new Set<string>());

  const wantedLevelMap = $derived.by(() => {
    const map = new Map<string, number>();
    for (const w of wantedNodes) {
      map.set(w.skillId, w.targetLevel);
    }
    return map;
  });

  const orChoiceMap = $derived.by(() => {
    const map = new Map<string, { options: string[][]; chosenOptionIndex: number }>();
    for (const choice of buildStore.computedPaths.orChoices) {
      map.set(choice.nodeId, { options: choice.options, chosenOptionIndex: choice.chosenOptionIndex ?? 0 });
    }
    return map;
  });

  const TREE_VIEW_X: Record<'conditioning' | 'mobility' | 'survival', number> = {
    conditioning: 0,
    mobility: 408,
    survival: 816,
  };

  const TREE_VIEW_WIDTH = 420;
  const TREE_VIEW_HEIGHT = 1040;

  let animatedViewBoxX = $state(0);
  let isAnimating = $state(false);
  let targetX = $state(0);

  const currentViewBox = $derived(
    mobileActiveTree
      ? `${animatedViewBoxX} 0 ${TREE_VIEW_WIDTH} ${TREE_VIEW_HEIGHT}`
      : SVG_VIEWBOX
  );

  $effect(() => {
    const tree = mobileActiveTree;
    if (!tree) {
      untrack(() => { animatedViewBoxX = 0; });
      return;
    }
    const newTargetX = TREE_VIEW_X[tree as 'conditioning' | 'mobility' | 'survival'];
    untrack(() => {
      targetX = newTargetX;
      if (!isAnimating) animateToTarget();
    });
  });

  function animateToTarget() {
    if (isAnimating) return;
    isAnimating = true;
    const startX = animatedViewBoxX;
    const endX = targetX;
    if (startX === endX) {
      isAnimating = false;
      return;
    }
    const duration = 300;
    const start = performance.now();

    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      animatedViewBoxX = startX + (endX - startX) * eased;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animatedViewBoxX = endX;
        isAnimating = false;
        if (targetX !== endX) animateToTarget();
      }
    }
    requestAnimationFrame(step);
  }

  const GATE_RING_STROKE = 5;

  function collectAncestors(startNodeId: string): Set<string> {
    const chain = new Set<string>();
    const seen = new Set<string>();

    const visit = (nodeId: string): void => {
      if (seen.has(nodeId)) return;
      seen.add(nodeId);
      chain.add(nodeId);
      const node = skillNodeMap.get(nodeId);
      if (!node) return;
      for (const prereqId of node.prerequisiteNodeIds) {
        visit(prereqId);
      }
    };

    visit(startNodeId);
    return chain;
  }

  function getNodeRadius(node: SkillNode): number {
    return node.isMajor ? NODE_SIZES.major : NODE_SIZES.minor;
  }

  function handleNodeClick(event: MouseEvent, node: SkillNode): void {
    event.preventDefault();
    buildStore.incrementWanted(node.id);
  }

  function handleNodeContextMenu(event: MouseEvent, node: SkillNode): void {
    event.preventDefault();
    buildStore.decrementWanted(node.id);
  }

  function handleNodeKeydown(event: KeyboardEvent, node: SkillNode): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      buildStore.incrementWanted(node.id);
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      buildStore.decrementWanted(node.id);
    }
  }

  function emitHover(node: SkillNode, event: MouseEvent): void {
    hoveredNodeId = node.id;
    lastHoverPos = { x: event.clientX, y: event.clientY };

    const level = allocations[node.id] ?? 0;
    const gate = checkGateThreshold(node.id, allocations, skillNodeMap);

    onHover({
      node,
      x: event.clientX,
      y: event.clientY,
      level,
      canAllocate: true,
      wanted: wantedSet.has(node.id),
      required: requiredNodes.has(node.id),
      gate,
    });
  }

  function clearHover(): void {
    hoveredNodeId = null;
    lastHoverPos = null;
    onHover(null);
  }

  // Re-emit tooltip when allocations/wanted/required change while hovering
  $effect(() => {
    const nodeId = hoveredNodeId;
    if (!nodeId || !lastHoverPos) return;

    const node = skillNodeMap.get(nodeId);
    if (!node) return;

    const level = allocations[nodeId] ?? 0;
    const gate = checkGateThreshold(nodeId, allocations, skillNodeMap);

    onHover({
      node,
      x: lastHoverPos.x,
      y: lastHoverPos.y,
      level,
      canAllocate: true,
      wanted: wantedSet.has(nodeId),
      required: requiredNodes.has(nodeId),
      gate,
    });
  });

  function getNodeClasses(node: SkillNode): string {
    const level = allocations[node.id] ?? 0;
    const isWanted = wantedSet.has(node.id);
    const isRequired = requiredNodes.has(node.id);
    const hoverActive = hoverChain.has(node.id);
    const gate = node.gateThreshold !== null ? checkGateThreshold(node.id, allocations, skillNodeMap) : null;
    const isAutoFilled = autoFilledNodes.has(node.id);
    const isIdle = level === 0 && !isWanted && !isRequired;

    return [
      'skill-node',
      node.isMajor ? 'major' : 'minor',
      level > 0 ? 'allocated' : '',
      isWanted ? 'wanted' : '',
      isRequired && !isWanted ? 'required' : '',
      hoverActive ? 'hover-path' : '',
      isIdle ? 'idle' : '',
      gate && !gate.unlocked ? 'gate-locked' : '',
      isAutoFilled ? 'auto-filled' : '',
    ].join(' ');
  }

  function getGateProgress(node: SkillNode): { unlocked: boolean; progress: number; pointsNeeded: number } | null {
    if (node.gateThreshold === null) return null;
    const gate = checkGateThreshold(node.id, allocations, skillNodeMap);
    const progress = gate.pointsRequired === 0 ? 1 : Math.min(1, gate.pointsSpent / gate.pointsRequired);
    return { unlocked: gate.unlocked, progress, pointsNeeded: gate.pointsNeeded };
  }
</script>

<svg viewBox={currentViewBox} role="img" aria-label="ARC Raiders skill tree" class="tree-svg" class:mobile={mobileActiveTree !== null}>
  <defs>
    <pattern id="noisePattern" width="60" height="60" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="8" r="1" fill="rgba(255,255,255,0.05)" />
      <circle cx="25" cy="32" r="0.8" fill="rgba(255,255,255,0.04)" />
      <circle cx="48" cy="17" r="0.9" fill="rgba(255,255,255,0.03)" />
      <circle cx="37" cy="49" r="0.9" fill="rgba(255,255,255,0.03)" />
    </pattern>
  </defs>

  <rect x="0" y="0" width="1200" height="1040" fill="url(#noisePattern)" opacity="0.32" pointer-events="none" />

  <g class="connections">
    {#each connections as connection (connection.from + '_' + connection.to)}
      {@const fromLevel = allocations[connection.from] ?? 0}
      {@const toLevel = allocations[connection.to] ?? 0}
      {@const isAllocatedPath = fromLevel > 0 && toLevel > 0}
      {@const hoverHighlight = hoverChain.has(connection.from) && hoverChain.has(connection.to)}
      {@const toNode = skillNodeMap.get(connection.to)}
      <path
        d={connection.d}
        class:active-link={isAllocatedPath}
        class:locked-link={!isAllocatedPath}
        class:hover-link={hoverHighlight}
        style={`--link-color:${toNode ? TREE_COLORS[toNode.category] : '#6f7a91'};`}
      />
    {/each}
  </g>

  <g class="nodes">
    {#each skillNodes as node (node.id)}
      {@const pos = positions[node.id]}
      {@const radius = getNodeRadius(node)}
      {@const level = allocations[node.id] ?? 0}
      {@const accent = TREE_COLORS[node.category]}
      {@const gateProgress = getGateProgress(node)}
      {@const ringRadius = radius + 12}
      {@const ringCircumference = 2 * Math.PI * ringRadius}

      <g
        transform={`translate(${pos.x} ${pos.y})`}
        class={getNodeClasses(node)}
        role="button"
        tabindex="0"
        aria-label={`Skill node ${node.name}`}
        style={`--accent:${accent};`}
        data-node-id={node.id}
        onclick={(event) => handleNodeClick(event, node)}
        onkeydown={(event) => handleNodeKeydown(event, node)}
        oncontextmenu={(event) => handleNodeContextMenu(event, node)}
        onmouseenter={(event) => emitHover(node, event)}
        onmousemove={(event) => emitHover(node, event)}
        onmouseleave={clearHover}
      >
        {#if gateProgress}
          <circle class="gate-ring-track" r={ringRadius} />
          <circle
            class="gate-ring-progress"
            class:met={gateProgress.unlocked}
            r={ringRadius}
            stroke-width={GATE_RING_STROKE}
            stroke-dasharray={ringCircumference}
            stroke-dashoffset={(1 - gateProgress.progress) * ringCircumference}
          />
        {/if}

        <circle class="outer-ring" r={radius + 4} />
        <circle class="node-shape" r={radius} />

        <image
          class="node-icon"
          href={getIconUrl(node.iconName)}
          x={-radius + 7}
          y={-radius + 7}
          width={(radius - 7) * 2}
          height={(radius - 7) * 2}
          preserveAspectRatio="xMidYMid meet"

        />

        <text class="label" x="0" y={radius + 20}>{node.name}</text>

        {#if level > 0 || wantedLevelMap.has(node.id)}
          {@const displayLevel = level > 0 ? level : wantedLevelMap.get(node.id)!}
          {@const isWantedBadge = wantedLevelMap.has(node.id)}
          <g class="level-badge" class:wanted-level={isWantedBadge} transform={`translate(${radius - 8} ${-radius + 8})`}>
            <circle r="10" />
            <text x="0" y="1">{displayLevel}</text>
          </g>
        {/if}

        {#if (mobileActiveTree !== null || viewport.isTouch) && wantedLevelMap.has(node.id)}
          <g
            class="mobile-minus"
            transform={`translate(${-radius - 8} ${-radius + 8})`}
            onclick={(e: MouseEvent) => { e.stopPropagation(); buildStore.decrementWanted(node.id); }}
            onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); buildStore.decrementWanted(node.id); } }}
            role="button"
            tabindex="0"
            aria-label={`Decrease ${node.name} level`}
          >
            <circle r="12" />
            <text x="0" y="1" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="currentColor">−</text>
          </g>
        {/if}

        {#if gateProgress && !gateProgress.unlocked}
          <g class="gate-counter" transform={`translate(${ringRadius + 4} 0)`}>
            <rect x="-12" y="-8" width="24" height="16" rx="8" />
            <text x="0" y="1">{gateProgress.pointsNeeded}</text>
          </g>
        {/if}

        {#if orChoiceMap.has(node.id)}
          {@const choice = orChoiceMap.get(node.id)!}
          {@const btnY = radius + 30}
          {@const leftOptIdx = (positions[choice.options[0]?.[0]]?.x ?? 0) <= (positions[choice.options[1]?.[0]]?.x ?? 0) ? 0 : 1}
          <g class="branch-selector" transform={`translate(0 ${btnY})`}>
            {#each choice.options as _option, optIdx (`branch-${node.id}-${optIdx}`)}
              {@const mappedIdx = optIdx === 0 ? leftOptIdx : 1 - leftOptIdx}
              {@const isSelected = choice.chosenOptionIndex === mappedIdx}
              {@const btnX = (optIdx - (choice.options.length - 1) / 2) * 24}
              <g
                class="branch-btn"
                class:active={isSelected}
                role="button"
                tabindex="0"
                transform={`translate(${btnX} 0)`}
                onclick={(e: MouseEvent) => { e.stopPropagation(); buildStore.setPathOverride(node.id, mappedIdx); }}
                onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); buildStore.setPathOverride(node.id, mappedIdx); } }}
              >
                <circle r="8" />
                <text x="0" y="1" font-size="8" text-anchor="middle" dominant-baseline="middle" fill="currentColor">{optIdx === 0 ? 'L' : 'R'}</text>
              </g>
            {/each}
          </g>
        {/if}
      </g>
    {/each}
  </g>

  <g class="tree-labels" aria-hidden="true">
    {#each TREE_LABELS as label (label.title)}
      <text x={label.x} y="955" font-size="20" font-weight="bold" text-anchor="middle" fill={label.color}>{label.title}</text>
      <text x={label.x} y="1015" font-size="46" font-weight="900" text-anchor="middle" fill={label.color}>{treeStats[label.key]}</text>
    {/each}
  </g>
</svg>

<style>
  .tree-svg {
    width: 100%;
    height: 100%;
    min-height: 34rem;
    display: block;
    user-select: none;
    -webkit-user-select: none;
  }

  .tree-svg.mobile {
    touch-action: none;
  }

  .connections path {
    fill: none;
    transition: opacity 150ms ease, stroke 150ms ease, stroke-width 150ms ease;
  }

  .connections path.active-link {
    stroke: var(--link-color);
    stroke-width: 6;
    filter: drop-shadow(0 0 4px var(--link-color));
  }

  .connections path.locked-link {
    stroke: #667;
    stroke-width: 4;
    opacity: 0.5;
  }

  .connections path.hover-link {
    opacity: 1;
  }

  .skill-node {
    cursor: pointer;
    transform-origin: center;
    transition: opacity 150ms ease;
  }

  .skill-node.gate-locked {
    cursor: not-allowed;
  }

  .skill-node .gate-ring-track {
    fill: none;
    stroke: rgba(80, 90, 110, 0.55);
    stroke-width: 6;
  }

  .skill-node .gate-ring-progress {
    fill: none;
    stroke: #ffb938;
    stroke-width: 6;
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: 0 0;
    transition: stroke-dashoffset 300ms ease, stroke 140ms ease;
    filter: drop-shadow(0 0 5px rgba(255, 185, 56, 0.6));
  }

  .skill-node .gate-ring-progress.met {
    stroke: #5ef0b0;
    filter: drop-shadow(0 0 5px rgba(94, 240, 176, 0.6));
  }

  .gate-counter rect {
    fill: rgba(8, 14, 26, 0.92);
    stroke: #ffb938;
    stroke-width: 1.3;
  }

  .gate-counter text {
    fill: #ffb938;
    font-size: 10px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }

  .skill-node .outer-ring {
    fill: transparent;
    stroke: color-mix(in srgb, #8ca6c9, transparent 70%);
    stroke-width: 2;
    transition: stroke 150ms ease, filter 150ms ease, transform 150ms ease;
  }

  .skill-node .node-shape {
    fill: color-mix(in srgb, var(--accent), #06101f 92%);
    stroke: color-mix(in srgb, var(--accent), transparent 75%);
    stroke-width: 2;
    filter: none;
    transition: transform 150ms ease, stroke 150ms ease, opacity 150ms ease, filter 150ms ease;
  }

  .skill-node .node-icon {
    opacity: 0.94;
    filter: brightness(0) invert(1);
    transition: transform 150ms ease, filter 150ms ease, opacity 150ms ease;
  }

  .skill-node:hover .node-shape,
  .skill-node.hover-path .node-shape,
  .skill-node:hover .outer-ring,
  .skill-node.hover-path .outer-ring,
  .skill-node:hover .node-icon,
  .skill-node.hover-path .node-icon {
    transform: scale(1.05);
  }

  .skill-node:hover .node-shape,
  .skill-node.hover-path .node-shape {
    stroke: #e8f4ff;
    filter: brightness(1.15) drop-shadow(0 0 12px color-mix(in srgb, var(--accent), transparent 70%));
  }

  .skill-node.allocated .node-shape {
    fill: color-mix(in srgb, var(--accent), #09162f 45%);
    stroke: color-mix(in srgb, var(--accent), white 35%);
    filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent), transparent 50%));
  }

  .skill-node.allocated .outer-ring {
    stroke: #dcf2ff;
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent), transparent 55%));
  }
  .skill-node.auto-filled .node-shape {
    fill: color-mix(in srgb, var(--accent), #09162f 78%);
    stroke: color-mix(in srgb, var(--accent), transparent 40%);
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--accent), transparent 65%));
  }

  .skill-node.auto-filled .outer-ring {
    stroke: color-mix(in srgb, var(--accent), transparent 55%);
  }

  .skill-node.auto-filled .node-icon {
    opacity: 0.7;
  }

  .skill-node.auto-filled .label {
    fill: color-mix(in srgb, var(--accent), #d4e2f7 40%);
  }


  .skill-node.required .outer-ring {
    stroke: #7ed8ff;
  }

  .skill-node.wanted .outer-ring {
    stroke: #ffd676;
    stroke-width: 2.8;
    animation: wantedPulse 2.2s ease-in-out infinite;
  }

  .skill-node.gate-locked .node-shape {
    fill: color-mix(in srgb, var(--accent), #06101f 95%);
    stroke: color-mix(in srgb, var(--accent), transparent 80%);
  }

  .skill-node.gate-locked .node-icon {
    opacity: 0.4;
  }



  .label {
    text-anchor: middle;
    fill: color-mix(in srgb, #d4e2f7, transparent 12%);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    pointer-events: none;
    paint-order: stroke;
    stroke: rgba(8, 12, 22, 0.9);
    stroke-width: 3px;
  }

  .level-badge circle {
    fill: #0f1e3f;
    stroke: #f9fcff;
    stroke-width: 1.5;
  }

  .level-badge text {
    fill: #f9fcff;
    text-anchor: middle;
    dominant-baseline: middle;
    font-size: 10px;
    font-weight: 700;
  }

  .tree-labels text {
    text-anchor: middle;
    letter-spacing: 0.12em;
    opacity: 0.92;
  }

  .level-badge.wanted-level circle {
    fill: #b8860b;
    stroke: #ffd76e;
  }

  .level-badge.wanted-level text {
    fill: #fff8e0;
  }

  .branch-selector {
    pointer-events: all;
  }

  .branch-btn {
    cursor: pointer;
  }

  .branch-btn circle {
    fill: #1a2a44;
    stroke: #5a7a9e;
    stroke-width: 1.5;
    transition: fill 120ms ease, stroke 120ms ease;
  }

  .branch-btn:hover circle {
    fill: #243a58;
    stroke: #8ab4e0;
  }

  .branch-btn.active circle {
    fill: color-mix(in srgb, var(--accent), #1a2a44 50%);
    stroke: var(--accent);
  }

  .branch-btn text {
    fill: #8aa4c4;
    pointer-events: none;
  }

  .branch-btn.active text {
    fill: #e8f4ff;
  }

  .mobile-minus {
    cursor: pointer;
  }

  .mobile-minus circle {
    fill: rgba(9, 13, 26, 0.9);
    stroke: rgba(255, 100, 100, 0.5);
    stroke-width: 1.5;
  }

  .mobile-minus text {
    fill: #ff8a8a;
    pointer-events: none;
  }

  .mobile-minus:active circle {
    fill: rgba(255, 80, 80, 0.25);
  }

  @keyframes wantedPulse {
    0%,
    100% {
      filter: drop-shadow(0 0 0 rgba(255, 214, 118, 0));
      stroke-width: 2.8;
    }

    50% {
      filter: drop-shadow(0 0 8px rgba(255, 214, 118, 0.62));
      stroke-width: 3.3;
    }
  }
</style>
