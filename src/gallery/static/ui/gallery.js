import { ElemWrapper, createDiv, createLazyImg } from './elements.js';
import { observer, setupObserver } from '../events/observers.js';

// Return RowInfo[], where RowInfo = {'start': int, 'end': int, 'count': int, 'height': int}
function calculateRows(ratios, viewWidth, targetRowHeight) {
	const targetRatio = viewWidth / targetRowHeight;

	let idx = 0;
	const rowsStruct = [];
	while (idx < ratios.length) {
		const rowInfo = { start: idx };

		let rowRatio = 0;
		let rowRatioPrevDiff = targetRatio;

		// Count entries to be fitted to row
		for (let i=rowInfo.start; i<ratios.length; i++) {
			const ratio = ratios[i];
			rowRatio += ratio;
			const rowRatioDiff = Math.abs(targetRatio - rowRatio);

			if (rowRatioDiff > rowRatioPrevDiff) {
				rowRatio -= ratio;
				rowInfo.count = i - rowInfo.start;
				rowInfo.end = i;

				// Prevent infinitely looping single wide image
				if (i == rowInfo.start) {
					rowRatio = ratio;
					rowInfo.count++;
					rowInfo.end ++;
				}

				break;
			}

			rowRatioPrevDiff = rowRatioDiff;
		}

		rowInfo.height = Math.max(85, viewWidth / rowRatio);
		rowsStruct.push(rowInfo);
		idx = rowInfo.start + rowInfo.count;
		idx = rowInfo.end;
	}

	// Prevent large last row height
	const lastRow = rowsStruct[rowsStruct.length - 1];
	lastRow.height = Math.min(lastRow.height, 280);

	return rowsStruct;
}


export function renderGallery(
	mediaIdx, media, parentElem,
	handleImgClick, handleCheckboxMouseDown, handleCheckboxMouseEnter
) {
	// Lazy load images
	setupObserver();

	parentElem.innerHTML = '';

	calculateRows(
		mediaIdx.map(key => {
			return media.get(key).aspectRatio;
		}),
		window.innerWidth - 16,
		200
	).forEach(row => {
		const rowElem = createDiv({ className: 'gallery-row' });

		for (let i = row.start; i < row.end; i++) {
			const imgHash = mediaIdx[i];
			const img = media.get(imgHash);

			const imgContainer = createDiv({ className: 'gallery-media-container' })
				.setStyles({
					width: (img.aspectRatio * row.height - 8) + 'px',
					height: row.height + 'px',
					position: 'relative'
				});

			createLazyImg({ src: `/media/${imgHash}/thumbnail` })
				.className('gallery-media')
				.setStyles({
					width: '100%',
					height: '100%',
				})
				.setAttrs({
					alt: img.name,
					title: img.name,
					loading: 'lazy'		// Fallback to observer
				})
				.addEventListener('click', () => handleImgClick({idx: i}))
				.appendtoWrapper(imgContainer)
				.observe(observer);

			const checkbox = createDiv({ className: 'selection-checkbox' });
			checkbox.getElem().checked = false;
			checkbox
				.addEventListener('mousedown', (e) => handleCheckboxMouseDown(e, checkbox.getElem(), i))
				.addEventListener('mouseenter', (e) => handleCheckboxMouseEnter(e, checkbox.getElem(), i))
				.appendtoWrapper(imgContainer);


			if (img.video === true && img.duration) {
				const durationElem = createDiv({ className: 'video-duration' });
				(new ElemWrapper('span'))
					.className('play-icon')
						.setHTML(`
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 18"
								fill="white"
								width="12" height="12"
							>
								<path d="M8 5v14l11-7z"/>
							</svg>
						`)
					.appendtoWrapper(durationElem);

				durationElem.appendChild(
					document.createTextNode(img.duration)
				);

				durationElem.appendtoWrapper(imgContainer);
			}

			imgContainer.appendtoWrapper(rowElem);
		}
		rowElem.appendto(parentElem);
	});
}

