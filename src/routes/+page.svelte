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
  import { onMount } from 'svelte';
  import TutorialOverlay from '$lib/components/TutorialOverlay.svelte';
  import { tutorialStore } from '$lib/stores/tutorialStore.svelte';

  buildStore.initEffects();
  onMount(() => {
    if (!viewport.isMobile && !viewport.isTouch) tutorialStore.checkAutoShow();
    if (viewport.isMobile && typeof localStorage !== 'undefined' && !localStorage.getItem('arc-mobile-banner-dismissed')) {
      showMobileBanner = true;
    }
  });

  function dismissMobileBanner() {
    showMobileBanner = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('arc-mobile-banner-dismissed', 'true');
    }
  }

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
  let showMobileBanner = $state(false);

</script>

<svelte:head>
  <title>ARC Raiders Skill Tree Planner — Raider Tools</title>
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ARC Raiders Skill Tree Planner",
    "description": "The only ARC Raiders skill planner that automatically optimizes your build. Pick the skills you want, and the pathfinder calculates the cheapest route through the tree — no wasted points.",
    "url": "https://skilltree.raidertools.net",
    "applicationCategory": "GameApplication",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Person",
      "name": "Illic Lanthresh"
    },
    "about": {
      "@type": "VideoGame",
      "name": "ARC Raiders"
    }
  })}</script>`}
</svelte:head>

<div class="app-shell">
  <div class="status-bar-tint" aria-hidden="true"></div>
  <span class="beta-badge">BETA</span>
  <h1 class="seo-h1">ARC Raiders Skill Tree Planner</h1>
  {#if showMobileBanner}
    <div class="mobile-banner">
      <div class="mobile-banner-text">
        <p>For the best experience, visit on desktop.</p>
        <p>The interactive tutorial is only available there and it's worth taking. It explains how the optimizer works and what makes this planner different from ordinary skill tree tools.</p>
        <p>Mobile support is still a work in progress.</p>
      </div>
      <button class="mobile-banner-close" onclick={dismissMobileBanner} aria-label="Dismiss">✕</button>
    </div>
  {/if}
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
      onShowKofi={() => { showKofi = true; }}
    />
  {/if}

  <footer class="footer">
    <div class="footer-actions">
      {#if impossibleBuild}
        <span class="warning">Build exceeds budget — remove some nodes or add expedition points.</span>
      {:else}
        <button class="kofi-btn" onclick={() => showKofi = true}>☕ Support me</button>
      {/if}
      {#if !viewport.isMobile}
        <button
          class="tutorial-btn"
          onclick={() => tutorialStore.start()}
          data-testid="tutorial-relaunch"
          aria-label="Restart tutorial"
        >?</button>
      {/if}
      <a
        class="report-btn"
        href="https://github.com/IllicLanthresh/ARC-skilltree/issues/new?title=%5BBug%5D+&labels=bug"
        target="_blank"
        rel="noopener noreferrer"
      >Report bug</a>
    </div>
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

{#if !viewport.isMobile && !viewport.isTouch && !tutorialStore.isActive}<Tooltip data={hoveredNode} />{/if}

{#if !viewport.isMobile}<TutorialOverlay />{/if}

<style>
  .app-shell {
    height: 100dvh;
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

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
      padding-bottom: calc(36px + env(safe-area-inset-bottom, 0px));
    }

    .footer {
      display: none;
    }
  }

  .tutorial-btn {
    background: rgba(100, 140, 200, 0.12);
    border: 1px solid rgba(120, 160, 220, 0.3);
    border-radius: 999px;
    color: #8eb0d8;
    font-size: 0.78rem;
    font-weight: 700;
    width: 1.7rem;
    height: 1.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s;
  }
  .tutorial-btn:hover {
    background: rgba(120, 160, 220, 0.22);
    border-color: rgba(140, 180, 240, 0.5);
    color: #b0d0f0;
  }

  .report-btn {
    background: transparent;
    border: 1px solid rgba(120, 160, 220, 0.2);
    border-radius: 999px;
    color: #7a95b8;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.22rem 0.6rem;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }
  .report-btn:hover {
    background: rgba(120, 160, 220, 0.12);
    border-color: rgba(140, 180, 240, 0.4);
    color: #a0c0e0;
  }

  .beta-badge {
    position: fixed;
    top: 0.7rem;
    left: 0.7rem;
    z-index: 35;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(180, 210, 255, 0.55);
    background: rgba(15, 25, 50, 0.5);
    border: 1px solid rgba(100, 150, 220, 0.15);
    border-radius: 4px;
    padding: 0.18rem 0.5rem;
    backdrop-filter: blur(6px);
    pointer-events: none;
    user-select: none;
  }

  .seo-h1 {
    position: fixed;
    top: 0.7rem;
    left: 5.5rem;
    z-index: 35;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: rgba(180, 210, 255, 0.30);
    pointer-events: none;
    user-select: none;
    margin: 0;
    white-space: nowrap;
  }

  .mobile-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: linear-gradient(160deg, rgba(20, 40, 80, 0.95), rgba(12, 24, 50, 0.97));
    border-bottom: 1px solid rgba(100, 150, 220, 0.25);
    backdrop-filter: blur(8px);
  }

  .mobile-banner-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .mobile-banner-text p {
    margin: 0;
    font-size: 0.72rem;
    line-height: 1.45;
    color: #b8cfe8;
  }

  .mobile-banner-close {
    background: transparent;
    border: none;
    color: #7a95b8;
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }

  .status-bar-tint {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: env(safe-area-inset-top, 3px);
    min-height: 3px;
    background-color: #0a0e1a;
    z-index: 9999;
    pointer-events: none;
  }

</style>
