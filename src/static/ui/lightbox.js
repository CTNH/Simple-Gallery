import { EVENTNAMES, galleryEvents } from "../events/galleryevents.js";
import { getElemWrapperFromID } from "./elements.js";

class Lightbox {
	LIGHTBOX = document.getElementById('lightbox');
	LIGHTBOX_IMG = getElemWrapperFromID('lightbox-img');
	LIGHTBOX_VID = getElemWrapperFromID('lightbox-vid');
	prevPathName = '/';

	constructor() {
		['play', 'pause', 'ended'].forEach(event =>
			this.LIGHTBOX_VID.addEventListener(event, (e) => {
				const vid = e.target;
				if (vid.paused || vid.ended) {
					this.showLightboxButtons();
				}
				else {
					this.hideLightboxButtons();
				}
			})
		);

		galleryEvents.on(
			EVENTNAMES.INFO_PANEL_OPENED,
			() => {
				this.LIGHTBOX.classList.add('info-open');
				document.getElementById('lightbox-button-info-panel').classList.add('active');
			}
		);
		galleryEvents.on(
			EVENTNAMES.INFO_PANEL_CLOSED,
			() => {
				this.LIGHTBOX.classList.remove('info-open');
				document.getElementById('lightbox-button-info-panel').classList.remove('active');
			}
		);
	}

	showLightboxButtons() {
		document.getElementById('lightbox-button-row').classList.add('active');
		document.querySelectorAll('.lightbox-nav').forEach((elem) => {
			elem.classList.add('active');
		});
	}
	hideLightboxButtons() {
		document.getElementById('lightbox-button-row').classList.remove('active');
		document.querySelectorAll('.lightbox-nav').forEach((elem) => {
			elem.classList.remove('active');
		});
	}


	showLightbox({
		hash,
		mediaName,
		vid = false,
		updateHistory = true,
		mediaRotation = 0,
		infoPanelWidthOffset = 0
	}) {
		if (updateHistory) {
			if (!(window.location.pathname.startsWith('/lightbox/'))) {
				this.prevPathName = window.location.pathname + window.location.search;
			}
			window.history.pushState({}, '', '/lightbox/' + hash);
		}

		this.LIGHTBOX.classList.add('active');
		this.showLightboxButtons();
		if (vid) {
			this.LIGHTBOX_VID
				.setAttrs({
					src: `/media/${hash}/original`,
					alt: mediaName
				})
				.addClass('active');
			this.LIGHTBOX_IMG
				.removeClass('active');
		}
		else {
			this.rotateLightboxImg(mediaRotation, infoPanelWidthOffset);
			// Temporary placeholder to be responsive
			this.LIGHTBOX_IMG.setAttr('src', `/media/${hash}/thumbnail`);
			this.LIGHTBOX_IMG
				.setAttrs({
					src: `/media/${hash}/original`,
					alt: mediaName
				})
				.addClass('active');
			this.LIGHTBOX_VID
				.removeClass('active');
		}

		// Prevent Scrolling
		document.body.style.overflow = 'hidden';
	}

	hideLightbox({pushState = true} = {}) {
		this.LIGHTBOX_VID.getElem().removeAttribute('src');
		this.LIGHTBOX_VID.getElem().load();

		this.hideLightboxButtons();

		this.LIGHTBOX.classList.remove('active');
		document.getElementById('lightbox-button-row').classList.remove('active');

		if (pushState) {
			window.history.pushState({}, '', this.prevPathName);
			this.prevPathName = '/';
		}

		// Restore Scrolling
		document.body.style.overflow = '';
	}

	rotateLightboxImg(mediaRotation, infoPanelWidthOffset) {
		this.LIGHTBOX_IMG.setStyles({
			maxWidth: '90%',
			maxHeight: '96%',
		});
		if (mediaRotation !== null) {
			this.LIGHTBOX_IMG.setStyle('transform', `rotate(${mediaRotation}deg)`);
			// Vertical
			if (mediaRotation === 90 || mediaRotation === 270) {
				this.LIGHTBOX_IMG.setStyles({
					maxWidth: (this.LIGHTBOX.clientHeight * 0.96) + 'px',
					maxHeight: (this.LIGHTBOX.clientWidth * 0.90 - infoPanelWidthOffset) + 'px'
				});
			}
		}
		else {
			this.LIGHTBOX_IMG.setStyle('transform', '');
		}
	}
}

document.getElementById('lightbox-button-info-panel').addEventListener('click', () => {
	galleryEvents.trigger(EVENTNAMES.TOGGLE_INFO_PANEL);
});

export const lightbox = new Lightbox();

