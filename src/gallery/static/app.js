let allMedia = [];
let galleryContainer = document.getElementById('gallery');
let statsElement = document.getElementById('stats');
let observer;
let currMediaIdx = 0;
let lastWinWidth = window.innerWidth;

// Fetch images from API
async function loadMedia() {
	try {
		const response = await fetch('/api/media');
		allMedia = await response.json();

		if (allMedia.length === 0) {
			galleryContainer.innerHTML = '<div class="error">No images found. Please add some images to the static/images folder.</div>';
			return;
		}

		updateStats();
		renderGallery();
	} catch (error) {
		console.error('Error loading images:', error);
		galleryContainer.innerHTML = '<div class="error">Error loading images. Please check the console for details.</div>';
	}
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

function openLightbox(idx) {
	currMediaIdx = idx;
	const lightboxImg = document.getElementById('lightbox-img');
	const lightboxVid = document.getElementById('lightbox-vid');
	if (allMedia[idx].video === 0) {
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
	document.getElementById('lightbox').classList.add('active');

	// Prevent Scrolling
	document.body.style.overflow = 'hidden';
}

function closeLightbox() {
	document.getElementById('lightbox-vid').src = "";
	document.getElementById('lightbox').classList.remove('active');

	// Restore Scrolling
	document.body.style.overflow = '';
}

function nextMedia() {
	document.getElementById('lightbox-vid').src = "";
	currMediaIdx = (currMediaIdx + 1) % allMedia.length;
	openLightbox(currMediaIdx);
}

function prevMedia() {
	document.getElementById('lightbox-vid').src = "";
	currMediaIdx = (currMediaIdx - 1 + allMedia.length) % allMedia.length;
	openLightbox(currMediaIdx);
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

			if (img.video === 1 && img.duration) {
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
	}, 350);
}

// Close lightbox by clicking outside the image
document.getElementById('lightbox').addEventListener('click', (e) => {
	if (e.target.id === 'lightbox') {
		closeLightbox();
	}
});

document.addEventListener('keydown', (e) => {
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
		default:
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
window.addEventListener('load', loadMedia);

// Load images immediately if DOM is already ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadMedia);
} else {
	loadMedia();
}

