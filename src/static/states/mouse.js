class MouseState {
	mouseDown = false;

	constructor() {
		document.body.addEventListener('mousedown', () => { this.mouseDown = true });
		document.body.addEventListener('mouseup', () => { this.mouseDown = false });
		document.documentElement.addEventListener('mouseleave', (event) => {
			if (
				event.clientY <= 0 ||
				event.clientX <= 0 ||
				event.clientX >= window.innerWidth ||
				event.clientY >= window.innerHeight
			) {
				this.mouseDown = false;
			}
		});
	}

	isDown() {
		return this.mouseDown;
	}
}

export const mouseState = new MouseState();

