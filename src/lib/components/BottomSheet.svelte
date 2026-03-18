<script lang="ts">
  import { buildStore } from '$lib/state/buildStore.svelte';
  import { BASE_SKILL_POINTS, MAX_EXPEDITION_BONUS } from '$lib/data/skillData';
  import { trackEvent } from '$lib/analytics';

  interface Props {
    activeTree: 'conditioning' | 'mobility' | 'survival';
    onTreeChange: (tree: 'conditioning' | 'mobility' | 'survival') => void;
    onShowKofi?: () => void;
  }

  let { activeTree, onTreeChange, onShowKofi }: Props = $props();

  const TREES = ['conditioning', 'mobility', 'survival'] as const;
  type Tree = typeof TREES[number];

  const TREE_COLORS: Record<Tree, string> = {
    conditioning: '#2afe7f',
    mobility: '#fdd333',
    survival: '#f4101b'
  };

  let openAmount = $state(0);
  let isDragging = $state(false);
  let shareLabel = $state('Share');

  let touchStartY = 0;
  let startOpenAmount = 0;
  const DRAG_DISTANCE = 250;

  const isOpen = $derived(openAmount > 0.5);

  function handleTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    startOpenAmount = openAmount;
    isDragging = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const deltaY = touchStartY - e.touches[0].clientY;
    const deltaRatio = deltaY / DRAG_DISTANCE;
    openAmount = Math.max(0, Math.min(1, startOpenAmount + deltaRatio));
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    openAmount = openAmount > 0.3 ? 1 : 0;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openAmount = openAmount > 0.5 ? 0 : 1;
    }
  }

  // Close sheet when active tree changes
  $effect(() => {
    activeTree;
    openAmount = 0;
  });

  const maxBudget = $derived(buildStore.maxBudget);
  const breakdown = $derived(buildStore.costBreakdown);
  const wantedNodes = $derived(buildStore.wantedNodes);
  const fillerNeeded = $derived(buildStore.fillerNeeded);

  const fillerTotal = $derived(
    (fillerNeeded.conditioning ?? 0) +
    (fillerNeeded.mobility ?? 0) +
    (fillerNeeded.survival ?? 0)
  );

  const totalCost = $derived(breakdown.wantedCost + breakdown.prereqCost + fillerTotal);
  const feasible = $derived(totalCost <= maxBudget);
  const gateDetails = $derived(buildStore.gateDetails);



  async function copyShareUrl(): Promise<void> {
    if (typeof window === 'undefined') return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'ARC Raiders Skill Tree', url });
        trackEvent('shared_build', 'Shared Build');
        shareLabel = 'Shared!';
        setTimeout(() => { shareLabel = 'Share'; }, 1500);
      } catch {
        // User cancelled — do nothing
      }
      return;
    }

    // Fallback only if share API not available at all
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
    setTimeout(() => { shareLabel = 'Share'; }, 1500);
  }
</script>

{#if openAmount > 0}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sheet-backdrop"
    style="opacity: {openAmount}"
    onclick={() => { openAmount = 0; }}
  ></div>
{/if}
<div class="bottom-sheet" class:open={isOpen}>
  <div
    class="drag-zone"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    onclick={() => { openAmount = openAmount > 0.5 ? 0 : 1; }}
    onkeydown={handleKeyDown}
    role="button"
    tabindex="0"
    aria-label="Drag to expand controls"
  >
    <span class="drag-pill"></span>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="slim-bar"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <div class="dots">
      {#each TREES as tree}
        <button
          class="dot"
          class:active={tree === activeTree}
          style="--dot-color: {TREE_COLORS[tree]}"
          onclick={() => onTreeChange(tree)}
          aria-label="Switch to {tree} tree"
        ></button>
      {/each}
    </div>
    <span class="points-summary">{totalCost} / {maxBudget} pts</span>
  </div>

  <div
    class="sheet-content"
    style="max-height: {openAmount * 60}vh; {isDragging ? '' : 'transition: max-height 0.3s ease;'}"
  >
    <section class="sheet-block">
      <label class="block-label">Expedition Bonus</label>
      <div class="exp-row">
        <div class="exp-stepper">
          <button class="exp-step-btn" onclick={() => buildStore.setExpeditionBonus(buildStore.expeditionBonus - 1)} aria-label="Decrease expedition bonus">−</button>
          <span class="exp-value">{buildStore.expeditionBonus}</span>
          <button class="exp-step-btn" onclick={() => buildStore.setExpeditionBonus(buildStore.expeditionBonus + 1)} aria-label="Increase expedition bonus">+</button>
        </div>
        <span class="exp-total">{BASE_SKILL_POINTS} + {buildStore.expeditionBonus} = {maxBudget}</span>
      </div>
      <span class="exp-hint">Each expedition grants up to 5 bonus points.</span>
    </section>

    {#if wantedNodes.length > 0}
      <section class="sheet-block">
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

        {#if feasible}
          <span class="verdict-ok">{maxBudget - totalCost} points remaining</span>
        {:else}
          <span class="verdict-bad">Over budget by {totalCost - maxBudget}</span>
        {/if}
      </section>
    {/if}

    <section class="sheet-block actions">
      <button class="action-btn" onclick={copyShareUrl}>{shareLabel}</button>
      <button class="action-btn danger-btn" onclick={() => buildStore.resetAll()}>Reset</button>
    </section>

    <div class="sheet-footer">
      <div class="sheet-footer-actions">
        {#if onShowKofi}
          <button class="sheet-kofi-btn" onclick={onShowKofi}>☕ Support me</button>
        {/if}
        <a
          class="sheet-report-btn"
          href="https://github.com/IllicLanthresh/ARC-skilltree/issues/new?title=%5BBug%5D+&labels=bug"
          target="_blank"
          rel="noopener noreferrer"
        >Report bug</a>
      </div>
      <span class="sheet-attribution">ARC Raiders is a trademark of Embark Studios. Game assets belong to their respective owners.</span>
    </div>
  </div>
</div>

<style>
  .bottom-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    background: linear-gradient(180deg, rgba(9, 13, 26, 0.96), rgba(12, 18, 34, 0.98));
    border-top: 1px solid color-mix(in srgb, #91a9cf, transparent 72%);
    backdrop-filter: blur(12px);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .slim-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.15rem 0.75rem;
    touch-action: none;
    font-size: 0.75rem;
  }

  .dots {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: color-mix(in srgb, var(--dot-color), transparent 60%);
    cursor: pointer;
    padding: 0;
    transition: background 0.2s ease, transform 0.15s ease;
  }

  .dot.active {
    background: var(--dot-color);
    transform: scale(1.2);
  }

  .points-summary {
    color: #8ea8cc;
    font-size: 0.8rem;
    letter-spacing: 0.03em;
  }

  .drag-zone {
    display: flex;
    justify-content: center;
    padding: 0.25rem 0 0;
    cursor: grab;
    touch-action: none;
  }

  .drag-zone:active {
    cursor: grabbing;
  }

  .drag-pill {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: rgba(140, 170, 210, 0.35);
    transition: background 0.2s;
  }

  .drag-zone:hover .drag-pill,
  .drag-zone:active .drag-pill {
    background: rgba(160, 190, 230, 0.55);
  }

  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 29;
    background: rgba(0, 0, 0, 0.3);
  }

  .sheet-content {
    padding: 0.5rem 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sheet-block {
    border: 1px solid color-mix(in srgb, #93acd0, transparent 74%);
    border-radius: 0.7rem;
    background: linear-gradient(150deg, rgba(15, 22, 40, 0.84), rgba(11, 17, 29, 0.9));
    padding: 0.55rem;
    display: grid;
    gap: 0.4rem;
  }

  .block-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8ea0bd;
  }

  .exp-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .exp-stepper {
    display: flex;
    align-items: center;
    border: 1px solid color-mix(in srgb, #8eaad1, transparent 60%);
    border-radius: 0.45rem;
    background: rgba(9, 14, 24, 0.7);
    overflow: hidden;
  }

  .exp-step-btn {
    background: rgba(100, 150, 220, 0.08);
    border: none;
    color: #8eb0d8;
    font-size: 0.85rem;
    font-weight: 700;
    width: 1.6rem;
    height: 1.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
  }

  .exp-step-btn:hover {
    background: rgba(100, 150, 220, 0.2);
  }

  .exp-step-btn:active {
    background: rgba(100, 150, 220, 0.3);
  }

  .exp-value {
    min-width: 1.8rem;
    text-align: center;
    font-size: 0.82rem;
    font-weight: 600;
    color: #e6f1ff;
    padding: 0 0.15rem;
  }

  .exp-total {
    color: #8a9fb8;
    font-size: 0.7rem;
  }

  .exp-hint {
    font-size: 0.64rem;
    color: #607a96;
    font-style: italic;
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

  .cost-total.over-budget strong {
    color: #ff9f9f;
  }

  .cost-breakdown {
    display: grid;
    gap: 0.25rem;
    padding: 0.4rem 0;
  }

  .cost-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: #b8cfe8;
  }

  .cost-row.prereq {
    color: #7abfff;
  }

  .cost-row.filler {
    color: #ffc875;
  }

  .cost-detail {
    display: flex;
    justify-content: space-between;
    font-size: 0.66rem;
    color: #8a9fba;
    padding-left: 0.5rem;
  }

  .verdict-ok {
    color: #2afe7f;
    font-size: 0.72rem;
    text-align: center;
  }

  .verdict-bad {
    color: #ff8b8b;
    font-weight: 600;
    font-size: 0.72rem;
    text-align: center;
  }

  .actions {
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
  }

  .danger-btn {
    border-color: color-mix(in srgb, #f39b9b, transparent 45%);
    background: linear-gradient(145deg, #371f29, #2b1821);
    color: #ffd4d4;
  }

  .sheet-footer {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-top: 0.3rem;
    border-top: 1px solid rgba(100, 150, 220, 0.1);
  }

  .sheet-footer-actions {
    display: flex;
    gap: 0.4rem;
  }

  .sheet-attribution {
    font-size: 0.58rem;
    color: #5a7090;
    line-height: 1.3;
  }

  .sheet-kofi-btn {
    background: rgba(180, 120, 40, 0.15);
    border: 1px solid rgba(200, 150, 60, 0.35);
    border-radius: 999px;
    color: #e8c36a;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.22rem 0.6rem;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .sheet-kofi-btn:hover {
    background: rgba(200, 140, 50, 0.28);
    border-color: rgba(220, 170, 80, 0.55);
  }

  .sheet-report-btn {
    background: transparent;
    border: 1px solid rgba(120, 160, 220, 0.2);
    border-radius: 999px;
    color: #7a95b8;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.22rem 0.6rem;
    text-decoration: none;
    display: flex;
    align-items: center;
    transition: background 0.2s, border-color 0.2s;
  }

  .sheet-report-btn:hover {
    background: rgba(120, 160, 220, 0.12);
    border-color: rgba(140, 180, 240, 0.4);
    color: #a0c0e0;
  }
</style>
