let allMedia = [];
let allTags = {};
const activeTags = new Set();
let galleryContainer = document.getElementById('gallery');
let statsElement = document.getElementById('stats');
const selectModeCheckbox = document.getElementById('select-mode-checkbox');
let observer;
let currMediaIdx = 0;
let lastWinWidth = window.innerWidth;
let infoPanelOpen = false;

let selectedItems = new Set();
let lastSelected = null;
let mouseDown = false;
let checkSelect = true;

let currentPath = null;
const TAGS_CACHE = 'tags-cache';

const Toast_Container = document.getElementById('toast-container');
const First_Toast = document.getElementById('first-toast');
let lastToast = First_Toast;

const Modes = {
	none: 0,
	lightbox: 1,
	select: 2,
	tagprompt: 3
};
let activeMode = Modes.none;
let lastActiveMode = Modes.none;

const lightboxVid = document.getElementById('lightbox-vid');

let cssRules = {};
const sheet = document.styleSheets[0].cssRules;
for (let i = 0; i < sheet.length; i++) {
	cssRules[sheet[i].selectorText] = sheet[i];
}


// Fetch images from API
async function loadMedia({pushState = true} = {}) {
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

// Resource can be single string or array, returns single response or dictionary
// Add if resource not in cache, return cache
async function getCache(resources, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResp = {};
	const singleResource = typeof resources === 'string';

	if (singleResource) {
		resources = [resources];
	}

	for (const r of resources) {
		cachedResp[r] = await cache.match(r);

		// Resource not in cache
		if (!cachedResp[r]) {
			await cache.add(r);
			cachedResp[r] = await cache.match(r);
		}
	}

	if (singleResource) {
		return cachedResp[resources[0]];
	}
	return cachedResp;
}

async function getJSONCache(resources, cacheName) {
	const cachedResp = await getCache(resources, cacheName);

	if (typeof resources === 'string') {
		return await cachedResp.json();
	}

	const jsonResp = {};
	for (const resource in cachedResp) {
		jsonResp[resource] = await cachedResp[resource].json();
	}

	return jsonResp;
}

async function loadMediaByFilter({path = null, tags = [], pushState = true} = {}) {
	activeTags.clear();
	selectedItems = new Set();
	updateSelectModeMediaCount();
	selectModeCheckbox.checked = false;

	activeMode = Modes.select;
	toggleSelectionMode();

	closeLightbox();

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

		let apiEndpoint = '/api/media';
		if (queryparam.length > 0) {
			const joinedParams = "?" + queryparam.join('&');
			apiEndpoint += joinedParams;

			if (pushState) {
				window.history.pushState({}, '', '/search' + joinedParams);
			}
		}
		else if (pushState) {
			window.history.pushState({}, '', '/');
		}

		let response = await fetch(apiEndpoint);
		allMedia = await response.json();

		document.getElementById('filter-path').innerHTML = "Path " + createPathButtons(path);

		tags = await getJSONCache('/api/tags', TAGS_CACHE);
		let tagButtons = '';

		tags['data'].forEach(tag => {
			tagButtons += `<a onclick="addActiveFilters({tags:['${tag}']})">${tag}</a>`;
		});
		document.getElementById('filter-all-tags').innerHTML = tagButtons;

		tagButtons = '';
		if (activeTags.size === 0) {
			tagButtons += "None";
		}
		else {
			activeTags.forEach(tag => {
				tagButtons += `<a onclick="removeActiveFilters({tags:['${tag}']})">${tag}</a>`;
			});
		}
		document.getElementById('filter-active-tags').innerHTML = tagButtons;

		updateStats();

		if (allMedia.length === 0) {
			galleryContainer.innerHTML = '<div class="error">No images found.</div>';
		}
		else {
			renderGallery();
		}
	} catch (error) {
		console.error('Error loading images:', error);
		galleryContainer.innerHTML = '<div class="error">Error loading images. Please check the console for details.</div>';
	}
}

function addPathFilter(path) {
	loadMediaByFilter({path: path, tags: Array.from(activeTags)})
}

function createPathButtons(path) {
	if (path == null) {
		path = '/';
	}
	let cumPath = '';
	let pathButtons = `<a onclick="addPathFilter(path=null);" title="Show media with any path">ALL</a>/`;
	if (path !== '/') {
		path.split('/').slice(0, -1).forEach(segment => {
			cumPath += segment + "/";
			pathButtons += `<a onclick="addPathFilter(path='${cumPath}')" title="Show only media in '${cumPath}'">${segment}</a>/`;
		});
	}
	return pathButtons;
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

	let tagButtons = '';
	for (const tag of allTags[hash]) {
		tagButtons += `<a onclick="addActiveFilters({tags:['${tag}']})">${tag}</a>`;
	}
	return tagButtons;
}

function updateStats() {
	statsElement.textContent = `${allMedia.length} items • Window: ${window.innerWidth}x${window.innerHeight}px`;
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
function calculateRows(viewWidth, mediaInfo) {
	// Magic number 200; fix with config
	const targetRatio = viewWidth / 200;
	const rows = [];
	let lastImg = 0;

	while (lastImg < mediaInfo.length) {
		let prevRatioDiff = targetRatio;
		let currTotalRatio = 0;
		let colInRow = lastImg;

		for (let idx = lastImg; idx < mediaInfo.length; idx++) {
			currTotalRatio += mediaInfo[idx].aspectRatio;

			// Current ratio diff > previous
			if (Math.abs(targetRatio - currTotalRatio) > prevRatioDiff) {
				currTotalRatio -= mediaInfo[idx].aspectRatio;

				// If the single image is very wide
				// Needed to prevent infinite loop
				if (idx == lastImg) {
					currTotalRatio = mediaInfo[idx].aspectRatio;
					colInRow = idx + 1;
				} else {
					colInRow = idx;
				}
				break;
			}
			prevRatioDiff = Math.abs(targetRatio - currTotalRatio);

			// If we've reached the end of images
			if (idx === mediaInfo.length - 1) {
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
			const imgw = (mediaInfo[i].aspectRatio / currTotalRatio) * viewWidth;
			rowImages.push({
				...mediaInfo[i],
				width: Math.max(50, imgw - 8), // Account for margin, min width
				height: imgh,
				idx: i
			});
		}

		rows.push(rowImages);
		lastImg = colInRow;
	}

	return rows;
}

async function openLightbox(idx) {
	currMediaIdx = idx;
	activeMode = Modes.lightbox;

	const lightboxImg = document.getElementById('lightbox-img');
	const lightboxVid = document.getElementById('lightbox-vid');

	document.getElementById('lightbox').classList.add('active');
	showLightboxButtons();

	if (allMedia[idx].video === false) {
		rotateLightboxImg();
		lightboxImg.src = `/media/${allMedia[idx].hash}/original`;
		lightboxImg.alt = allMedia[idx].name;

		lightboxImg.classList.add('active');
		lightboxVid.classList.remove('active');
	}
	else {
		lightboxVid.src = `/media/${allMedia[idx].hash}/original`;

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

	lightboxImg.style.maxWidth = '90%';
	lightboxImg.style.maxHeight = '96%';
	if (allMedia[currMediaIdx].rotation !== null) {
		lightboxImg.style.transform = 'rotate(' + allMedia[currMediaIdx].rotation + 'deg)';
		const infoPanelWidth = (infoPanelOpen) ? document.getElementById('info-panel').clientWidth : 0;

		if (allMedia[currMediaIdx].rotation === 90 || allMedia[currMediaIdx].rotation === 270) {
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

function closeLightbox() {
	const lightboxVid = document.getElementById('lightbox-vid');
	lightboxVid.removeAttribute('src');
	lightboxVid.load();

	hideLightboxButtons();

	activeMode = Modes.none;

	document.getElementById('lightbox').classList.remove('active');
	document.getElementById('lightbox-button-row').classList.remove('active');
	document.getElementById('info-panel').classList.remove('active');

	// Restore Scrolling
	document.body.style.overflow = '';
}

async function nextMedia() {
	document.getElementById('lightbox-vid').removeAttribute('src');
	currMediaIdx = (currMediaIdx + 1) % allMedia.length;
	await openLightbox(currMediaIdx);
}

async function prevMedia() {
	document.getElementById('lightbox-vid').removeAttribute('src');
	currMediaIdx = (currMediaIdx - 1 + allMedia.length) % allMedia.length;
	await openLightbox(currMediaIdx);
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

function isMobile() {
	return window.innerWidth <= 768;
}

async function updateInfoPanel() {
	if (!infoPanelOpen || currMediaIdx >= allMedia.length) return;

	const media = allMedia[currMediaIdx];
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
			["Hash", media.hash],
			["Created", formatDate(media.dateCreated)],
			["Modified", formatDate(media.dateModified)]
		])],
		["Gallery Info", new Map([
			["Index", (currMediaIdx + 1) + ' of '  + allMedia.length],
			["Display Size", Math.round(media.width || 0) + ' x ' + Math.round(media.height || 0)],
			["Tags", await createInfoTagButtons(media.hash)],
		])]
	]);
	infoContent.innerHTML = "";
	for (const [infoSection, infoItems] of infoData) {
		infoContent.innerHTML += '<div class="info-section"><h3>' + infoSection + "</h3>"
		for (const [infoLabel, infoValue] of infoItems) {
			infoContent.innerHTML += '<div class="info-item">' +
									'<span class="info-label">' +
									infoLabel +
									'</span>' +
									'<span class="info-value">' +
									infoValue +
									'</span>' +
									'</div>';
		}
		infoContent.innerHTML += '</div>'
	}
}

async function rotate(deg) {
	if (deg !== 90 && deg !== -90)
		return;

	const direction = (deg === 90) ? '/right' : '/left';
	const resp = await fetch(
		'/api/rotate/' + allMedia[currMediaIdx].hash + direction,
		{method: 'POST'}
	);
	const jsonResp = await resp.json();
	if (!jsonResp.success)
		return;

	// Apply now
	let rotation = allMedia[currMediaIdx].rotation;
	rotation = (rotation == null) ? 0 : rotation;
	allMedia[currMediaIdx].rotation = (rotation + deg + 360) % 360;
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
	galleryContainer.innerHTML = '';

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

			imgElement.addEventListener('click', () => openLightbox(img.idx));
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
		galleryContainer.appendChild(rowDiv);
	});
	// After new elements added, observe their images for lazy loading
	setupObserver();
	// Start observing all images
	const imgs = galleryContainer.querySelectorAll('img.gallery-media');
	imgs.forEach(img => observer.observe(img));
}

// Debounced resize handler
let resizeTimeout;
function handleResize() {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => {
		updateStats();
		if (allMedia.length > 0) {
			renderGallery();
		}

		// Close info panel if switching between mobile/desktop
		if (infoPanelOpen) {
			closeInfoPanel();
		}
	}, 350);
}

function openTagPrompt() {
	document.getElementById('tag-overlay').classList.add('active');
	const input = document.getElementById('tag-input');
	lastActiveMode = activeMode;
	activeMode = Modes.tagprompt;
	input.select();
}
function closeTagPrompt() {
	document.getElementById('tag-overlay').classList.remove('active');
	document.getElementById('tag-input').blur();
	activeMode = lastActiveMode;
}

async function addTag() {
	selectedItems;
	let data = {
		'tag': [],
		'hashes': []
	};

	for (const t of document.getElementById('tag-input').value.split(' ')) {
		data['tag'].push(t)
	}
	for (const idx of selectedItems) {
		data['hashes'].push(allMedia[idx].hash);
	}

	try {
		const response = await fetch('/api/tags', {
			method: 'POST',
			headers: {
				'Content-Type': "application/json",
			},
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			throw new Error(`Server error: ${response.status}`);
		}

		// Clear tag cache
		await caches.delete(TAGS_CACHE);

		const resp = await response.json();
		if (!resp['success']) {
			// TODO Show error message to user
		}

		closeTagPrompt();
		createToast(
			msg=`Successfully added ${data['tag'].length} tags to ${data['hashes'].length} items`,
			bgColor='#4ad466'
		);
		return;

	} catch (error) {
		console.error("Error sending data: ", error)
	}
}

function createToast(msg, bgColor) {
	const toast = document.createElement('div');
	toast.classList.add('toast-banner');
	toast.innerText = msg;
	toast.style.backgroundColor = bgColor;

	// Keep previous toast on top of new
	Toast_Container.insertBefore(toast, lastToast);

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
				lastToast = First_Toast;
			}
			Toast_Container.removeChild(toast);
		}, 600);
	}, 4000);
}

function selectModeSelectAll() {
	for (let i=0; i<allMedia.length; i++) {
		selectedItems.add(i);
	}
	document.querySelectorAll('.selection-checkbox').forEach(e => {
		e.classList.add('selected');
	});
	updateSelectModeMediaCount();
}

function selectModeDeselectAll() {
	for (let i=0; i<allMedia.length; i++) {
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
selectModeCheckbox.addEventListener('change', function() {
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
document.getElementById('tag-action-close').addEventListener('click', () => {
	closeTagPrompt();
});
document.getElementById('tag-action-add').addEventListener('click', () => {
	addTag();
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
document.getElementById('tag-overlay').addEventListener('click', (e) => {
	if (e.target.id === 'tag-overlay') {
		closeTagPrompt();
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

document.getElementById('tag-input').addEventListener('keydown', e => {
	if (e.key === 'Enter') {
		addTag();
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
					selectModeCheckbox.checked = false;
					break;
				case 'a':
					// Deselect all if all is selected
					if (selectedItems.size === allMedia.length) {
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

		case Modes.none:
		default:
			switch (e.key) {
				case 'ArrowRight':
				case 'ArrowLeft':
					openLightbox(currMediaIdx);
					break;
				case 's':
					selectModeCheckbox.checked = true;
					toggleSelectionMode();
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

window.addEventListener('load', loadMedia);
// Detects backwards and forwards navigation
window.addEventListener('popstate', function(e) {
	if (e.state) {
		loadMedia({pushState: false});
	}
});


// Load images immediately if DOM is already ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadMedia);
} else {
	loadMedia();
}

