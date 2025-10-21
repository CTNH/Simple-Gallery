import { getJSONCache } from "../cache.js";

export async function api_getTagsFromHash(hash) {
	let resp = await getJSONCache(`/api/tags?hash=${hash}`);
	if (!resp['success']) {
		console.error(`Failed to get tags from hash ${hash}`);
		return null;
	}
	return resp['data'];
}

export async function api_rotate({ hash, clockwise = true }) {
	const resp = await fetch(
		'/api/rotate/' + hash + ((clockwise) ? '/right' : '/left'),
		{ method: 'POST' }
	);
	const jsonResp = await resp.json();
	if (!jsonResp.success) {
		return jsonResp.msg;
	}
	return null;
}

