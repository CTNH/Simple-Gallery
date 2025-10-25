export const EVENTNAMES = {
	TOGGLE_INFO_PANEL: 'toggleInfoPanel',
	INFO_PANEL_OPENED: 'infoPanelOpen',
	INFO_PANEL_CLOSED: 'infoPanelClose',
};

class GalleryEvents extends EventTarget {
	trigger(event, details = null) {
		this.dispatchEvent(
			new CustomEvent( event, { detail: details } )
		);
	}

	on(event, callback) {
		this.addEventListener(event, callback);
	}

	off(event, callback) {
		this.removeEventListener(event, callback);
	}
}

export const galleryEvents = new GalleryEvents();

