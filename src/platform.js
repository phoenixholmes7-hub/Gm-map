// Thin layer over the things that differ between the Android app and a plain browser:
// speech, keeping the screen on, system-bar styling and picture-in-picture.
//
// Inside the Android shell, `window.GmNative` is injected by MainActivity. In a browser the
// same calls fall back to web APIs where they exist.

const native = typeof window !== 'undefined' ? window.GmNative || null : null;

export const isNativeApp = !!native;

function call(method, ...args) {
  try {
    if (native && typeof native[method] === 'function') return native[method](...args);
  } catch (err) {
    console.warn(`native ${method} failed`, err);
  }
  return undefined;
}

// ---- speech ------------------------------------------------------------------------------

export function speak(text) {
  if (!text) return;
  if (native) {
    call('speak', text);
    return;
  }
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = navigator.language || 'en-US';
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (native) call('stopSpeaking');
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ---- screen wake -------------------------------------------------------------------------

let wakeLock = null;
let wantAwake = false;

async function acquire() {
  if (!wantAwake || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null; // battery saver or unsupported; nothing useful to do
  }
}

export function keepAwake(on) {
  wantAwake = on;
  if (native) {
    call('setKeepAwake', on);
    return;
  }
  if (on) acquire();
  else if (wakeLock) wakeLock.release().catch(() => {});
}

if (typeof document !== 'undefined') {
  // The browser drops the lock whenever the tab is hidden; take it back on return.
  document.addEventListener('visibilitychange', acquire);
}

// ---- system chrome -----------------------------------------------------------------------

/** Tell the OS whether the map is light (dark status-bar icons) and tint the browser chrome. */
export function setChrome({ light, color }) {
  call('setLightBars', !!light);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = color;
}

/** While navigating, the Android app shrinks to a floating mini-map when you leave it. */
export function setNavigating(on) {
  call('setNavigating', !!on);
}

/**
 * Subscribe to events pushed from the Android shell:
 *   { type: 'insets', top, right, bottom, left }   system bar sizes in CSS px
 *   { type: 'pip', active }                        picture-in-picture entered / left
 */
export function onNativeEvent(handler) {
  window.addEventListener('gm-native', (e) => handler(e.detail || {}));
  const insets = call('getInsets');
  if (insets) {
    try {
      handler({ type: 'insets', ...JSON.parse(insets) });
    } catch {
      /* ignore malformed payload */
    }
  }
}
