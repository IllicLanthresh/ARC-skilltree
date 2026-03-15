import { base } from '$app/paths';

export function getIconUrl(iconName: string): string {
  return `${base}/icons/${iconName}`;
}
