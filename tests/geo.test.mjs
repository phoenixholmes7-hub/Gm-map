import test from 'node:test';
import assert from 'node:assert/strict';
import { haversine, bearing, destination, angleDiff, lerpAngle, cumulative, nearestOnLine, pointAlong, formatDistance, spokenDistance, formatDuration, formatSpeed } from '../src/geo.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('haversine: one degree of latitude is about 111.2 km', () => {
  near(haversine([0, 0], [0, 1]), 111195, 50);
});

test('bearing: cardinal directions', () => {
  near(bearing([0, 0], [0, 1]), 0, 0.01);
  near(bearing([0, 0], [1, 0]), 90, 0.01);
  near(bearing([0, 1], [0, 0]), 180, 0.01);
  near(bearing([1, 0], [0, 0]), 270, 0.01);
});

test('destination is the inverse of haversine + bearing', () => {
  const a = [-118.25, 34.05];
  const b = destination(a, 63, 1500);
  near(haversine(a, b), 1500, 0.5);
  near(bearing(a, b), 63, 0.05);
});

test('angles wrap the short way round', () => {
  assert.equal(angleDiff(350, 10), 20);
  assert.equal(angleDiff(10, 350), -20);
  near(lerpAngle(350, 10, 0.5), 0, 1e-9);
});

test('nearestOnLine snaps to the closest segment', () => {
  const line = [[0, 0], [0.01, 0], [0.01, 0.01]];
  const hit = nearestOnLine(line, [0.005, 0.0004]);
  assert.equal(hit.index, 0);
  near(hit.t, 0.5, 0.01);
  near(hit.dist, 44.5, 1);
});

test('pointAlong walks the line by distance', () => {
  const line = [[0, 0], [0.01, 0], [0.01, 0.01]];
  const cum = cumulative(line);
  const mid = pointAlong(line, cum, cum[1] + 100);
  assert.equal(mid.index, 1);
  near(mid.bearing, 0, 0.01);
  near(haversine(line[1], mid.point), 100, 0.5);
  assert.deepEqual(pointAlong(line, cum, 1e9).point, line[2]);
});

test('distance formatting in both unit systems', () => {
  assert.deepEqual(formatDistance(40, 'metric'), { value: '40', unit: 'm' });
  assert.deepEqual(formatDistance(340, 'metric'), { value: '350', unit: 'm' });
  assert.deepEqual(formatDistance(2400, 'metric'), { value: '2.4', unit: 'km' });
  assert.deepEqual(formatDistance(100, 'imperial'), { value: '350', unit: 'ft' });
  assert.deepEqual(formatDistance(1609.344 * 3.2, 'imperial'), { value: '3.2', unit: 'mi' });
  assert.equal(spokenDistance(1609.344, 'imperial'), '1 mile');
  assert.equal(spokenDistance(400, 'metric'), '400 meters');
});

test('durations and speeds', () => {
  assert.equal(formatDuration(30), '1 min');
  assert.equal(formatDuration(60 * 47), '47 min');
  assert.equal(formatDuration(3600 * 2 + 60 * 5), '2 h 5 min');
  assert.equal(formatSpeed(10, 'metric'), 36);
  assert.equal(formatSpeed(10, 'imperial'), 22);
});
