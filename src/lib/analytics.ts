export function trackEvent(event: string, title?: string) {
  if (typeof window === 'undefined') return;
  const gc = (window as any).goatcounter;
  if (gc?.count) {
    gc.count({ path: `event/${event}`, title: title ?? event, event: true });
  }
}
