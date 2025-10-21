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

