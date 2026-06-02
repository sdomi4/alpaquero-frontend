import assert from 'node:assert/strict';
import test from 'node:test';

import { parseObservatoryLogMessage } from '../src/lib/websocketMessages.js';

test('parseObservatoryLogMessage normalizes backend websocket messages', () => {
	const receivedAt = '2026-06-02T12:35:00.000Z';
	const raw = JSON.stringify({
		level: 'error',
		message: 'Some context: underlying error',
		timestamp: '2026-06-02T12:34:56.789012+00:00'
	});

	assert.deepEqual(parseObservatoryLogMessage(raw, receivedAt), {
		level: 'error',
		message: 'Some context: underlying error',
		timestamp: '2026-06-02T12:34:56.789012+00:00',
		receivedAt,
		raw
	});
});

test('parseObservatoryLogMessage keeps malformed websocket payloads loggable', () => {
	const receivedAt = '2026-06-02T12:35:00.000Z';
	const raw = '{broken';

	assert.deepEqual(parseObservatoryLogMessage(raw, receivedAt), {
		level: 'error',
		message: 'Invalid websocket message',
		timestamp: receivedAt,
		receivedAt,
		raw
	});
});
