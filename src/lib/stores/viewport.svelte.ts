import { MediaQuery } from 'svelte/reactivity';

const mobileQuery = new MediaQuery('(pointer: coarse) and (max-width: 1023px), (max-width: 767px)');
const touchQuery = new MediaQuery('(pointer: coarse)');
const landscapeMobileQuery = new MediaQuery('(pointer: coarse) and (orientation: landscape)');

export const viewport = {
  get isMobile() {
    return mobileQuery.current;
  },
  get isTouch() {
    return touchQuery.current;
  },
  get isLandscapeMobile() {
    return landscapeMobileQuery.current;
  },
};
