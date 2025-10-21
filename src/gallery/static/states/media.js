let mediaHashIdx = [];
let allMedia = new Map();
let currentMedia = 0;

export function setNewMedia(data) {
	allMedia = new Map(data);
	mediaHashIdx = Array.from(allMedia.keys());
}

export function getMedia(hash) {
	return allMedia.get(hash, null);
}

export function getAllMediaIndexed() {
	return mediaHashIdx.map(hash => {
		return {
			hash, ...allMedia.get(hash)
		};
	});
}

export function getMediaListSize() {
	return allMedia.size;
}

export function getCurrentMediaHash() {
	return mediaHashIdx[currentMedia];
}

export function getCurrentMedia() {
	return allMedia.get(mediaHashIdx[currentMedia]);
}

export function getCurrentMediaIndex() {
	return currentMedia;
}

export function getHashesAtIndices(indices = []) {
	return indices.map(idx => mediaHashIdx[idx]);
}

export function setCurrentMedia(idx, offset = false) {
	if (offset) {
		currentMedia = (currentMedia + idx + allMedia.size) % allMedia.size;
	}
	else {
		currentMedia = idx % allMedia.size;
		if (currentMedia < 0) {
			currentMedia += allMedia.size;
		}
	}
}

