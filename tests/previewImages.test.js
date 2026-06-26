import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildFullPreviewImagePath,
	normalizeCapturePreviews
} from '../src/lib/previewImages.js';

test('normalizeCapturePreviews keeps up to three valid preview images', () => {
	assert.deepEqual(
		normalizeCapturePreviews([
			{
				name: 'capture 1.jpg',
				timestamp: '2026-06-26T18:30:00Z',
				preview_jpg: '/9j/preview-one',
				mime_type: 'image/png'
			},
			{
				name: 'capture-2.jpg',
				timestamp: 1782500000,
				preview_jpg: 'data:image/jpeg;base64,/9j/preview-two'
			},
			{
				name: 'missing-preview.jpg',
				timestamp: 'ignored',
				preview_jpg: ''
			},
			{
				name: 'capture-3.jpg',
				timestamp: null,
				preview_jpg: '/9j/preview-three'
			},
			{
				name: 'capture-4.jpg',
				timestamp: 'ignored because limit is three',
				preview_jpg: '/9j/preview-four'
			}
		]),
		[
			{
				name: 'capture 1.jpg',
				timestamp: '2026-06-26T18:30:00Z',
				src: 'data:image/png;base64,/9j/preview-one'
			},
			{
				name: 'capture-2.jpg',
				timestamp: '1782500000',
				src: 'data:image/jpeg;base64,/9j/preview-two'
			},
			{
				name: 'capture-3.jpg',
				timestamp: '',
				src: 'data:image/jpeg;base64,/9j/preview-three'
			}
		]
	);
});

test('buildFullPreviewImagePath encodes preview names for the observatory proxy', () => {
	assert.equal(
		buildFullPreviewImagePath('capture 1/final.jpg'),
		'/api/observatory/previews/full/capture%201%2Ffinal.jpg'
	);
});
