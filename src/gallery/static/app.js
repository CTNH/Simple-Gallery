let allMedia = [];
let allTags = {};
let galleryContainer = document.getElementById('gallery');
let statsElement = document.getElementById('stats');
const selectModeCheckbox = document.getElementById('select-mode-checkbox');
let observer;
let currMediaIdx = 0;
let lastWinWidth = window.innerWidth;
let infoPanelOpen = false;

let selectMode = false;
let selectedItems = new Set();
let lastSelected = null;
let mouseDown = false;
let checkSelect = true;

let cssRules = {};
const sheet = document.styleSheets[0].cssRules;
for (let i = 0; i < sheet.length; i++) {
	cssRules[sheet[i].selectorText] = sheet[i];
}


// Fetch images from API
async function loadMedia() {
	loadMediaByFilter();
}

async function loadMediaByFilter({path = null, tags = []} = {}) {
	selectedItems = new Set();
	updateSelectModeMediaCount();
	selectModeCheckbox.checked = false;
	selectMode = true;
	toggleSelectionMode();

	try {
		let apiEndpoint = '/api/media';

		let queryparam = [];
		if (path !== null) {
			queryparam.push("path="+path);
		}
		if (tags !== []) {
			for (const tag of tags) {
				queryparam.push("tag="+tag);
			}
		}
		if (queryparam.length > 0) {
			apiEndpoint += "?" + queryparam.join('&');
		}

		let response = await fetch(apiEndpoint);
		allMedia = await response.json();

		if (allMedia.length === 0) {
			galleryContainer.innerHTML = '<div class="error">No images found. Please add some images to the static/images folder.</div>';
			return;
		}

		document.getElementById('filter-path').innerHTML = createPathButtons(path);

		updateStats();
		renderGallery();
	} catch (error) {
		console.error('Error loading images:', error);
		galleryContainer.innerHTML = '<div class="error">Error loading images. Please check the console for details.</div>';
	}
}

function createPathButtons(path) {
	if (path == null) {
		path = '/';
	}
	let cumPath = '';
	let pathButtons = `<a onclick="loadMediaByFilter({path:null});" title="Show all media">ALL</a>/`;
	if (path !== '/') {
		path.split('/').slice(0, -1).forEach(segment => {
			cumPath += segment + "/";
			pathButtons += `<a onclick="loadMediaByFilter({path:'${cumPath}'})" title="Show only media in '${cumPath}'">${segment}</a>/`;
		});
	}
	return pathButtons;
}

async function createInfoTagButtons(hash) {
	if (!(hash in allTags)) {
		let resp = await fetch('/api/tags?hash=' + hash);
		resp = await resp.json();

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
		tagButtons += `<a onclick="loadMediaByFilter({tags:['${tag}']})">${tag}</a>`;
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
	const lightboxImg = document.getElementById('lightbox-img');
	const lightboxVid = document.getElementById('lightbox-vid');

	document.getElementById('lightbox').classList.add('active');
	document.getElementById('lightbox-button-row').style.display = 'flex';

	if (allMedia[idx].video === false) {
		rotateLightboxImg();
		lightboxImg.src = `/files/${allMedia[idx].hash}/original`;
		lightboxImg.alt = allMedia[idx].name;

		lightboxImg.classList.add('active');
		lightboxVid.classList.remove('active');
	}
	else {
		lightboxVid.src = `/files/${allMedia[idx].hash}/original`;

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
			lightboxImg.style.maxWidth = ((lightbox.clientHeight-infoPanelWidth)*0.9) + 'px';
			lightboxImg.style.maxHeight = (lightbox.clientWidth*0.96) + 'px';
		}
	}
	else {
		lightboxImg.style.transform = '';
	}
}

function closeLightbox() {
	document.getElementById('lightbox-vid').src = "";
	document.getElementById('lightbox').classList.remove('active');
	document.getElementById('info-panel').classList.remove('active');

	// Restore Scrolling
	document.body.style.overflow = '';
}

async function nextMedia() {
	document.getElementById('lightbox-vid').src = "";
	currMediaIdx = (currMediaIdx + 1) % allMedia.length;
	await openLightbox(currMediaIdx);
}

async function prevMedia() {
	document.getElementById('lightbox-vid').src = "";
	currMediaIdx = (currMediaIdx - 1 + allMedia.length) % allMedia.length;
	await openLightbox(currMediaIdx);
}

async function toggleInfoPanel() {
	const infoButton = document.getElementById('info-button');

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
	const infoButton = document.getElementById('info-button');

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
			imgElement.dataset.src = '/files/' + img.hash + "/thumbnail";
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
				// Prevents default click toggle behavior to avoid double toggling
				event.preventDefault(); 
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
	document.getElementById('tag-overlay').style.display = 'flex';
}
function closeTagPrompt() {
	document.getElementById('tag-overlay').style.display = 'none';
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

		const resp = await response.json();
		if (resp['success']) {
			closeTagPrompt();
			return;
		}
		// TODO Show error message to user

	} catch (error) {
		console.error("Error sending data: ", error)
	}
}

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
function toggleSelectionMode() {
	const selectModeBar = document.getElementById('select-mode-info-bar');
	if (selectMode) {
		selectMode = false;
		selectModeBar.style.display = 'none';
		cssRules['.selection-checkbox'].style.display = 'none';
	}
	else {
		selectMode = true;
		selectModeBar.style.display = 'flex';
		cssRules['.selection-checkbox'].style.display = 'flex';
	}
}
selectModeCheckbox.addEventListener('change', function() {
	toggleSelectionMode();
});

const lightboxVid = document.getElementById('lightbox-vid');
['play', 'pause', 'ended'].forEach(event =>
	lightboxVid.addEventListener(event, (e) => {
		const vid = e.target;
		const buttonRow = document.getElementById('lightbox-button-row');
		if (vid.paused || vid.ended) {
			buttonRow.style.display = 'flex';
			document.querySelectorAll('.lightbox-nav').forEach((elem) => {
				elem.style.display = '';
			});
		}
		else {
			buttonRow.style.display = 'none';
			document.querySelectorAll('.lightbox-nav').forEach((elem) => {
				elem.style.display = 'none';
			});
		}
	})
);

document.addEventListener('keydown', (e) => {
	if (selectMode) {
		switch (e.key) {
			case 'Escape':
			case 's':
				toggleSelectionMode();
				selectModeCheckbox.checked = false;
				break;
			case 'a':
				break;
		}
		return;
	}
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
		case 'I':
			if (document.getElementById('lightbox').classList.contains('active')) {
				toggleInfoPanel();
			}
			break;
		case 's':
			selectModeCheckbox.checked = true;
			toggleSelectionMode();
			break;
		default:
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

// Load images immediately if DOM is already ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadMedia);
} else {
	loadMedia();
}

