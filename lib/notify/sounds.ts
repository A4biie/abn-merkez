// Bildirim sesleri: design/abn-animasyonlar.html "Masaüstü bildirimleri" bloğundaki SOUNDS aynen.
// Dosya yok, hepsi Web Audio ile sentezleniyor. Tek fark: çıkış a.destination yerine ses seviyesi
// gain'ine bağlanıyor. m = true anma (mention) çeşidini çalar.

import { getPrefs, type SoundStyle } from './prefs';

let actx: AudioContext | null = null;
let master: GainNode | null = null;

function ctx(): AudioContext {
  if (!actx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx = new AC();
    master = actx.createGain();
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

/** Uygulama açılırken çağrılır: ilk bildirimde ses gecikmesin. */
export function primeAudio() {
  try {
    ctx();
  } catch {}
}

type A = AudioContext;
const dest = () => master as AudioNode;

function env(g: GainNode, t0: number, peak: number, att: number, dec: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dec);
}
function tone(a: A, type: OscillatorType, f0: number, f1: number, t0: number, peak: number, att: number, dec: number, out?: AudioNode) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + att + dec * 0.6);
  env(g, t0, peak, att, dec);
  o.connect(g);
  g.connect(out || dest());
  o.start(t0);
  o.stop(t0 + att + dec + 0.05);
}
function soft(a: A) {
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 3200;
  f.connect(dest());
  return f;
}
function noise(a: A, t0: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number) {
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, peak, 0.004, dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest());
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const SOUNDS: Record<SoundStyle, (a: A, t: number, m: boolean) => void> = {
  pop: (a, t, m) => {
    const o = soft(a);
    tone(a, 'sine', 380, 900, t, 0.18, 0.003, 0.08, o);
    if (m) tone(a, 'sine', 480, 1150, t + 0.09, 0.15, 0.003, 0.08, o);
  },
  cift: (a, t, m) => {
    const o = soft(a);
    tone(a, 'sine', 360, 820, t, 0.16, 0.003, 0.07, o);
    tone(a, 'sine', 520, 1250, t + 0.075, 0.14, 0.003, 0.07, o);
    if (m) tone(a, 'sine', 640, 1500, t + 0.15, 0.12, 0.003, 0.07, o);
  },
  bloop: (a, t, m) => {
    const o = soft(a);
    const osc = a.createOscillator();
    const g = a.createGain();
    const lfo = a.createOscillator();
    const lg = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(m ? 760 : 560, t + 0.12);
    lfo.frequency.value = 28;
    lg.gain.value = 18;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    env(g, t, 0.2, 0.006, 0.17);
    osc.connect(g);
    g.connect(o);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.25);
    lfo.stop(t + 0.25);
  },
  piril: (a, t, m) => {
    const o = soft(a);
    tone(a, 'sine', 400, 950, t, 0.16, 0.003, 0.08, o);
    tone(a, 'sine', 2637, 0, t + 0.06, 0.035, 0.002, 0.22);
    if (m) tone(a, 'sine', 3136, 0, t + 0.13, 0.03, 0.002, 0.22);
  },
  mantar: (a, t, m) => {
    noise(a, t, 0.05, 'bandpass', 1800, 900, 1.2, 0.18);
    tone(a, 'sine', 300, 700, t + 0.01, 0.16, 0.003, 0.07, soft(a));
    if (m) {
      noise(a, t + 0.1, 0.05, 'bandpass', 2200, 1100, 1.2, 0.15);
      tone(a, 'sine', 380, 880, t + 0.11, 0.14, 0.003, 0.07, soft(a));
    }
  },
  yukselen: (a, t, m) => {
    noise(a, t, 0.12, 'bandpass', 600, 3000, 3, 0.05);
    tone(a, 'sine', 500, 1100, t + 0.1, 0.16, 0.003, 0.08, soft(a));
    if (m) tone(a, 'sine', 620, 1350, t + 0.19, 0.13, 0.003, 0.08, soft(a));
  },
  ahsap: (a, t, m) => {
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 4;
    f.connect(dest());
    tone(a, 'square', 820, 600, t, 0.12, 0.002, 0.06, f);
    tone(a, 'sine', 420, 0, t, 0.08, 0.002, 0.06);
    if (m) tone(a, 'square', 1040, 760, t + 0.09, 0.1, 0.002, 0.06, f);
  },
};

/** kind: 'msg' | 'mention'. force: ses kapalı olsa da çal ("Dinle" için). */
export function blip(kind: 'msg' | 'mention' | undefined, force = false, style?: SoundStyle) {
  const p = getPrefs();
  if ((!p.sound && !force) || !kind) return;
  try {
    const a = ctx();
    if (master) master.gain.value = Math.max(0, Math.min(1, p.volume / 100));
    SOUNDS[style ?? p.soundStyle](a, a.currentTime + 0.02, kind === 'mention');
  } catch {}
}
