import { clearCache, getJSONCache } from "./cache.js";
import { EVENTNAMES, galleryEvents } from "./events/galleryevents.js";
import { filterState } from "./states/filter.js";
import { mediaState } from "./states/media.js";
import { mouseState } from "./states/mouse.js";
import { selectionState } from "./states/selection.js";
import { TAG_STATUS } from "./states/tags.js";
import { touchState } from "./states/touch.js";
import { createPathButtons, ismobile } from "./ui/dom.js";
import { renderGallery } from "./ui/gallery.js";
import { infoPanel } from "./ui/infopanel.js";
import { lightbox } from "./ui/lightbox.js";
import { openInputPrompt, closeInputPrompt, showInputErr } from "./ui/prompt.js";
import { createToast } from "./ui/toast.js";
import { api_rotate } from "./utils/api.js";

const GALLERY_CONTAINER = document.getElementById('gallery');
const STATS_ELEM = document.getElementById('stats');
const SELECT_MODE_CHECKBOX = document.getElementById('select-mode-checkbox');
let lastWinWidth = window.innerWidth;

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
	let tags = [], itags = [], types = [];
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

				case 'itag':
					itags.push(fieldVal);
					break;

				case 'types':
					types.push(fieldVal);
					break;

				default:
					break;
			}
		});
	}

	loadMediaByFilter({
		path: path,
		tags: tags,
		inverseTags: itags,
		types: types,
		pushState: pushState
	});
}

function addActiveTagFilter(tag) {
	addActiveFilters({ tags: [tag] });
}

async function addActiveFilters({tags = [], types = []}) {
	if (tags.length > 0) {
		tags.forEach(tag => {
			filterState.setTagActive(tag);
		});
	}

	if (types.length > 0) {
		types.forEach(type => {
			filterState.addType(type);
		});
	}

	loadMediaByCurrentFilters();
}

function loadMediaByCurrentFilters() {
	loadMediaByFilter({
		path: currentPath,
		tags: filterState.getAllTagsActive(),
		inverseTags: filterState.getAllTagsInverse(),
		types: filterState.getTypes()
	});
}

async function updateAllTags() {
	const tags = await getJSONCache('/api/tags', TAGS_CACHE);
	const allTagsFilter = document.getElementById('filter-all-tags');

	if (tags['data'].length === 0) {
		allTagsFilter.innerText = 'None';
		return
	}

	const editingTag = (t) => {
		if (activeMode === Modes.tagedit) {
			openTagEditPrompt(t);
			return true;
		}
		return false;
	}

	const filterInactive = t => { filterState.setTagInactive(t) };
	const filterActive = t => { filterState.setTagActive(t) };
	const filterInverse = t => { filterState.setTagInverse(t) };

	allTagsFilter.innerHTML = '';
	tags['data'].forEach(tag => {
		const button = document.createElement('a');
		button.textContent = tag;

		let callback;
		switch(filterState.getTagState(tag)) {
			case TAG_STATUS.INACTIVE:
				button.className = 'inactive';
				callback = filterActive;
				break;
			case TAG_STATUS.ACTIVE:
				button.className = 'active';
				callback = filterInverse;
				break;
			case TAG_STATUS.INVERSE:
				button.className = 'inverse';
				callback = filterInactive;
				break;
		}

		button.addEventListener('click', () => {
			if (editingTag(tag))
				return;

			callback(tag);
			loadMediaByCurrentFilters();
		});

		allTagsFilter.appendChild(button);
	});

}

async function loadMediaByFilter({
	path = null,
	tags = [],
	inverseTags = [],
	types = [],
	pushState = true
} = {}) {
	filterState.clearTags();
	filterState.clearTypes();
	selectionState.clear();
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
			filterState.setTagActive(tag);
		}
		inverseTags.forEach((tag) => {
			queryparam.push("itag="+tag);
			filterState.setTagInverse(tag);
		});

		if (types.length > 0) {
			for (const t of types) {
				filterState.addType(t);
			}
			queryparam.push("types=" + filterState.getTypes().join(','));
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
				handleCheckboxMouseEnter: handleCheckboxMouseEnter,
				handleCheckboxTouchStart: handleCheckboxTouchStart,
				handleCheckboxTouchEnd: handleCheckboxTouchEnd,
			});
		}

		updateAllTags();
		mediaState.setCurrentMedia(0);
	} catch (error) {
		console.error('Error loading images:', error);
		GALLERY_CONTAINER.innerHTML = '<div class="error">Error loading images. Please check the console for details.</div>';
	}
}

function addPathFilter(path) {
	loadMediaByFilter({
		path: path,
		tags: filterState.getAllTagsActive(),
		inverseTags: filterState.getAllTagsInverse(),
		types: filterState.getTypes()
	});
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

function handleTagRemoveButtons(tag, hash) {
	if (!confirm(`Remove tag ${tag} from media?`))
		return;
	tagPromptRequest({
		data: {
			'tags': [tag],
			'hashes': [hash],
		},
		method: 'DELETE',
		toastMsg: `Successfully removed tag '${tag}' from media`,
		errorPrefix: "Error removing tag:<br>"
	});
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
	lightbox.showLightbox({
		hash: hash,
		mediaName: media.name,
		vid: media.video,
		updateHistory: updateHistory,
		mediaRotation: media.rotation,
		infoPanelWidthOffset: (
			infoPanel.isOpen()
				? document.getElementById('info-panel').clientWidth : 0
		)
	});

	// Update info panel if it's open
	if (infoPanel.isOpen()) {
		await infoPanel.update({
			media: {
				hash: mediaState.getCurrentMediaHash(),
				idx: mediaState.getCurrentMediaIndex(),
				...mediaState.getCurrentMedia()
			},
			mediaCount: mediaState.getMediaListSize(),
			handlePathButtons: addPathFilter,
			handleTagButtons: addActiveTagFilter,
			tagRemoveHandler: handleTagRemoveButtons,
		});
		document.getElementById('info-panel').classList.add('active');
	}
}

function closeLightbox({pushState = true} = {}) {
	lightbox.hideLightbox({ pushState: pushState });

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
		if (infoPanel.isOpen()) {
			infoPanel.close();
			return;
		}

		await infoPanel.open({
			media: {
				hash: mediaState.getCurrentMediaHash(),
				idx: mediaState.getCurrentMediaIndex(),
				...mediaState.getCurrentMedia()
			},
			mediaCount: mediaState.getMediaListSize(),
			handlePathButtons: addPathFilter,
			handleTagButtons: addActiveTagFilter,
			tagRemoveHandler: handleTagRemoveButtons,
		});
		lightbox.rotateLightboxImg(
			mediaState.getCurrentMedia().rotation,
			document.getElementById('info-panel').clientWidth
		);
	}
);

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
	lightbox.rotateLightboxImg(
		mediaState.getCurrentMedia().rotation,
		document.getElementById('info-panel').clientWidth
	);

	// Update info panel if it's open
	if (infoPanel.isOpen()) {
		await infoPanel.update({
			media: {
				hash: mediaState.getCurrentMediaHash(),
				idx: mediaState.getCurrentMediaIndex(),
				...mediaState.getCurrentMedia()
			},
			mediaCount: mediaState.getMediaListSize(),
			handlePathButtons: addPathFilter,
			handleTagButtons: addActiveTagFilter,
			tagRemoveHandler: handleTagRemoveButtons,
		});
	}
}

function toggleMediaSelection(checkbox, mediaIdx) {
	if (selectionState.toggle(mediaIdx)) {
		checkbox.classList.add('selected');
	}
	else {
		checkbox.classList.remove('selected');
	}
	updateSelectModeMediaCount();
}

function updateSelectModeMediaCount() {
	document.getElementById('select-mode-media-count').innerText = selectionState.getCount();
}

function handleCheckboxTouchStart(checkbox, imgIdx) {
	const prevSelect = selectionState.getLast();
	setTimeout(() => {
		if (!touchState.isLongTouch()) return;

		let start = prevSelect, end = imgIdx;
		if (start > end)
			[start, end] = [end, start];

		const elems = document.querySelectorAll('.selection-checkbox');
		const checked = !checkbox.checked;
		const action = checked ? 'add' : 'remove';
		for (let i = start; i < end+1; i++) {
			elems[i].checked = checked;
			elems[i].classList[action]('selected');
			selectionState[action](i);
		}
		updateSelectModeMediaCount();
	}, 250);
}
function handleCheckboxTouchEnd(checkbox, imgIdx) {
	if (touchState.hasMoved()) return;
	selectionState.setLast(imgIdx);
	if (touchState.isLongTouch()) return;

	checkbox.checked = !checkbox.checked;
	checkSelect = checkbox.checked;
	toggleMediaSelection(checkbox, imgIdx);
}

function handleCheckboxMouseDown(checkbox, imgIdx) {
	if (ismobile()) return;
	checkbox.checked = !checkbox.checked;
	checkSelect = checkbox.checked;
	toggleMediaSelection(checkbox, imgIdx);
}

function handleCheckboxMouseEnter(checkbox, imgIdx) {
	if (mouseState.isDown() && (checkbox.checked !== checkSelect)) {
		checkbox.checked = !checkbox.checked;
		toggleMediaSelection(checkbox, imgIdx);
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
				handleCheckboxMouseEnter: handleCheckboxMouseEnter,
				handleCheckboxTouchStart: handleCheckboxTouchStart,
				handleCheckboxTouchEnd: handleCheckboxTouchEnd,
			});
		}

		// Close info panel if switching between mobile/desktop
		if (infoPanel.isOpen()) {
			infoPanel.close();
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
		'hashes': mediaState.getHashesAtIndices(selectionState.getArray())
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
		selectionState.add(i);
	}
	document.querySelectorAll('.selection-checkbox').forEach(e => {
		e.classList.add('selected');
	});
	updateSelectModeMediaCount();
}

function selectModeDeselectAll() {
	for (let i=0; i<mediaState.getMediaListSize(); i++) {
		selectionState.remove(i);
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
		document.getElementById('gallery').classList.remove('select-mode');
	}
	else {
		activeMode = Modes.select;
		selectModeBar.classList.add('active');
		document.getElementById('gallery').classList.add('select-mode');
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
	infoPanel.close();
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
					if (selectionState.getCount() === mediaState.getMediaListSize()) {
						selectModeDeselectAll();
					}
					else {
						selectModeSelectAll();
					}
					break;
				case 'A':
					// Select all if none is selected
					if (selectionState.getCount() === 0) {
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

