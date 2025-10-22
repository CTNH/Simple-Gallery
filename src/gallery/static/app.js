import { clearCache, getJSONCache } from "./cache.js";
import { EVENTNAMES, galleryEvents } from "./events/galleryevents.js";
import { mediaState } from "./states/media.js";
import { createPathButtons } from "./ui/dom.js";
import { renderGallery } from "./ui/gallery.js";
import { isInfoPanelOpen, openInfoPanel, setInfoPanelClosed, updateInfoPanel } from "./ui/infopanel.js";
import { hideLightbox, rotateLightboxImg, showLightbox } from "./ui/lightbox.js";
import { openInputPrompt, closeInputPrompt, showInputErr } from "./ui/prompt.js";
import { createToast } from "./ui/toast.js";
import { api_rotate } from "./utils/api.js";

const activeTags = new Set();
const activeTypes = new Set();
const GALLERY_CONTAINER = document.getElementById('gallery');
const STATS_ELEM = document.getElementById('stats');
const SELECT_MODE_CHECKBOX = document.getElementById('select-mode-checkbox');
let lastWinWidth = window.innerWidth;

let selectedItems = new Set();
let mouseDown = false;
let checkSelect = true;

let currentTagEdit = '';

let currentPath = null;
const TAGS_CACHE = 'tags-cache';

const Modes = {
	none: 0,
	lightbox: 1,
	select: 2,
	tagprompt: 3,
	tagedit: 4
};
let activeMode = Modes.none;
let lastActiveMode = Modes.none;

let handleInputExtra = null;

let cssRules = {};
const sheet = document.styleSheets[0].cssRules;
for (let i = 0; i < sheet.length; i++) {
	cssRules[sheet[i].selectorText] = sheet[i];
}

// Fetch media info from API
async function updateAllMedia(queryParams='') {
	const response = await fetch('/api/media' + queryParams);
	const jsonResp = await response.json();
	mediaState.setNewMedia(jsonResp['data']);
}

async function loadMedia({pushState = true} = {}) {
	if (window.location.pathname.startsWith('/lightbox/')) {
		const mediaHash = window.location.pathname.slice(10);
		if (mediaState.getMedia(mediaHash) == null) {
			await updateAllMedia();
		}
		await openLightbox({hash: mediaHash, updateHistory: pushState});

		return;
	}

	let path = null;
	let tags = [];
	// Parse link filters
	if (window.location.pathname.startsWith('/search')) {
		window.location.search.slice(1).split('&').forEach(query => {
			let [fieldName, fieldVal] = query.split('=');
			switch (fieldName) {
				case 'path':
					path = fieldVal;
					break;

				case 'tag':
					tags.push(fieldVal);
					break;

				default:
					break;
			}
		});
	}

	loadMediaByFilter({path: path, tags: tags, pushState: pushState});
}

async function addActiveFilters({tags = [], types = []}) {
	if (tags.length > 0) {
		tags.forEach(tag => {
			activeTags.add(tag);
		});
	}

	if (types.length > 0) {
		types.forEach(type => {
			activeTypes.add(type);
		});
	}

	loadMediaByFilter({
		path: currentPath,
		tags: Array.from(activeTags),
		types: Array.from(activeTypes)
	});
}

async function removeActiveFilters({tags = []}) {
	if (tags.length == 0) {
		return;
	}
	tags.forEach(tag => {
		activeTags.delete(tag);
	});
	loadMediaByFilter({path: currentPath, tags: Array.from(activeTags)});
}

async function updateAllTags() {
	const tags = await getJSONCache('/api/tags', TAGS_CACHE);
	const allTagsFilter = document.getElementById('filter-all-tags');

	if (tags['data'].length === 0) {
		allTagsFilter.innerText = 'None';
		return
	}

	allTagsFilter.innerHTML = '';
	tags['data'].forEach(tag => {
		const a = document.createElement('a');
		a.textContent = tag;
		a.addEventListener('click', () => {
			handleTagButton(tag);
		});
		allTagsFilter.appendChild(a);
	});
}

async function loadMediaByFilter({path = null, tags = [], types = [], pushState = true} = {}) {
	activeTags.clear();
	activeTypes.clear();
	selectedItems = new Set();
	updateSelectModeMediaCount();
	SELECT_MODE_CHECKBOX.checked = false;

	activeMode = Modes.select;
	toggleSelectionMode();
	// Reset tag edit
	document.getElementById('header-item-edit-tags').classList.remove('active');

	closeLightbox({pushState: pushState});

	currentPath = path;

	try {
		let queryparam = [];
		if (path !== null) {
			queryparam.push("path="+path);
		}

		for (const tag of tags) {
			queryparam.push("tag="+tag);
			activeTags.add(tag);
		}

		if (types.length > 0) {
			for (const t of types) {
				activeTypes.add(t);
			}
			queryparam.push("types=" + [...activeTypes].join(','));
		}

		const joinedParams = queryparam.length > 0 ? ("?" + queryparam.join('&')) : '';
		await updateAllMedia(joinedParams);
		if (pushState) {
			window.history.pushState(
				{}, '',
				queryparam.length > 0 ? ('/search' + joinedParams) : '/'
			);
		}

		const pathFilter = document.getElementById('filter-path');
		pathFilter.innerHTML = '';
		pathFilter.appendChild(createPathButtons(path, addPathFilter));

		updateAllTags();

		const activeTagsFilter = document.getElementById('filter-active-tags');
		activeTagsFilter.innerHTML = '';
		if (activeTags.size === 0) {
			activeTagsFilter.innerText = "None";
		}
		else {
			activeTags.forEach(tag => {
				const a = document.createElement('a');
				a.textContent = tag;
				a.addEventListener('click', () => {
					removeActiveFilters({ tags: [tag] });
				});
				activeTagsFilter.appendChild(a);
			});
		}

		updateStats();

		if (mediaState.getMediaListSize() === 0) {
			GALLERY_CONTAINER.innerHTML = '<div class="error">No images found.</div>';
		}
		else {
			renderGallery({
				indexedMedia: mediaState.getAllMediaIndexed(),
				parentElem: GALLERY_CONTAINER,
				handleImgClick: openLightbox,
				handleCheckboxMouseDown: handleCheckboxMouseDown,
				handleCheckboxMouseEnter: handleCheckboxMouseEnter
			});
		}

		mediaState.setCurrentMedia(0);
	} catch (error) {
		console.error('Error loading images:', error);
		GALLERY_CONTAINER.innerHTML = '<div class="error">Error loading images. Please check the console for details.</div>';
	}
}

function addPathFilter(path) {
	loadMediaByFilter({path: path, tags: Array.from(activeTags)})
}

function openTagEditPrompt(tag) {
	currentTagEdit = tag;
	const removeButton = document.getElementById('input-action-extra');
	removeButton.innerText = "Remove";
	removeButton.classList.add('active');
	handleInputExtra = removeTag;

	openInputPrompt({
		header: "Edit '" + tag + "' Tag",
		placeholder: "Tag name",
		value: tag
	});
}

function handleTagButton(tag) {
	if (activeMode === Modes.tagedit) {
		openTagEditPrompt(tag);
		return;
	}
	addActiveFilters({tags: [tag]});
}

function updateStats() {
	STATS_ELEM.textContent = `${mediaState.getMediaListSize()} items • Window: ${window.innerWidth}x${window.innerHeight}px`;
}

// Provide either idx or hash, if both present idx overwrites hash
async function openLightbox({idx = null, hash = null, updateHistory = true}) {
	activeMode = Modes.lightbox;
	if (idx !== null) {
		mediaState.setCurrentMedia(idx);
		hash = mediaState.getCurrentMediaHash();
	}
	else if (hash == null) {
		console.error("No index or hash provided!");
		return;
	}

	const media = mediaState.getMedia(hash);
	showLightbox({
		hash: hash,
		mediaName: media.name,
		vid: media.video,
		updateHistory: updateHistory,
		mediaRotation: media.rotation,
		infoPanelWidthOffset: (
			isInfoPanelOpen()
				? document.getElementById('info-panel').clientWidth : 0
		)
	});

	// Update info panel if it's open
	if (isInfoPanelOpen()) {
		await updateInfoPanel({
			media: {
				hash: mediaState.getCurrentMediaHash(),
				idx: mediaState.getCurrentMediaIndex(),
				...mediaState.getCurrentMedia()
			},
			mediaCount: mediaState.getMediaListSize(),
			handlePathButtons: addPathFilter,
			handleTagButtons: handleTagButton
		});
		document.getElementById('info-panel').classList.add('active');
	}
}

function closeLightbox({pushState = true} = {}) {
	hideLightbox({ pushState: pushState });

	activeMode = Modes.none;
	document.getElementById('info-panel').classList.remove('active');
}

async function nextMedia() {
	document.getElementById('lightbox-vid').removeAttribute('src');
	mediaState.setCurrentMedia(1, true);
	await openLightbox({idx: mediaState.getCurrentMediaIndex()});
}

async function prevMedia() {
	document.getElementById('lightbox-vid').removeAttribute('src');
	mediaState.setCurrentMedia(-1, true);
	await openLightbox({idx: mediaState.getCurrentMediaIndex()});
}

// Toggle info panel
galleryEvents.on(
	EVENTNAMES.TOGGLE_INFO_PANEL, 
	async () => {
		if (isInfoPanelOpen()) {
			closeInfoPanel();
			return;
		}

		document.querySelector('.lightbox').classList.add('info-open');
		document.getElementById('lightbox-button-info-panel').classList.add('active');
		await openInfoPanel({
			media: {
				hash: mediaState.getCurrentMediaHash(),
				idx: mediaState.getCurrentMediaIndex(),
				...mediaState.getCurrentMedia()
			},
			mediaCount: mediaState.getMediaListSize(),
			handlePathButtons: addPathFilter,
			handleTagButtons: handleTagButton
		});
		rotateLightboxImg(
			mediaState.getCurrentMedia().rotation,
			document.getElementById('info-panel').clientWidth
		);
	}
);

function closeInfoPanel() {
	setInfoPanelClosed();
	document.getElementById('info-panel').classList.remove('active');
	document.querySelector('.lightbox').classList.remove('info-open');
	document.getElementById('lightbox-button-info-panel').classList.remove('active');
}

async function rotate(clockwise) {
	const err = await api_rotate({
		hash: mediaState.getCurrentMediaHash(),
		clockwise: clockwise
	});
	if (err) {
		console.log(err);
		return;
	}

	// Apply now
	let rotation = mediaState.getCurrentMedia().rotation;
	if (rotation == null) {
		rotation = 0;
	}
	rotation = (rotation + ((clockwise) ? 90 : -90) + 360) % 360;
	mediaState.getCurrentMedia().rotation = rotation;
	rotateLightboxImg(
		mediaState.getCurrentMedia().rotation,
		document.getElementById('info-panel').clientWidth
	);

	// Update info panel if it's open
	if (isInfoPanelOpen()) {
		await updateInfoPanel({
			media: {
				hash: mediaState.getCurrentMediaHash(),
				idx: mediaState.getCurrentMediaIndex(),
				...mediaState.getCurrentMedia()
			},
			mediaCount: mediaState.getMediaListSize(),
			handlePathButtons: addPathFilter,
			handleTagButtons: handleTagButton
		});
	}
}

function toggleMediaSelection(e, mediaIdx) {
	if (selectedItems.has(mediaIdx)) {
		selectedItems.delete(mediaIdx);
		e.target.classList.remove('selected');
	} else {
		selectedItems.add(mediaIdx);
		e.target.classList.add('selected');
	}
	updateSelectModeMediaCount();
}

function updateSelectModeMediaCount() {
	document.getElementById('select-mode-media-count').innerText = selectedItems.size;
}

function handleCheckboxMouseDown(e, checkbox, imgIdx) {
	checkbox.checked = !checkbox.checked;
	checkSelect = checkbox.checked;
	toggleMediaSelection(e, imgIdx);
}

function handleCheckboxMouseEnter(e, checkbox, imgIdx) {
	if (mouseDown && (checkbox.checked !== checkSelect)) {
		checkbox.checked = !checkbox.checked;
		toggleMediaSelection(e, imgIdx);
	}
}

// Debounced resize handler
let resizeTimeout;
function handleResize() {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => {
		updateStats();
		if (mediaState.getMediaListSize() > 0) {
			renderGallery({
				indexedMedia: mediaState.getAllMediaIndexed(),
				parentElem: GALLERY_CONTAINER,
				handleImgClick: openLightbox,
				handleCheckboxMouseDown: handleCheckboxMouseDown,
				handleCheckboxMouseEnter: handleCheckboxMouseEnter
			});
		}

		// Close info panel if switching between mobile/desktop
		if (isInfoPanelOpen()) {
			closeInfoPanel();
		}
	}, 350);
}

let lastTagPromptInput = "";

function openTagPrompt() {
	lastActiveMode = activeMode;
	activeMode = Modes.tagprompt;
	openInputPrompt({
		header: "Add Tags",
		placeholder: "Tag name",
		value: lastTagPromptInput
	});
}

function closeTagPrompt() {
	const input = document.getElementById('input-input');
	lastTagPromptInput = input.value;
	closeInputPrompt();
	input.blur();	// Unfocus
	activeMode = lastActiveMode;
}

async function handleInputConfirm() {
	if (activeMode === Modes.tagprompt) {
		await addTag();
	}
	else if (activeMode === Modes.tagedit) {
		await editTag();
	}
}

function handleInputCancel() {
	switch (activeMode) {
		case Modes.tagedit:
			closeInputPrompt();
			document.getElementById('input-action-extra').classList.remove('active');
			break;

		case Modes.tagprompt:
			closeTagPrompt();
			break;

		default:
			break;
	}
}

async function tagPromptRequest({data, method, toastMsg, errorPrefix}) {
	try {
		const response = await fetch('/api/tags', {
			method: method,
			headers: {
				'Content-Type': "application/json",
			},
			body: JSON.stringify(data),
		});

		const resp = await response.json();
		if (!response.ok || !resp['success']) {
			throw new Error(resp['msg']);
		}

		// Clear tag cache
		await clearCache(TAGS_CACHE);

		updateAllTags();

		closeTagPrompt();

		createToast({
			msg: toastMsg,
			bgColor: '#4ad466'
		});
	} catch (error) {
		showInputErr(errorPrefix + error.message);
	}
}

async function addTag() {
	let data = {
		'tag': [],
		'hashes': mediaState.getHashesAtIndices(Array.from(selectedItems))
	};

	for (const t of document.getElementById('input-input').value.split(' ')) {
		data['tag'].push(t);
	}

	tagPromptRequest({
		data: data,
		method: 'POST',
		toastMsg: `Successfully added ${data['tag'].length} tags to ${data['hashes'].length} items`,
		errorPrefix: "Error adding tag:<br>"
	});
}

async function editTag() {
	let data = {
		'old_tag': currentTagEdit,
		'new_tag': document.getElementById('input-input').value
	};

	tagPromptRequest({
		data: data,
		method: 'PUT',
		toastMsg: `Successfully edited ${data['old_tag']} as ${data['new_tag']}`,
		errorPrefix: "Error editing tag:<br>"
	});
}

async function removeTag() {
	let data = {
		'tags': [currentTagEdit]
	};

	tagPromptRequest({
		data: data,
		method: 'DELETE',
		toastMsg: `Successfully removed ${data['tags'].length} tags`,
		errorPrefix: "Error removing tag:<br>"
	});
}

function toggleTagEditMode() {
	const headerButton = document.getElementById('header-item-edit-tags');
	if (activeMode === Modes.none) {
		activeMode = Modes.tagedit;
		headerButton.classList.add('active');
	}
	else if (activeMode === Modes.tagedit) {
		headerButton.classList.remove('active');
		activeMode = Modes.none;
	}
}

function selectModeSelectAll() {
	for (let i=0; i<mediaState.getMediaListSize(); i++) {
		selectedItems.add(i);
	}
	document.querySelectorAll('.selection-checkbox').forEach(e => {
		e.classList.add('selected');
	});
	updateSelectModeMediaCount();
}

function selectModeDeselectAll() {
	for (let i=0; i<mediaState.getMediaListSize(); i++) {
		selectedItems.delete(i);
	}
	document.querySelectorAll('.selection-checkbox').forEach(e => {
		e.classList.remove('selected');
	});
	updateSelectModeMediaCount();
}

function toggleSelectionMode() {
	const selectModeBar = document.getElementById('select-mode-info-bar');
	if (activeMode === Modes.select) {
		activeMode = Modes.none;
		selectModeBar.classList.remove('active');
		cssRules['.selection-checkbox'].style.opacity = 0;
		cssRules['.selection-checkbox'].style.pointerEvents = 'none';
	}
	else {
		activeMode = Modes.select;
		selectModeBar.classList.add('active');
		cssRules['.selection-checkbox'].style.pointerEvents = 'all';
		cssRules['.selection-checkbox'].style.opacity = 1;
	}
}
SELECT_MODE_CHECKBOX.addEventListener('change', function() {
	toggleSelectionMode();
});

document.getElementById('select-mode-deselect-all').addEventListener('click', () => {
	selectModeDeselectAll();
});
document.getElementById('select-mode-select-all').addEventListener('click', () => {
	selectModeSelectAll();
});
document.getElementById('select-mode-open-tags').addEventListener('click', () => {
	openTagPrompt();
});

document.getElementById('input-action-extra').addEventListener('click', () => {
	handleInputExtra();
});
document.getElementById('input-action-cancel').addEventListener('click', () => {
	handleInputCancel();
});
document.getElementById('input-action-confirm').addEventListener('click', () => {
	handleInputConfirm();
});

document.getElementById('lightbox-close').addEventListener('click', () => {
	closeLightbox();
});
document.getElementById('lightbox-prev').addEventListener('click', () => {
	prevMedia();
});
document.getElementById('lightbox-next').addEventListener('click', () => {
	nextMedia();
});
document.getElementById('lightbox-button-counter-clockwise').addEventListener('click', () => {
	rotate(false);
});
document.getElementById('lightbox-button-clockwise').addEventListener('click', () => {
	rotate(true);
});
document.getElementById('info-panel-close').addEventListener('click', () => {
	closeInfoPanel();
});
document.getElementById('scroll-to-top-button').addEventListener('click', () => {
	window.scrollTo({top: 0, behavior: 'smooth'});
});
document.getElementById('header-item-video').addEventListener('click', () => {
	addActiveFilters({types: ['video']});
});
document.getElementById('header-item-edit-tags').addEventListener('click', () => {
	toggleTagEditMode();
});
/*
document.getElementById('').addEventListener('click', () => {
});
*/

// Close lightbox by clicking outside the image
document.getElementById('lightbox-media-container').addEventListener('click', (e) => {
	if (e.target.id === 'lightbox-media-container') {
		closeLightbox();
	}
});
document.getElementById('input-overlay').addEventListener('click', (e) => {
	if (e.target.id === 'input-overlay') {
		handleInputCancel();
	}
});

document.getElementById('input-input').addEventListener('keydown', e => {
	if (e.key === 'Enter') {
		handleInputConfirm();
	}
});

// Global keybinds
document.addEventListener('keydown', (e) => {
	switch (activeMode) {
		case Modes.lightbox:
			switch (e.key) {
				case 'Escape':
					closeLightbox();
					break;
				case 'ArrowRight':
					nextMedia();
					break;
				case 'ArrowLeft':
					prevMedia();
					break;
				case 'i':
					galleryEvents.trigger(EVENTNAMES.TOGGLE_INFO_PANEL);
					break;
			}
			break;

		case Modes.select:
			switch (e.key) {
				case 's':
				case 'Escape':
					toggleSelectionMode();
					SELECT_MODE_CHECKBOX.checked = false;
					break;
				case 'a':
					// Deselect all if all is selected
					if (selectedItems.size === mediaState.getMediaListSize()) {
						selectModeDeselectAll();
					}
					else {
						selectModeSelectAll();
					}
					break;
				case 'A':
					// Select all if none is selected
					if (selectedItems.size === 0) {
						selectModeSelectAll();
					}
					else {
						selectModeDeselectAll();
					}
					break;
				case 't':
					e.preventDefault();
					openTagPrompt();
					break;
			}
			break;

		case Modes.tagprompt:
			switch(e.key) {
				case 'Escape':
					closeTagPrompt();
					break;
			}
			break;

		case Modes.tagedit:
			switch(e.key) {
				case 'e':
					if (e.target.id === 'input-input') {
						break;
					}
					toggleTagEditMode();
					break;
			}
			break;

		case Modes.none:
		default:
			switch (e.key) {
				case 'ArrowRight':
				case 'ArrowLeft':
					openLightbox({idx: mediaState.getCurrentMediaIndex()});
					break;
				case 's':
					SELECT_MODE_CHECKBOX.checked = true;
					toggleSelectionMode();
					break;
				case 'e':
					toggleTagEditMode();
					break;
			}
			break;
	}
});

document.body.addEventListener('mousedown', () => {
	mouseDown = true;
});

document.body.addEventListener('mouseup', () => {
	mouseDown = false;
});
document.documentElement.addEventListener('mouseleave', (event) => {
	if (
		event.clientY <= 0 ||
		event.clientX <= 0 ||
		event.clientX >= window.innerWidth ||
		event.clientY >= window.innerHeight
	) {
		mouseDown = false;
	}
});


// Event listeners
window.addEventListener('resize', () => {
	// Ignore height resizes
	let currWidth = window.innerWidth;
	if (currWidth !== lastWinWidth) {
		lastWinWidth = currWidth;
		handleResize();
	}
});

// Detects backwards and forwards navigation
window.addEventListener('popstate', function(e) {
	if (e.state) {
		loadMedia({pushState: false});
	}
});


window.addEventListener('load', loadMedia);
// Load images immediately if DOM is already ready
// if (document.readyState === 'loading') {
// 	document.addEventListener('DOMContentLoaded', loadMedia);
// } else {
// 	loadMedia();
// }

