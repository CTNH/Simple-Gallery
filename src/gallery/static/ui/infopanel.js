import { api_getTagsFromHash } from '../utils/api.js';
import { formatDate, formatFileSize } from '../utils/formatter.js';
import { addTagButtons, createPathButtons } from './dom.js';
import { createDiv, ElemWrapper } from './elements.js';

const CONTENT = document.getElementById('info-content');
const TAGS = {};

const PANEL = document.getElementById('info-panel');
let isopen = false;

export function isInfoPanelOpen() {
	return isopen;
}

export async function openInfoPanel(updateInfoPanelArgs) {
	isopen = true;
	PANEL.classList.add('active');
	await updateInfoPanel(updateInfoPanelArgs);
}

export function setInfoPanelClosed() {
	isopen = false;
}

export async function updateInfoPanel({
	media,
	mediaCount,
	handlePathButtons,
	handleTagButtons
}) {
	if (!(media.hash in TAGS)) {
		TAGS[media.hash] = await api_getTagsFromHash(media.hash);
	}

	const tagButtons = document.createElement('div');
	addTagButtons(TAGS[media.hash], handleTagButtons, tagButtons);

	const infoData = new Map([
		["File Information", new Map([
			["Name", media.name || 'Unknown'],
			["Type", media.video ? 'Video' : 'Image'],
			["Size", formatFileSize(media.size)],
			["Dimensions", `${media.width || '?'} x ${media.height || '?'}`],
			["Aspect Ratio", media.aspectRatio ? media.aspectRatio.toFixed(2) : 'Unknown'],
			["Duration", (media.video && media.duration) ? media.duration : '-'],
			["Path", createPathButtons(media.path, handlePathButtons) || 'Unknown']
		])],
		["Technical Details", new Map([
			["Hash", media.hash],
			["Created", formatDate(media.dateCreated)],
			["Modified", formatDate(media.dateModified)]
		])],
		["Gallery Info", new Map([
			["Index", `${media.idx + 1} of ${mediaCount}`],
			["Display Size", "Unknown"],	// TODO
			["Rotation", `${media.rotation || 0}&deg;`],
			["Tags", tagButtons],
		])],
	]);

	CONTENT.innerHTML = '';

	for (const [section, items] of infoData) {
		const sectionElem = createDiv({ className: 'info-section' });

		(new ElemWrapper('h3')).setText(section).appendtoWrapper(sectionElem);

		for (const [label, value] of items) {
			const infoItem = createDiv({ className: 'info-item' });

			(new ElemWrapper('span'))
				.className('info-label')
				.setHTML(label)
				.appendtoWrapper(infoItem);

			(new ElemWrapper('span'))
				.className('info-value')
				.appendChild(
					(value instanceof Element)
					? value
					: createDiv().setHTML(value).getElem()
				)
				.appendtoWrapper(infoItem);

			infoItem.appendtoWrapper(sectionElem);
		}

		sectionElem.appendto(CONTENT);
	}
}

