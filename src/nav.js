// Turn-by-turn session: tracks progress along a route, picks the upcoming manoeuvre, decides
// what to say and when, and notices when the driver has left the route or arrived.

import { nearestOnLine, bearing, spokenDistance } from './geo.js';

const OFF_ROUTE_M = 45; // further than this from the line counts as "off"
const OFF_ROUTE_FIXES = 4; // ...for this many fixes in a row before we re-route
const ARRIVE_M = 25;
const SNAP_M = 30; // closer than this, the marker is drawn on the road

export class NavSession {
  constructor(route, { units = 'metric' } = {}) {
    this.route = route;
    this.units = units;
    this.seg = 0;
    this.along = 0;
    this.offCount = 0;
    this.arrived = false;
    this.spoken = new Set();
  }

  /** Feed a GPS fix; returns everything the HUD needs for this moment. */
  update(fix) {
    const { coords, cum, steps } = this.route;
    const p = [fix.lng, fix.lat];
    const last = coords.length - 2;

    // Look near the last known position first so overlapping roads can't teleport us.
    let hit = nearestOnLine(coords, p, this.seg - 3, this.seg + 40);
    if (!hit || hit.dist > OFF_ROUTE_M) {
      const wide = nearestOnLine(coords, p, 0, last);
      if (wide && (!hit || wide.dist < hit.dist - 10)) hit = wide;
    }

    const slack = Math.max(OFF_ROUTE_M, (fix.accuracy || 0) * 1.5);
    const off = hit.dist > slack;
    this.offCount = off ? this.offCount + 1 : 0;

    if (!off) {
      this.seg = hit.index;
      this.along = cum[hit.index] + (cum[hit.index + 1] - cum[hit.index]) * hit.t;
    }

    const remaining = Math.max(0, this.route.distance - this.along);

    // Current step = the last one whose manoeuvre is behind us.
    let i = 0;
    while (i + 1 < steps.length && steps[i + 1].along <= this.along + 1) i++;
    const next = steps[Math.min(i + 1, steps.length - 1)];
    const toNext = Math.max(0, next.along - this.along);

    // Time left: the unfinished part of this step plus every later step.
    const cur = steps[i];
    const stepLen = Math.max(1, next.along - cur.along);
    let seconds = cur.duration * Math.min(1, toNext / stepLen);
    for (let k = i + 1; k < steps.length; k++) seconds += steps[k].duration;

    if (!off && remaining <= ARRIVE_M) this.arrived = true;

    const onRoad = !off && hit.dist <= SNAP_M;
    return {
      onRoad,
      snapped: onRoad ? hit.point : p,
      roadBearing: bearing(coords[hit.index], coords[hit.index + 1]),
      seg: this.seg,
      along: this.along,
      remaining,
      seconds,
      stepIndex: i,
      next,
      toNext,
      offRoute: this.offCount >= OFF_ROUTE_FIXES,
      arrived: this.arrived,
      say: this.arrived ? null : this.#announce(i + 1, next, toNext, fix.speed || 0),
    };
  }

  /** Remaining route geometry from the current position, for trimming the drawn line. */
  remainingLine(from) {
    const { coords } = this.route;
    return [from, ...coords.slice(this.seg + 1)];
  }

  // Two prompts per manoeuvre: an early heads-up and a "now" call timed by speed.
  #announce(index, next, toNext, speed) {
    const nowAt = Math.max(35, Math.min(160, speed * 5));
    const earlyAt = Math.max(250, Math.min(900, speed * 22));
    const nowKey = `${index}:now`;
    const earlyKey = `${index}:early`;
    if (toNext <= nowAt && !this.spoken.has(nowKey)) {
      this.spoken.add(nowKey);
      this.spoken.add(earlyKey);
      return next.text;
    }
    if (toNext <= earlyAt && toNext > nowAt * 1.8 && !this.spoken.has(earlyKey)) {
      this.spoken.add(earlyKey);
      return `In ${spokenDistance(toNext, this.units)}, ${lowerFirst(next.text)}`;
    }
    return null;
  }
}

function lowerFirst(s) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
