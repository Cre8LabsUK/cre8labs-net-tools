"""Makes the audio for the explainer videos.

- Voiceover: one MP3 per line of src/voiceover.json (Microsoft neural voices, via edge-tts), saved to
  public/vo, with each line's spoken length in src/voiceover-timing.json.
- Sound effects and a quiet music bed, generated here so there is nothing to license: public/sfx.

    python scripts/audio.py          (from the video folder)
"""

import asyncio
import json
import math
import wave
from pathlib import Path

import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RATE = 48000


async def voiceover() -> None:
    spec = json.loads((ROOT / "src" / "voiceover.json").read_text(encoding="utf-8"))
    out = ROOT / "public" / "vo"
    out.mkdir(parents=True, exist_ok=True)
    timing: dict[str, float] = {}
    for key, text in spec["lines"].items():
        speech = edge_tts.Communicate(text, spec["voice"], rate=spec["rate"], boundary="WordBoundary")
        end = 0
        with open(out / f"{key}.mp3", "wb") as f:
            async for chunk in speech.stream():
                if chunk["type"] == "audio":
                    f.write(chunk["data"])
                elif "offset" in chunk:
                    # Offsets and durations are in 100 ns units.
                    end = max(end, chunk["offset"] + chunk["duration"])
        timing[key] = round(end / 1e7, 3)
        print(f"{key}: {timing[key]} s")
    (ROOT / "src" / "voiceover-timing.json").write_text(json.dumps(timing, indent=1), encoding="utf-8")


def save(name: str, samples: np.ndarray) -> None:
    out = ROOT / "public" / "sfx"
    out.mkdir(parents=True, exist_ok=True)
    data = np.int16(np.clip(samples, -1, 1) * 32767)
    with wave.open(str(out / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


def smooth(x: np.ndarray, n: int) -> np.ndarray:
    return np.convolve(x, np.ones(n) / n, mode="same")


def sound_effects() -> None:
    rng = np.random.default_rng(7)

    # Mouse click: a short, bright tick with a little body.
    t = np.arange(int(RATE * 0.06)) / RATE
    tick = rng.standard_normal(t.size) - smooth(rng.standard_normal(t.size), 6)
    click = (0.5 * tick + 0.6 * np.sin(2 * math.pi * 1900 * t)) * np.exp(-t * 140)
    save("click.wav", 0.55 * click / np.abs(click).max())

    # Key taps: a soft tap every 110 ms (the typing speed in the capture), looped while typing.
    t = np.arange(int(RATE * 0.11)) / RATE
    tap = smooth(rng.standard_normal(t.size), 3) * np.exp(-t * 260)
    save("keys.wav", 0.22 * tap / np.abs(tap).max())

    # Whoosh: band-limited noise that rises and falls, for zooms and title cards.
    t = np.arange(int(RATE * 0.7)) / RATE
    noise = rng.standard_normal(t.size)
    swell = np.sin(math.pi * t / t[-1]) ** 2
    whoosh = (smooth(noise, 8) - smooth(noise, 60)) * swell
    save("whoosh.wav", 0.35 * whoosh / np.abs(whoosh).max())


def music() -> None:
    """A calm 32 second loop of soft pad chords (Cmaj9, Am9, Fmaj9, G6), seamless when repeated."""
    length = 32.0
    n = int(RATE * length)
    t = np.arange(n) / RATE
    chords = [
        [130.81, 196.00, 246.94, 293.66, 329.63],
        [110.00, 164.81, 196.00, 246.94, 261.63],
        [87.31, 174.61, 220.00, 261.63, 329.63],
        [98.00, 146.83, 196.00, 246.94, 329.63],
    ]
    each = length / len(chords)
    mix = np.zeros(n)
    for i, chord in enumerate(chords):
        start = i * each
        # Each chord swells in and out over a little more than its slot, wrapping round the loop.
        local = (t - start) % length
        span = each + 2.0
        env = np.where(local < span, np.sin(np.pi * np.clip(local / span, 0, 1)) ** 1.5, 0)
        for f in chord:
            for detune in (-0.6, 0.6):
                mix += env * np.sin(2 * math.pi * (f + detune) * t) * (0.6 if f < 150 else 0.35)
    mix = smooth(mix, 24)
    save("music.wav", 0.5 * mix / np.abs(mix).max())


if __name__ == "__main__":
    asyncio.run(voiceover())
    sound_effects()
    music()
    print("audio ready")
