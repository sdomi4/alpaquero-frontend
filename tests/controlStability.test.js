import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../src/routes/layout.css', import.meta.url), 'utf8');
const deviceShell = readFileSync(
	new URL('../src/lib/components/devices/DeviceShell.svelte', import.meta.url),
	'utf8'
);
const componentSources = readdirSync('src', { recursive: true, encoding: 'utf8' })
	.filter((path) => path.endsWith('.svelte'))
	.map((path) => readFileSync(`src/${path}`, 'utf8'));

test('control shadows reserve the same space while disabled', () => {
	assert.match(layout, /button:not\(\[data-shadowless\]\),/);
	assert.doesNotMatch(layout, /button:not\(:disabled\):not\(\[data-shadowless\]\)/);
	assert.match(layout, /margin-inline-end: 0\.1875rem/);
	assert.match(layout, /margin-block-end: 0\.1875rem/);
});

test('interaction states do not translate controls or remove their shadows', () => {
	for (const source of componentSources) {
		assert.doesNotMatch(source, /active:translate-[xy]-\[1px\]/);
		assert.doesNotMatch(source, /(?:active|disabled):shadow-none/);
	}

	assert.doesNotMatch(layout, /transform:\s*translate/);
});

test('pressed controls collapse their shadow without moving their layout box', () => {
	assert.match(layout, /button:not\(\[data-shadowless\]\):not\(\[data-allow-motion\]\):active/);
	assert.match(layout, /box-shadow: 1px 1px 0 #a855f7/);
	assert.match(layout, /transform: none/);
});

test('the connection control keeps a fixed width while its label changes', () => {
	assert.match(deviceShell, /class="w-20 shrink-0 border/);
});
