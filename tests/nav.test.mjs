import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseRoute, describe, iconFor } from '../src/routing.js';
import { NavSession } from '../src/nav.js';
import { pointAlong, destination } from '../src/geo.js';

// An L-shaped drive: ~1.1 km east, turn left, ~1.1 km north.
const osrm = {
  duration: 200,
  geometry: { coordinates: [[0, 0], [0.005, 0], [0.01, 0], [0.01, 0.005], [0.01, 0.01]] },
  legs: [{
    steps: [
      { name: 'First Street', distance: 1112, duration: 100, maneuver: { type: 'depart', location: [0, 0] } },
      { name: 'Oak Avenue', distance: 1112, duration: 100, maneuver: { type: 'turn', modifier: 'left', location: [0.01, 0] } },
      { name: 'Oak Avenue', distance: 0, duration: 0, maneuver: { type: 'arrive', modifier: 'right', location: [0.01, 0.01] } },
    ],
  }],
};

const fixAt = (route, along, extra = {}) => {
  const p = pointAlong(route.coords, route.cum, along).point;
  return { lng: p[0], lat: p[1], accuracy: 5, speed: 12, heading: 0, ...extra };
};

test('instructions read naturally', () => {
  assert.equal(describe('turn', 'left', 'Oak Avenue'), 'Turn left onto Oak Avenue');
  assert.equal(describe('turn', 'slight right', ''), 'Bear right');
  assert.equal(describe('turn', 'uturn', 'Main St'), 'Make a U-turn');
  assert.equal(describe('roundabout', '', 'Ring Road', 2), 'At the roundabout, take the 2nd exit onto Ring Road');
  assert.equal(describe('off ramp', 'right', ''), 'Take the exit on the right');
  assert.equal(describe('arrive', 'right', ''), 'Your destination is on the right');
  assert.equal(iconFor('turn', 'sharp left'), 'sharp-left');
  assert.equal(iconFor('arrive', 'right'), 'arrive');
});

test('route steps are pinned to the geometry', () => {
  const route = normaliseRoute(osrm);
  assert.equal(route.steps.length, 3);
  assert.equal(route.steps[0].along, 0);
  assert.ok(Math.abs(route.steps[1].along - route.cum[2]) < 1);
  assert.ok(Math.abs(route.steps[2].along - route.distance) < 1);
});

test('progress, next manoeuvre and time remaining', () => {
  const route = normaliseRoute(osrm);
  const nav = new NavSession(route);
  const n = nav.update(fixAt(route, 300));
  assert.equal(n.onRoad, true);
  assert.equal(n.next.text, 'Turn left onto Oak Avenue');
  assert.ok(Math.abs(n.toNext - (route.cum[2] - 300)) < 2);
  assert.ok(Math.abs(n.remaining - (route.distance - 300)) < 2);
  assert.ok(n.seconds > 165 && n.seconds < 180, `seconds=${n.seconds}`);
  assert.equal(n.arrived, false);
  assert.equal(n.offRoute, false);
});

test('each manoeuvre is announced early, then at the turn, and never repeated', () => {
  const route = normaliseRoute(osrm);
  const nav = new NavSession(route);
  const said = [];
  for (let along = 0; along < route.cum[2] - 5; along += 12) {
    const n = nav.update(fixAt(route, along));
    if (n.say) said.push(n.say);
  }
  assert.equal(said.length, 2);
  assert.match(said[0], /^In \d+ meters, turn left onto Oak Avenue$/);
  assert.equal(said[1], 'Turn left onto Oak Avenue');
});

test('leaving the route triggers a re-route only after several fixes', () => {
  const route = normaliseRoute(osrm);
  const nav = new NavSession(route);
  nav.update(fixAt(route, 400));
  const on = pointAlong(route.coords, route.cum, 420).point;
  const off = destination(on, 180, 120); // 120 m south of the road
  const results = [1, 2, 3, 4].map(() => nav.update({ lng: off[0], lat: off[1], accuracy: 5, speed: 10 }));
  assert.deepEqual(results.map((r) => r.offRoute), [false, false, false, true]);
  assert.equal(results[3].onRoad, false);
  // Back on the road clears it.
  assert.equal(nav.update(fixAt(route, 440)).offRoute, false);
});

test('arrival fires near the end of the route', () => {
  const route = normaliseRoute(osrm);
  const nav = new NavSession(route);
  assert.equal(nav.update(fixAt(route, route.distance - 200)).arrived, false);
  assert.equal(nav.update(fixAt(route, route.distance - 10)).arrived, true);
});
