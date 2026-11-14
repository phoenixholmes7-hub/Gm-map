import test from 'node:test';
import assert from 'node:assert/strict';
import { CUES, kitFor, cueDuration, scheduleCue } from '../src/sound.js';
import { THEMES } from '../src/themes.js';

test('every theme has its own kit with every cue', () => {
  const kits = new Set();
  for (const theme of THEMES) {
    const kit = kitFor(theme.id);
    kits.add(kit);
    for (const cue of CUES) {
      const notes = kit.cues[cue];
      assert.ok(Array.isArray(notes) && notes.length > 0, `${theme.id}.${cue} is missing`);
    }
  }
  assert.equal(kits.size, THEMES.length, 'themes should not share a kit');
});

test('notes are well formed and audible-range', () => {
  for (const theme of THEMES) {
    for (const cue of CUES) {
      for (const [midi, start, length, gain = 1, slide = midi] of kitFor(theme.id).cues[cue]) {
        assert.ok(midi >= 33 && midi <= 100, `${theme.id}.${cue}: pitch ${midi}`);
        assert.ok(slide >= 33 && slide <= 100, `${theme.id}.${cue}: slide ${slide}`);
        assert.ok(start >= 0 && length > 0.03, `${theme.id}.${cue}: timing ${start}/${length}`);
        assert.ok(gain > 0 && gain <= 1, `${theme.id}.${cue}: gain ${gain}`);
      }
    }
  }
});

test('cues are short enough not to talk over the driver', () => {
  for (const theme of THEMES) {
    for (const cue of CUES) {
      const limit = cue === 'arrive' ? 3 : 2;
      assert.ok(cueDuration(theme.id, cue) <= limit, `${theme.id}.${cue} lasts ${cueDuration(theme.id, cue).toFixed(2)}s`);
    }
    // The heads-up before a spoken turn has to be brief.
    assert.ok(cueDuration(theme.id, 'turn') < 1.5, `${theme.id}.turn too long`);
  }
});

// A stand-in audio context that only records how nodes are wired together.
function recordingContext() {
  const edges = [];
  const param = () => ({ value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (kind) => ({
    kind, type: '', gain: param(), frequency: param(), detune: param(), delayTime: param(),
    connect(target) { edges.push([this, target]); }, start() {}, stop() {},
  });
  return {
    edges, currentTime: 0, destination: node('destination'),
    createGain: () => node('gain'), createOscillator: () => node('osc'),
    createBiquadFilter: () => node('filter'), createDelay: () => node('delay'),
  };
}

test('the only feedback loop in any cue is a damped echo', () => {
  for (const theme of THEMES) {
    for (const cue of CUES) {
      const ac = recordingContext();
      scheduleCue(ac, ac.destination, theme.id, cue, 0);
      const next = new Map();
      for (const [a, b] of ac.edges) next.set(a, [...(next.get(a) || []), b]);
      const reaches = (from, to, seen = new Set()) =>
        (next.get(from) || []).some((n) => n === to || (!seen.has(n) && seen.add(n) && reaches(n, to, seen)));
      const looping = [...next.keys()].filter((n) => reaches(n, n));
      // An undamped loop (anything beyond delay <-> feedback gain) grows without limit.
      assert.ok(looping.length <= 2, `${theme.id}.${cue}: ${looping.length} nodes in feedback loops`);
      for (const n of looping) {
        assert.ok(n.kind === 'delay' || (n.kind === 'gain' && n.gain.value < 0.7), `${theme.id}.${cue}: ${n.kind} in a loop`);
      }
      assert.ok(ac.edges.some(([, b]) => b === ac.destination), `${theme.id}.${cue} never reaches the speakers`);
    }
  }
});
