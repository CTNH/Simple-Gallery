let allImages = [];
let galleryContainer = document.getElementById('gallery');
let statsElement = document.getElementById('stats');

// Fetch images from API
async function loadImages() {
	try {
		const response = await fetch('/api/images');
		allImages = await response.json();

		if (allImages.length === 0) {
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
	statsElement.textContent = `${allImages.length} images • Window: ${window.innerWidth}x${window.innerHeight}px`;
}

// Logic to decide row height and items in row
function calculateRows(viewWidth, imgList) {
	// Magic number 200; fix with config
	const targetRatio = viewWidth / 200;
	const rows = [];
	let lastImg = 0;

	while (lastImg < imgList.length) {
		let currRowCnt = 0;
		let prevRatioDiff = targetRatio;
		let currTotalRatio = 0;
		let colInRow = lastImg;

		for (let idx = lastImg; idx < imgList.length; idx++) {
			currTotalRatio += imgList[idx].aspectRatio;

			// Current ratio diff > previous
			if (Math.abs(targetRatio - currTotalRatio) > prevRatioDiff) {
				currTotalRatio -= imgList[idx].aspectRatio;

				// If the single image is very wide
				// Needed to prevent infinite loop
				if (idx == lastImg) {
					currTotalRatio = imgList[idx].aspectRatio;
					colInRow = idx + 1;
				} else {
					colInRow = idx;
				}
				break;
			}
			prevRatioDiff = Math.abs(targetRatio - currTotalRatio);

			// If we've reached the end of images
			if (idx === imgList.length - 1) {
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
			const imgw = (imgList[i].aspectRatio / currTotalRatio) * viewWidth;
			rowImages.push({
				...imgList[i],
				width: Math.max(50, imgw - 8), // Account for margin, min width
				height: imgh
			});
		}

		rows.push(rowImages);
		lastImg = colInRow;
	}

	return rows;
}

function renderGallery() {
	const viewWidth = window.innerWidth - 16; // Account for padding
	const rows = calculateRows(viewWidth, allImages);

	galleryContainer.innerHTML = '';

	rows.forEach(row => {
		const rowDiv = document.createElement('div');
		rowDiv.className = 'gallery-row';

		row.forEach(img => {
			const container = document.createElement('div');
			container.className = 'gallery-image-container';
			container.style.width = img.width + 'px';
			container.style.height = img.height + 'px';
			container.style.position = 'relative';

			const imgElement = document.createElement('img');
			imgElement.src = '/image/' + img.hash;
			imgElement.className = 'gallery-image';
			imgElement.style.width = '100%';
			imgElement.style.height = '100%';
			imgElement.alt = img.name;
			imgElement.title = img.name;
			imgElement.loading = 'lazy';

			// Add click handler for full size view
			imgElement.addEventListener('click', () => {
				window.open('/originalimage/' + img.hash, '_blank');
			});

			container.appendChild(imgElement);

			if (img.video === 1 && img.duration) {
				const durationDiv = document.createElement('div');
				durationDiv.className = 'video-duration';
				durationDiv.textContent = img.duration;
				container.appendChild(durationDiv);
			}

			rowDiv.appendChild(container);
		});
		galleryContainer.appendChild(rowDiv);
	});
}

// Debounced resize handler
let resizeTimeout;
function handleResize() {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => {
		updateStats();
		if (allImages.length > 0) {
			renderGallery();
		}
	}, 350);
}

// Event listeners
window.addEventListener('resize', handleResize);
window.addEventListener('load', loadImages);

// Load images immediately if DOM is already ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadImages);
} else {
	loadImages();
}

