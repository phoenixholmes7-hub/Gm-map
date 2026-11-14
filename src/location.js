// Position sources. Both emit "fix" events with
// { lng, lat, accuracy (m), speed (m/s), heading (deg or null), time (ms), simulated }.

import { haversine, bearing, pointAlong, angleDiff } from './geo.js';

export class GpsTracker extends EventTarget {
  #watch = null;
  #last = null;
  #compass = null;
  #onOrient = null;

  get active() {
    return this.#watch !== null;
  }

  start() {
    if (this.#watch !== null) return true;
    if (!('geolocation' in navigator)) {
      this.dispatchEvent(new CustomEvent('error', { detail: { code: 0, message: 'This device has no location support' } }));
      return false;
    }
    this.#watch = navigator.geolocation.watchPosition(
      (pos) => this.#onPosition(pos),
      (err) => {
        // Permission denied is final; timeouts and "unavailable" recover on their own.
        if (err.code === 1) this.stop();
        this.dispatchEvent(new CustomEvent('error', { detail: { code: err.code, message: err.message } }));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    this.#startCompass();
    return true;
  }

  stop() {
    if (this.#watch !== null) navigator.geolocation.clearWatch(this.#watch);
    this.#watch = null;
    if (this.#onOrient) {
      window.removeEventListener('deviceorientationabsolute', this.#onOrient);
      window.removeEventListener('deviceorientation', this.#onOrient);
      this.#onOrient = null;
    }
  }

  #onPosition(pos) {
    const c = pos.coords;
    const here = [c.longitude, c.latitude];
    const speed = Number.isFinite(c.speed) && c.speed !== null ? Math.max(0, c.speed) : this.#derivedSpeed(here, pos.timestamp);

    // Prefer the GPS course while moving, then our own track, then the compass when parked.
    let heading = null;
    if (Number.isFinite(c.heading) && c.heading !== null && speed > 1.2) heading = c.heading;
    else if (this.#last && haversine(this.#last.at, here) > 6) heading = bearing(this.#last.at, here);
    else if (speed < 1.2 && this.#compass !== null) heading = this.#compass;
    else if (this.#last) heading = this.#last.heading;

    if (!this.#last || haversine(this.#last.at, here) > 6) {
      this.#last = { at: here, time: pos.timestamp, heading };
    } else {
      this.#last.heading = heading;
    }

    this.dispatchEvent(
      new CustomEvent('fix', {
        detail: { lng: here[0], lat: here[1], accuracy: c.accuracy, speed, heading, time: pos.timestamp, simulated: false },
      }),
    );
  }

  #derivedSpeed(here, time) {
    if (!this.#last) return 0;
    const dt = (time - this.#last.time) / 1000;
    return dt > 0.5 ? haversine(this.#last.at, here) / dt : 0;
  }

  #startCompass() {
    if (this.#onOrient || typeof window === 'undefined') return;
    this.#onOrient = (e) => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading; // iOS
      else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha; // Android
      if (h === null) return;
      h = (h + (screen.orientation?.angle || 0) + 360) % 360;
      // Low-pass filter: phone magnetometers are jittery.
      this.#compass = this.#compass === null ? h : (this.#compass + angleDiff(this.#compass, h) * 0.2 + 360) % 360;
    };
    const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(type, this.#onOrient);
  }
}

/** Drives along a route at realistic speeds; used for the demo drive and for testing. */
export class RouteSimulator extends EventTarget {
  #timer = null;
  #along = 0;

  constructor(route, { rate = 1, tickMs = 250 } = {}) {
    super();
    this.route = route;
    this.rate = rate;
    this.tickMs = tickMs;
  }

  start() {
    if (this.#timer) return;
    this.#emit(0);
    this.#timer = setInterval(() => this.#tick(), this.tickMs);
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }

  // Cruise speed for the step we're in, eased down ahead of the next manoeuvre.
  #speedAt(along) {
    const { steps } = this.route;
    let i = 0;
    while (i + 1 < steps.length && steps[i + 1].along <= along) i++;
    const st = steps[i];
    const cruise = st.duration > 0 ? Math.max(6, Math.min(34, st.distance / st.duration)) : 10;
    const nextAt = i + 1 < steps.length ? steps[i + 1].along : this.route.distance;
    const toTurn = nextAt - along;
    return toTurn < 60 ? Math.max(5, cruise * (0.35 + 0.65 * (toTurn / 60))) : cruise;
  }

  #tick() {
    const speed = this.#speedAt(this.#along);
    this.#along += speed * (this.tickMs / 1000) * this.rate;
    if (this.#along >= this.route.distance) {
      this.#along = this.route.distance;
      this.#emit(0);
      this.stop();
      this.dispatchEvent(new Event('end'));
      return;
    }
    this.#emit(speed);
  }

  #emit(speed) {
    const { coords, cum } = this.route;
    const at = pointAlong(coords, cum, this.#along);
    this.dispatchEvent(
      new CustomEvent('fix', {
        detail: { lng: at.point[0], lat: at.point[1], accuracy: 5, speed, heading: at.bearing, time: Date.now(), simulated: true },
      }),
    );
  }
}
