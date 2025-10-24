class FilterState {
	tags = {
		active: new Set(),
		inverse: new Set(),
	};
	types = new Set();

	setTagInactive (tag) {
		this.tags.active.delete(tag);
		this.tags.inverse.delete(tag);
	}
	setTagActive (tag) {
		this.tags.inverse.delete(tag);
		this.tags.active.add(tag);
	}
	setTagInverse (tag) {
		this.tags.active.delete(tag);
		this.tags.inverse.add(tag);
	}

	getAllTagsActive() {
		return Array.from(this.tags.active);
	}
	getAllTagsInverse() {
		return Array.from(this.tags.inverse);
	}

	isTagActive(tag) {
		this.tags.active.has(tag);
	}
	isTagInverse(tag) {
		this.tags.inverse.has(tag);
	}

	clearTags() {
		this.tags.active.clear();
		this.tags.inverse.clear();
	}

	addType(type) {
		this.types.add(type);
	}
	removeType(type) {
		this.types.delete(type);
	}
	clearTypes() {
		this.types.clear();
	}
	getTypes() {
		return Array.from(this.types);
	}
}

export const filterState = new FilterState();

