class SelectionState {
	selected = new Set();
	lastSelected = null;

	clear() {
		this.selected = new Set();
	}

	add(idx) {
		this.selected.add(idx);
	}

	remove(idx) {
		this.selected.delete(idx);
	}

	toggle(idx) {
		if (this.selected.has(idx)) {
			this.selected.delete(idx);
			return false;
		}
		this.selected.add(idx)
		return true;
	}

	getCount() {
		return this.selected.size;
	}

	getArray() {
		return Array.from(this.selected);
	}

	setLast(idx) {
		this.lastSelected = idx;
	}
	getLast() {
		return this.lastSelected;
	}
}

export const selectionState = new SelectionState();

