<script lang="ts">
  import { onMount } from 'svelte';
  import SkillTree from '$lib/components/SkillTree.svelte';
  import SidePanel from '$lib/components/SidePanel.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import type { TooltipData } from '$lib/components/Tooltip.svelte';
  import { buildStore } from '$lib/state/buildStore.svelte';
  import { BASE_SKILL_POINTS, MAX_EXPEDITION_BONUS } from '$lib/data/skillData';

  buildStore.initEffects();

  let hoveredNode = $state<TooltipData | null>(null);
  let isDesktop = $state(true);
  let shareLabel = $state('Share Build');

  const treeStats = $derived(buildStore.treeStats);
  const maxBudget = $derived(buildStore.maxBudget);
  const totalNodes = $derived(Object.keys(buildStore.allocations).length);
  const wantedCount = $derived(buildStore.wantedNodes.length);
  const overBudget = $derived(treeStats.total > maxBudget);
  const impossibleBuild = $derived(wantedCount > 0 && buildStore.computedPaths.totalCost > maxBudget);
  const isEmptyState = $derived(totalNodes === 0 && wantedCount === 0);

  function updateDesktopState(): void {
    if (typeof window === 'undefined') return;
    isDesktop = window.innerWidth >= 1024;
  }

  onMount(() => {
    updateDesktopState();
    window.addEventListener('resize', updateDesktopState);
    return () => window.removeEventListener('resize', updateDesktopState);
  });

  function updateExpeditionBonus(event: Event): void {
    const next = Number((event.currentTarget as HTMLInputElement).value);
    buildStore.setExpeditionBonus(next);
  }

  async function copyShareUrl(): Promise<void> {
    if (typeof window === 'undefined') return;

    const url = window.location.href;
    let copied = false;

    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    shareLabel = copied ? 'Copied!' : 'Copy failed';
    setTimeout(() => { shareLabel = 'Share Build'; }, 1500);
  }
</script>

<div class="app-shell">
  <header class="top-bar">
    <h1>ARC Skill Planner</h1>

    <div class="header-actions">
      <button type="button" class="action-btn" onclick={copyShareUrl}>{shareLabel}</button>
      <button type="button" class="action-btn danger-btn" onclick={() => buildStore.resetAll()}>Reset</button>
    </div>
  </header>

  <main class="content-grid">
    <section class="tree-canvas" aria-label="Skill tree canvas">
      {#if !isDesktop}
        <div class="desktop-gate" role="status">This tool is designed for desktop</div>
      {:else}
        <SkillTree onHover={(next) => (hoveredNode = next)} />

        {#if isEmptyState}
          <div class="empty-state" role="status" aria-live="polite">
            Click any node to add it to your build. Right-click to remove.
          </div>
        {/if}
      {/if}
    </section>

    <section class="side-panel-wrap">
      <SidePanel />
    </section>
  </main>

  <footer class="footer">
    {#if impossibleBuild}
      <span class="warning">Build exceeds budget — remove some nodes or add expedition points.</span>
    {:else}
      Left click to add, right click to remove
    {/if}
    <span class="attribution">ARC Raiders is a trademark of Embark Studios. Game assets belong to their respective owners.</span>
  </footer>
</div>

<Tooltip data={hoveredNode} />

<style>
  .app-shell {
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 1rem;
    padding: 1rem 1.1rem 0.9rem;
    background:
      radial-gradient(circle at 14% 18%, rgba(47, 73, 119, 0.3), transparent 42%),
      radial-gradient(circle at 83% 12%, rgba(78, 95, 128, 0.2), transparent 36%),
      linear-gradient(180deg, #0a0e1a 0%, #1a1e2e 100%);
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.9rem;
    padding: 0.4rem 0.6rem;
  }

  .top-bar h1 {
    font-size: 0.92rem;
    color: #8ea8cc;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }



  .action-btn {
    border: 1px solid color-mix(in srgb, #8aa9d4, transparent 55%);
    border-radius: 0.5rem;
    background: linear-gradient(145deg, #162744, #0f1d33);
    color: #eaf3ff;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.48rem 0.66rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .danger-btn {
    border-color: color-mix(in srgb, #f39b9b, transparent 45%);
    background: linear-gradient(145deg, #371f29, #2b1821);
    color: #ffd4d4;
  }

  .content-grid {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 23rem;
    gap: 1rem;
  }

  .tree-canvas {
    position: relative;
    border: 1px solid color-mix(in srgb, #91a8ca, transparent 74%);
    border-radius: 1rem;
    overflow: hidden;
    background: linear-gradient(180deg, #0a0e1a, #1a1e2e);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .desktop-gate,
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

  .side-panel-wrap {
    min-height: 0;
    border: 1px solid color-mix(in srgb, #91a9cf, transparent 72%);
    border-radius: 1rem;
    padding: 0.65rem;
    background: linear-gradient(160deg, rgba(9, 13, 23, 0.88), rgba(13, 20, 35, 0.9));
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

  .attribution {
    font-size: 0.62rem;
    color: #697a94;
  }

  .warning {
    color: #ffb3b3;
  }

</style>
