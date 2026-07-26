import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'yaml';

import {
	parseSequenceYaml,
	sequenceYamlFilename,
	serializeSequenceYaml
} from '../src/lib/sequence-builder/yaml.ts';

const source = `name: "feature test"
description: "Round-trip coverage"
await: "{{ conditions.weather_is_safe() }}"
await_timeout: 600
update: true
sequence:
  - name: "Open and report"
    parallel:
      - name: "Open Dome"
        action: open_dome
        device_id: sim_dome
        args:
          override: false
      - name: "Messages"
        sequence:
          - action: debug_print
            args:
              message: "Opening"
            update: true
    repeat: 2
    when: "{{ args.enabled }}"
  - name: "Confirm target"
    pause: true
    reason: "Check framing"
`;

test('parseSequenceYaml converts the backend language into the editor AST', () => {
	const document = parseSequenceYaml(source);

	assert.equal(document.name, 'feature test');
	assert.equal(document.description, 'Round-trip coverage');
	assert.equal(document.root.children.length, 2);
	assert.equal(document.root.await, '{{ conditions.weather_is_safe() }}');
	assert.equal(document.root.await_timeout, 600);
	assert.equal(document.root.update, true);

	const parallel = document.root.children[0];
	assert.equal(parallel.type, 'parallel');
	assert.equal(parallel.repeat, 2);
	assert.equal(parallel.when, '{{ args.enabled }}');
	assert.equal(parallel.type === 'parallel' ? parallel.children.length : 0, 2);

	const action =
		parallel.type === 'parallel' && parallel.children[0].type === 'action'
			? parallel.children[0]
			: null;
	assert.equal(action?.device, 'sim_dome');
	assert.deepEqual(action?.args, { override: false });

	const nestedAction =
		parallel.type === 'parallel' &&
		parallel.children[1].type === 'sequence' &&
		parallel.children[1].children[0].type === 'action'
			? parallel.children[1].children[0]
			: null;
	assert.equal(nestedAction?.update, true);
	assert.equal(nestedAction?.extra, undefined);

	const pause = document.root.children[1];
	assert.equal(pause.type, 'pause');
	assert.equal(pause.type === 'pause' ? pause.reason : null, 'Check framing');
});

test('serializeSequenceYaml preserves semantics and unknown fields', () => {
	const document = parseSequenceYaml(source);
	const serialized = serializeSequenceYaml(document);
	const yaml = parse(serialized);

	assert.equal(yaml.name, 'feature test');
	assert.equal(yaml.description, 'Round-trip coverage');
	assert.equal(yaml.await, '{{ conditions.weather_is_safe() }}');
	assert.equal(yaml.await_timeout, 600);
	assert.equal(yaml.update, true);
	assert.equal(yaml.sequence[0].parallel[0].device, 'sim_dome');
	assert.equal(yaml.sequence[0].parallel[0].device_id, undefined);
	assert.equal(yaml.sequence[0].parallel[1].sequence[0].update, true);
	assert.equal(yaml.sequence[0].when, '{{ args.enabled }}');
	assert.deepEqual(yaml.sequence[1], {
		name: 'Confirm target',
		pause: true,
		reason: 'Check framing'
	});

	const reparsed = parseSequenceYaml(serialized);
	assert.equal(reparsed.root.children[0].type, 'parallel');
	assert.equal(reparsed.root.children[1].type, 'pause');
});

test('parseSequenceYaml rejects ambiguous nodes before they reach the backend', () => {
	assert.throws(
		() =>
			parseSequenceYaml(`
name: invalid
sequence:
  - action: debug_print
    pause: true
`),
		/exactly one/
	);
});

test('parseSequenceYaml rejects invalid lifecycle value types', () => {
	assert.throws(
		() =>
			parseSequenceYaml(`
name: invalid
sequence: []
update: "true"
`),
		/update must be a boolean/
	);
	assert.throws(
		() =>
			parseSequenceYaml(`
name: invalid
sequence: []
await_timeout: forever
`),
		/await_timeout must be a number/
	);
});

test('sequenceYamlFilename creates an accepted YAML filename', () => {
	assert.equal(sequenceYamlFilename(' Feature Test / Copy '), 'feature-test-copy.yaml');
});
