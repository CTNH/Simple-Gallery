let cacheAPIAvailable = false;
const LOCAL_CACHE = {};


// Uses cache storage API; Requires https or localhost
// Resource can be single string or array, returns single response or dictionary
// Add if resource not in cache, return cache
async function getCache(resources, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResp = {};
	const singleResource = typeof resources === 'string';

	if (singleResource) {
		resources = [resources];
	}

	for (const r of resources) {
		cachedResp[r] = await cache.match(r);

		// Resource not in cache
		if (!cachedResp[r]) {
			await cache.add(r);
			cachedResp[r] = await cache.match(r);
		}
	}

	if (singleResource) {
		return cachedResp[resources[0]];
	}
	return cachedResp;
}

// Memory only local cache
async function getJSONLocalCache(resources, cacheName) {
	if (!(cacheName in LOCAL_CACHE)) {
		LOCAL_CACHE[cacheName] = {};
	}

	const singleResource = typeof resources === 'string';
	if (singleResource) {
		resources = [resources];
	}

	const cachedResp = {};
	for (const r of resources) {
		// Fetch resource if not exist
		if (!(r in LOCAL_CACHE[cacheName])) {
			let resp = await fetch(r);
			LOCAL_CACHE[cacheName][r] = await resp.json();
		}

		cachedResp[r] = LOCAL_CACHE[cacheName][r];
	}

	if (singleResource) {
		return cachedResp[resources[0]];
	}
	return cachedResp;
}



export async function getJSONCache(resources, cacheName) {
	let cachedResp;

	if (!cacheAPIAvailable) {
		cachedResp = await getJSONLocalCache(resources, cacheName);

		return cachedResp;
	}

	cachedResp = await getCache(resources, cacheName);

	if (typeof resources === 'string') {
		return await cachedResp.json();
	}

	const jsonResp = {};
	for (const resource in cachedResp) {
		jsonResp[resource] = await cachedResp[resource].json();
	}

	return jsonResp;
}

export async function clearCache(cacheName) {
	if (cacheAPIAvailable) {
		await caches.delete(cacheName);
		return;
	}

	if (cacheName in LOCAL_CACHE) {
		delete LOCAL_CACHE[cacheName];
	}
}


if (
	window.location.protocol === 'https:' ||
	(['localhost', '127.0.0.1', '', '::1'].includes(window.location.hostname))
) {
	cacheAPIAvailable = true;
}

