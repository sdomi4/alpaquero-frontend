import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mobilePage = readFileSync(
	new URL('../src/routes/mobile/+page.svelte', import.meta.url),
	'utf8'
);

test('mobile page uses the shared camera, observing conditions, and logger components', () => {
	assert.match(
		mobilePage,
		/import CameraBlock from '\$lib\/components\/devices\/CameraBlock\.svelte';/
	);
	assert.match(
		mobilePage,
		/import ObservingConditionsBlock from '\$lib\/components\/devices\/ObservingConditionsBlock\.svelte';/
	);
	assert.match(
		mobilePage,
		/import WebsocketLogger from '\$lib\/components\/WebsocketLogger\.svelte';/
	);
	assert.match(mobilePage, /device\.type === 'camera'\s*\?\s*CameraBlock/);
	assert.match(mobilePage, /<ObservingConditionsBlock/);
	assert.match(
		mobilePage,
		/<WebsocketLogger messages=\{websocketMessages\} status=\{errorWsStatus\}/
	);
});
