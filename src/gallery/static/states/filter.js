import { TAG_STATUS } from "./tags.js";

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

	getTagState(tag) {
		if (this.tags.active.has(tag))
			return TAG_STATUS.ACTIVE;
		if (this.tags.inverse.has(tag))
			return TAG_STATUS.INVERSE;
		return TAG_STATUS.INACTIVE;
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

