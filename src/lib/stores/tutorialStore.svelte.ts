import { browser } from '$app/environment';
import { TUTORIAL_STEPS, TOTAL_STEPS } from '$lib/data/tutorialSteps';
import { buildStore } from '$lib/state/buildStore.svelte';
import { trackEvent } from '$lib/analytics';
import type { WantedNode } from '$lib/types';

const STORAGE_KEY = 'arc-tutorial-completed';

let isActive = $state(false);
let currentStepIndex = $state(0);
let isCompleted = $state(false);

interface BuildSnapshot {
  wantedNodes: WantedNode[];
  pathOverrides: Map<string, number>;
}

let stepSnapshots: BuildSnapshot[] = [];

function takeSnapshot(): BuildSnapshot {
  return {
    wantedNodes: buildStore.wantedNodes.map(n => ({ ...n })),
    pathOverrides: new Map(buildStore.pathOverrides),
  };
}

const currentStep = $derived(TUTORIAL_STEPS[currentStepIndex]);
const progress = $derived((currentStepIndex + 1) / TOTAL_STEPS);
const isFirstStep = $derived(currentStepIndex === 0);
const isLastStep = $derived(currentStepIndex === TOTAL_STEPS - 1);

function markCompleted() {
  if (browser) {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
  isCompleted = true;
}

function start() {
  currentStepIndex = 0;
  isActive = true;
  buildStore.saveState();
  stepSnapshots = [takeSnapshot()];
}

function nextStep() {
  if (isLastStep) {
    complete();
  } else {
    currentStepIndex += 1;
    stepSnapshots[currentStepIndex] = takeSnapshot();
  }
}

function prevStep() {
  if (isFirstStep) return;
  currentStepIndex -= 1;
  const snapshot = stepSnapshots[currentStepIndex];
  if (snapshot) {
    buildStore.applySnapshot(snapshot.wantedNodes, new Map(snapshot.pathOverrides));
  }
}

function skip() {
  trackEvent('tutorial_skipped', `Skipped at step ${currentStepIndex + 1}`);
  buildStore.restoreState();
  isActive = false;
  stepSnapshots = [];
  markCompleted();
}

function complete() {
  trackEvent('tutorial_completed', 'Tutorial Completed');
  buildStore.restoreState();
  isActive = false;
  stepSnapshots = [];
  markCompleted();
}

function checkAutoShow() {
  if (browser && !localStorage.getItem(STORAGE_KEY)) {
    start();
  }
}

export const tutorialStore = {
  get isActive() { return isActive; },
  get currentStepIndex() { return currentStepIndex; },
  get isCompleted() { return isCompleted; },
  get currentStep() { return currentStep; },
  get progress() { return progress; },
  get isFirstStep() { return isFirstStep; },
  get isLastStep() { return isLastStep; },
  start,
  nextStep,
  prevStep,
  skip,
  complete,
  checkAutoShow,
};
