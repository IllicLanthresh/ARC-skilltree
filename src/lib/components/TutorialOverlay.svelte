<script lang="ts">
  import { tutorialStore } from '$lib/stores/tutorialStore.svelte';
  import { buildStore } from '$lib/state/buildStore.svelte';
  import type { TutorialStep } from '$lib/data/tutorialSteps';
  import { TOTAL_STEPS } from '$lib/data/tutorialSteps';

  let spotlights = $state<Array<{x: number, y: number, r: number}>>([]);

  let cardX = $state<number | null>(null);
  let cardY = $state<number | null>(null);
  let cardCentered = $state(true);
  let cardAbove = $state(false);

  function getTargetBounds(step: TutorialStep): { union: DOMRect | null; individual: DOMRect[] } {
    if (!step.targetSelector) return { union: null, individual: [] };
    const elements = document.querySelectorAll(step.targetSelector);
    if (elements.length === 0) return { union: null, individual: [] };

    const rects: DOMRect[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      rects.push(rect);
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.right);
      maxY = Math.max(maxY, rect.bottom);
    });

    return {
      union: new DOMRect(minX, minY, maxX - minX, maxY - minY),
      individual: rects,
    };
  }

  function updateSpotlight(step: TutorialStep) {
    const { union: bounds, individual } = getTargetBounds(step);

    if (!bounds || bounds.width === 0) {
      spotlights = [];
      cardCentered = true;
      cardX = null;
      cardY = null;
      return;
    }

    spotlights = individual.map(rect => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      r: Math.max(rect.width, rect.height) / 2 + 20,
    }));

    // When spotlights span a wide area, try to find a gap to place the card
    if (bounds.width > window.innerWidth * 0.5 || bounds.height > window.innerHeight * 0.5) {
      const CARD_W = 320;
      const CARD_MARGIN = 12;
      const sorted = [...spotlights].sort((a, b) => a.x - b.x);
      let maxGap = 0;
      let gapCenterX = window.innerWidth / 2;
      for (let i = 0; i < sorted.length - 1; i++) {
        const rightEdge = sorted[i].x + sorted[i].r;
        const leftEdge = sorted[i + 1].x - sorted[i + 1].r;
        const gap = leftEdge - rightEdge;
        if (gap > maxGap) {
          maxGap = gap;
          gapCenterX = (rightEdge + leftEdge) / 2;
        }
      }

      // Only use gap positioning if the gap is big enough to fit the card
      if (maxGap > CARD_W + CARD_MARGIN * 2) {
        cardCentered = false;
        cardX = Math.max(CARD_W / 2 + CARD_MARGIN, Math.min(gapCenterX, window.innerWidth - CARD_W / 2 - CARD_MARGIN));
        cardY = window.innerHeight * 0.33;
        cardAbove = false;
        return;
      }

      // No meaningful gap — center the card
      cardCentered = true;
      cardX = null;
      cardY = null;
      return;
    }

    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;

    cardCentered = false;
    // Clamp card center to keep 320px card fully within viewport (12px margins each side)
    const CARD_W = 320;
    const CARD_MARGIN = 12;
    cardX = Math.max(CARD_W / 2 + CARD_MARGIN, Math.min(cx, window.innerWidth - CARD_W / 2 - CARD_MARGIN));
    
    if (cy < window.innerHeight / 2) {
      cardY = Math.min(bounds.bottom + 16, window.innerHeight - 12);
      cardAbove = false;
    } else {
      cardY = Math.max(bounds.top - 16, 12);
      cardAbove = true;
    }
  }

  $effect(() => {
    const current = tutorialStore.currentStep;
    if (!tutorialStore.isActive || !current) return;

    if (current.id === 'panel-intro' && buildStore.wantedNodes.length === 0) {
      buildStore.incrementWanted('cond_1');
      buildStore.incrementWanted('cond_2l');
    }

    requestAnimationFrame(() => updateSpotlight(current));

    const handleResize = () => {
      const active = tutorialStore.currentStep;
      if (!active) return;
      requestAnimationFrame(() => updateSpotlight(active));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  $effect(() => {
    const current = tutorialStore.currentStep;
    if (!tutorialStore.isActive || !current || current.type !== 'action' || !current.expectedAction) return;

    const selector = current.expectedTargetSelector;

    function handleInterceptedEvent(e: Event) {
      const target = e.target;
      const targetElement = target instanceof Element ? target : null;

      if (targetElement?.closest('[data-testid="tutorial-card"]')) {
        return;
      }

      if (selector && targetElement?.closest(selector)) {
        setTimeout(() => tutorialStore.nextStep(), 150);
        return;
      }

      e.preventDefault();
      e.stopPropagation();
    }

    function blockEvent(e: Event) {
      const target = e.target;
      const targetElement = target instanceof Element ? target : null;
      if (targetElement?.closest('[data-testid="tutorial-card"]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
    }

    if (current.expectedAction === 'any') {
      document.addEventListener('click', handleInterceptedEvent, { capture: true });
      document.addEventListener('contextmenu', handleInterceptedEvent, { capture: true });
      return () => {
        document.removeEventListener('click', handleInterceptedEvent, true);
        document.removeEventListener('contextmenu', handleInterceptedEvent, true);
      };
    }

    const eventType = current.expectedAction === 'contextmenu' ? 'contextmenu' : 'click';
    const oppositeType = eventType === 'contextmenu' ? 'click' : 'contextmenu';

    document.addEventListener(eventType, handleInterceptedEvent, { capture: true });
    document.addEventListener(oppositeType, blockEvent, { capture: true });

    return () => {
      document.removeEventListener(eventType, handleInterceptedEvent, true);
      document.removeEventListener(oppositeType, blockEvent, true);
    };
  });

  // Block all skill tree interactions during non-action steps
  $effect(() => {
    const current = tutorialStore.currentStep;
    if (!tutorialStore.isActive || !current) return;
    if (current.type === 'action') return;

    function blockAll(e: Event) {
      const target = e.target;
      const targetElement = target instanceof Element ? target : null;
      if (targetElement?.closest('[data-testid="tutorial-card"]')) return;
      if (targetElement?.closest('.footer')) return;
      if (targetElement?.closest('.branch-selector')) return;
      e.preventDefault();
      e.stopPropagation();
    }

    document.addEventListener('click', blockAll, { capture: true });
    document.addEventListener('contextmenu', blockAll, { capture: true });

    return () => {
      document.removeEventListener('click', blockAll, true);
      document.removeEventListener('contextmenu', blockAll, true);
    };
  });

  $effect(() => {
    if (!tutorialStore.isActive) return;

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        tutorialStore.skip();
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (!tutorialStore.isFirstStep) {
          tutorialStore.prevStep();
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        const current = tutorialStore.currentStep;
        if (!current || current.type === 'action') return;
        if (current.type === 'completion') {
          tutorialStore.complete();
        } else {
          tutorialStore.nextStep();
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });

  const step = $derived(tutorialStore.currentStep);
  const isActionStep = $derived(step?.type === 'action');
  const showNextBtn = $derived(Boolean(step && step.type !== 'action'));
  const showBackBtn = $derived(!tutorialStore.isFirstStep);

  function advanceStep() {
    if (!step) return;
    if (step.type === 'completion') {
      tutorialStore.complete();
      return;
    }
    tutorialStore.nextStep();
  }
</script>

{#if tutorialStore.isActive && step}
  <svg
    class="tutorial-backdrop"
    data-testid="tutorial-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Tutorial: {step.title}"
  >
     <defs>
       <filter id="spotlight-feather" x="-50%" y="-50%" width="200%" height="200%">
         <feGaussianBlur stdDeviation="12" />
       </filter>
      <mask id="tutorial-mask">
        <rect width="100%" height="100%" fill="white" />
        {#each spotlights as spot}
          <circle cx={spot.x} cy={spot.y} r={spot.r} fill="black" filter="url(#spotlight-feather)" />
        {/each}
      </mask>
    </defs>
    <rect
      width="100%"
      height="100%"
      fill="rgba(0, 0, 0, 0.78)"
      mask={spotlights.length > 0 ? 'url(#tutorial-mask)' : undefined}
    />
  </svg>

  <div
    class="tutorial-card"
    class:card-centered={cardCentered}
    style={cardCentered ? '' : `left: ${(cardX ?? 0) - 160}px; top: ${cardY ?? 50}px;${cardAbove ? ' transform: translateY(-100%);' : ''}`}
    data-testid="tutorial-card"
    data-testid-step="tutorial-step-{step.id}"
  >
    <div class="card-header">
      <h2 class="card-title">{step.title}</h2>
      <span class="step-counter">Step {tutorialStore.currentStepIndex + 1} of {TOTAL_STEPS}</span>
    </div>

    <p class="card-desc">{step.description}</p>

    {#if isActionStep}
      <p class="card-action-hint">Perform the action above to continue.</p>
    {/if}

    <div class="card-actions">
      {#if showBackBtn}
        <button
          class="btn btn-back"
          onclick={() => tutorialStore.prevStep()}
          data-testid="tutorial-back"
        >← Back</button>
      {/if}

      <button
        class="btn btn-skip"
        onclick={() => tutorialStore.skip()}
        data-testid="tutorial-skip"
      >Skip Tutorial</button>

      {#if showNextBtn}
        <button class="btn btn-next" onclick={advanceStep} data-testid="tutorial-next">
          {step.nextButtonLabel}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tutorial-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 150;
    pointer-events: none;
  }

  .tutorial-card {
    pointer-events: all;
    position: fixed;
    width: 320px;
    max-width: calc(100vw - 24px);
    background: linear-gradient(160deg, rgba(9, 13, 26, 0.96), rgba(12, 18, 34, 0.98));
    border: 1px solid color-mix(in srgb, #91a9cf, transparent 60%);
    border-radius: 0.8rem;
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    z-index: 151;
  }

  .card-centered {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .card-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #f4f8ff;
  }

  .step-counter {
    font-size: 0.68rem;
    color: #7a90b0;
    white-space: nowrap;
    padding-top: 0.1rem;
  }

  .card-desc {
    margin: 0;
    font-size: 0.84rem;
    color: #ced9ec;
    line-height: 1.5;
    white-space: pre-line;
  }

  .card-action-hint {
    margin: 0;
    font-size: 0.78rem;
    color: #ffd676;
    opacity: 0.9;
  }

  .card-actions {
    margin-top: 0.25rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn {
    border: 1px solid;
    border-radius: 0.5rem;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.42rem 0.7rem;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .btn-next {
    margin-left: auto;
    background: linear-gradient(145deg, #162744, #0f1d33);
    border-color: color-mix(in srgb, #8aa9d4, transparent 45%);
    color: #eaf3ff;
  }

  .btn-next:hover {
    background: linear-gradient(145deg, #1d3258, #142240);
  }

  .btn-skip,
  .btn-back {
    background: transparent;
    border-color: color-mix(in srgb, #8aa9d4, transparent 65%);
    color: #8a9fba;
  }

  .btn-skip:hover,
  .btn-back:hover {
    border-color: color-mix(in srgb, #8aa9d4, transparent 40%);
    color: #adc4e0;
  }
</style>
