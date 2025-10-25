class TouchState {
	static LONGHOLD_TIMEOUT = 240;
	touching = false;
	longHold = false;
	moved = false;
	timer = null;

	constructor() {
		document.body.addEventListener('touchstart', () => {
			this.longHold = false;
			this.touching = true;
			this.moved = false;
			this.timer = setTimeout(
				() => { this.longHold = true },
				TouchState.LONGHOLD_TIMEOUT
			);
		}, { passive: true });

		document.body.addEventListener('touchend', () => {
			clearTimeout(this.timer);
			this.touching = false;
		}, { passive: true });

		document.body.addEventListener('touchmove', () => {
			clearTimeout(this.timer);
			this.longHold = false;
			this.moved = true;;
		}, { passive: true });

		document.body.addEventListener('touchcancel', () => {
			clearTimeout(this.timer);
			this.longHold = false;
		}, { passive: true });
	}

	isTouching() {
		return this.touching;
	}
	isLongTouch() {
		return this.longHold;
	}

	hasMoved() {
		return this.moved;
	}

	clearLongTouch() {
		this.longHold = false;
	}
}

export const touchState = new TouchState();

