# NeonGate

**A playable cyberpunk gate synth for your MIDI keyboard. Hold a chord and a tempo-synced trance gate and sidechain pump chop it on the grid of your BPM and key, with a synth sub bass and drum machine underneath. Record a take and export a DAW-ready WAV and MIDI that land on bar 1.** Live: **https://neongate.vercel.app**

Trance gates usually live as effect plugins inside a DAW: you insert one on a pad track, draw the steps, then play into it ([free Trance Gate plugin, Oct 28 2026](https://x.com/vstfinds/status/2115568037692891469); ["Kilohearts Trance Gate for the pump"](https://x.com/ZeroPlugsHQ/status/2114719774974640607)). NeonGate makes the gate the instrument. You play it live from a MIDI keyboard in the browser, with nothing to install and no DAW open, and change the gate while you play.

## Play it
1. **Your loop:** BPM (60–180), key, mode, bars (4/8/16) and chords (one per bar, e.g. `Am F C G`). These are saved in your browser. Changing the key transposes your chords and your take.
2. **Play:** your MIDI keyboard plays the synth right away and never starts the transport. Press **▶ Play gate + band** to run the gate, the pump, the sub bass and the drums on the audio clock. When the transport is stopped the gate is open, so you hear the raw voice.
3. **Gate:** choose from 7 recipes: Trance 16ths, Offbeat Neon, Glitch Stutter, 3-3-2 Pulse, Dotted Rain, Halftime Swell and Hold (gate open). You can also edit the 16-step grid. Set the depth, the gate length and the pump (sidechain duck on every beat), and pick drums: four on the floor, broken, halftime or off. Every change lands on the next step, with no restart.
4. **Voice:** Neon Saw, Glass Pulse, Vapor Brass or Chrome Square. Each is synthesized and named for how it's made. Controls: cutoff, resonance, attack (a real ramp) and release (≥10 ms). **Scale lock** snaps any key you press to your key.
5. **Rec take:** while playing, press Rec and play. Each pass overdubs onto the loop (snap to 1/16 is optional). The take loops through the gate and is what the export renders. With no take, the export holds your chords one per bar.

## MIDI controls
- Notes and velocity (louder and brighter)
- **CC64** sustain
- **CC1 mod wheel** = gate depth
- **CC74** = cutoff
- **Pitch bend** ±2 semitones
- **CC123** all notes off
- MIDI clock and start are ignored: notes never start the transport.
- **MIDI in select** and **MIDI out select.** Out mirrors what you play (ch 1), the bass (ch 2) and the drums (ch 10). Stop sends All Notes Off.
- **Audio out select** (`setSinkId`, with a note if the browser can't). No audio input is used.
- On-screen keys and computer keys (A W S E D F T G Y H U J K O L P ;, Z/X octave) are a fallback only.

## Export
- **WAV:** `neongate-<recipe>-<bpm>bpm-<key>.wav`. 48 kHz, 24-bit stereo, rendered with OfflineAudioContext. The length is exactly your bars (92 BPM × 8 bars = 1,001,739 samples) and the downbeat is at sample 0. The limiter's look-ahead is measured and removed. The ring-out tail is folded into the start so it loops seamlessly, and the peak is −1.1 dBFS. The render is deterministic: the noise uses a seeded generator, with no `Math.random`.
- **MIDI:** same name, `.mid`. It has your tempo, 4/4, key signature and a bar marker per chord, plus one track per chair:
  - Gate Synth (held notes)
  - Gate Synth (gated notes: the chopped rhythm as MIDI)
  - Sub Bass
  - Drum Machine
- Drop both at bar 1 of a session at the same BPM.

## Sounds
Everything is synthesized in your browser, and every voice says so: detuned saws, square/triangle, a sine sweep kick, and a seeded-noise clap and hat. There are no samples and no CDN, so nothing can fail to load.

## Pricing
- **Launch (no Lemon Squeezy product configured yet):** everything is free ("Checkout opening soon"). Gating turns on only when `LEMON.storeId` and `LEMON.productId` are set, and keys are only accepted for that store and product.
- **Once checkout is live:** playing, recording, every recipe and voice, and exports up to 8 bars are free. A **$19 one-time** license unlocks 16-bar exports.
- **Why one-time:** it's a single instrument that runs fully in the browser (no server or AI cost per user), it matches the other WorkinWithAI desks, and players buy instruments once.
- **Where to sell:** Lemon Squeezy (license keys, merchant of record for VAT and sales tax). Gumroad is the backup.

## QA
- `qa/s9.py <url>`: AUDIO-ENGINE-RULES §9 checks 1–7, plus simulated Web MIDI (note on/off, velocity, CC64, CC1, clock ignored, MIDI out), the MIDI file, stop silence, persistence and the license gate. Evidence is in `checks/`.
- `qa/no_unpinned.sh [url]`: check 7 grep.

No accounts, no database, no tracking. © 2026 WorkinWithAI.
