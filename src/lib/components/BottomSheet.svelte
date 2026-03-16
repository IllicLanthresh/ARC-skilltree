<script lang="ts">
  import { buildStore } from '$lib/state/buildStore.svelte';
  import { BASE_SKILL_POINTS, MAX_EXPEDITION_BONUS } from '$lib/data/skillData';

  interface Props {
    activeTree: 'conditioning' | 'mobility' | 'survival';
    onTreeChange: (tree: 'conditioning' | 'mobility' | 'survival') => void;
  }

  let { activeTree, onTreeChange }: Props = $props();

  const TREES = ['conditioning', 'mobility', 'survival'] as const;
  type Tree = typeof TREES[number];

  const TREE_COLORS: Record<Tree, string> = {
    conditioning: '#2afe7f',
    mobility: '#fdd333',
    survival: '#f4101b'
  };

  let isOpen = $state(false);
  let shareLabel = $state('Share Build');

  // Close sheet when active tree changes (swipe or dot tap)
  $effect(() => {
    activeTree; // track the prop
    isOpen = false;
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

<div class="bottom-sheet" class:open={isOpen}>
  <div class="slim-bar">
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
    <button class="pull-handle" onclick={() => isOpen = !isOpen} aria-label="Toggle controls">
      {isOpen ? '▾' : '▴'}
    </button>
  </div>

  {#if isOpen}
    <div class="sheet-content">
      <section class="sheet-block">
        <label class="block-label" for="exp-input-mobile">Expedition Bonus</label>
        <div class="exp-row">
          <input
            id="exp-input-mobile"
            type="number"
            min="0"
            max={MAX_EXPEDITION_BONUS}
            value={buildStore.expeditionBonus}
            oninput={updateExpeditionBonus}
          />
          <span class="exp-total">{BASE_SKILL_POINTS} + {buildStore.expeditionBonus} = {maxBudget}</span>
        </div>
      </section>

      {#if wantedNodes.length > 0}
        <section class="sheet-block">
          <div class="cost-total" class:over-budget={!feasible}>
            <span>Total</span>
            <strong>{totalCost} / {maxBudget}</strong>
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
    </div>
  {/if}
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
    padding: 0.5rem 1rem;
    min-height: 48px;
  }

  .dots {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .dot {
    width: 10px;
    height: 10px;
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

  .pull-handle {
    background: none;
    border: none;
    color: #8ea8cc;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }

  .sheet-content {
    padding: 0.5rem 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-height: 60vh;
    overflow-y: auto;
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
</style>
