import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainPage = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const sequencePanel = readFileSync(
	new URL('../src/lib/components/sequences/SequencePanel.svelte', import.meta.url),
	'utf8'
);
const sequenceBuilder = readFileSync(
	new URL('../src/routes/sequences/new/+page.svelte', import.meta.url),
	'utf8'
);
const sequenceBuilderServer = readFileSync(
	new URL('../src/routes/sequences/new/+page.server.ts', import.meta.url),
	'utf8'
);
const blockNode = readFileSync(
	new URL('../src/lib/components/sequence-builder/BlockNode.svelte', import.meta.url),
	'utf8'
);
const builderLibraryItem = readFileSync(
	new URL('../src/lib/components/sequence-builder/BuilderLibraryItem.svelte', import.meta.url),
	'utf8'
);
const dropZone = readFileSync(
	new URL('../src/lib/components/sequence-builder/DropZone.svelte', import.meta.url),
	'utf8'
);
const parallelBranchDropTarget = readFileSync(
	new URL(
		'../src/lib/components/sequence-builder/ParallelBranchDropTarget.svelte',
		import.meta.url
	),
	'utf8'
);
const parallelNewBranchDropZone = readFileSync(
	new URL(
		'../src/lib/components/sequence-builder/ParallelNewBranchDropZone.svelte',
		import.meta.url
	),
	'utf8'
);

test('main page top bar links to the pinpoint page', () => {
	assert.match(mainPage, /href=\{resolve\('\/pinpoint'\)\}/);
	assert.match(mainPage, />\s*Pinpoint\s*</);
});

test('main page top bar links to the sequence builder', () => {
	assert.match(mainPage, /href=\{resolve\('\/sequences\/new'\)\}/);
	assert.match(mainPage, />\s*Builder\s*</);
});

test('available sequences link to the editor with their catalog name', () => {
	assert.match(
		sequencePanel,
		/`\$\{resolve\('\/sequences\/new'\)\}\?sequence=\$\{encodeURIComponent\(sequence\)\}`/
	);
	assert.match(sequencePanel, /aria-label=\{`Edit sequence \$\{sequence\}`\}/);
});

test('the sequence builder loads a sequence named in the query string', () => {
	assert.match(sequenceBuilder, /page\.url\.searchParams\.get\('sequence'\)/);
	assert.match(sequenceBuilder, /loadCatalogSequence\(requestedSequence, true\)/);
});

test('the sequence builder keeps loaded sequences above the scrolling toolbox', () => {
	const loadedSequencesIndex = sequenceBuilder.indexOf('Loaded Sequences');
	const blockLibraryIndex = sequenceBuilder.indexOf('Block Library');

	assert.ok(loadedSequencesIndex >= 0);
	assert.ok(blockLibraryIndex > loadedSequencesIndex);
	assert.match(sequenceBuilder, /class="grid max-h-32 gap-1 overflow-y-auto pr-1"/);
	assert.match(sequenceBuilder, /class="min-h-0 flex-1 overflow-y-auto px-2 pb-2"/);
});

test('the sequence builder can start a fresh sequence without losing edits accidentally', () => {
	assert.match(sequenceBuilder, /onclick=\{\(\) => startNewSequence\(\)\}/);
	assert.match(sequenceBuilder, />\s*New\s*</);
	assert.match(sequenceBuilder, /if \(isDirty && !force\)/);
	assert.match(sequenceBuilder, /Starting a new sequence will discard unsaved edits/);
	assert.match(sequenceBuilder, /onclick=\{\(\) => startNewSequence\(true\)\}/);
	assert.match(sequenceBuilder, /document = next/);
	assert.match(sequenceBuilder, /loadedCatalogName = null/);
});

test('the sequence builder has no summary, checks, or preview footer', () => {
	assert.doesNotMatch(sequenceBuilder, /<footer/);
	assert.doesNotMatch(sequenceBuilder, /Sequence Summary|Run Preview/);
});

test('the sequence builder loads condition metadata and persists saves to YAML', () => {
	assert.match(sequenceBuilderServer, /observatory\/conditions/);
	assert.match(sequenceBuilder, /uploadSequenceYaml\(filename, yaml, false, true\)/);
	assert.match(sequenceBuilder, /Lifecycle & conditions/);
	assert.match(sequenceBuilder, /Available conditions/);
});

test('the sequence builder exposes reliable sequence and parallel drop targets', () => {
	assert.match(dropZone, /terminal/);
	assert.match(dropZone, /aria-label=\{terminal \|\| empty \? 'Drop at sequence end'/);
	assert.match(dropZone, /slotId/);
	assert.match(blockNode, /slotId="end"/);
	assert.match(dropZone, /get data\(\)/);
	assert.doesNotMatch(dropZone, /untrack/);
	assert.match(blockNode, /ParallelBranchDropTarget/);
	assert.match(blockNode, /ParallelNewBranchDropZone/);
	assert.match(parallelBranchDropTarget, /kind: 'parallel-branch'/);
	assert.doesNotMatch(parallelBranchDropTarget, />\s*Drop anywhere to append\s*</);
	assert.match(parallelNewBranchDropZone, /kind: 'parallel-new-branch'/);
	assert.match(parallelNewBranchDropZone, /bg-\[#180d20\]/);
	assert.doesNotMatch(parallelNewBranchDropZone, />\s*\+ New branch\s*</);
	assert.match(parallelNewBranchDropZone, /parallel-new-branch:\$\{parallelId\}:end/);
	assert.doesNotMatch(parallelNewBranchDropZone, /untrack/);
	assert.match(sequenceBuilder, /Feedback\.configure\(\{ dropAnimation: null \}\)/);
});

test('parallel builder branches divide all space left beside the new-branch drop target', () => {
	assert.match(blockNode, /flex w-full min-w-0 items-stretch gap-2/);
	assert.match(parallelBranchDropTarget, /min-w-0 flex-1 basis-0/);
	assert.doesNotMatch(parallelBranchDropTarget, /\bw-64\b/);
	assert.match(parallelNewBranchDropZone, /\bw-20 shrink-0\b/);
});

test('device actions expose a prominent editable dropdown control', () => {
	assert.match(sequenceBuilder, /Open configured device options/);
	assert.match(sequenceBuilder, /deviceInput\.showPicker\(\)/);
	assert.match(sequenceBuilder, /Choose configured ID/);
	assert.match(sequenceBuilder, /border-2 border-sky-700/);
});

test('the sequence builder opens empty and omits redundant editor chrome', () => {
	assert.match(sequenceBuilder, /name: 'New Sequence'/);
	assert.match(sequenceBuilder, /createSequence\('root-sequence', 'New Sequence', \[\]\)/);
	assert.doesNotMatch(sequenceBuilder, /createSequenceFixture|reference sequence/i);
	assert.doesNotMatch(sequenceBuilder, /Builder Canvas|Top to bottom|\{actions\.length\} actions/);
	assert.doesNotMatch(sequenceBuilder, /Saves are written/);
	assert.doesNotMatch(sequenceBuilder, />\s*Unsaved\s*</);
	assert.match(builderLibraryItem, /\{#if description\}/);
	assert.match(builderLibraryItem, /<div\s+\{@attach draggable\.attach\}/);
	assert.match(builderLibraryItem, /\{@attach draggable\.attachHandle\}/);
	assert.doesNotMatch(builderLibraryItem, /showAdd|onAdd|<button/);
});

test('blocks use their full card as the selection target without calculated duration estimates', () => {
	assert.match(blockNode, /onclick=\{selectFromBlock\}/);
	assert.match(blockNode, /target\.closest\('\[data-block-id\]'\) === currentTarget/);
	assert.doesNotMatch(blockNode, /nodeDurationSeconds|formatDuration|\{duration\}/);
	assert.match(blockNode, /node\.await_timeout/);
	assert.match(blockNode, /node\.delay/);
	assert.match(sequenceBuilder, /Delay seconds|Await timeout seconds/);
	assert.doesNotMatch(blockNode, /join ·/);
	assert.doesNotMatch(blockNode, /nodeDescription/);
});

test('the delete key invokes the selected block delete action outside editable controls', () => {
	assert.match(sequenceBuilder, /<svelte:window onkeydown=\{handleBuilderKey\}/);
	assert.match(sequenceBuilder, /event\.key !== 'Delete'/);
	assert.match(sequenceBuilder, /target\.closest\('input, textarea, select'\)/);
	assert.match(sequenceBuilder, /deleteSelected\(\)/);
	assert.match(sequenceBuilder, /onclick=\{deleteSelected\}/);
});

test('the sequence builder supports copy and context-aware paste shortcuts', () => {
	assert.match(sequenceBuilder, /\(event\.ctrlKey \|\| event\.metaKey\)/);
	assert.match(sequenceBuilder, /key === 'c'/);
	assert.match(sequenceBuilder, /copiedNode = selectedNode/);
	assert.match(sequenceBuilder, /key === 'v'/);
	assert.match(sequenceBuilder, /pasteBlock\(document, copiedNode, selectedId\)/);
	assert.match(sequenceBuilder, /onclick=\{copySelected\}/);
	assert.match(sequenceBuilder, /disabled=\{!selectedNode\}/);
	assert.match(sequenceBuilder, />\s*Copy\s*</);
	assert.match(sequenceBuilder, /onclick=\{pasteCopied\}/);
	assert.match(sequenceBuilder, /disabled=\{!copiedNode\}/);
	assert.match(sequenceBuilder, />\s*Paste\s*</);
	assert.match(sequenceBuilder, /onclick=\{deselectFromCanvas\}/);
	assert.match(sequenceBuilder, /data-sequence-canvas/);
});
