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

Five worlds, each built on new procedural terrain on every press: Vesuvius in 79 AD (the Gran Cono
with Monte Somma's broken rim on its far-left flank, a Roman villa in fragments on a tuff terrace,
vineyards, umbrella pines, galleys in a deep bay) · an alpine valley village under snow peaks, with a
river gorge, a lake and fireworks · red-rock high plains with a mesa, a butte, a creek canyon, a bison
herd and a tornado · Koh Phi Phi lagoon with long-tail boats and a sunset, moonrise and rising tide ·
a neon beach city: art-deco setback towers with gold bands and lit crowns, streamline hotels and palms on the
promenade, a suspension bridge across a river estuary, a marina of moored yachts, and a colossal bronze figure on the
breakwater holding up a ring of light. Water reflects the sky, cumulus clouds drift with the
wind (a gale clears them), Cappadocia-style balloons float near the lens, and the camera adds
glow and film grain. Eight more worlds are still defined in `app.js` but left out
of the rotation by the `KEEP` list.

Behind every world is a painted sky that follows the time of day: drifting cloud banks, stars at night,
a sun glow, and a glassy sea under the world that mirrors it. Even when calm, worlds keep moving: trees sway,
surf breaks along every shoreline (the swell sweeps along the coast), sun glints play on open water, and
gulls wheel overhead, scattering when something loud happens.

Every world is composed low at the front and high at the back: beaches, lakes, harbours and boats near the
lens, the subject in the middle, and peaks, mesas, karst towers or supertall towers massed in the far corner.
A bay, gorge, canyon or harbour cuts through the front cut walls, so the strata profile itself rises and falls.
The far side softens into the horizon colour (aerial haze), and at night the terrain and walls keep a faint
moonlight so the slice still reads.

Surfaces are textured in the shader from object-space position (ground mottling, cliff bedding, strata beds with
partings and grain), so the detail turns with the world on SPIN. Where the cut passes through the sea, a lake or a
canal, the wall is clear water whose lower edge is the exact seabed line: it is clear near the surface and darkens with
depth, submerged ground takes on the water's colour, and you can see plankton drifting (faintly bioluminescent at
night) and schools of fish circling inside. The palettes stay with natural earth tones.

Each world is centred automatically from its silhouette (sampled terrain heights, the slab's base corners and any
tall objects in `c.tall`), turned to the current spin, and shown at 80% of its `frame.zoom`, smaller if the screen
needs it. `frame` also sets camera elevation (a lower camera makes peaks and towers loom) and the deck's scale and drop.
The deck keeps its on-screen size, leans slightly toward the viewer, and docks in the foreground. `depth` sets how deep the cut-away
strata go, `nseg` the terrain resolution, and `landMax` the highest ground animals will walk on.

Vesuvius's EVENT is a Plinian eruption: a pressure dome and shockwave blow the summit off, a column of
ash climbs into an umbrella-pine cloud, lightning runs through it, bombs arc out and start fires, lava
runs to the sea, and pyroclastic flows pour downhill and out over the water. The camera pulls back
and up to frame it, and the sky turns ember red.

A new world arrives calm and stays. Loud action (eruption, fireworks, tornado, the city's light cascade, the Phi Phi sunset with rising tide) only runs when you press EVENT (`B0`, `B1` in `app.js`). WORLD collapses the current scene in 0.45 s.

## Adding a world

Call `story({...})` in `app.js` with:
`height(u, v, noise)` and `color(h, slope, u, v, noise)` for the terrain (u, v run from −1 to 1),
a `preset` of control levels, a `calm` palette that tints the time of day, `build(c)` to place objects, and `update(c, t, dt)` for the action.
Use `c.P` (additive glow particles) and `c.Sm` (soft smoke, water and dust particles) for effects.

To preview one world, open `index.html?world=<id>`. Add `&ff=2.5` to fast-forward into the burst, `&ev=1` to trigger its EVENT, and `&snap=1` to jump the camera straight to the world's framing. `&spin=1` (to 3) starts the world turned by that many quarter turns, and `&time=0` (to 3) sets dawn, noon, dusk or night. While tuning a composition,
`&fr=zoom:2.2,el:.5,drop:3.5` overrides any `frame` value.

## Performance

The page renders at most 1.5× device pixels with 4× MSAA, and steps down toward 1× if frames run slower than 40 fps.
Waves are computed on the GPU, the cut walls are two-row strips coloured in the shader, and the sun's shadow map is
2048². A loader covers the start until the first frames are on screen.
