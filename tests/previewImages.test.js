import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFullPreviewImagePath, normalizeCapturePreviews } from '../src/lib/previewImages.js';

test('normalizeCapturePreviews keeps up to three valid preview images', () => {
	assert.deepEqual(
		normalizeCapturePreviews([
			{
				name: 'capture 1.png',
				timestamp: '2026-06-26T18:30:00Z',
				preview_png: 'iVBOR/preview-one',
				mime_type: 'image/png'
			},
			{
				name: 'capture-2.png',
				timestamp: 1782500000,
				preview_png: 'data:image/png;base64,iVBOR/preview-two'
			},
			{
				name: 'missing-preview.png',
				timestamp: 'ignored',
				preview_png: ''
			},
			{
				name: 'capture-3.png',
				timestamp: null,
				preview_png: 'iVBOR/preview-three'
			},
			{
				name: 'capture-4.png',
				timestamp: 'ignored because limit is three',
				preview_png: 'iVBOR/preview-four'
			}
		]),
		[
			{
				name: 'capture 1.png',
				timestamp: '2026-06-26T18:30:00Z',
				src: 'data:image/png;base64,iVBOR/preview-one'
			},
			{
				name: 'capture-2.png',
				timestamp: '1782500000',
				src: 'data:image/png;base64,iVBOR/preview-two'
			},
			{
				name: 'capture-3.png',
				timestamp: '',
				src: 'data:image/png;base64,iVBOR/preview-three'
			}
		]
	);
});

test('buildFullPreviewImagePath encodes preview names for the observatory proxy', () => {
	assert.equal(
		buildFullPreviewImagePath('capture 1/final.png'),
		'/api/observatory/previews/full/capture%201%2Ffinal.png'
	);
});
