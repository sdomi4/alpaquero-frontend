import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mobilePage = readFileSync(
	new URL('../src/routes/mobile/+page.svelte', import.meta.url),
	'utf8'
);
const deviceShell = readFileSync(
	new URL('../src/lib/components/devices/DeviceShell.svelte', import.meta.url),
	'utf8'
);

test('mobile device controls stay within a scrollable viewport', () => {
	assert.match(mobilePage, /class="h-full min-h-\[10rem\] min-w-0 overflow-auto"/);
	assert.match(mobilePage, /class="h-full w-fit min-w-full"/);
	assert.match(deviceShell, /class="min-h-0 flex-1 overflow-auto"/);
	assert.doesNotMatch(deviceShell, /class="min-h-0 flex-1 overflow-hidden"/);
});
