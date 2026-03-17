<script lang="ts">
  import SkillTree from '$lib/components/SkillTree.svelte';
  import SidePanel from '$lib/components/SidePanel.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import RotateOverlay from '$lib/components/RotateOverlay.svelte';
  import type { TooltipData } from '$lib/components/Tooltip.svelte';
  import { buildStore } from '$lib/state/buildStore.svelte';
  import { viewport } from '$lib/stores/viewport.svelte';
  import { swipe } from '$lib/actions/swipe';

  buildStore.initEffects();

  let hoveredNode = $state<TooltipData | null>(null);

  const MOBILE_TREES = ['conditioning', 'mobility', 'survival'] as const;
  type MobileTree = typeof MOBILE_TREES[number];
  let mobileActiveTree = $state<MobileTree>('conditioning');

  function handleSwipeLeft() {
    const i = MOBILE_TREES.indexOf(mobileActiveTree);
    mobileActiveTree = MOBILE_TREES[(i + 1) % 3];
  }

  function handleSwipeRight() {
    const i = MOBILE_TREES.indexOf(mobileActiveTree);
    mobileActiveTree = MOBILE_TREES[(i + 2) % 3];
  }

  const treeStats = $derived(buildStore.treeStats);
  const impossibleBuild = $derived(
    buildStore.wantedNodes.length > 0 && buildStore.computedPaths.totalCost > buildStore.maxBudget
  );
  const isEmptyState = $derived(
    Object.keys(buildStore.allocations).length === 0 && buildStore.wantedNodes.length === 0
  );

  let showKofi = $state(false);

</script>

<svelte:head><title>ARC Raiders Skill Tree Planner — Raider Tools</title></svelte:head>

<div class="app-shell">
  <RotateOverlay />
  <main class="content-grid">
    <section class="tree-canvas" aria-label="Skill tree canvas">
      {#if viewport.isMobile}
        <div
          class="swipe-capture"
          use:swipe
          onswipeleft={handleSwipeLeft}
          onswiperight={handleSwipeRight}
        >
          <SkillTree
            onHover={(next) => (hoveredNode = next)}
            {treeStats}
            {mobileActiveTree}
          />
        </div>
      {:else}
        <SkillTree onHover={(next) => (hoveredNode = next)} {treeStats} />

        {#if isEmptyState}
          <div class="empty-state" role="status" aria-live="polite">
            Click any node to add it to your build. Right-click to remove.
          </div>
        {/if}
      {/if}
    </section>
  </main>

  {#if !viewport.isMobile}<SidePanel />{/if}

  {#if viewport.isMobile}
    <BottomSheet
      activeTree={mobileActiveTree}
      onTreeChange={(t) => { mobileActiveTree = t; }}
    />
  {/if}

  <footer class="footer">
    {#if impossibleBuild}
      <span class="warning">Build exceeds budget — remove some nodes or add expedition points.</span>
    {:else}
      <button class="kofi-btn" onclick={() => showKofi = true}>☕ Support me</button>
    {/if}
    <span class="attribution">ARC Raiders is a trademark of Embark Studios. Game assets belong to their respective owners.</span>
  </footer>
</div>

{#if showKofi}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="kofi-overlay" onclick={() => showKofi = false} onkeydown={(e) => { if (e.key === 'Escape') showKofi = false; }} role="dialog" aria-label="Support on Ko-fi" tabindex="-1">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="kofi-modal" onclick={(e) => e.stopPropagation()}>
      <button class="kofi-close" onclick={() => showKofi = false} aria-label="Close">✕</button>
      <iframe
        src="https://ko-fi.com/illiclanthresh/?hidefeed=true&widget=true&embed=true&preview=true"
        title="Support on Ko-fi"
        class="kofi-iframe"
      ></iframe>
    </div>
  </div>
{/if}

{#if !viewport.isMobile}<Tooltip data={hoveredNode} />{/if}

<style>
  .app-shell {
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 1rem;
    padding: 0.4rem;
    background:
      radial-gradient(circle at 14% 18%, rgba(47, 73, 119, 0.3), transparent 42%),
      radial-gradient(circle at 83% 12%, rgba(78, 95, 128, 0.2), transparent 36%),
      linear-gradient(180deg, #0a0e1a 0%, #1a1e2e 100%);
  }

  .content-grid {
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .tree-canvas {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 14% 18%, rgba(47, 73, 119, 0.3), transparent 42%),
      radial-gradient(circle at 83% 12%, rgba(78, 95, 128, 0.2), transparent 36%),
      linear-gradient(180deg, #0a0e1a 0%, #1a1e2e 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .empty-state {
    position: absolute;
    inset: 1rem;
    display: grid;
    place-items: center;
    text-align: center;
    border-radius: 0.8rem;
    border: 1px solid color-mix(in srgb, #8da9d6, transparent 64%);
    background: color-mix(in srgb, #081022, transparent 18%);
    color: #d8e8ff;
    backdrop-filter: blur(4px);
    padding: 0.9rem;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .empty-state {
    inset: auto 1rem 1rem 1rem;
    background: color-mix(in srgb, #1f2e4a, transparent 26%);
    color: #ebf4ff;
    font-size: 0.82rem;
    padding: 0.55rem 0.75rem;
  }

  .footer {
    color: #90a6c6;
    font-size: 0.78rem;
    text-align: right;
    padding: 0 0.2rem;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }



  .kofi-btn {
    background: rgba(180, 120, 40, 0.15);
    border: 1px solid rgba(200, 150, 60, 0.35);
    border-radius: 999px;
    color: #e8c87a;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.28rem 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 0 8px rgba(200, 150, 50, 0.15), inset 0 0 6px rgba(200, 150, 50, 0.06);
    transition: box-shadow 0.25s ease, background 0.25s ease, border-color 0.25s ease;
  }

  .kofi-btn:hover {
    background: rgba(200, 140, 50, 0.22);
    border-color: rgba(220, 170, 70, 0.5);
    box-shadow: 0 0 14px rgba(210, 160, 60, 0.3), inset 0 0 8px rgba(210, 160, 60, 0.1);
    color: #f5dda0;
  }

  .kofi-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }

  .kofi-modal {
    position: relative;
    width: 340px;
    max-width: 92vw;
    max-height: 85vh;
    border-radius: 0.8rem;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .kofi-close {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    z-index: 1;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    color: #fff;
    font-size: 1rem;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kofi-close:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  .kofi-iframe {
    border: none;
    width: 100%;
    height: 712px;
    max-height: 85vh;
  }

  .attribution {
    font-size: 0.62rem;
    color: #697a94;
  }

  .warning {
    color: #ffb3b3;
  }

  .swipe-capture {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    width: 100%;
    height: 100%;
  }

  @media (max-width: 767px) {
    .app-shell {
      padding-bottom: calc(52px + env(safe-area-inset-bottom, 0px));
    }

    .footer {
      padding-bottom: calc(0.2rem + env(safe-area-inset-bottom, 0px));
    }
  }

</style>
