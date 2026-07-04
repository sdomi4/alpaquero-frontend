import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainPage = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');

test('main page top bar links to the pinpoint page', () => {
	assert.match(mainPage, /href="\/pinpoint"/);
	assert.match(mainPage, />\s*Pinpoint\s*</);
});
