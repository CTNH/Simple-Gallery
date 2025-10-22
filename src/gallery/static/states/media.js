class MediaState {
	mediaHashIdx = [];
	allMedia = new Map();
	currentMedia = 0;

	setNewMedia(data) {
		this.allMedia = new Map(data);
		this.mediaHashIdx = Array.from(this.allMedia.keys());
	}

	getMedia(hash) {
		return this.allMedia.get(hash, null);
	}

	getAllMediaIndexed() {
		return this.mediaHashIdx.map(hash => {
			return {
				hash, ...this.allMedia.get(hash)
			};
		});
	}

	getMediaListSize() {
		return this.allMedia.size;
	}

	getCurrentMediaHash() {
		return this.mediaHashIdx[this.currentMedia];
	}

	getCurrentMedia() {
		return this.allMedia.get(this.mediaHashIdx[this.currentMedia]);
	}

	getCurrentMediaIndex() {
		return this.currentMedia;
	}

	getHashesAtIndices(indices = []) {
		return indices.map(idx => this.mediaHashIdx[idx]);
	}

	setCurrentMedia(idx, offset = false) {
		if (offset) {
			this.currentMedia = (this.currentMedia + idx + this.allMedia.size) % this.allMedia.size;
		}
		else {
			this.currentMedia = idx % this.allMedia.size;
			if (this.currentMedia < 0) {
				this.currentMedia += this.allMedia.size;
			}
		}
	}
}

export const mediaState = new MediaState();

