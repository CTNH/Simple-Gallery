import { EVENTNAMES, galleryEvents } from "../events/galleryevents.js";
import { getElemWrapperFromID } from "./elements.js";

const LIGHTBOX = document.getElementById('lightbox');
const LIGHTBOX_IMG = getElemWrapperFromID('lightbox-img');
const LIGHTBOX_VID = getElemWrapperFromID('lightbox-vid');
let prevPathName = '/';


function showLightboxButtons() {
	document.getElementById('lightbox-button-row').classList.add('active');
	document.querySelectorAll('.lightbox-nav').forEach((elem) => {
		elem.classList.add('active');
	});
}
function hideLightboxButtons() {
	document.getElementById('lightbox-button-row').classList.remove('active');
	document.querySelectorAll('.lightbox-nav').forEach((elem) => {
		elem.classList.remove('active');
	});
}

['play', 'pause', 'ended'].forEach(event =>
	LIGHTBOX_VID.addEventListener(event, (e) => {
		const vid = e.target;
		if (vid.paused || vid.ended) {
			showLightboxButtons();
		}
		else {
			hideLightboxButtons();
		}
	})
);

export function showLightbox({
	hash,
	mediaName,
	vid = false,
	updateHistory = true,
	mediaRotation = 0,
	infoPanelWidthOffset = 0
}) {
	if (updateHistory) {
		if (!(window.location.pathname.startsWith('/lightbox/'))) {
			prevPathName = window.location.pathname + window.location.search;
		}
		window.history.pushState({}, '', '/lightbox/' + hash);
	}

	LIGHTBOX.classList.add('active');
	showLightboxButtons();
	if (vid) {
		LIGHTBOX_VID
			.setAttrs({
				src: `/media/${hash}/original`,
				alt: mediaName
			})
			.addClass('active');
		LIGHTBOX_IMG
			.removeClass('active');
	}
	else {
		rotateLightboxImg(mediaRotation, infoPanelWidthOffset);
		LIGHTBOX_IMG
			.setAttrs({
				src: `/media/${hash}/original`,
				alt: mediaName
			})
			.addClass('active');
		LIGHTBOX_VID
			.removeClass('active');
	}

	// Prevent Scrolling
	document.body.style.overflow = 'hidden';
}

export function hideLightbox({pushState = true} = {}) {
	LIGHTBOX_VID.getElem().removeAttribute('src');
	LIGHTBOX_VID.getElem().load();

	hideLightboxButtons();

	LIGHTBOX.classList.remove('active');
	document.getElementById('lightbox-button-row').classList.remove('active');

	if (pushState) {
		window.history.pushState({}, '', prevPathName);
		prevPathName = '/';
	}

	// Restore Scrolling
	document.body.style.overflow = '';
}

export function rotateLightboxImg(mediaRotation, infoPanelWidthOffset) {
	LIGHTBOX_IMG.setStyles({
		maxWidth: '90%',
		maxHeight: '96%',
	});
	if (mediaRotation !== null) {
		LIGHTBOX_IMG.setStyle('transform', `rotate(${mediaRotation}deg)`);
		// Vertical
		if (mediaRotation === 90 || mediaRotation === 270) {
			LIGHTBOX_IMG.setStyles({
				maxWidth: (LIGHTBOX.clientHeight * 0.96) + 'px',
				maxHeight: (LIGHTBOX.clientWidth * 0.90 - infoPanelWidthOffset) + 'px'
			});
		}
	}
	else {
		LIGHTBOX_IMG.setStyle('transform', '');
	}
}

document.getElementById('lightbox-button-info-panel').addEventListener('click', () => {
	galleryEvents.trigger(EVENTNAMES.TOGGLE_INFO_PANEL);
});

