export function formatFileSize(bytes) {
	if (!bytes) return 'Unknown';
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};


export function formatDate(timestamp) {
	if (!timestamp) return 'Unknown';
	const date = new Date(timestamp);
	return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

