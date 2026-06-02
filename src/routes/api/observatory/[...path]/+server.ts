import { API_BASE } from '$env/static/private';
import { proxyObservatoryRequest } from '$lib/server/observatoryProxy.js';
import type { RequestHandler } from './$types';

const proxy: RequestHandler = ({ fetch, params, request }) =>
	proxyObservatoryRequest({
		apiBase: API_BASE,
		path: params.path,
		request,
		fetch
	});

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
