import { createDiv } from "./elements";

const TOAST_CONTAINER = document.getElementById('toast-container');
const FIRST_TOAST = document.getElementById('first-toast');
const DEFAULT_FADEOUT = 4000;
let lastToast = FIRST_TOAST;


export function createToast({ msg, bgColor, fadeout = DEFAULT_FADEOUT }) {
	const toast = createDiv('toast-banner')
		.setText(msg)
		.setStyles({
			'backgroundColor': bgColor
		})
		.getElem();

	// Keep previous toast on top of new
	TOAST_CONTAINER.insertBefore(toast, lastToast);

	lastToast = toast;
	// Smooth appearance
	setTimeout(() => {
		toast.style.transform = 'translateY(0px)';
	}, 0);
	// Smooth disappearance
	setTimeout(() => {
		toast.style.transform = 'translateY(4em)';
		setTimeout(() => {
			if (lastToast === toast) {
				lastToast = FIRST_TOAST;
			}
			TOAST_CONTAINER.removeChild(toast);
		}, 600);
	}, fadeout);
}

