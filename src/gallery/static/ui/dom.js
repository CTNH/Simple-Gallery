import { ElemWrapper } from "./elements.js";

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

