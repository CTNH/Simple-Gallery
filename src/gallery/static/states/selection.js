class SelectionState {
	selected = new Set();

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
}

export const selectionState = new SelectionState();

