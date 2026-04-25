"""
DOMINO Quest - Original SFX generator (CC0 / public domain).

Generates 7 short retro-RPG-style SE wav files using only square / triangle /
noise oscillators with simple envelopes. No external audio assets are used.

Run once:  python generate_sfx.py
"""
import os
import math
import random
import struct
import wave

SR = 22050  # sample rate
HERE = os.path.dirname(os.path.abspath(__file__))


def write_wav(name, samples):
    path = os.path.join(HERE, name)
    samples = [max(-1.0, min(1.0, s)) for s in samples]
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        for s in samples:
            w.writeframesraw(struct.pack("<h", int(s * 32760)))
    print("wrote", path, len(samples), "samples")


def env_ad(n, attack=0.005, release=0.06):
    a = max(1, int(SR * attack))
    r = max(1, int(SR * release))
    out = []
    for i in range(n):
        if i < a:
            out.append(i / a)
        elif i > n - r:
            out.append(max(0.0, (n - i) / r))
        else:
            out.append(1.0)
    return out


def square(freq, n, duty=0.5):
    period = SR / freq
    return [1.0 if (i % period) / period < duty else -1.0 for i in range(n)]


def triangle(freq, n):
    period = SR / freq
    out = []
    for i in range(n):
        p = (i % period) / period
        out.append(4.0 * abs(p - 0.5) - 1.0)
    return out


def noise(n):
    return [random.uniform(-1.0, 1.0) for _ in range(n)]


def mix(*tracks):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, s in enumerate(t):
            out[i] += s
    m = max(1.0, max(abs(s) for s in out))
    return [s / m for s in out]


def gain(track, g):
    return [s * g for s in track]


def apply_env(track, env):
    return [s * e for s, e in zip(track, env)]


def slide(f0, f1, n, kind="square"):
    out = []
    phase = 0.0
    for i in range(n):
        t = i / max(1, n - 1)
        f = f0 + (f1 - f0) * t
        phase += 2 * math.pi * f / SR
        if kind == "square":
            out.append(1.0 if math.sin(phase) > 0 else -1.0)
        else:
            out.append((2.0 / math.pi) * math.asin(math.sin(phase)))  # triangle-ish
    return out


# --- 1. dialogue_normal: short mid-pitch pico ---
def gen_dialogue_normal():
    n = int(SR * 0.045)
    s = square(620, n, duty=0.5)
    s = apply_env(s, env_ad(n, 0.002, 0.030))
    return gain(s, 0.55)


# --- 2. dialogue_dark: low gritty blip ---
def gen_dialogue_dark():
    n = int(SR * 0.060)
    base = square(180, n, duty=0.3)
    nz = gain(noise(n), 0.18)
    s = mix(base, nz)
    s = apply_env(s, env_ad(n, 0.003, 0.045))
    return gain(s, 0.6)


# --- 3. dialogue_bright: high quick blip ---
def gen_dialogue_bright():
    n = int(SR * 0.040)
    s = square(1080, n, duty=0.5)
    s = apply_env(s, env_ad(n, 0.001, 0.028))
    return gain(s, 0.5)


# --- 4. ui_warning: longer buzzer ---
def gen_ui_warning():
    n = int(SR * 0.42)
    a = square(220, n, duty=0.5)
    b = square(225, n, duty=0.5)  # slight beat
    nz = gain(noise(n), 0.08)
    s = mix(a, b, nz)
    # simple gate envelope: on / off / on
    env = []
    seg = n // 6
    for i in range(n):
        phase = (i // seg) % 2
        env.append(1.0 if phase == 0 else 0.15)
    s = [v * e for v, e in zip(s, env)]
    s = apply_env(s, env_ad(n, 0.005, 0.05))
    return gain(s, 0.5)


# --- 5. ui_cursor: short click/pi ---
def gen_ui_cursor():
    n = int(SR * 0.035)
    s = square(880, n, duty=0.5)
    s = apply_env(s, env_ad(n, 0.001, 0.022))
    return gain(s, 0.45)


# --- 6. ui_confirm: bright pikon (rising) ---
def gen_ui_confirm():
    n = int(SR * 0.14)
    s = slide(620, 1240, n, "square")
    s = apply_env(s, env_ad(n, 0.003, 0.08))
    return gain(s, 0.55)


# --- 7. ui_cancel: low pokoh (falling) ---
def gen_ui_cancel():
    n = int(SR * 0.13)
    s = slide(420, 200, n, "triangle")
    s = apply_env(s, env_ad(n, 0.004, 0.09))
    return gain(s, 0.55)


def main():
    random.seed(20260425)
    write_wav("dialogue_normal.wav", gen_dialogue_normal())
    write_wav("dialogue_dark.wav",   gen_dialogue_dark())
    write_wav("dialogue_bright.wav", gen_dialogue_bright())
    write_wav("ui_warning.wav",      gen_ui_warning())
    write_wav("ui_cursor.wav",       gen_ui_cursor())
    write_wav("ui_confirm.wav",      gen_ui_confirm())
    write_wav("ui_cancel.wav",       gen_ui_cancel())


if __name__ == "__main__":
    main()
