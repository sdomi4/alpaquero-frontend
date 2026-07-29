import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainPage = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const mobilePage = readFileSync(
	new URL('../src/routes/mobile/+page.svelte', import.meta.url),
	'utf8'
);
const sequencePanel = readFileSync(
	new URL('../src/lib/components/sequences/SequencePanel.svelte', import.meta.url),
	'utf8'
);
const runningSequences = readFileSync(
	new URL('../src/lib/components/header/RunningSequences.svelte', import.meta.url),
	'utf8'
);
const statusDisplay = readFileSync(
	new URL('../src/lib/components/header/StatusDisplay.svelte', import.meta.url),
	'utf8'
);

test('state-tick messages are exclusively routed to the log in both pages', () => {
	for (const page of [mainPage, mobilePage]) {
		assert.match(page, /appendStateMessages\(stateStatus\?\.messages\)/);
		assert.match(page, /<StatusDisplay status=\{observatoryStatus\} \/>/);
		assert.doesNotMatch(page, /<StatusDisplay[^>]+messages=/);
	}

	assert.doesNotMatch(statusDisplay, /messages|Status messages/);
});

test('running sequences have compact inline controls in the desktop header and mobile actions', () => {
	assert.match(mainPage, /<header[\s\S]*<RunningSequences sequences=\{liveSequences\}/);
	assert.match(
		mobilePage,
		/selectedControl\?\.kind === 'observatory-actions'[\s\S]*Sequence status[\s\S]*<RunningSequences sequences=\{liveSequences\}/
	);
	assert.doesNotMatch(
		mobilePage,
		/<header[\s\S]*?<RunningSequences sequences=\{liveSequences\}[\s\S]*?<\/header>/
	);

	for (const page of [mainPage, mobilePage]) {
		assert.match(page, /info: string \| null/);
	}

	assert.match(runningSequences, /\{sequence\.info \|\| '—'\}/);
	assert.match(runningSequences, /class="col-span-full min-w-0 truncate/);
	assert.doesNotMatch(runningSequences, />\s*Sequence\s*</);
	assert.doesNotMatch(runningSequences, />\s*Info\s*</);
	assert.match(runningSequences, /pauseSequence\(sequence\.context_id\)/);
	assert.match(runningSequences, /resumeSequence\(sequence\.context_id\)/);
	assert.match(runningSequences, /abortSequence\(sequence\.context_id\)/);
});

test('the sequence panel only displays catalog sequences', () => {
	assert.doesNotMatch(sequencePanel, /activeSequences|Running|No active sequences/);
	assert.doesNotMatch(sequencePanel, /pauseSequence|resumeSequence|abortSequence/);
});
