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

const SEQUENCE_PARSE_PATH = 'observatory/sequences/parse';

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
 * @param {string} path
 * @param {Request} request
 */
function isSequenceUploadJson(path, request) {
	return (
		path.replace(/^\/+/, '') === SEQUENCE_PARSE_PATH &&
		request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
	);
}

/**
 * @param {unknown} payload
 */
function buildSequenceUploadForm(payload) {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Sequence upload payload must be an object');
	}

	const { filename, content, contentType } = /** @type {{ filename?: unknown; content?: unknown; contentType?: unknown }} */ (
		payload
	);

	if (typeof filename !== 'string' || !filename || typeof content !== 'string') {
		throw new Error('Sequence upload payload requires filename and content');
	}

	const form = new FormData();
	const blob = new Blob([content], {
		type: typeof contentType === 'string' && contentType ? contentType : 'application/x-yaml'
	});
	form.append('file', blob, filename);

	return form;
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
	const isJsonSequenceUpload = isSequenceUploadJson(path, request);
	const requestHeaders = new Set([
		...HOP_BY_HOP_HEADERS,
		'content-length',
		...(isJsonSequenceUpload ? ['content-type'] : [])
	]);
	const body = isJsonSequenceUpload
		? buildSequenceUploadForm(await request.json())
		: hasBody
			? await request.arrayBuffer()
			: undefined;

	const backendResponse = await fetch(buildBackendUrl(apiBase, path, sourceUrl.search), {
		method,
		headers: copyHeaders(request.headers, requestHeaders),
		body
	});

	return new Response(backendResponse.body, {
		status: backendResponse.status,
		statusText: backendResponse.statusText,
		headers: copyHeaders(backendResponse.headers)
	});
}
