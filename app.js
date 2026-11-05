// NeonGate: a playable gate synth. Every sound is synthesized here and named as a synth (no samples).
"use strict";
const APP = "neongate", BRAND = "NeonGate", SR = 48000, STEPS = 16, LOOKAHEAD_MS = 25, SCHEDULE_AHEAD = 0.12, FAST_RELEASE = 0.012, MIN_REL = 0.01;
const $ = id => document.getElementById(id), clamp = (x, a, b) => Math.min(b, Math.max(a, x)), pc = n => ((n % 12) + 12) % 12;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"], NAMES_S = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const QUAL = { "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], 5: [0, 7] };
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const KEYSIG = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
// Gate recipes: 16-step patterns (1 = gate open on that 16th). They load into the editable grid.
const RECIPES = {
  trance: { name: "Trance 16ths", p: "1111111111111111", len: 0.55, depth: 1, pump: 0.35, drums: "four", note: "Classic trance gate: every 16th chopped." },
  offbeat: { name: "Offbeat Neon", p: "0010001000100010", len: 0.8, depth: 0.95, pump: 0.5, drums: "four", note: "Chords only on the 'and': the off-beat stab of synthwave and future garage." },
  stutter: { name: "Glitch Stutter", p: "1110101111011010", len: 0.5, depth: 1, pump: 0.25, drums: "break", note: "Broken, glitchy chops for cyberpunk tension." },
  tresillo: { name: "3-3-2 Pulse", p: "1001001010010010", len: 0.7, depth: 0.9, pump: 0.3, drums: "four", note: "3+3+2 accents: a moving pulse that never sits still." },
  dotted: { name: "Dotted Rain", p: "1001001001001001", len: 0.6, depth: 0.85, pump: 0.2, drums: "half", note: "Dotted-8th chops that drift across the bar like rain on neon." },
  half: { name: "Halftime Swell", p: "1000000010000000", len: 0.95, depth: 0.8, pump: 0.15, drums: "half", note: "Two long swells per bar for slow, heavy sections." },
  hold: { name: "Hold (gate open)", p: "1111111111111111", len: 1, depth: 0, pump: 0, drums: "off", note: "Gate fully open: the voice holds as long as you hold the keys." }
};
const DRUMS = {
  four: { name: "Four on the floor", k: "1000100010001000", s: "0000100000001000", h: "0010001000100010" },
  break: { name: "Broken beat", k: "1000001000100000", s: "0000100000001001", h: "1010101010101010" },
  half: { name: "Halftime", k: "1000000000100000", s: "0000000010000000", h: "1010101010101010" },
  off: { name: "Off", k: "0000000000000000", s: "0000000000000000", h: "0000000000000000" }
};
// Honest voice names: each says what synthesis makes it.
const VOICES = {
  neonsaw: { name: "Neon Saw (synth: 3 detuned saws)", osc: [["sawtooth", 0, -9], ["sawtooth", 0, 0], ["sawtooth", 0, 9]], cut: 0.62, env: 0.25 },
  glass: { name: "Glass Pulse (synth: square + triangle octave)", osc: [["square", 0, -4], ["triangle", 12, 3]], cut: 0.7, env: 0.2 },
  brass: { name: "Vapor Brass (synth: saws + filter swell)", osc: [["sawtooth", 0, -6], ["sawtooth", 0, 6]], cut: 0.35, env: 0.45 },
  chrome: { name: "Chrome Square (synth: square + sub octave)", osc: [["square", 0, -7], ["square", 0, 7], ["sine", -12, 0]], cut: 0.5, env: 0.3 }
};
const CHAIRS = [
  { id: "gate", name: "Gate Synth (your keys, synth)", ch: 0 },
  { id: "bass", name: "Sub Bass (synth: sine + saw)", ch: 1 },
  { id: "drums", name: "Drum Machine (synth kick, noise clap + hat)", ch: 9 }
];
const DEF = { bpm: 100, keyRoot: 9, mode: "minor", bars: 8, chordsText: "Am F C G", recipe: "trance", pattern: RECIPES.trance.p, glen: 0.55, depth: 1, pump: 0.35, drums: "four",
  voice: "neonsaw", cutoff: 0.62, reso: 4, atk: 0.01, rel: 0.35, lock: false, quant: true, kbdOct: 4, gains: { gate: 0.8, bass: 0.7, drums: 0.8 }, mutes: { gate: false, bass: false, drums: false },
  midiIn: "", midiOut: "", audioOut: "", take: [] };
function loadJSON(k){ try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
const state = Object.assign(JSON.parse(JSON.stringify(DEF)), loadJSON(APP + "-settings") || {});
state.gains = Object.assign({}, DEF.gains, state.gains); state.mutes = Object.assign({}, DEF.mutes, state.mutes); if (!Array.isArray(state.take)) state.take = [];
function save(){ try { localStorage.setItem(APP + "-settings", JSON.stringify(state)); } catch (e) {} }
// ---------- chords ----------
function parseChord(s){ const m = /^([A-Ga-g])([#b]?)(maj7|m7|m9|m|7|sus2|sus4|dim|add9|5)?$/.exec(s); if (!m) return null; let r = "C D EF G A B".indexOf(m[1].toUpperCase()); if (m[2] === "#") r++; if (m[2] === "b") r--; return { root: pc(r), q: m[3] || "" }; }
function parseChords(text){ const toks = String(text || "").trim().split(/[\s,|]+/).filter(Boolean).slice(0, 16), out = []; for (const t of toks) { const c = parseChord(t); if (!c) return { err: `"${t}" isn't a chord I know (try Am, F, C7, Dm7, Gsus4).` }; out.push(c); } return out.length ? { list: out } : { err: "Type at least one chord." }; }
const useSharps = () => [7, 2, 9, 4, 11, 6].includes(state.mode === "minor" ? pc(state.keyRoot + 3) : state.keyRoot);
const chName = c => (useSharps() ? NAMES_S : NAMES)[c.root] + c.q;
function songChords(){ const p = parseChords(state.chordsText); return p.list || [{ root: state.keyRoot, q: state.mode === "minor" ? "m" : "" }]; }
const chordAt = bar => { const l = songChords(); return l[bar % l.length]; };
function voicing(c, lo, hi){ const ivs = QUAL[c.q] || QUAL[""], out = []; for (const i of ivs.slice(0, 4)) { let n = c.root + i; while (n < lo) n += 12; while (n > hi) n -= 12; out.push(n); } return [...new Set(out)].sort((a, b) => a - b); }
const keyLabel = () => NAMES[state.keyRoot] + (state.mode === "minor" ? "m" : "");
function lockNote(n){ if (!state.lock) return n; const sc = SCALE[state.mode].map(i => pc(i + state.keyRoot)); for (let d = 0; d < 6; d++) { if (sc.includes(pc(n - d))) return n - d; if (sc.includes(pc(n + d))) return n + d; } return n; }
// ---------- deterministic noise (seeded LCG: no Math.random anywhere) ----------
const noiseCache = new Map();
function noiseBuf(c){ if (noiseCache.has(c)) return noiseCache.get(c); const b = c.createBuffer(1, Math.round(c.sampleRate * 0.5), c.sampleRate), d = b.getChannelData(0); let s = 20261105;
  for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) % 2147483648; d[i] = s / 1073741824 - 1; } noiseCache.set(c, b); return b; }
// ---------- the bus: voices -> gate gain -> pump gain -> chair gain -> compressor (limiter) -> destination ----------
function buildBus(c){ const comp = c.createDynamicsCompressor(); comp.threshold.value = -6; comp.knee.value = 3; comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.1;
  const master = c.createGain(); master.gain.value = 0.9; comp.connect(master); master.connect(c.destination); const chairs = {};
  for (const ch of CHAIRS) { const g = c.createGain(); g.gain.value = chairGain(ch.id); g.connect(comp); chairs[ch.id] = g; }
  const gate = c.createGain(), pumpG = c.createGain(), pumpB = c.createGain(); gate.connect(pumpG); pumpG.connect(chairs.gate); pumpB.connect(chairs.bass);
  const an = c.createAnalyser(); an.fftSize = 2048; master.connect(an); return { comp, master, chairs, gate, pumpG, pumpB, an, voiceIn: gate, bassIn: pumpB, drumIn: chairs.drums }; }
const chairGain = id => state.mutes[id] ? 0 : state.gains[id];
function applyMix(){ if (!bus) return; const now = ctx.currentTime; for (const ch of CHAIRS) bus.chairs[ch.id].gain.setTargetAtTime(chairGain(ch.id), now, 0.01); }
// ---------- synth voices ----------
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const cutHz = x => 120 * Math.pow(2, x * 7.2); // 120 Hz .. ~18 kHz
function synthVoice(c, dest, n, vel, t, P, bendRef){ const V = VOICES[P.voice] || VOICES.neonsaw, g = c.createGain(), f = c.createBiquadFilter(), oscs = [];
  f.type = "lowpass"; f.Q.value = P.reso; const base = cutHz(P.cutoff) * (0.6 + 0.6 * vel), peak = Math.min(18000, base * (1 + V.env * 6 * vel)), atk = Math.max(0.002, P.atk);
  f.frequency.setValueAtTime(base, t); f.frequency.linearRampToValueAtTime(peak, t + atk); f.frequency.setTargetAtTime(base * 1.2, t + atk, 0.25);
  const lvl = (0.06 + 0.16 * Math.pow(vel, 1.3)) / Math.sqrt(V.osc.length);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + atk); g.gain.setTargetAtTime(lvl * 0.8, t + atk, 0.4);
  for (const [type, semi, cents] of V.osc) { const o = c.createOscillator(); o.type = type; o.frequency.value = mtof(n + semi); o.detune.value = cents + (bendRef ? bendRef.cents : 0); o.connect(f); o.start(t); oscs.push(o); }
  f.connect(g); g.connect(dest);
  const v = { n, g, oscs, lvl, t0: t, atk, done: false,
    release(at, fast){ if (v.done) return; v.done = true; const r = fast ? FAST_RELEASE : Math.max(MIN_REL, P.rel); at = Math.max(at, t);
      if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(at); else { g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(at < t + atk ? lvl * 0.5 : lvl * 0.8, at); }
      g.gain.linearRampToValueAtTime(0, at + r); for (const o of oscs) o.stop(at + r + 0.02); v.end = at + r; },
    bend(cents, at){ for (let i = 0; i < oscs.length; i++) oscs[i].detune.setTargetAtTime(V.osc[i][2] + cents, at, 0.01); } };
  return v; }
function bassNote(c, dest, n, vel, t, dur){ const g = c.createGain(), f = c.createBiquadFilter(), o1 = c.createOscillator(), o2 = c.createOscillator(); f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 1;
  o1.type = "sine"; o2.type = "sawtooth"; o1.frequency.value = mtof(n); o2.frequency.value = mtof(n); const g2 = c.createGain(); g2.gain.value = 0.25; o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(dest);
  const lvl = 0.35 * vel; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.004); g.gain.setValueAtTime(lvl, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
  o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); return { nodes: [o1, o2], g, end: t + dur + 0.05 }; }
function drumHit(c, dest, kind, vel, t){ const g = c.createGain(); g.connect(dest); const nodes = [];
  if (kind === "k") { const o = c.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.95 * vel, t); g.gain.setTargetAtTime(0, t + 0.06, 0.09); o.connect(g); o.start(t); o.stop(t + 0.6); nodes.push(o); return { nodes, g, end: t + 0.6 }; }
  const s = c.createBufferSource(); s.buffer = noiseBuf(c); const f = c.createBiquadFilter(); s.connect(f); f.connect(g);
  if (kind === "s") { f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 0.8; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55 * vel, t + 0.002); g.gain.setTargetAtTime(0, t + 0.02, 0.07); s.start(t); s.stop(t + 0.4); }
  else { f.type = "highpass"; f.frequency.value = 7000; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.001); g.gain.setTargetAtTime(0, t + 0.005, 0.025); s.start(t); s.stop(t + 0.15); }
  nodes.push(s); return { nodes, g, end: t + 0.4 }; }
// ---------- the step: gate + pump + bass + drums + take, all read from CURRENT state ----------
function gateStep(G, P, k, t, sd){ const pat = P.pattern, i = k % STEPS, on = pat[i] === "1", next = pat[(i + 1) % STEPS] === "1", low = 1 - P.depth, len = clamp(P.glen, 0.1, 1);
  if (on) { G.setTargetAtTime(1, t, 0.0015); if (!(len >= 0.999 && next)) G.setTargetAtTime(low, t + len * sd, 0.003); }
  else G.setTargetAtTime(low, t, 0.003); return on; }
function pumpStep(Pg, P, k, t, sd){ if (k % 4 !== 0 || P.pump <= 0) return; Pg.setTargetAtTime(1 - P.pump, t, 0.002); Pg.setTargetAtTime(1, t + 0.012, sd * 0.9); }
function bandEventsAt(P, k){ const out = [], i = k % STEPS, bar = Math.floor(k / STEPS), D = DRUMS[P.drums] || DRUMS.off, ch = chordAtP(P, bar);
  for (const d of ["k", "s", "h"]) if (D[d][i] === "1") out.push({ ch: "drums", kind: d, n: d === "k" ? 36 : d === "s" ? 39 : 42, v: d === "h" && i % 4 === 0 ? 0.7 : 1, d: 1 });
  if (i % 2 === 0) { const root = 28 + pc(ch.root - 4) + 4; out.push({ ch: "bass", n: i % 8 === 4 ? root + 12 : root, v: i % 4 === 0 ? 1 : 0.75, d: 1.6 }); }
  return out; }
function chordAtP(P, bar){ const p = parseChords(P.chordsText); const l = p.list || [{ root: P.keyRoot, q: P.mode === "minor" ? "m" : "" }]; return l[bar % l.length]; }
// the part played through the gate in export / on loop: your take, or your chords held one per bar if there's no take
function gateNotes(P){ if (P.take && P.take.length) return P.take; const out = []; for (let b = 0; b < P.bars; b++) for (const n of voicing(chordAtP(P, b), 57, 72)) out.push({ s: b * STEPS, d: STEPS, n, v: 0.8 }); return out; }
// ---------- live engine ----------
let ctx = null, bus = null, play = null, timerId = null, rec = false, sustain = false, bendRef = { cents: 0 };
const active = new Set(), liveVoices = new Map(), takeVoices = new Set(); window.__schedLog = [];
async function ensureCtx(){ if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" }); bus = buildBus(ctx); bus.gate.gain.value = 1; applySink(); } if (ctx.state !== "running") { try { await ctx.resume(); } catch (e) {} } return ctx; }
function track(x){ active.add(x); const kill = () => active.delete(x); if (x.nodes[0]) x.nodes[0].onended = kill; }
function start(){ if (!ctx || ctx.state !== "running") { setStatus("Tap to start audio first."); return false; } stop(true); const P = state;
  play = { nextStepTime: ctx.currentTime + 0.1, step: 0, t0: ctx.currentTime + 0.1, log: [] }; window.__schedLog = []; scheduler(); timerId = setInterval(scheduler, LOOKAHEAD_MS); requestAnimationFrame(draw); paintTransport();
  setStatus("Playing. Hold chords on your keyboard: the gate chops them on the grid. Changes land on the next step."); return true; }
function scheduler(){ if (!play) return; while (play.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) { const sd = 60 / state.bpm / 4; scheduleStep(play.step, play.nextStepTime, sd); play.nextStepTime += sd; play.step = (play.step + 1) % (state.bars * STEPS); } }
function scheduleStep(k, t, sd){ const P = state, on = gateStep(bus.gate.gain, P, k, t, sd); pumpStep(bus.pumpG.gain, P, k, t, sd); pumpStep(bus.pumpB.gain, P, k, t, sd);
  const evs = bandEventsAt(P, k); for (const e of evs) { if (P.mutes[e.ch]) continue; const x = e.ch === "drums" ? drumHit(ctx, bus.drumIn, e.kind, e.v, t) : bassNote(ctx, bus.bassIn, e.n, e.v, t, e.d * sd); track(x); midiSendBand(e, t, sd); }
  if (P.take.length && !rec) for (const n of P.take) { if (Math.floor(n.s) !== k) continue; const at = t + (n.s - k) * sd, v = synthVoice(ctx, bus.voiceIn, n.n, n.v, at, P); v.release(at + n.d * sd); takeVoices.add(v); v.oscs[0].onended = () => takeVoices.delete(v); }
  play.log.push({ k, t, sd }); if (play.log.length > 256) play.log.splice(0, 64); window.__schedLog.push({ k, t, sd, gateOn: on, recipe: P.recipe, pattern: P.pattern, bpm: P.bpm, mutes: Object.assign({}, P.mutes), events: evs.filter(e => !P.mutes[e.ch]).length, wall: performance.now() }); }
function stop(quiet){ clearInterval(timerId); timerId = null; const was = !!play; play = null; if (rec) { rec = false; finishRec(); }
  if (ctx) { const now = ctx.currentTime; for (const x of active) { try { x.g.gain.cancelScheduledValues(now); x.g.gain.setValueAtTime(x.g.gain.value, now); x.g.gain.linearRampToValueAtTime(0, now + FAST_RELEASE); for (const n of x.nodes) n.stop(now + FAST_RELEASE + 0.005); } catch (e) {} }
    active.clear(); for (const v of takeVoices) { try { v.done = false; v.release(now, true); } catch (e) {} } takeVoices.clear(); liveAllOff(true);
    for (const p of [bus.gate.gain, bus.pumpG.gain, bus.pumpB.gain]) { p.cancelScheduledValues(now); p.setTargetAtTime(1, now, 0.005); } }
  midiPanic(); paintTransport(); if (was && !quiet) setStatus("Stopped."); }
function posAt(t){ if (!play) return null; let cur = null; for (const e of play.log) { if (e.t <= t) cur = e; else break; } if (!cur) return null; return cur.k + (t - cur.t) / cur.sd; }
let lastStep = -1;
function draw(){ if (!play) { paintSteps(-1); return; } const p = posAt(ctx.currentTime); if (p != null) { const k = Math.floor(p); if (k !== lastStep) { lastStep = k; paintSteps(k); } } requestAnimationFrame(draw); }
// ---------- recording a take (notes land on the loop at their audio-clock position) ----------
let recNotes = new Map(), recBuf = [];
function toggleRec(){ if (rec) { rec = false; finishRec(); paintTransport(); return; } if (!play && !start()) return; rec = true; recBuf = []; recNotes.clear(); paintTransport(); setStatus("Recording: play your part. Every pass overdubs onto the loop. Press Rec again to keep it."); }
function finishRec(){ const L = state.bars * STEPS, now = ctx ? ctx.currentTime : 0; for (const [, r] of recNotes) closeRec(r, now); recNotes.clear(); if (!recBuf.length) return;
  for (const r of recBuf) { let s = r.s, d = r.d; if (state.quant) { s = Math.round(s); d = Math.max(1, Math.round(d)); } s = ((s % L) + L) % L; state.take.push({ s: Math.round(s * 1000) / 1000, d: Math.min(L, Math.round(d * 1000) / 1000), n: r.n, v: Math.round(r.v * 100) / 100 }); }
  state.take.sort((a, b) => a.s - b.s); recBuf = []; save(); paintTake(); setStatus(`Take kept: ${state.take.length} notes. They loop through the gate and go into the export.`); }
function closeRec(r, t){ const p = posAt(t); if (p == null) return; let d = p - r.s; if (d <= 0) d += state.bars * STEPS; r.d = Math.max(0.25, d); recBuf.push(r); }
// ---------- live playing ----------
function liveOn(note, vel, src){ if (!ctx || ctx.state !== "running") { ensureCtx(); if (!ctx || ctx.state !== "running") { setStatus("Tap to start audio, then play."); return; } }
  const n = lockNote(note), key = src + ":" + note, old = liveVoices.get(key); if (old) old.v.release(ctx.currentTime, true);
  if (liveVoices.size >= 12) { const [k0, o0] = liveVoices.entries().next().value; o0.v.release(ctx.currentTime, true); liveVoices.delete(k0); }
  const v = synthVoice(ctx, bus.voiceIn, n, vel, ctx.currentTime, state, bendRef); liveVoices.set(key, { v, n, sustained: false }); keyVis(note, true); midiOutNote(true, n, vel);
  if (rec && play) { const p = posAt(ctx.currentTime); if (p != null) recNotes.set(key, { s: p, n, v: vel }); } }
function liveOff(note, src){ const key = src + ":" + note, vo = liveVoices.get(key); keyVis(note, false); if (!vo) return; if (sustain) { vo.sustained = true; return; } releaseLive(key, vo); }
function releaseLive(key, vo){ liveVoices.delete(key); vo.v.release(ctx.currentTime); midiOutNote(false, vo.n, 0); const r = recNotes.get(key); if (r) { recNotes.delete(key); closeRec(r, ctx.currentTime); } }
function setSustain(down){ sustain = down; if (!down && ctx) for (const [k, vo] of [...liveVoices]) if (vo.sustained) releaseLive(k, vo); }
function liveAllOff(fast){ if (!ctx) return; for (const [k, vo] of [...liveVoices]) { vo.v.release(ctx.currentTime, fast); midiOutNote(false, vo.n, 0); const r = recNotes.get(k); if (r) { recNotes.delete(k); closeRec(r, ctx.currentTime); } } liveVoices.clear(); sustain = false; document.querySelectorAll(".down").forEach(k => k.classList.remove("down")); }
function keyVis(n, on){ document.querySelectorAll(`[data-n="${n}"]`).forEach(k => k.classList.toggle("down", on)); }
// ---------- Web MIDI in/out ----------
let midiAccess = null, midiOut = null, midiInPort = null;
function onMidi(ev){ const d = ev.data, s = d[0], cmd = s & 0xF0, n = d[1], v = d[2]; if (s >= 0xF0) return; // clock/start/stop ignored: MIDI never starts the transport
  showMidi(d);
  if (cmd === 0xB0) { if (n === 64) setSustain(v >= 64); else if (n === 1) { state.depth = Math.round(v / 127 * 100) / 100; paintGate(); save(); } else if (n === 74) { state.cutoff = Math.round(v / 127 * 1000) / 1000; paintVoice(); save(); } else if (n === 123 || n === 120) liveAllOff(); return; }
  if (cmd === 0xE0) { const b = ((v << 7) | n) - 8192; bendRef.cents = b / 8192 * 200; if (ctx) for (const [, vo] of liveVoices) vo.v.bend(bendRef.cents, ctx.currentTime); return; }
  if (cmd === 0x90 && v > 0) liveOn(n, v / 127, "midi"); else if (cmd === 0x80 || (cmd === 0x90 && v === 0)) liveOff(n, "midi"); }
function showMidi(d){ const el = $("midiLast"); if (el) el.textContent = "Last MIDI in: " + [...d].map(x => x.toString(16).padStart(2, "0")).join(" "); }
function refreshMidi(){ if (!midiAccess) return; const fill = (sel, ports, cur) => { sel.innerHTML = '<option value="">(none)</option>' + [...ports.values()].map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(""); sel.value = [...ports.keys()].includes(cur) ? cur : ""; };
  if (!state.midiIn && midiAccess.inputs.size) state.midiIn = [...midiAccess.inputs.keys()][0]; fill($("midiIn"), midiAccess.inputs, state.midiIn); fill($("midiOut"), midiAccess.outputs, state.midiOut);
  if (midiInPort) midiInPort.onmidimessage = null; midiInPort = state.midiIn ? midiAccess.inputs.get(state.midiIn) : null; if (midiInPort) midiInPort.onmidimessage = onMidi;
  midiOut = state.midiOut ? midiAccess.outputs.get(state.midiOut) || null : null;
  $("midiNote").textContent = midiInPort ? `MIDI keyboard: ${midiInPort.name}. Play it: notes, velocity, sustain, mod wheel and pitch bend all work.` : midiAccess.inputs.size ? "Pick your MIDI keyboard above." : "No MIDI keyboard found. Plug one in (it appears here by itself). On-screen and computer keys are the fallback."; }
function midiOutNote(on, n, v){ if (!midiOut) return; try { midiOut.send(on ? [0x90, n, clamp(Math.round(v * 127), 1, 127)] : [0x80, n, 0]); } catch (e) {} }
function midiSendBand(e, time, sd){ if (!midiOut || !ctx) return; const ch = e.ch === "drums" ? 9 : 1, at = performance.now() + (time - ctx.currentTime) * 1000, v = clamp(Math.round(e.v * 110), 1, 127);
  try { midiOut.send([0x90 | ch, e.n, v], at); midiOut.send([0x80 | ch, e.n, 0], at + Math.max(15, e.d * sd * 1000 - 3)); } catch (x) {} }
function midiPanic(){ if (!midiOut) return; try { for (const ch of [0, 1, 9]) { midiOut.clear && midiOut.clear(); midiOut.send([0xB0 | ch, 123, 0]); } } catch (e) {} }
// ---------- audio output select (setSinkId with fallback) ----------
const sinkOK = () => typeof (window.AudioContext || function(){}).prototype.setSinkId === "function";
async function listDevices(){ const sel = $("audioOut"); if (!sinkOK()) { sel.innerHTML = '<option value="">System default</option>'; sel.disabled = true; $("audioOutNote").textContent = "This browser can't route Web Audio to a chosen device (no setSinkId), so sound uses your system output."; return; }
  let devs = []; try { devs = await navigator.mediaDevices.enumerateDevices(); } catch (e) {} const outs = devs.filter(d => d.kind === "audiooutput" && d.deviceId !== "default");
  sel.innerHTML = '<option value="">System default</option>' + outs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || "Output " + (i + 1))}</option>`).join(""); sel.value = outs.some(d => d.deviceId === state.audioOut) ? state.audioOut : ""; }
async function applySink(){ if (!ctx || !sinkOK()) return; try { await ctx.setSinkId(state.audioOut || ""); $("audioOutNote").textContent = state.audioOut ? "Playing through the selected output." : "Playing through the system default output."; } catch (e) { $("audioOutNote").textContent = "That output couldn't be used, so sound stays on the system default."; } }
// ---------- export: OfflineAudioContext, downbeat at sample 0, exact length, tail folded, peak <= -1 dBFS ----------
const snapState = () => JSON.parse(JSON.stringify(state));
async function renderMix(o){ o = o || {}; const P = Object.assign(snapState(), o.override || {}), sd = 60 / P.bpm / 4, L = P.bars * STEPS, N = Math.round(P.bars * 4 * 60 / P.bpm * SR);
  const notes = gateNotes(P); let lastEnd = N / SR; for (const n of notes) lastEnd = Math.max(lastEnd, (n.s + n.d) * sd); const tailS = Math.max(0, lastEnd - N / SR) + Math.max(MIN_REL, P.rel) + 0.8, total = N + Math.ceil(tailS * SR);
  const oc = new OfflineAudioContext(2, total, SR); const saved = state.mutes; const B = (function(){ const prev = state.mutes; state.mutes = o.only ? Object.fromEntries(CHAIRS.map(c => [c.id, !o.only.includes(c.id)])) : P.mutes; const b = buildBus(oc); state.mutes = prev; return b; })();
  const mutes = o.only ? Object.fromEntries(CHAIRS.map(c => [c.id, !o.only.includes(c.id)])) : P.mutes;
  B.gate.gain.setValueAtTime(P.pattern[0] === "1" ? 1 : 1 - P.depth, 0); B.pumpG.gain.setValueAtTime(1, 0); B.pumpB.gain.setValueAtTime(1, 0);
  const totalSteps = Math.ceil(total / SR / sd) + 1; for (let k = 0; k < totalSteps; k++) { const t = k * sd; gateStep(B.gate.gain, P, k, t, sd); pumpStep(B.pumpG.gain, P, k, t, sd); pumpStep(B.pumpB.gain, P, k, t, sd); }
  for (let k = 0; k < L; k++) { const t = k * sd; for (const e of bandEventsAt(P, k)) { if (mutes[e.ch]) continue; if (e.ch === "drums") drumHit(oc, B.drumIn, e.kind, e.v, t); else bassNote(oc, B.bassIn, e.n, e.v, t, e.d * sd); } }
  if (!mutes.gate) for (const n of notes) { const t = n.s * sd, v = synthVoice(oc, B.voiceIn, n.n, n.v, t, P); v.release(t + n.d * sd); }
  const buf = await oc.startRendering(), ch = [0, 1].map(c => { const src = buf.getChannelData(c), out = new Float32Array(N); out.set(src.subarray(0, N)); if (!o.noFold) for (let i = N; i < src.length; i++) out[(i - N) % N] += src[i]; return out; });
  let pk = 0; for (const x of ch) for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(x[i])); const g = o.gain != null ? o.gain : pk > 0 ? Math.pow(10, -1.1 / 20) / pk : 1; for (const x of ch) for (let i = 0; i < N; i++) x[i] *= g;
  return { ch, N, gain: g, peak: pk, P }; }
function wav24(ch, N){ const nc = ch.length, ba = nc * 3, buf = new ArrayBuffer(44 + N * ba), dv = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); dv.setUint32(4, 36 + N * ba, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nc, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * ba, true); dv.setUint16(32, ba, true); dv.setUint16(34, 24, true); w(36, "data"); dv.setUint32(40, N * ba, true);
  let o = 44; for (let i = 0; i < N; i++) for (let c = 0; c < nc; c++) { let v = Math.round(clamp(ch[c][i], -1, 1) * 8388607); if (v < 0) v += 16777216; dv.setUint8(o, v & 255); dv.setUint8(o + 1, (v >> 8) & 255); dv.setUint8(o + 2, (v >> 16) & 255); o += 3; } return new Uint8Array(buf); }
const fileBase = P => `${APP}-${P.recipe}-${P.bpm}bpm-${NAMES[P.keyRoot] + (P.mode === "minor" ? "m" : "")}`;
function midiFile(o){ const P = Object.assign(snapState(), (o && o.override) || {}), PPQ = 480, TK = PPQ / 4, L = P.bars * STEPS, total = L * TK, vlq = n => { const a = [n & 127]; while (n >>= 7) a.unshift((n & 127) | 128); return a; };
  const trk = evs => { evs.sort((a, b) => a.t - b.t || a.o - b.o); let last = 0; const d = []; for (const e of evs) { d.push(...vlq(e.t - last), ...e.b); last = e.t; } d.push(...vlq(Math.max(0, total - last)), 0xFF, 0x2F, 0); return [0x4D, 0x54, 0x72, 0x6B, (d.length >>> 24) & 255, (d.length >> 16) & 255, (d.length >> 8) & 255, d.length & 255, ...d]; };
  const meta = (type, s) => { const c = [...String(s).replace(/[^\x20-\x7e]/g, "-")].map(ch => ch.charCodeAt(0)); return [0xFF, type, ...vlq(c.length), ...c]; };
  const us = Math.round(60e6 / P.bpm), minor = P.mode === "minor", sf = KEYSIG[pc(minor ? P.keyRoot + 3 : P.keyRoot)];
  const cond = [{ t: 0, o: 0, b: meta(0x03, `${BRAND} ${P.bpm} BPM ${fileBase(P)}`) }, { t: 0, o: 1, b: [0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] }, { t: 0, o: 2, b: [0xFF, 0x58, 4, 4, 2, 24, 8] }, { t: 0, o: 2, b: [0xFF, 0x59, 2, sf & 255, minor ? 1 : 0] }];
  for (let b = 0; b < P.bars; b++) cond.push({ t: b * STEPS * TK, o: 3, b: meta(0x06, `Bar ${b + 1} ${chName(chordAtP(P, b))}`) });
  const noteTrack = (name, ch, list, prog) => { const out = [{ t: 0, o: 0, b: meta(0x03, name) }]; if (prog != null) out.push({ t: 0, o: 1, b: [0xC0 | ch, prog] });
    for (const e of list) { const t0 = Math.round(e.s * TK); if (t0 >= total) continue; const t1 = Math.min(total, Math.max(t0 + 1, Math.round((e.s + e.d) * TK))); out.push({ t: t0, o: 3, b: [0x90 | ch, e.n, clamp(Math.round(e.v * 127), 1, 127)] }); out.push({ t: t1, o: 2, b: [0x80 | ch, e.n, 0] }); } return trk(out); };
  const held = gateNotes(P), gated = [], len = clamp(P.glen, 0.1, 1);
  for (const n of held) for (let k = Math.floor(n.s); k < n.s + n.d && k < L; k++) { if (P.pattern[k % STEPS] !== "1") continue; const s0 = Math.max(k, n.s), e0 = Math.min(k + len, n.s + n.d); if (e0 - s0 > 0.05) gated.push({ s: s0, d: e0 - s0, n: n.n, v: n.v }); }
  const bass = [], drums = []; for (let k = 0; k < L; k++) for (const e of bandEventsAt(P, k)) (e.ch === "bass" ? bass : drums).push({ s: k, d: e.ch === "bass" ? e.d : 0.5, n: e.n, v: e.v * 0.86 });
  const tracks = [trk(cond)]; if (!P.mutes.gate) { tracks.push(noteTrack("Gate Synth (held notes)", 0, held, 81)); tracks.push(noteTrack(`Gate Synth (gated: ${RECIPES[P.recipe] ? RECIPES[P.recipe].name : "custom"})`, 2, gated, 81)); }
  if (!P.mutes.bass) tracks.push(noteTrack("Sub Bass", 1, bass, 38)); if (!P.mutes.drums && P.drums !== "off") tracks.push(noteTrack("Drum Machine", 9, drums, null));
  return new Uint8Array([].concat([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, PPQ >> 8, PPQ & 255], ...tracks)); }
async function exportWavBytes(o){ o = o || {}; const r = await renderMix(o); return { bytes: wav24(r.ch, r.N), name: fileBase(r.P) + ".wav", frames: r.N, gain: r.gain, peak: r.peak }; }
function exportMidBytes(o){ const P = Object.assign(snapState(), (o && o.override) || {}); return { bytes: midiFile(o), name: fileBase(P) + ".mid" }; }
function download(bytes, name, type){ const blob = new Blob([bytes], { type }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
function expMsg(m, cls){ setStatus(m); const el = $("expMsg"); el.textContent = m; el.className = "expmsg " + (cls || ""); }
async function doExport(kind){ if (gated() && state.bars > FREE_BARS) { expMsg(`Free exports are up to ${FREE_BARS} bars. Unlock for ${state.bars}-bar exports.`, "bad"); return; }
  try { if (kind === "wav") { expMsg("Rendering WAV…"); $("expProg").hidden = false; const r = await exportWavBytes(); download(r.bytes, r.name, "audio/wav"); expMsg(`Saved ${r.name}: ${r.frames.toLocaleString()} samples (exactly ${state.bars} bars at ${state.bpm} BPM), 48 kHz / 24-bit.`, "ok"); }
    else { const r = exportMidBytes(); download(r.bytes, r.name, "audio/midi"); expMsg(`Saved ${r.name}: tempo ${state.bpm}, 4/4, one track per chair.`, "ok"); } }
  catch (e) { expMsg("Export failed: " + (e && e.message || e), "bad"); } finally { $("expProg").hidden = true; } }
// ---------- Lemon Squeezy license gate (restricted to our store + product; empty config = checkout not live yet) ----------
const LEMON = { checkoutUrl: "", storeId: null, productId: null, price: "$19 once" };
const LS_API = "https://api.lemonsqueezy.com/v1/licenses/";
const lic = loadJSON(APP + "-license") || { valid: false };
const configured = () => !!(LEMON.storeId && LEMON.productId);
const gated = () => configured() && !lic.valid; // no product configured = nobody can buy, so nothing is gated
const FREE_BARS = 8;
if (!configured()) lic.valid = false;
async function lsCall(action, params){ const r = await fetch(LS_API + action, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() }); return r.json(); }
const ours = j => !!j && j.meta && +j.meta.store_id === +LEMON.storeId && +j.meta.product_id === +LEMON.productId;
async function activateKey(key){ if (!configured()) return { ok: false, reason: "Checkout opening soon. License keys can't be checked until the store is live." };
  const j = await lsCall("activate", { license_key: key, instance_name: BRAND + " web" }); if (!j.activated) return { ok: false, reason: j.error || "That key could not be activated." };
  if (!ours(j)) { if (j.instance) lsCall("deactivate", { license_key: key, instance_id: j.instance.id }).catch(() => {}); return { ok: false, reason: "That key is for a different product." }; }
  return { ok: true, instance: j.instance.id }; }
async function validateKey(key, instance){ if (!configured()) return false; const j = await lsCall("validate", { license_key: key, instance_id: instance }); return !!j.valid && ours(j); }
const saveLic = () => localStorage.setItem(APP + "-license", JSON.stringify(lic));
function paintLicense(){ const b = $("buy"); if (configured() && LEMON.checkoutUrl) { b.textContent = "Unlock " + BRAND + " · " + LEMON.price; b.disabled = false; b.onclick = () => window.open(LEMON.checkoutUrl, "_blank", "noopener"); } else { b.textContent = "Checkout opening soon · " + LEMON.price; b.disabled = true; }
  $("licState").textContent = !configured() ? `Launch: full exports free until checkout opens. WAV + MIDI at every length (4, 8 or 16 bars). (${LEMON.price} when checkout opens.)` : lic.valid ? "Unlocked: exports at every length." : `Free: play, record, every gate recipe; exports up to ${FREE_BARS} bars. Unlock adds 16-bar exports.`; }
// ---------- UI ----------
function setStatus(m){ $("status").textContent = m; }
function paintTransport(){ $("play").textContent = play ? "■ Stop" : "▶ Play gate + band"; $("play").classList.toggle("on", !!play); $("rec").classList.toggle("on", rec); $("rec").textContent = rec ? "● Recording… (press to keep)" : "● Rec take"; }
function paintSteps(k){ const i = k < 0 ? -1 : k % STEPS; $("steps").querySelectorAll("div").forEach((d, j) => d.classList.toggle("cur", j === i)); $("grid").querySelectorAll("button").forEach((d, j) => d.classList.toggle("cur", j === i));
  $("pos").textContent = k < 0 ? "bar – · step –" : `bar ${Math.floor(k / STEPS) + 1} · step ${i + 1} · ${chName(chordAt(Math.floor(k / STEPS)))}`; }
function paintGate(){ $("recipe").value = RECIPES[state.recipe] ? state.recipe : "custom"; $("depth").value = state.depth; $("depth_v").textContent = Math.round(state.depth * 100) + "%"; $("glen").value = state.glen; $("glen_v").textContent = Math.round(state.glen * 100) + "%";
  $("pump").value = state.pump; $("pump_v").textContent = Math.round(state.pump * 100) + "%"; $("drums").value = state.drums;
  $("grid").innerHTML = [...state.pattern].map((b, i) => `<button data-i="${i}" class="${b === "1" ? "on" : ""}" title="Step ${i + 1}">${i % 4 === 0 ? i / 4 + 1 : ""}</button>`).join("");
  const R = RECIPES[state.recipe]; $("recipeNote").textContent = R ? R.note + " Click steps to edit the pattern." : "Custom pattern. Click steps to edit."; }
function paintVoice(){ $("voice").value = state.voice; $("cutoff").value = state.cutoff; $("cutoff_v").textContent = Math.round(cutHz(state.cutoff)) + " Hz"; $("reso").value = state.reso; $("reso_v").textContent = state.reso.toFixed(1);
  $("atk").value = state.atk; $("atk_v").textContent = Math.round(state.atk * 1000) + " ms"; $("rel").value = state.rel; $("rel_v").textContent = Math.round(state.rel * 1000) + " ms"; $("lock").checked = state.lock;
  $("voiceNote").textContent = "All voices are synthesized in your browser and named for what makes them. Attack and release are real gain ramps (release never under 10 ms)."; }
function paintSong(){ $("bpm").value = state.bpm; $("key").value = state.keyRoot; $("mode").value = state.mode; $("bars").value = state.bars; $("chords").value = state.chordsText; $("quant").checked = state.quant; const p = parseChords(state.chordsText); $("chordErr").textContent = p.err || ""; }
function paintMix(){ $("mix").innerHTML = CHAIRS.map(c => `<div class="ch"><label>${esc(c.name)}</label><input type="range" min="0" max="1.2" step="0.01" value="${state.gains[c.id]}" data-g="${c.id}"><button class="mini ${state.mutes[c.id] ? "on" : ""}" data-m="${c.id}">${state.mutes[c.id] ? "muted" : "mute"}</button></div>`).join(""); }
function paintTake(){ $("takeInfo").textContent = state.take.length ? `Your take: ${state.take.length} notes on the ${state.bars}-bar loop. It plays through the gate and is what the export renders.` : "No take yet: the export plays your chords held one per bar through the gate. Press Rec while playing to capture your own part."; }
function paintKeys(){ const lo = state.kbdOct * 12 + 12, el = $("keys"), W = 100 / 15; let html = "", wi = 0; for (let n = lo; n < lo + 25; n++) { const b = [1, 3, 6, 8, 10].includes(pc(n)); if (b) html += `<div class="b" data-n="${n}" style="left:${(wi - 0.32) * W}%;width:${W * 0.64}%"></div>`; else { html += `<div class="w" data-n="${n}" style="left:${wi * W}%;width:${W}%"></div>`; wi++; } } el.innerHTML = html; }
function paintAll(){ paintSong(); paintGate(); paintVoice(); paintMix(); paintTake(); paintLicense(); paintTransport(); }
function setSetting(k, v){ if (k === "bpm") { v = clamp(Math.round(+v || 100), 60, 180); }
  if (k === "keyRoot" || k === "mode") { const old = state.keyRoot, nv = k === "keyRoot" ? +v : state.keyRoot, d = ((nv - old + 18) % 12) - 6; if (k === "keyRoot" && d) transposeAll(d); state[k] = k === "keyRoot" ? +v : v; }
  else if (k === "recipe") { const R = RECIPES[v]; if (R) { state.recipe = v; state.pattern = R.p; state.glen = R.len; state.depth = R.depth; state.pump = R.pump; state.drums = R.drums; } }
  else if (k === "bars") { state.bars = +v; const L = state.bars * STEPS; state.take = state.take.filter(n => n.s < L); if (play) play.step = play.step % L; }
  else if (k === "mute") { state.mutes[v[0]] = v[1]; applyMix(); } else if (k === "gain") { state.gains[v[0]] = +v[1]; applyMix(); }
  else state[k] = typeof DEF[k] === "number" ? +v : v;
  save(); paintAll(); }
function transposeAll(d){ const p = parseChords(state.chordsText); if (p.list) state.chordsText = p.list.map(c => (useSharps() ? NAMES_S : NAMES)[pc(c.root + d)] + c.q).join(" "); state.take = state.take.map(n => Object.assign({}, n, { n: clamp(n.n + d, 0, 127) })); }
const KB = "awsedftgyhujkolp;"; const kbDown = new Set();
function bind(){ $("key").innerHTML = NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join(""); $("recipe").innerHTML = Object.entries(RECIPES).map(([k, r]) => `<option value="${k}">${esc(r.name)}</option>`).join("") + '<option value="custom" disabled>Custom (edited)</option>';
  $("drums").innerHTML = Object.entries(DRUMS).map(([k, d]) => `<option value="${k}">${esc(d.name)}</option>`).join(""); $("voice").innerHTML = Object.entries(VOICES).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join("");
  $("steps").innerHTML = "<div></div>".repeat(16);
  $("tapBtn").onclick = async () => { $("tap").classList.add("hide"); await ensureCtx(); listDevices(); setStatus(ctx.state === "running" ? "Audio on. Play your MIDI keyboard, or press Play to run the gate + band." : "Audio is still suspended: tap anywhere to resume."); };
  document.addEventListener("pointerdown", () => { if (ctx && ctx.state !== "running") ctx.resume(); });
  $("play").onclick = async () => { await ensureCtx(); if (play) stop(); else start(); }; $("rec").onclick = async () => { await ensureCtx(); toggleRec(); };
  $("clear").onclick = () => { state.take = []; save(); paintTake(); setStatus("Take cleared."); };
  $("bpm").onchange = e => setSetting("bpm", e.target.value); $("key").onchange = e => setSetting("keyRoot", e.target.value); $("mode").onchange = e => setSetting("mode", e.target.value); $("bars").onchange = e => setSetting("bars", e.target.value);
  $("chords").onchange = e => { const p = parseChords(e.target.value); $("chordErr").textContent = p.err || ""; if (!p.err) setSetting("chordsText", e.target.value.trim()); };
  $("quant").onchange = e => setSetting("quant", e.target.checked); $("recipe").onchange = e => setSetting("recipe", e.target.value);
  for (const id of ["depth", "glen", "pump", "cutoff", "reso", "atk", "rel"]) $(id).oninput = e => { state[id] = +e.target.value; save(); id === "cutoff" || id === "reso" || id === "atk" || id === "rel" ? paintVoice() : paintGateVals(); };
  $("drums").onchange = e => setSetting("drums", e.target.value); $("voice").onchange = e => setSetting("voice", e.target.value); $("lock").onchange = e => setSetting("lock", e.target.checked);
  $("grid").onclick = e => { const b = e.target.closest("button"); if (!b) return; const i = +b.dataset.i, p = [...state.pattern]; p[i] = p[i] === "1" ? "0" : "1"; state.pattern = p.join(""); if (RECIPES[state.recipe] && RECIPES[state.recipe].p !== state.pattern) state.recipe = "custom"; save(); paintGate(); };
  $("mix").addEventListener("input", e => { const g = e.target.dataset.g; if (g) { state.gains[g] = +e.target.value; save(); applyMix(); } });
  $("mix").addEventListener("click", e => { const m = e.target.dataset.m; if (m) setSetting("mute", [m, !state.mutes[m]]); });
  $("midiIn").onchange = e => { state.midiIn = e.target.value; save(); refreshMidi(); }; $("midiOut").onchange = e => { state.midiOut = e.target.value; save(); refreshMidi(); };
  $("audioOut").onchange = e => { state.audioOut = e.target.value; save(); applySink(); };
  $("wav").onclick = () => doExport("wav"); $("mid").onclick = () => doExport("mid");
  $("licBtn").onclick = async () => { const k = $("licKey").value.trim(); if (!k) return; const r = await activateKey(k); if (r.ok) { lic.valid = true; lic.key = k; lic.instance = r.instance; saveLic(); } $("licState").textContent = r.ok ? "Unlocked." : r.reason; if (r.ok) paintLicense(); };
  const keys = $("keys"), held = new Map(); keys.addEventListener("pointerdown", e => { const k = e.target.closest("[data-n]"); if (!k) return; keys.setPointerCapture(e.pointerId); held.set(e.pointerId, +k.dataset.n); ensureCtx().then(() => liveOn(+k.dataset.n, 0.8, "screen")); });
  const up = e => { const n = held.get(e.pointerId); if (n != null) { held.delete(e.pointerId); liveOff(n, "screen"); } }; keys.addEventListener("pointerup", up); keys.addEventListener("pointercancel", up);
  document.addEventListener("keydown", e => { if (e.repeat || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; const c = e.key.toLowerCase();
    if (c === "z" || c === "x") { state.kbdOct = clamp(state.kbdOct + (c === "z" ? -1 : 1), 1, 7); save(); paintKeys(); return; } if (c === " ") { e.preventDefault(); $("play").click(); return; }
    const i = KB.indexOf(c); if (i < 0) return; const n = state.kbdOct * 12 + 12 + i; kbDown.add(c); ensureCtx().then(() => liveOn(n, 0.8, "kbd:" + c)); });
  document.addEventListener("keyup", e => { const c = e.key.toLowerCase(), i = KB.indexOf(c); if (i < 0 || !kbDown.has(c)) return; kbDown.delete(c); liveOff(state.kbdOct * 12 + 12 + i, "kbd:" + c); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { const was = !!play; stop(true); liveAllOff(true); if (was) setStatus("Stopped because the tab was hidden. Press Play to start again."); } }); }
function paintGateVals(){ $("depth_v").textContent = Math.round(state.depth * 100) + "%"; $("glen_v").textContent = Math.round(state.glen * 100) + "%"; $("pump_v").textContent = Math.round(state.pump * 100) + "%"; }
async function boot(){ bind(); paintAll(); paintKeys(); refreshMidiInit(); }
async function refreshMidiInit(){ if (!navigator.requestMIDIAccess) { $("midiNote").textContent = "This browser has no Web MIDI (Safari/iOS). Use Chrome or Edge with your MIDI keyboard; on-screen and computer keys still play."; return; }
  try { midiAccess = await navigator.requestMIDIAccess({ sysex: false }); midiAccess.onstatechange = refreshMidi; refreshMidi(); } catch (e) { $("midiNote").textContent = "MIDI access was blocked. Allow MIDI for this site to play your keyboard; on-screen keys still play."; } }
window.__neongate = { state, ctx: () => ctx, bus: () => bus, play: () => play, start, stop, setSetting, liveOn, liveOff, setSustain, onMidi, exportWavBytes, exportMidBytes, renderMix, activeSources: () => active.size, liveVoices: () => liveVoices.size,
  takeVoices: () => takeVoices.size, toggleRec, recording: () => rec, LEMON, lic, gated, VOICES, CHAIRS, RECIPES, midiOut: () => midiOut, midiIn: () => midiInPort, sustainOn: () => sustain, posAt };
boot();
