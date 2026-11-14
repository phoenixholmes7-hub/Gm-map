// Sound cues, synthesized on the fly with the Web Audio API. No audio files: every theme has
// its own small "instrument" and a short original motif for each event.
//
// Cues:  waypoint  destination chosen          start    navigation begins
//        route     route planned               turn     heads-up before a spoken direction
//        reroute   route recalculated          arrive   destination reached
//        error     something went wrong

export const CUES = ['waypoint', 'route', 'start', 'turn', 'reroute', 'arrive', 'error'];

// A note is [midi, start (s), length (s), gain (0..1, optional), slide-to midi (optional)].
// midi 69 = A4 (440 Hz).
const KITS = {
  // Crisp digital chimes, like a phone alert: a pure tone with a quiet octave on top.
  heist: {
    wave: 'sine', shape: 'pluck', voices: [[0, 1], [1200, 0.32]], echo: { time: 0.13, feedback: 0.22 }, volume: 0.95,
    cues: {
      waypoint: [[79, 0, 0.09], [84, 0.085, 0.24]],
      route: [[72, 0, 0.1], [79, 0.085, 0.1], [84, 0.17, 0.1], [91, 0.27, 0.5]],
      start: [[48, 0, 0.36, 0.9, 36], [79, 0.14, 0.12], [86, 0.26, 0.12], [91, 0.38, 0.5]],
      turn: [[88, 0, 0.08], [88, 0.11, 0.2]],
      reroute: [[84, 0, 0.11], [79, 0.1, 0.11], [72, 0.2, 0.34]],
      arrive: [[72, 0, 0.16], [76, 0.11, 0.16], [79, 0.22, 0.16], [84, 0.33, 0.16], [88, 0.44, 0.16], [91, 0.58, 0.8]],
      error: [[46, 0, 0.16, 0.9], [45, 0.2, 0.3, 0.9]],
    },
  },
  // Plucked strings in an open major pentatonic.
  frontier: {
    wave: 'triangle', shape: 'pluck', voices: [[-7, 1], [7, 1]], lowpass: 2400, volume: 1,
    cues: {
      waypoint: [[74, 0, 0.3], [81, 0.1, 0.5]],
      route: [[62, 0, 0.35], [66, 0.1, 0.35], [69, 0.2, 0.35], [74, 0.3, 0.7]],
      start: [[57, 0, 0.4, 1, 62], [69, 0.16, 0.4], [74, 0.3, 0.8]],
      turn: [[81, 0, 0.3], [78, 0.14, 0.5]],
      reroute: [[69, 0, 0.3], [66, 0.13, 0.3], [62, 0.26, 0.6]],
      arrive: [[62, 0, 0.6], [66, 0.05, 0.6], [69, 0.1, 0.6], [74, 0.15, 0.6], [78, 0.2, 0.6], [74, 0.55, 0.3], [81, 0.7, 1]],
      error: [[50, 0, 0.3], [49, 0.22, 0.5]],
    },
  },
  // Square-wave chiptune arpeggios.
  blocks: {
    wave: 'square', shape: 'beep', volume: 0.42,
    cues: {
      waypoint: [[84, 0, 0.06], [88, 0.06, 0.1]],
      route: [[72, 0, 0.07], [76, 0.07, 0.07], [79, 0.14, 0.07], [84, 0.21, 0.16]],
      start: [[67, 0, 0.08], [72, 0.08, 0.08], [76, 0.16, 0.08], [79, 0.24, 0.2]],
      turn: [[88, 0, 0.05], [88, 0.1, 0.09]],
      reroute: [[79, 0, 0.08], [76, 0.08, 0.08], [72, 0.16, 0.16]],
      arrive: [[72, 0, 0.08], [76, 0.08, 0.08], [79, 0.16, 0.08], [84, 0.24, 0.08], [88, 0.32, 0.08], [91, 0.4, 0.08], [96, 0.48, 0.36]],
      error: [[45, 0, 0.12], [45, 0.18, 0.2]],
    },
  },
  // Filtered saw leads with a long echo tail.
  neon: {
    wave: 'sawtooth', shape: 'pluck', voices: [[-9, 1], [9, 1]], echo: { time: 0.21, feedback: 0.42 }, lowpass: 2600, volume: 0.6,
    cues: {
      waypoint: [[69, 0, 0.3, 1, 81]],
      route: [[57, 0, 0.18], [64, 0.09, 0.18], [69, 0.18, 0.18], [73, 0.27, 0.18], [76, 0.36, 0.5]],
      start: [[45, 0, 0.5, 0.9, 69], [76, 0.3, 0.2], [81, 0.42, 0.6]],
      turn: [[76, 0, 0.16], [73, 0.12, 0.3]],
      reroute: [[76, 0, 0.18], [72, 0.12, 0.18], [69, 0.24, 0.45]],
      arrive: [[57, 0, 0.25], [61, 0.1, 0.25], [64, 0.2, 0.25], [68, 0.3, 0.25], [73, 0.4, 0.25], [76, 0.5, 0.25], [80, 0.6, 0.9]],
      error: [[40, 0, 0.3, 0.9, 38], [39, 0.26, 0.4, 0.9]],
    },
  },
  // Plain console beeps.
  terminal: {
    wave: 'sine', shape: 'beep', volume: 0.75,
    cues: {
      waypoint: [[81, 0, 0.07]],
      route: [[76, 0, 0.06], [81, 0.09, 0.06], [88, 0.18, 0.12]],
      start: [[69, 0, 0.09], [81, 0.13, 0.18]],
      turn: [[88, 0, 0.05], [88, 0.09, 0.05]],
      reroute: [[81, 0, 0.08], [76, 0.11, 0.14]],
      arrive: [[76, 0, 0.08], [81, 0.11, 0.08], [88, 0.22, 0.08], [93, 0.33, 0.3]],
      error: [[57, 0, 0.1], [57, 0.15, 0.1], [57, 0.3, 0.1]],
    },
  },
};

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function kitFor(themeId) {
  return KITS[themeId] || KITS.heist;
}

/** Length of a cue in seconds, including its echo tail. */
export function cueDuration(themeId, cue) {
  const kit = kitFor(themeId);
  const notes = kit.cues[cue] || [];
  const end = notes.reduce((m, [, t, d]) => Math.max(m, t + d), 0);
  return end + (kit.echo ? kit.echo.time * 4 : 0.05);
}

/**
 * Build the audio graph for one cue on any (live or offline) audio context.
 * Returns the time at which the cue has finished sounding.
 */
export function scheduleCue(ac, destination, themeId, cue, at = ac.currentTime) {
  const kit = kitFor(themeId);
  const notes = kit.cues[cue];
  if (!notes) return at;

  // notes -> bus -> (lowpass) -> out, with the echo tapped off after the filter. The dry
  // path and the echo loop must stay separate: if the delay fed back into its own input
  // through `out`, the loop gain would exceed 1 and the cue would howl.
  const out = ac.createGain();
  out.gain.value = kit.volume;
  const bus = ac.createGain();
  let tail = bus;
  if (kit.lowpass) {
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kit.lowpass;
    bus.connect(filter);
    tail = filter;
  }
  tail.connect(out);
  if (kit.echo) {
    const delay = ac.createDelay(1);
    delay.delayTime.value = kit.echo.time;
    const feedback = ac.createGain();
    feedback.gain.value = kit.echo.feedback;
    tail.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(out);
  }
  out.connect(destination);

  for (const [midi, t, d, g = 1, slide] of notes) {
    const t0 = at + t;
    const env = ac.createGain();
    const peak = 0.3 * g;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    if (kit.shape === 'pluck') {
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    } else {
      // "beep": hold level, then a very short release so it doesn't click
      env.gain.setValueAtTime(peak, t0 + Math.max(0.008, d - 0.012));
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    }
    env.connect(bus);

    // Voices are [detune in cents, gain]: detuned pairs thicken a tone, an octave adds sparkle.
    for (const [cents, level] of kit.voices || [[0, 1]]) {
      const osc = ac.createOscillator();
      osc.type = kit.wave;
      osc.frequency.setValueAtTime(hz(midi), t0);
      if (slide !== undefined) osc.frequency.exponentialRampToValueAtTime(hz(slide), t0 + d * 0.8);
      osc.detune.value = cents;
      const voice = ac.createGain();
      voice.gain.value = level;
      osc.connect(voice);
      voice.connect(env);
      osc.start(t0);
      osc.stop(t0 + d + 0.02);
    }
  }
  return at + cueDuration(themeId, cue);
}

// ---- live playback ---------------------------------------------------------------------------

let context = null;
let master = null;
let enabled = true;

function live() {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    context = new AC();
    master = context.createGain();
    master.gain.value = 0.9;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

export function setSoundEnabled(on) {
  enabled = !!on;
}

/**
 * Browsers only let audio start after the user has touched the page. Call this once from a
 * tap handler so later cues (which fire from GPS and network events) are allowed to play.
 */
export function unlockAudio() {
  live();
}

/** Play a cue now. Returns its length in milliseconds (0 if nothing played). */
export function playCue(themeId, cue) {
  if (!enabled) return 0;
  const ac = live();
  if (!ac || ac.state !== 'running') return 0;
  try {
    scheduleCue(ac, master, themeId, cue, ac.currentTime + 0.02);
  } catch {
    return 0;
  }
  return Math.round(cueDuration(themeId, cue) * 1000);
}
