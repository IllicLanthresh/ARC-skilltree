<script lang="ts">
  import type { SkillNode } from '$lib/types';
  import { getPrerequisites } from '$lib/data/skillData';
  import { buildStore } from '$lib/state/buildStore.svelte';

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
  const allocations = $derived(buildStore.allocations);
  const prerequisites = $derived.by(() => {
    if (!data) return [];

    return getPrerequisites(data.node.id).map((node) => ({
      node,
      met: (allocations[node.id] ?? 0) >= node.maxPoints,
    }));
  });
</script>

{#if data}
  <aside
    class="tooltip"
    style={`left:${Math.round(data.x + 18)}px;top:${Math.round(data.y + 18)}px;`}
    role="status"
    aria-live="polite"
  >
    <p class="name">{data.node.name}</p>
    <p class="meta">{data.node.category} • {data.level}/{data.node.maxPoints}</p>
    <p class="desc">{data.node.description}</p>
    <div class="prereqs">
      <p class="prereq-title">Prerequisites</p>
      {#if prerequisites.length === 0}
        <p class="prereq-empty">None</p>
      {:else}
        <ul>
          {#each prerequisites as prereq (prereq.node.id)}
            <li class:met={prereq.met} class:unmet={!prereq.met}>
              {prereq.met ? '✓' : '✗'} {prereq.node.name}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="flags">
      <span class:wanted={data.wanted}>Wanted: {data.wanted ? 'yes' : 'no'}</span>
      <span class:required={data.required}>Path: {data.required ? 'required' : 'optional'}</span>
      <span class:locked={!data.canAllocate}>Spend: {data.canAllocate ? 'available' : 'locked'}</span>
      {#if data.node.gateThreshold !== null}
        <span class:locked={!data.gate.unlocked}>
          Gate {data.gate.pointsSpent}/{data.gate.pointsRequired}
        </span>
      {/if}
    </div>
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

  .prereqs {
    display: grid;
    gap: 0.28rem;
  }

  .prereq-title {
    font-size: 0.72rem;
    color: #b2c8ea;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .prereq-empty {
    color: #98aac8;
    font-size: 0.74rem;
  }

  .prereqs ul {
    list-style: none;
    display: grid;
    gap: 0.2rem;
    margin: 0;
    padding: 0;
  }

  .prereqs li {
    font-size: 0.76rem;
    color: #c8d7ef;
  }

  .prereqs li.met {
    color: #9fe6ba;
  }

  .prereqs li.unmet {
    color: #ffb6b6;
  }

  .flags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: #c5d0e6;
  }

  .flags span {
    border: 1px solid color-mix(in srgb, #99b4e4, transparent 72%);
    border-radius: 999px;
    padding: 0.2rem 0.45rem;
    background: rgba(255, 255, 255, 0.05);
  }

  .flags span.wanted {
    border-color: color-mix(in srgb, #ffc14f, transparent 38%);
    color: #ffd896;
  }

  .flags span.required {
    border-color: color-mix(in srgb, #5fd5ff, transparent 40%);
    color: #9de8ff;
  }

  .flags span.locked {
    border-color: color-mix(in srgb, #ff6b6b, transparent 40%);
    color: #ffc0c0;
  }
</style>
