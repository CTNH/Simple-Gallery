import { createDiv, ElemWrapper } from "./elements.js";

function addPathButton(name, fullpath, handlePathButton, parent) {
	(new ElemWrapper('a'))
		.setText(name)
		.setAttr('title', `Show only media in '${fullpath}'`)
		.addEventListener('click', () => handlePathButton(fullpath))
		.appendto(parent);
	parent.appendChild(document.createTextNode('/'));
}

export function createPathButtons(path, handlePathButton) {
	if (path == null) {
		path = '/';
	}

	const container = document.createElement('div');

	addPathButton('ALL', null, handlePathButton, container);
	let cumPath = '';
	if (path !== '/') {
		path.split('/').slice(0, -1).forEach(segment => {
			cumPath += segment + "/";
			addPathButton(segment, cumPath, handlePathButton, container);
		});
	}

	return container;
}

export function addTagButtons({
	hash,
	tags,
	filterHandler,
	removeHandler,
	parent
}) {
	if (tags.length == 0) {
		parent.appendChild(document.createTextNode("None"));
	}
	tags.forEach(tag => {
		const container = createDiv({ className: 'info-tag-container' });
		createDiv({ className: 'info-tag' })
			.setHTML('&times;')
			.addEventListener('click', () => { removeHandler(tag, hash) })
			.appendtoWrapper(container);
		createDiv({ className: 'info-tag' })
			.setText(tag)
			.addEventListener('click', () => { filterHandler(tag) })
			.appendtoWrapper(container);
		container.appendto(parent);
	});
}

export function ismobile() {
	return (window.innerWidth <= 768);
}

