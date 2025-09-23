import { clearCache, getJSONCache } from "./cache.js";

let allMedia = new Map();
let allMediaIdx = [];
let allTags = {};
const activeTags = new Set();
const GALLERY_CONTAINER = document.getElementById('gallery');
const STATS_ELEM = document.getElementById('stats');
const SELECT_MODE_CHECKBOX = document.getElementById('select-mode-checkbox');
let observer;
let currMediaIdx = 0;
let lastWinWidth = window.innerWidth;
let infoPanelOpen = false;

let selectedItems = new Set();
let mouseDown = false;
let checkSelect = true;

let currentTagEdit = '';

let currentPath = null;
const TAGS_CACHE = 'tags-cache';

const TOAST_CONTAINER = document.getElementById('toast-container');
const FIRST_TOAST = document.getElementById('first-toast');
let lastToast = FIRST_TOAST;

let prevPathName = '/';

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

const lightboxVid = document.getElementById('lightbox-vid');

let cssRules = {};
const sheet = document.styleSheets[0].cssRules;
for (let i = 0; i < sheet.length; i++) {
	cssRules[sheet[i].selectorText] = sheet[i];
}

// Fetch media info from API
async function updateAllMedia(queryParams='') {
	const response = await fetch('/api/media' + queryParams);
	const jsonResp = await response.json();
	allMedia = new Map(jsonResp['data']);
	allMediaIdx = Array.from(allMedia.keys());
}

async function loadMedia({pushState = true} = {}) {
	if (window.location.pathname.startsWith('/lightbox/')) {
		const mediaHash = window.location.pathname.slice(10);
		if (allMedia.get(mediaHash, null) == null) {
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

async function addActiveFilters({tags = []}) {
	tags.forEach(tag => {
		activeTags.add(tag);
	});
	loadMediaByFilter({path: currentPath, tags: Array.from(activeTags)});
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

async function loadMediaByFilter({path = null, tags = [], pushState = true} = {}) {
	activeTags.clear();
	selectedItems = new Set();
	updateSelectModeMediaCount();
	SELECT_MODE_CHECKBOX.checked = false;

	activeMode = Modes.select;
	toggleSelectionMode();
	// Reset tag edit
	document.getElementById('header-item-edit-tags').classList.remove('active');

	closeLightbox({pushState: pushState});

	currentPath = path;
	currMediaIdx = 0;

	try {
		let queryparam = [];
		if (path !== null) {
			queryparam.push("path="+path);
		}

		for (const tag of tags) {
			queryparam.push("tag="+tag);
			activeTags.add(tag);
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
		pathFilter.appendChild(createPathButtons(path));

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

		if (allMedia.size === 0) {
			GALLERY_CONTAINER.innerHTML = '<div class="error">No images found.</div>';
		}
		else {
			renderGallery();
		}
	} catch (error) {
		console.error('Error loading images:', error);
		GALLERY_CONTAINER.innerHTML = '<div class="error">Error loading images. Please check the console for details.</div>';
	}
}

function addPathFilter(path) {
	loadMediaByFilter({path: path, tags: Array.from(activeTags)})
}

function createPathButtons(path) {
	if (path == null) {
		path = '/';
	}

	const container = document.createElement('div');
	const basePath = document.createElement('a');
	basePath.innerText = 'ALL';
	basePath.title = 'Show media with any path';
	basePath.addEventListener('click', () => {
		addPathFilter(null);
	});
	container.appendChild(basePath);
	container.appendChild(document.createTextNode('/'));

	let cumPath = '';
	if (path !== '/') {
		path.split('/').slice(0, -1).forEach(segment => {
			cumPath += segment + "/";
			const currCumPath = cumPath;

			const pathButton = document.createElement('a');
			pathButton.title = "Show only media in '" + currCumPath + "'";
			pathButton.innerText = segment;
			pathButton.addEventListener('click', () => {
				addPathFilter(currCumPath);
			});

			container.appendChild(pathButton);
			container.appendChild(document.createTextNode('/'));
		});
	}

	return container;
}

async function createInfoTagButtons(hash) {
	if (!(hash in allTags)) {
		let resp = await getJSONCache('/api/tags?hash=' + hash, TAGS_CACHE);

		if (!resp['success']) {
			console.error("Failed to get tags data.")
			return '';
		}

		allTags[hash] = resp['data'];
	}

	if (allTags[hash].length == 0) {
		return 'None';
	}

	const container = document.createElement('div');
	for (const tag of allTags[hash]) {
		const tagButton = document.createElement('a');
		tagButton.innerText = tag;
		tagButton.addEventListener('click', () => {
			handleTagButton(tag);
		});

		container.appendChild(tagButton);
	}
	return container;
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

function openInputPrompt({header, placeholder, value=''}) {
	document.getElementById('input-info-header').innerText = header;
	const input = document.getElementById('input-input');
	input.placeholder = placeholder;
	input.value = value;
	document.getElementById('input-overlay').classList.add('active');
	input.select();
}

function closeInputPrompt() {
	hideInputErr();
	document.getElementById('input-overlay').classList.remove('active');
}

function handleTagButton(tag) {
	if (activeMode === Modes.tagedit) {
		openTagEditPrompt(tag);
		return;
	}
	addActiveFilters({tags: [tag]});
}

function updateStats() {
	STATS_ELEM.textContent = `${allMedia.size} items • Window: ${window.innerWidth}x${window.innerHeight}px`;
}

// Intersection Observer setup for lazy loading
function setupObserver() {
	if (observer) {
		observer.disconnect();
	}
	observer = new IntersectionObserver(
		(entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const item = entry.target;
					if (!item.src) {
						item.src = item.dataset.src;
						observer.unobserve(item);
					}
				}
			});
		},
		{ rootMargin: '200px' }
	);
}

// Logic to decide row height and items in row
function calculateRows(viewWidth) {
	// Magic number 200; fix with config
	const targetRatio = viewWidth / 200;
	const rows = [];
	let lastImg = 0;

	while (lastImg < allMedia.size) {
		let prevRatioDiff = targetRatio;
		let currTotalRatio = 0;
		let colInRow = lastImg;

		for (let idx = lastImg; idx < allMedia.size; idx++) {
			const currMedia = allMedia.get(allMediaIdx[idx]);
			currTotalRatio += currMedia.aspectRatio;

			// Current ratio diff > previous
			if (Math.abs(targetRatio - currTotalRatio) > prevRatioDiff) {
				currTotalRatio -= currMedia.aspectRatio;

				// If the single image is very wide
				// Needed to prevent infinite loop
				if (idx == lastImg) {
					currTotalRatio = currMedia.aspectRatio;
					colInRow = idx + 1;
				} else {
					colInRow = idx;
				}
				break;
			}
			prevRatioDiff = Math.abs(targetRatio - currTotalRatio);

			// If we've reached the end of images
			if (idx === allMedia.size - 1) {
				colInRow = idx + 1;
				break;
			}
		}

		// Same height for all img in row
		// Magic number
		const imgh = Math.max(85, viewWidth / currTotalRatio); // Min height of 100px

		// Create row data
		const rowImages = [];
		for (let i = lastImg; i < colInRow; i++) {
			const currMedia = allMedia.get(allMediaIdx[i]);
			const imgw = (currMedia.aspectRatio / currTotalRatio) * viewWidth;
			rowImages.push({
				hash: allMediaIdx[i],
				...currMedia,
				width: Math.max(50, imgw - 8), // Account for margin, min width
				height: imgh,
				idx: i
			});
		}

		rows.push(rowImages);
		lastImg = colInRow;
	}

	const lastRow = rows.slice(-1)[0];
	const maxRowHeight = 280;
	if (lastRow[0].height > maxRowHeight) {
		for (let i = 0; i < lastRow.length; i++) {
			lastRow[i].width = lastRow[i].aspectRatio * maxRowHeight;
			lastRow[i].height = maxRowHeight;
		}
		rows[rows.length - 1] = lastRow
	}

	return rows;
}

// Provide either idx or hash, if both present idx overwrites hash
async function openLightbox({idx = null, hash = null, updateHistory = true}) {
	activeMode = Modes.lightbox;
	if (idx !== null) {
		currMediaIdx = idx;
		hash = allMediaIdx[idx];
	}
	else if (hash == null) {
		console.error("No index or hash provided!");
		return;
	}

	if (updateHistory) {
		if (!(window.location.pathname.startsWith('/lightbox/'))) {
			prevPathName = window.location.pathname + window.location.search;
		}
		window.history.pushState({}, '', '/lightbox/' + hash);
	}

	const lightboxImg = document.getElementById('lightbox-img');
	const lightboxVid = document.getElementById('lightbox-vid');

	document.getElementById('lightbox').classList.add('active');
	showLightboxButtons();

	if (allMedia.get(hash).video === false) {
		rotateLightboxImg();
		lightboxImg.src = `/media/${hash}/original`;
		lightboxImg.alt = allMedia.get(hash).name;

		lightboxImg.classList.add('active');
		lightboxVid.classList.remove('active');
	}
	else {
		lightboxVid.src = `/media/${hash}/original`;

		lightboxVid.classList.add('active');
		lightboxImg.classList.remove('active');
	}

	// Update info panel if it's open
	if (infoPanelOpen) {
		await updateInfoPanel();
		document.getElementById('info-panel').classList.add('active');
	}

	// Prevent Scrolling
	document.body.style.overflow = 'hidden';
}

function rotateLightboxImg() {
	const lightboxImg = document.getElementById('lightbox-img');
	const currMediaHash = allMediaIdx[currMediaIdx];

	lightboxImg.style.maxWidth = '90%';
	lightboxImg.style.maxHeight = '96%';
	const mediaRotation = allMedia.get(currMediaHash).rotation;
	if (mediaRotation !== null) {
		lightboxImg.style.transform = 'rotate(' + mediaRotation + 'deg)';
		const infoPanelWidth = (infoPanelOpen) ? document.getElementById('info-panel').clientWidth : 0;

		if (mediaRotation === 90 || mediaRotation === 270) {
			const lightbox = document.getElementById('lightbox');
			// Swap width and height
			lightboxImg.style.maxWidth = (lightbox.clientHeight*0.96) + 'px';
			lightboxImg.style.maxHeight = (lightbox.clientWidth*0.9 - infoPanelWidth) + 'px';
		}
	}
	else {
		lightboxImg.style.transform = '';
	}
}

function closeLightbox({pushState = true} = {}) {
	const lightboxVid = document.getElementById('lightbox-vid');
	lightboxVid.removeAttribute('src');
	lightboxVid.load();

	hideLightboxButtons();

	activeMode = Modes.none;

	document.getElementById('lightbox').classList.remove('active');
	document.getElementById('lightbox-button-row').classList.remove('active');
	document.getElementById('info-panel').classList.remove('active');

	if (pushState) {
		window.history.pushState({}, '', prevPathName);
		prevPathName = '/';
	}

	// Restore Scrolling
	document.body.style.overflow = '';
}

async function nextMedia() {
	document.getElementById('lightbox-vid').removeAttribute('src');
	currMediaIdx = (currMediaIdx + 1) % allMedia.size;
	await openLightbox({idx: currMediaIdx});
}

async function prevMedia() {
	document.getElementById('lightbox-vid').removeAttribute('src');
	currMediaIdx = (currMediaIdx - 1 + allMedia.size) % allMedia.size;
	await openLightbox({idx: currMediaIdx});
}

async function toggleInfoPanel() {
	const infoButton = document.getElementById('lightbox-button-info-panel');

	if (infoPanelOpen) {
		closeInfoPanel();
		infoButton.classList.remove('active');
	} else {
		await openInfoPanel();
		infoButton.classList.add('active');
	}
}

async function openInfoPanel() {
	const infoPanel = document.getElementById('info-panel');
	const lightboxContent = document.querySelector('.lightbox');

	infoPanelOpen = true;
	infoPanel.classList.add('active');
	lightboxContent.classList.add('info-open');
	rotateLightboxImg();
	await updateInfoPanel();
}

function closeInfoPanel() {
	const infoPanel = document.getElementById('info-panel');
	const lightboxContent = document.querySelector('.lightbox');
	const infoButton = document.getElementById('lightbox-button-info-panel');

	infoPanelOpen = false;
	infoPanel.classList.remove('active');
	lightboxContent.classList.remove('info-open');
	infoButton.classList.remove('active');
}

async function updateInfoPanel() {
	if (!infoPanelOpen || currMediaIdx >= allMedia.size) return;

	const media = allMedia.get(allMediaIdx[currMediaIdx]);
	const infoContent = document.getElementById('info-content');

	// Format file size
	const formatFileSize = (bytes) => {
		if (!bytes) return 'Unknown';
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
	};

	// Format date
	const formatDate = (timestamp) => {
		if (!timestamp) return 'Unknown';
		const date = new Date(timestamp);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	};

	const infoData = new Map([
		["File Information", new Map([
			["Name", media.name || 'Unknown'],
			["Type", media.video ? 'Video' : 'Image'],
			["Size", formatFileSize(media.size)],
			["Dimensions", (media.width || '?') + ' x ' + (media.height || '?')],
			["Aspect Ratio", media.aspectRatio ? media.aspectRatio.toFixed(2) : 'Unknown'],
			["Duration", (media.video && media.duration) ? media.duration : '-'],
			["Rotation", (media.rotation || 0) + '&deg;'],
			["Path", createPathButtons(media.path) || 'Unknown']
		])],
		["Technical Details", new Map([
			["Hash", allMediaIdx[currMediaIdx]],
			["Created", formatDate(media.dateCreated)],
			["Modified", formatDate(media.dateModified)]
		])],
		["Gallery Info", new Map([
			["Index", (currMediaIdx + 1) + ' of '  + allMedia.size],
			["Display Size", Math.round(media.width || 0) + ' x ' + Math.round(media.height || 0)],
			["Tags", await createInfoTagButtons(allMediaIdx[currMediaIdx])],
		])]
	]);
	infoContent.innerHTML = "";
	for (const [infoSection, infoItems] of infoData) {
		const infoSectionElem = document.createElement('div');
		infoSectionElem.className = 'info-section';

		const infoSectionHeaderElem = document.createElement('h3');
		infoSectionHeaderElem.innerText = infoSection;
		infoSectionElem.appendChild(infoSectionHeaderElem);

		for (const [infoLabel, infoValue] of infoItems) {
			const infoItemElem = document.createElement('div');
			infoItemElem.className = 'info-item';

			const infoLabelElem = document.createElement('span');
			infoLabelElem.className = "info-label";
			infoLabelElem.innerHTML = infoLabel;
			infoItemElem.appendChild(infoLabelElem);

			const infoValueElem = document.createElement('span');
			infoValueElem.className = "info-value";
			if (infoValue instanceof Element) {
				infoValueElem.appendChild(infoValue);
			}
			else {
				infoValueElem.innerHTML = infoValue;
			}
			infoItemElem.appendChild(infoValueElem);

			infoSectionElem.appendChild(infoItemElem);
		}
		infoContent.appendChild(infoSectionElem);
	}
}

async function rotate(deg) {
	if (deg !== 90 && deg !== -90)
		return;

	const currMediaHash = allMediaIdx[currMediaIdx];

	const direction = (deg === 90) ? '/right' : '/left';
	const resp = await fetch(
		'/api/rotate/' + currMediaHash + direction,
		{method: 'POST'}
	);
	const jsonResp = await resp.json();
	if (!jsonResp.success)
		return;

	// Apply now
	let rotation = allMedia.get(currMediaHash).rotation;
	rotation = (rotation == null) ? 0 : rotation;
	allMedia.get(currMediaHash).rotation = (rotation + deg + 360) % 360;
	rotateLightboxImg();

	// Update info panel if it's open
	if (infoPanelOpen) {
		await updateInfoPanel();
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

function renderGallery() {
	const viewWidth = window.innerWidth - 16; // Account for padding
	const rows = calculateRows(viewWidth, allMedia);

	// Instead of clearing and recreating everything, reuse existing elements if possible
	// For simplicity here, we clear and re-render container but defer image src loading
	GALLERY_CONTAINER.innerHTML = '';

	rows.forEach(row => {
		const rowDiv = document.createElement('div');
		rowDiv.className = 'gallery-row';

		row.forEach(img => {
			const container = document.createElement('div');
			container.className = 'gallery-media-container';
			container.style.width = img.width + 'px';
			container.style.height = img.height + 'px';
			container.style.position = 'relative';

			const imgElement = document.createElement('img');
			// Use data-src for lazy loading, no initial src to prevent eager loading
			imgElement.dataset.src = '/media/' + img.hash + "/thumbnail";
			imgElement.className = 'gallery-media';
			imgElement.style.width = '100%';
			imgElement.style.height = '100%';
			imgElement.alt = img.name;
			imgElement.title = img.name;
			imgElement.loading = 'lazy'; // Works as fallback

			imgElement.addEventListener('click', () => openLightbox({idx: img.idx}));
			container.appendChild(imgElement);

			const checkbox = document.createElement('div');
			checkbox.checked = false;
			checkbox.className = 'selection-checkbox';
			if (selectedItems.has(img.idx)) {
				checkbox.classList.add('selected');
			}
			checkbox.addEventListener('mousedown', function(e) {
				this.checked = !this.checked;
				checkSelect = this.checked;
				toggleMediaSelection(e, img.idx);
			});
			checkbox.addEventListener('mouseenter', function(e) {
				if (mouseDown && (this.checked !== checkSelect)) {
					this.checked = !this.checked;
					toggleMediaSelection(e, img.idx);
				}
			});
			container.appendChild(checkbox);

			if (img.video === true && img.duration) {
				const durationDiv = document.createElement('div');
				durationDiv.className = 'video-duration';

				const playIcon = document.createElement('span');
				playIcon.className = 'play-icon';
				// Use a simple SVG play icon
				playIcon.innerHTML = `
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18" fill="white" width="12" height="12">
						<path d="M8 5v14l11-7z"/>
					</svg>
				`;
				durationDiv.appendChild(playIcon);
				durationDiv.appendChild(document.createTextNode(img.duration));

				container.appendChild(durationDiv);
			}

			rowDiv.appendChild(container);
		});
		GALLERY_CONTAINER.appendChild(rowDiv);
	});

	// After new elements added, observe their images for lazy loading
	setupObserver();
	// Start observing all images
	GALLERY_CONTAINER.querySelectorAll('img.gallery-media').forEach(img => observer.observe(img));
}

// Debounced resize handler
let resizeTimeout;
function handleResize() {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => {
		updateStats();
		if (allMedia.size > 0) {
			renderGallery();
		}

		// Close info panel if switching between mobile/desktop
		if (infoPanelOpen) {
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

		createToast(toastMsg, '#4ad466');
	} catch (error) {
		showInputErr(errorPrefix + error.message);
	}
}

async function addTag() {
	let data = {
		'tag': [],
		'hashes': []
	};

	for (const t of document.getElementById('input-input').value.split(' ')) {
		data['tag'].push(t);
	}
	for (const idx of selectedItems) {
		data['hashes'].push(allMediaIdx[idx]);
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

function showInputErr(msg) {
	let inputError = document.getElementById('input-error');
	inputError.classList.add('active');
	inputError.innerHTML = msg;
}
function hideInputErr() {
	let inputError = document.getElementById('input-error');
	inputError.classList.remove('active');
	inputError.innerText = '';
}

function createToast(msg, bgColor) {
	const toast = document.createElement('div');
	toast.classList.add('toast-banner');
	toast.innerText = msg;
	toast.style.backgroundColor = bgColor;

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
	}, 4000);
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
	for (let i=0; i<allMedia.size; i++) {
		selectedItems.add(i);
	}
	document.querySelectorAll('.selection-checkbox').forEach(e => {
		e.classList.add('selected');
	});
	updateSelectModeMediaCount();
}

function selectModeDeselectAll() {
	for (let i=0; i<allMedia.size; i++) {
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
	rotate(-90);
});
document.getElementById('lightbox-button-clockwise').addEventListener('click', () => {
	rotate(90);
});
document.getElementById('lightbox-button-info-panel').addEventListener('click', () => {
	toggleInfoPanel();
});
document.getElementById('info-panel-close').addEventListener('click', () => {
	closeInfoPanel();
});
document.getElementById('scroll-to-top-button').addEventListener('click', () => {
	window.scrollTo({top: 0, behavior: 'smooth'});
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

['play', 'pause', 'ended'].forEach(event =>
	lightboxVid.addEventListener(event, (e) => {
		const vid = e.target;
		if (vid.paused || vid.ended) {
			showLightboxButtons();
		}
		else {
			hideLightboxButtons();
		}
	})
);

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
					toggleInfoPanel();
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
					if (selectedItems.size === allMedia.size) {
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
					openLightbox({idx: currMediaIdx});
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

