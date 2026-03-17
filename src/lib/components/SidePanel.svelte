<script lang="ts">
  import { buildStore } from '$lib/state/buildStore.svelte';
  import { BASE_SKILL_POINTS, MAX_EXPEDITION_BONUS } from '$lib/data/skillData';
  import { viewport } from '$lib/stores/viewport.svelte';
  import { trackEvent } from '$lib/analytics';

  const maxBudget = $derived(buildStore.maxBudget);
  const wantedNodes = $derived(buildStore.wantedNodes);
  const fillerNeeded = $derived(buildStore.fillerNeeded);
  const gateDetails = $derived(buildStore.gateDetails);
  const breakdown = $derived(buildStore.costBreakdown);

  const fillerTotal = $derived((fillerNeeded.conditioning ?? 0) + (fillerNeeded.mobility ?? 0) + (fillerNeeded.survival ?? 0));
  const totalCost = $derived(breakdown.wantedCost + breakdown.prereqCost + fillerTotal);
  const feasible = $derived(totalCost <= maxBudget);

  let shareLabel = $state('Share Build');

  let panelEl: HTMLElement | null = $state(null);
  let isOverlapping = $state(false);
  let isHovered = $state(false);
  let isOpenTouch = $state(false);

  function checkOverlap(): void {
    if (!panelEl || viewport.isMobile) { isOverlapping = false; return; }
    // Find the rightmost rendered node by checking actual bounding rects.
    const nodes = document.querySelectorAll('g[class*="skill-node"]');
    if (nodes.length === 0) { isOverlapping = false; return; }
    let maxRight = 0;
    nodes.forEach(n => {
      const right = n.getBoundingClientRect().right;
      if (right > maxRight) maxRight = right;
    });
    // Where the panel's left edge WOULD be when visible (right: 1rem = 16px)
    const panelLeft = window.innerWidth - panelEl.offsetWidth - 16;
    // Hide the box a bit before it actually touches nodes (20px buffer)
    isOverlapping = panelLeft < maxRight + 20;
  }

  $effect(() => {
    if (!panelEl || viewport.isMobile) return;

    const observer = new ResizeObserver(() => checkOverlap());
    observer.observe(document.documentElement);
    checkOverlap();

    return () => observer.disconnect();
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

    if (copied) trackEvent('shared_build', 'Shared Build');
    shareLabel = copied ? 'Copied!' : 'Copy failed';
    setTimeout(() => { shareLabel = 'Share Build'; }, 1500);
  }
</script>

{#if viewport.isTouch && !viewport.isMobile && isOpenTouch}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="panel-backdrop" onclick={() => { isOpenTouch = false; }}></div>
{/if}
<aside
  class="panel"
  class:drawer={(isOverlapping || viewport.isTouch) && !viewport.isMobile}
  class:drawer-open={(isOverlapping || viewport.isTouch) && !viewport.isMobile && (viewport.isTouch ? isOpenTouch : isHovered)}
  bind:this={panelEl}
  onmouseenter={() => { if (!viewport.isTouch) isHovered = true; }}
  onmouseleave={() => { if (!viewport.isTouch) isHovered = false; }}
  aria-label="Build info"
  data-tutorial-target="panel"
>
  {#if viewport.isTouch && !viewport.isMobile}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="drawer-tab" onclick={() => { isOpenTouch = !isOpenTouch; }}>
      {isOpenTouch ? '⟩' : '⟨'}
    </div>
  {/if}
  <div class="panel-scroll">
    {#if wantedNodes.length > 0}
      <section class="block" data-tutorial-target="cost-section">
        <div class="section-title">Build Cost</div>
        <div class="cost-total" class:over-budget={!feasible}>
          <span>Total</span>
          <strong>{totalCost} / {maxBudget}</strong>
        </div>

        <div class="cost-breakdown">
          <div class="cost-row">
            <span>Your selections</span>
            <span>{breakdown.wantedCost}</span>
          </div>
          {#if breakdown.prereqCost > 0}
            <div class="cost-row prereq">
              <span>Required path</span>
              <span>{breakdown.prereqCost}</span>
            </div>
          {/if}
          {#if fillerTotal > 0}
            <div class="cost-row filler">
              <span>Points to unlock gates</span>
              <span>+{fillerTotal}</span>
            </div>
            {#each gateDetails as gate (gate.nodeId)}
              <div class="cost-detail">
                <span>{gate.nodeName} ({gate.pointsBefore}/{gate.threshold})</span>
                <span>+{gate.pointsNeeded}</span>
              </div>
            {/each}
          {/if}
        </div>

        <div class="cost-verdict">
          {#if feasible}
            <span class="verdict-ok">{maxBudget - totalCost} points remaining</span>
          {:else}
            <span class="verdict-bad">Over budget by {totalCost - maxBudget}</span>
          {/if}
        </div>
      </section>
    {/if}

    <section class="block expedition-block" data-tutorial-target="expedition-section">
      <label class="exp-label" for="expedition-input">Expedition Bonus</label>
      <div class="exp-row">
        <input
          id="expedition-input"
          type="number"
          min="0"
          max={MAX_EXPEDITION_BONUS}
          value={buildStore.expeditionBonus}
          oninput={updateExpeditionBonus}
        />
        <span class="exp-total">{BASE_SKILL_POINTS} + {buildStore.expeditionBonus} = {maxBudget}</span>
      </div>
    </section>

    <section class="block actions-block" data-tutorial-target="actions-section">
      <button type="button" class="action-btn" onclick={copyShareUrl}>{shareLabel}</button>
      <button type="button" class="action-btn danger-btn" onclick={() => buildStore.resetAll()}>Reset</button>
    </section>
  </div>
</aside>

<style>
  .panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgba(0, 0, 0, 0.3);
  }

  .panel {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 40;
    width: 18rem;
    max-height: calc(100vh - 2rem);
    overflow: visible;
    background: linear-gradient(160deg, rgba(9, 13, 26, 0.92), rgba(12, 18, 34, 0.96));
    backdrop-filter: blur(12px);
    border: 1px solid color-mix(in srgb, #91a9cf, transparent 72%);
    border-radius: 0.8rem;
    padding: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    transition: right 0.25s ease;
  }

  .panel-scroll {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    overflow-y: auto;
    max-height: calc(100vh - 2rem - 1.3rem);
  }

  .panel.drawer {
    right: -16.5rem; /* mostly hidden, leaving ~1.5rem for the tab */
  }

  .panel.drawer.drawer-open {
    right: 0; /* flush to viewport edge — prevents hover loop in the gap */
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    padding-right: calc(0.65rem + 1rem); /* compensate visually for the lost margin */
  }

  /* Drawer tab visual */
  .panel.drawer::before {
    content: '⟨';
    position: absolute;
    left: -1.4rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.4rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(9, 13, 26, 0.92);
    border: 1px solid color-mix(in srgb, #91a9cf, transparent 72%);
    border-right: none;
    border-radius: 0.4rem 0 0 0.4rem;
    color: #8ea8cc;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .panel.drawer.drawer-open::before {
    content: '⟩';
  }

  .drawer-tab {
    position: absolute;
    left: -1.5rem;
    bottom: 0.5rem;
    width: 1.5rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, rgba(9, 13, 26, 0.92), rgba(12, 18, 34, 0.96));
    border: 1px solid color-mix(in srgb, #91a9cf, transparent 72%);
    border-right: none;
    border-radius: 0.4rem 0 0 0.4rem;
    color: #8ea8cc;
    font-size: 0.9rem;
    cursor: pointer;
  }

  @media (pointer: coarse) {
    .panel.drawer::before {
      display: none;
    }
  }

  .block {
    border: 1px solid color-mix(in srgb, #93acd0, transparent 74%);
    border-radius: 0.7rem;
    background: linear-gradient(150deg, rgba(15, 22, 40, 0.84), rgba(11, 17, 29, 0.9));
    padding: 0.55rem;
    display: grid;
    gap: 0.4rem;
  }

  .section-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8ea0bd;
  }

  .cost-total {
    display: flex;
    justify-content: space-between;
    font-size: 0.88rem;
    padding: 0.42rem 0.52rem;
    border-radius: 0.5rem;
    background: rgba(139, 216, 255, 0.06);
    border: 1px solid rgba(139, 216, 255, 0.18);
    color: #c8daf0;
  }

  .cost-total.over-budget {
    background: rgba(255, 100, 100, 0.08);
    border-color: rgba(255, 100, 100, 0.3);
  }

  .cost-total.over-budget strong { color: #ff9f9f; }

  .cost-breakdown {
    display: grid;
    gap: 0.25rem;
    font-size: 0.76rem;
  }

  .cost-row, .cost-detail {
    display: flex;
    justify-content: space-between;
    color: #b0c4de;
  }

  .cost-row.prereq { color: #a8c8e8; }
  .cost-row.filler { color: #ffc89a; }

  .cost-detail {
    padding-left: 0.7rem;
    font-size: 0.7rem;
    color: #8a9fba;
  }

  .cost-verdict {
    text-align: center;
    font-size: 0.76rem;
    padding: 0.2rem;
  }

  .verdict-ok { color: #2afe7f; }
  .verdict-bad { color: #ff8b8b; font-weight: 600; }

  .expedition-block {
    gap: 0.35rem;
  }

  .exp-label {
    font-size: 0.72rem;
    color: #8ea0bd;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .exp-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .exp-row input {
    width: 4rem;
    border: 1px solid color-mix(in srgb, #8eaad1, transparent 66%);
    border-radius: 0.35rem;
    background: rgba(9, 14, 24, 0.8);
    color: #e6f1ff;
    padding: 0.28rem 0.38rem;
    font-size: 0.78rem;
  }

  .exp-total {
    color: #8a9fb8;
    font-size: 0.7rem;
  }

  .actions-block {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    flex: 1;
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
</style>
