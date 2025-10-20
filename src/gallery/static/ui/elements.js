export class ElemWrapper {
	// return this; for chaining

	constructor(tag) {
		this.element = document.createElement(tag);
	}

	getElem() {
		return this.element;
	}

	setAttr(attr, val) {
		this.element.setAttribute(attr, val);
		return this;
	}

	setAttrs(attrs) {
		for (const attr in attrs) {
			this.element.setAttribute(attr, attrs[attr]);
		}
		return this;
	}

	setStyles(styles) {
		for (const style in styles) {
			this.element.style[style] = styles[style];
		}
		return this;
	}

	setData(key, val) {
		this.element.dataset[key] = val;
		return this;
	}

	setHTML(data) {
		this.element.innerHTML = data;
		return this;
	}

	className(className) {
		this.element.className = className;
		return this;
	}

	appendto(parent) {
		parent.appendChild(this.element);
		return this;
	}
	appendtoWrapper(parent) {
		parent.getElem().appendChild(this.element);
		return this;
	}

	appendChild(child) {
		this.element.appendChild(child);
		return this;
	}

	addEventListener(event, handler) {
		this.element.addEventListener(event, handler);
		return this;
	}
}


class LazyImgElem extends ElemWrapper {
	constructor() {
		super('img');
	}
	observe(observer) {
		observer.observe(this.element);
		return this;
	}
}


export function createDiv({ className = "" } = {}) {
	return (new ElemWrapper('div')).className(className);
}

// Use dataset.src for lazy loading
export function createLazyImg({ src = "" } = {}) {
	return (new LazyImgElem()).setData('src', src);
}

