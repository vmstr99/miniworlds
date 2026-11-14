# Wonder Deck K-9

A toy for pressing buttons. A nine-key isometric deck in soft neumorphic plastic. Each press raises a small terrain
diorama out of the key you hit and floats it above and behind the deck, so the keys stay
clear and its shadow falls on the floor behind. The world bursts into action for about
three seconds, settles into a calm afterglow, then sinks back into the key. Each press starts
a new, unrelated world.

## Run it

No build step and no dependencies to install (three.js r128 is vendored in `vendor/`).

```bash
open index.html                      # works straight from disk
# or, to make it installable as an app (Chrome/Edge: ⋮ → Install Wonder Deck):
python3 -m http.server 8081          # then visit http://localhost:8081
```

The centre key (**WORLD**, Space) opens a new scene. The eight around it change the scene
on screen, and the dots and LED on each key show its current level:

| | | |
|---|---|---|
| **TIME** (T) dawn → noon → dusk → night | **CLOUDS** (C) clear → storm | **RAIN** (R) dry → downpour |
| **WIND** (W) calm → gale | **WORLD** (Space) next scene | **GLOW** (G) windows, lamps, neon |
| **EVENT** (E) replay the scene's big moment | **LIFE** (L) birds, traffic | **SPIN** (S) turn 90° |

Keys 1–9 also work, in reading order. Each key shows an engraved icon that changes with its level (sun → sunset → moon, a cloud that fills and gets a lightning bolt, more raindrops, more gust lines, a brighter bulb). Each world loads its own starting settings, and the
scene stays on screen until you press WORLD again.

## Worlds

Five worlds, each built on new procedural terrain on every press: volcanic island with
sauropods · village with a lantern-lit river and fireworks · storm plains with an elephant herd
and a tornado · Koh Phi Phi lagoon with long-tail boats and a sunset, moonrise and rising tide ·
neon megacity with traffic and crowds. Water reflects the sky, cumulus clouds drift with the
wind (a gale clears them), Cappadocia-style balloons float near the lens, and the camera adds
tilt-shift, glow and film grain. Eight more worlds are still defined in `app.js` but left out
of the rotation by the `KEEP` list.

A new world arrives calm and stays. Loud action (eruption, fireworks, tornado, the city's light cascade, the Phi Phi sunset with rising tide) only runs when you press EVENT (`B0`, `B1` in `app.js`). WORLD collapses the current scene in 0.45 s.

## Adding a world

Call `story({...})` in `app.js` with:
`height(u, v, noise)` and `color(h, slope, u, v, noise)` for the terrain (u, v run from −1 to 1),
a `preset` of control levels, a `calm` palette that tints the time of day, `build(c)` to place objects, and `update(c, t, dt)` for the action.
Use `c.P` (additive glow particles) and `c.Sm` (soft smoke, water and dust particles) for effects.

To preview one world, open `index.html?world=<id>`. Add `&ff=2.5` to fast-forward into the burst.
