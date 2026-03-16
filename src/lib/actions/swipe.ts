import type { Action } from 'svelte/action';

interface SwipeOptions {
	threshold?: number;
	maxVertical?: number;
}

export const swipe: Action<
	HTMLElement | SVGElement,
	SwipeOptions | undefined,
	{ onswipeleft: (e: CustomEvent) => void; onswiperight: (e: CustomEvent) => void }
> = (node, options = {}) => {
	const { threshold = 50, maxVertical = 75 } = options;
	let startX = 0;
	let startY = 0;
	let moved = false;

	function onTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		moved = false;
	}

	function onTouchMove(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		const dx = e.touches[0].clientX - startX;
		const dy = Math.abs(e.touches[0].clientY - startY);
		if (Math.abs(dx) > dy && Math.abs(dx) > 10) {
			e.preventDefault();
			moved = true;
		}
	}

	function onTouchEnd(e: TouchEvent) {
		if (!moved) return;
		const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
		const dy = Math.abs((e.changedTouches[0]?.clientY ?? startY) - startY);
		if (dy > maxVertical) return;
		if (Math.abs(dx) >= threshold) {
			node.dispatchEvent(new CustomEvent(dx < 0 ? 'swipeleft' : 'swiperight'));
		}
		moved = false;
	}

	node.addEventListener('touchstart', onTouchStart as EventListener, { passive: true });
	node.addEventListener('touchmove', onTouchMove as EventListener, { passive: false }); // MUST be non-passive
	node.addEventListener('touchend', onTouchEnd as EventListener, { passive: true });

	return {
		destroy() {
			node.removeEventListener('touchstart', onTouchStart as EventListener);
			node.removeEventListener('touchmove', onTouchMove as EventListener);
			node.removeEventListener('touchend', onTouchEnd as EventListener);
		}
	};
};
