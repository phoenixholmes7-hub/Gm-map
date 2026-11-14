import test from 'node:test';
import assert from 'node:assert/strict';
import { collectLines, buildPath } from '../src/traffic.js';
import { haversine } from '../src/geo.js';

const line = (coords, cls = 'minor') => ({ geometry: { type: 'LineString', coordinates: coords }, properties: { class: cls } });

test('collectLines flattens multi-part roads and drops stubs', () => {
  const lines = collectLines([
    line([[0, 0], [0.002, 0]]),
    { geometry: { type: 'MultiLineString', coordinates: [[[0, 0.001], [0.002, 0.001]], [[0, 0.002], [0.0001, 0.002]]] }, properties: { class: 'primary' } },
    { geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
  ]);
  assert.equal(lines.length, 2); // the 11 m stub and the point are ignored
  assert.equal(lines[1].cls, 'primary');
});

test('buildPath chains connected pieces into one continuous drive', () => {
  // Three collinear blocks, each ~222 m, stored in mixed directions like real tile data.
  const lines = collectLines([
    line([[0, 0], [0.002, 0]]),
    line([[0.004, 0], [0.002, 0]]),
    line([[0.004, 0], [0.006, 0]]),
  ]);
  const path = buildPath(lines, { target: 5000, random: () => 0 });
  assert.ok(path, 'expected a path');
  assert.ok(Math.abs(path.length - 667) < 5, `length ${path.length}`);
  for (let i = 1; i < path.coords.length; i++) {
    assert.ok(haversine(path.coords[i - 1], path.coords[i]) < 230, 'no jumps between pieces');
  }
});

test('buildPath will not reverse back down the road it came from', () => {
  const lines = collectLines([
    line([[0, 0], [0.002, 0]]),
    line([[0.002, 0], [0.0005, 0.00001]]), // doubles back
  ]);
  const path = buildPath(lines, { target: 5000, random: () => 0 });
  assert.ok(path.length < 230, 'should stop rather than U-turn');
});

test('buildPath gives up on scraps too short to drive', () => {
  assert.equal(buildPath(collectLines([line([[0, 0], [0.0005, 0]])]), { random: () => 0 }), null);
  assert.equal(buildPath([], {}), null);
});
