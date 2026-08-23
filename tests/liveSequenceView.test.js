import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cameraFeed = readFileSync(
	new URL('../src/lib/components/CameraFeed.svelte', import.meta.url),
	'utf8'
);
const liveSequenceView = readFileSync(
	new URL('../src/lib/components/sequences/LiveSequenceView.svelte', import.meta.url),
	'utf8'
);
const liveSequenceNode = readFileSync(
	new URL('../src/lib/components/sequences/LiveSequenceNode.svelte', import.meta.url),
	'utf8'
);
const liveSequenceModel = readFileSync(
	new URL('../src/lib/live-sequences.ts', import.meta.url),
	'utf8'
);
const observatoryApi = readFileSync(
	new URL('../src/lib/api/observatory.ts', import.meta.url),
	'utf8'
);
const mainPage = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');

test('camera feeds replace the redundant title with a larger Sequence View tab', () => {
	assert.doesNotMatch(cameraFeed, /<h2[^>]*>Camera feeds<\/h2>/i);
	assert.match(cameraFeed, />\s*Sequence View\s*</);
	assert.match(cameraFeed, /SEQUENCE_TAB_ID/);
	assert.match(cameraFeed, /px-3 py-1\.5 font-mono text-xs/);
	assert.match(cameraFeed, /<LiveSequenceView \{sequences\} \/>/);
	assert.match(mainPage, /<CameraFeed feeds=\{cameraFeeds\} sequences=\{liveSequences\} \/>/);
});

test('live sequence view joins state ticks to fetched context trees', () => {
	assert.match(observatoryApi, /sequences\/live\/\$\{encodeURIComponent\(contextId\)\}/);
	assert.match(liveSequenceView, /getLiveSequenceTree\(contextId\)/);
	assert.match(liveSequenceView, /isTreeBuildPending\(response\)/);
	assert.match(liveSequenceView, /parseLiveSequenceTree\(response\)/);
	assert.match(liveSequenceView, /unknownActiveIds/);
	assert.match(liveSequenceView, /no longer active/);
});

test('the compact sequence window keeps active steps and sequential neighbors', () => {
	assert.match(liveSequenceModel, /compactLiveNodeIds/);
	assert.match(liveSequenceModel, /indexInSequence - 1/);
	assert.match(liveSequenceModel, /indexInSequence \+ 1/);
	assert.match(liveSequenceView, /showAll \? 'Active window' : 'Show all'/);
	assert.match(liveSequenceNode, /data-active=\{isActive\}/);
	assert.match(liveSequenceNode, /node\.type === 'ParallelGroup'/);
	assert.match(liveSequenceNode, /repeat \{repetition\}/);
});

test('live parallel branches divide the full available width equally', () => {
	assert.match(liveSequenceNode, /flex w-full min-w-0 items-stretch gap-2/);
	assert.match(liveSequenceNode, /min-w-0 flex-1 basis-0 border-x/);
	assert.doesNotMatch(liveSequenceNode, /\bw-64 flex-none\b/);
});

test('live nodes display only non-default lifecycle hook values', () => {
	assert.match(liveSequenceModel, /nonDefaultLiveLifecycleEntries/);
	assert.match(liveSequenceModel, /name === 'repeat'/);
	assert.match(liveSequenceModel, /value === 1/);
	assert.match(liveSequenceModel, /Array\.isArray\(value\).*value\.length === 0/);
	assert.match(liveSequenceNode, /entry\.name !== 'repeat'/);
	assert.match(liveSequenceNode, /data-lifecycle-hook=\{entry\.name\}/);
	assert.match(liveSequenceNode, /\{entry\.label\} · \{entry\.value\}/);
	assert.match(liveSequenceNode, /entry\.name === 'until'/);
	assert.match(liveSequenceNode, /entry\.name === 'update'/);
	assert.match(liveSequenceNode, /repeat · \{configuredRepeat\}/);
});
