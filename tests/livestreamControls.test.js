import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cameraFeed = readFileSync(
	new URL('../src/lib/components/CameraFeed.svelte', import.meta.url),
	'utf8'
);
const livestreamControls = readFileSync(
	new URL('../src/lib/components/LivestreamControls.svelte', import.meta.url),
	'utf8'
);
const mainPage = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const mainPageServer = readFileSync(
	new URL('../src/routes/+page.server.ts', import.meta.url),
	'utf8'
);
const mobilePage = readFileSync(
	new URL('../src/routes/mobile/+page.svelte', import.meta.url),
	'utf8'
);
const mobilePageServer = readFileSync(
	new URL('../src/routes/mobile/+page.server.ts', import.meta.url),
	'utf8'
);

test('livestream controls render as a device-style control instead of inside camera feeds', () => {
	assert.doesNotMatch(cameraFeed, /LivestreamControls/);
	assert.match(livestreamControls, /<article/);
	assert.match(livestreamControls, />Livestreams<\/h3>/);
	assert.match(mainPage, /type: 'livestream'/);
	assert.match(
		mainPage,
		/activeControlDevices[\s\S]*device\.type === 'livestream'[\s\S]*<LivestreamControls/
	);
});

test('livestream controls load and edit exposure and gain camera settings', () => {
	assert.match(livestreamControls, /getLivestreamCameraSettings\(name\)/);
	assert.match(livestreamControls, /updateLivestreamCameraSettings\(selectedName/);
	assert.match(livestreamControls, /controls: \{ \[control\]: value \}/);
	assert.match(livestreamControls, /Exposure us/);
	assert.match(livestreamControls, />Gain<\/span>/);
	assert.equal((livestreamControls.match(/type="range"/g) ?? []).length, 2);
	assert.equal((livestreamControls.match(/type="number"/g) ?? []).length, 2);
	assert.match(livestreamControls, /setCameraControl\('exposure'\)/);
	assert.match(livestreamControls, /setCameraControl\('gain'\)/);
});

test('mobile exposes livestreams through the standard control selector', () => {
	assert.match(
		mobilePage,
		/createMobileControlOptions\(controlDevices, livestreamControlsAvailable\)/
	);
	assert.match(mobilePage, /selectedControl\?\.kind === 'livestreams'/);
	assert.match(mobilePage, /selectedControl\?\.kind === 'livestreams'[\s\S]*<LivestreamControls/);
	assert.doesNotMatch(mobilePage, /<LivestreamControls variant=/);
});

test('both pages preload livestream availability so null catalogs omit the control', () => {
	assert.match(mainPageServer, /fetch\(backendUrl\('observatory\/livestreams'\)\)/);
	assert.match(mobilePageServer, /fetch\(backendUrl\('observatory\/livestreams'\)\)/);
	assert.match(mainPage, /data\.livestreams !== null/);
	assert.match(mobilePage, /data\.livestreams !== null/);
	assert.match(livestreamControls, /\{#if livestreams !== null\}/);
});
