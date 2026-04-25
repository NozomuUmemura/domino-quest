# DOMINO Quest — SFX licenses

Generated original sound effects. No external audio assets used.

All seven WAV files in this directory were synthesized procedurally inside
this project from square / triangle / noise oscillators with simple AD
envelopes. They are released into the public domain under
**Creative Commons CC0 1.0 Universal**.

## Files

| File                  | Use                                | Synth                              |
|-----------------------|------------------------------------|------------------------------------|
| dialogue_normal.wav   | dialogue blip — neutral characters | square 620 Hz, AD env              |
| dialogue_dark.wav     | dialogue blip — low / serious      | square 180 Hz + noise, AD env      |
| dialogue_bright.wav   | dialogue blip — bright / energetic | square 1080 Hz, AD env             |
| ui_warning.wav        | warning / error                    | dual square 220/225 Hz beat + noise|
| ui_cursor.wav         | cursor move on menus / choices     | square 880 Hz, AD env              |
| ui_confirm.wav        | confirm / Z / OK / note-added      | rising square sweep 620 → 1240 Hz  |
| ui_cancel.wav         | cancel / X / back                  | falling triangle sweep 420 → 200 Hz|

## Generation

The two generator scripts in this directory produce the WAVs deterministically
(seeded RNG). Either one is sufficient — they both produce equivalent output.

- `generate_sfx.ps1` — Windows PowerShell (used to build the bundled WAVs)
- `generate_sfx.py`  — Python 3 fallback (same algorithm)

Re-run with:

```
powershell -NoProfile -ExecutionPolicy Bypass -File generate_sfx.ps1
# or
python generate_sfx.py
```

## License

To the extent possible under law, the authors of these generated SFX have
waived all copyright and related rights to the works in this directory.
See <https://creativecommons.org/publicdomain/zero/1.0/>.

No third-party audio (Undertale or otherwise) is included or referenced.
