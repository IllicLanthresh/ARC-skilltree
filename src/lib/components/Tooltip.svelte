<script lang="ts">
  import type { SkillNode } from '$lib/types';

  export interface TooltipData {
    node: SkillNode;
    level: number;
    canAllocate: boolean;
    wanted: boolean;
    required: boolean;
    gate: {
      unlocked: boolean;
      pointsSpent: number;
      pointsRequired: number;
      pointsNeeded: number;
    };
    x: number;
    y: number;
  }

  let { data = null }: { data: TooltipData | null } = $props();
</script>

{#if data}
  <aside
    class="tooltip"
    style={(() => {
      const center = data.node.category === 'CONDITIONING' ? 25 : data.node.category === 'MOBILITY' ? 50 : 75;
      const px = data.node.position.x;
      if (px === center) return `left:${Math.round(data.x - 160)}px;top:${Math.round(data.y - 18)}px;transform:translateY(-100%);`;
      if (px < center) return `right:${Math.round(window.innerWidth - data.x + 18)}px;top:${Math.round(data.y + 18)}px;`;
      return `left:${Math.round(data.x + 18)}px;top:${Math.round(data.y + 18)}px;`;
    })()}
    role="status"
    aria-live="polite"
  >
    <p class="name">{data.node.name}</p>
    <p class="meta">{data.node.category} • {data.level}/{data.node.maxPoints}</p>
    <p class="desc">{data.node.description}</p>
  </aside>
{/if}

<style>
  .tooltip {
    position: fixed;
    z-index: 45;
    width: min(25rem, calc(100vw - 2rem));
    pointer-events: none;
    border: 1px solid color-mix(in srgb, #b6d2ff, transparent 65%);
    border-radius: 0.75rem;
    background: linear-gradient(155deg, rgba(9, 14, 27, 0.96), rgba(18, 30, 56, 0.94));
    box-shadow: 0 14px 44px rgba(0, 0, 0, 0.45);
    padding: 0.7rem 0.85rem;
    display: grid;
    gap: 0.45rem;
  }

  .name {
    font-size: 0.98rem;
    font-weight: 700;
    color: #f4f8ff;
  }

  .meta {
    font-size: 0.74rem;
    letter-spacing: 0.04em;
    color: #9dc2ff;
    text-transform: uppercase;
  }

  .desc {
    color: #ced9ec;
    line-height: 1.4;
    font-size: 0.84rem;
  }
</style>
