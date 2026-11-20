# Wonder Deck HD

The whole Wonder Deck K-9 rebuilt with photoreal rendering: the nine-key deck, its controls, the five classic worlds and a sixth of its own. It uses three.js r160 as ES modules (import map from jsDelivr), physically based materials, HDR image-based lighting and CC0 assets from Poly Haven (see `assets/CREDITS.md`). The classic deck in the parent folder is unchanged.

## Run it

ES modules and textures need a web server; opening `index.html` from disk won't load them.

```bash
cd hd && python3 -m http.server 8765    # http://localhost:8765
```

The deck works like the classic one. **WORLD** (Space) sinks the current diorama into the deck and raises the next one, with no page reload. The keys around it are:

| | | |
|---|---|---|
| **TIME** (T) dawn → noon → dusk → night | **CLOUDS** (C) clear → storm | **RAIN** (R) dry → downpour (snow in the Alps) |
| **WIND** (W) calm → gale | **WORLD** (Space) next world | **GLOW** (G) windows, lamps, neon, fires |
| **EVENT** (E) the world's big moment | **LIFE** (L) birds, boats, traffic, creatures | **SPIN** (S) turn 90° |

Keys 1–9 work in reading order. Drag to orbit, pinch or scroll to zoom. Arrow keys orbit and +/− zoom. Each world loads its own preset of levels.

## Worlds

- **Rock Islands** (`palau.js`): undercut limestone islets in a turquoise lagoon, with coral, golden jellyfish, mantas, kayaks and a whale shark below the drop-off. EVENT: a squall and a breaching humpback.
- **Vesuvius, 79 AD** (`vesuvius.js`): a lopsided Gran Cono with a breached crater, parasitic cones and lava tongues, a jagged Somma, a terraced villa shelf, headlands, sea stacks and a pharos islet. Lava veins glow in the cut walls. EVENT: the classic deck's blast, with a rumble and steam jets, then a white flash. A sonic boom, a shock dome and rings, the summit blown out, thousands of incandescent ejecta, an ash column into an umbrella canopy under an ember-black sky, bombs and fires. The veins swell and lava oozes out of the cut, and pyroclastic flows pour into the bay.
- **Midsummer Night** (`alps.js`): the valley village, a mirror lake and a drowned bell tower. EVENT: fireworks.
- **Sea of Dunes** (`dunes.js`): the Namib's scale and stillness. Knife-edged linear dunes, apricot on the lit side and violet in shadow, sweep toward a terraced jebel. A cathedral is cut into its sheer face: a portico of six columns, a rose window, a tholos between broken pediments and spired towers, with colossal elephants stepping out of the cliff and lions at the stair. Between the dunes, a valley leads the eye to it, past a white clay pan of dead camelthorn trees and an oasis pool fed by groundwater, with palms and a camp. A caravan walks a crest for scale. The wind shaves the crests: sand streams off every ridge and past the edges of the slice into the sky, gusts sweep sheets of it out of the world, and now and then a dune spills over the cut wall and falls away into nothing. EVENT: a magnitude-nine quake drains the drifted sand from the cathedral's forecourt and sand pours from every window. A few seconds later the sand buries it again.
- **Neon Shore** (`city.js`): glass, setback, twisting and art-deco towers, streamline hotels, neon, a suspension bridge with traffic, a marina, and a bronze colossus holding a ring of light. A palm-crowned bluff runs along the back, and the river drops off it in a waterfall that is floodlit at night, into a misty plunge pool behind the bridge. Under the bay lies a capsized freighter. EVENT: a blackout, a power wave and a searchlight show.
- **Amazon Canopy** (`amazon.js`): a sixties-livery 747, so big its nose and tail poke out of the side walls and its port wing reaches far out past the front corner over the void, lies broken behind the wing in the swath it tore through the forest. Its super-graphics livery (sunflower to tangerine, a magenta sweep, a sun on the fin) is chalking, flaking to primer and rusting under moss, and vines hang from the wingtip into nothing. Something aboard is still awake: a few windows on both decks glow, the open forward door spills warm light, light leaks and mist drifts from the break, and the beacon still blinks. Behind it, a canopy in every green climbs to Inca terraces and a citadel, a waterfall drops from a cleft, and a brown river snakes from its pool past the nose. Gold light shafts fall through the humid air under an emerald grade. Unseen animals shake the crowns and flush macaws. EVENT: something comes. Rustling, then a cacophony as a troop of monkeys leaps over the canopy ahead of something invisible that flattens the trees, then a huge explosion with a fireball, a shock ring through the canopy and climbing smoke, then silence, and slowly the forest breathes again.

Slabs keep the classic proportions (about a quarter as deep as they are wide). `DZ()` in `core.js` compresses everything far below the surface so the abyss still reads in a thin profile.

## Files

- `core.js`: the engine, created once. It also has `makeFalls()`, the shared waterfall: a streaked curtain on a falling arc, a foaming pool and mist. Worlds can pass `grade: { lift, gain }` to tint shadows and highlights. It has quality tiers, lazy HDR skies (RGBE-in-PNG), looks for time of day and events, the control state, bloom, AgX and a film grade with flash, camera shake, heightfields and cut walls, the refractive water, `underwater()`, palms, sway and per-world audio buses.
- `deck.js`: the pad, drawn as an overlay viewport with engraved icons, LEDs, spring keys and click sounds.
- `fx.js`: rain held inside the glass case, lightning in storms, birds (gulls or vultures) and the wind and rain sound beds.
- `main.js`: world switching, presets, keyboard and the HUD.

## Performance

Phones and tablets get the light tier automatically (`?q=lo` or `?q=hi` forces either). It uses 1K textures and skies from `assets/lo/`, a pixel ratio capped at 1.5 and lowered further if frames run slow, no MSAA, a 2048² shadow map, about 60% of the terrain resolution, fewer trees and particles, and a smaller lake mirror. Desktop textures are 2K and recompressed (about 15 MB in total, 6.5 MB for the light tier). Each world loads only the textures it uses, and the cache carries over between worlds. Shaders are compiled before a world rises. The originals live in `../hd-src/` (git-ignored).

## Test parameters

`?world=<id>` or `#<id>` picks the starting world. `&still=1` stops the slow orbit, `&ev=1` starts the event, `&ff=6` fast-forwards that many seconds, `&time=0..3` sets the time of day, `&keys=0,1,8` presses deck keys after loading, `&seed=N` reshapes the terrain, `&shot=1` holds the load event for headless screenshots, and `&dbg=1` logs asset loading.
