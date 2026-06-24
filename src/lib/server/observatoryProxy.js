const HOP_BY_HOP_HEADERS = new Set([
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade'
]);

/**
 * @param {Headers} headers
 * @param {Set<string>} [omittedHeaders]
 */
function copyHeaders(headers, omittedHeaders = HOP_BY_HOP_HEADERS) {
	const copied = new Headers();

	for (const [name, value] of headers) {
		if (omittedHeaders.has(name.toLowerCase())) continue;
		copied.set(name, value);
	}

	return copied;
}

/**
 * @param {string} apiBase
 * @param {string} path
 * @param {string} [search]
 */
export function buildBackendUrl(apiBase, path, search = '') {
	const base = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
	const cleanPath = path.replace(/^\/+/, '');
	const url = new URL(cleanPath, base);
	url.search = search;

	return url.toString();
}

/**
 * @param {{
 *   apiBase: string;
 *   path: string;
 *   request: Request;
 *   fetch: typeof globalThis.fetch;
 * }} options
 */
export async function proxyObservatoryRequest({ apiBase, path, request, fetch }) {
	const sourceUrl = new URL(request.url);
	const method = request.method.toUpperCase();
	const hasBody = method !== 'GET' && method !== 'HEAD';
	const requestHeaders = new Set([...HOP_BY_HOP_HEADERS, 'content-length']);

	const backendResponse = await fetch(buildBackendUrl(apiBase, path, sourceUrl.search), {
		method,
		headers: copyHeaders(request.headers, requestHeaders),
		body: hasBody ? await request.arrayBuffer() : undefined
	});

	return new Response(backendResponse.body, {
		status: backendResponse.status,
		statusText: backendResponse.statusText,
		headers: copyHeaders(backendResponse.headers)
	});
}
