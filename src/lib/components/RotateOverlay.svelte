<script lang="ts">
  import { viewport } from '$lib/stores/viewport.svelte';
</script>

{#if viewport.isLandscapeMobile}
  <div class="rotate-overlay" role="status" aria-live="polite">
    <div class="rotate-content">
      <span class="rotate-icon" aria-hidden="true">↻</span>
      <p>Please rotate your device to portrait mode</p>
    </div>
  </div>
{/if}

<style>
  .rotate-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #0a0e1a;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .rotate-content {
    text-align: center;
    color: #8ea8cc;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .rotate-icon {
    font-size: 3rem;
    opacity: 0.7;
  }
  p {
    font-size: 1rem;
    max-width: 18rem;
    line-height: 1.5;
  }
</style>
