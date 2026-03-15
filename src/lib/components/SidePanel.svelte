<script lang="ts">
  import { buildStore } from '$lib/state/buildStore.svelte';
  import { BASE_SKILL_POINTS, MAX_EXPEDITION_BONUS } from '$lib/data/skillData';

  const stats = $derived(buildStore.treeStats);
  const maxBudget = $derived(buildStore.maxBudget);
  const wantedNodes = $derived(buildStore.wantedNodes);
  const fillerNeeded = $derived(buildStore.fillerNeeded);
  const gateDetails = $derived(buildStore.gateDetails);
  const breakdown = $derived(buildStore.costBreakdown);

  const fillerTotal = $derived((fillerNeeded.conditioning ?? 0) + (fillerNeeded.mobility ?? 0) + (fillerNeeded.survival ?? 0));
  const totalCost = $derived(breakdown.wantedCost + breakdown.prereqCost + fillerTotal);
  const feasible = $derived(totalCost <= maxBudget);

  function updateExpeditionBonus(event: Event): void {
    const next = Number((event.currentTarget as HTMLInputElement).value);
    buildStore.setExpeditionBonus(next);
  }
</script>

<aside class="panel" aria-label="Build info">
  <section class="block">
    <div class="section-title">Points per Tree</div>
    <div class="category-bars">
      <div class="cat-row">
        <span class="cat-label cond">Conditioning</span>
        <span class="cat-pts">{stats.conditioning}</span>
      </div>
      <div class="cat-row">
        <span class="cat-label mob">Mobility</span>
        <span class="cat-pts">{stats.mobility}</span>
      </div>
      <div class="cat-row">
        <span class="cat-label surv">Survival</span>
        <span class="cat-pts">{stats.survival}</span>
      </div>
    </div>
  </section>

  {#if wantedNodes.length > 0}
    <section class="block">
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

  <section class="block expedition-block">
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
</aside>

<style>
  .panel {
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.15rem;
  }

  .block {
    border: 1px solid color-mix(in srgb, #93acd0, transparent 74%);
    border-radius: 0.7rem;
    background: linear-gradient(150deg, rgba(15, 22, 40, 0.84), rgba(11, 17, 29, 0.9));
    padding: 0.7rem;
    display: grid;
    gap: 0.5rem;
  }

  .section-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8ea0bd;
  }

  .category-bars {
    display: grid;
    gap: 0.35rem;
  }

  .cat-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
  }

  .cat-label { color: #95a8c6; }
  .cat-label.cond { color: #2afe7f; }
  .cat-label.mob { color: #fdd333; }
  .cat-label.surv { color: #f4101b; }
  .cat-pts { color: #d8e6f8; font-weight: 600; }

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
</style>
