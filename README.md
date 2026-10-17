# Doodle World

A small walkable 3D sketchbook rendered as black ink on cream paper (Three.js + Vite).
Chapter 0 is the doodle loft (Milestones 1–2); chapter 1 is Taipei — Jiufen (Milestone 3).

```
npm install
npm run dev        # http://localhost:5173        (starts in the room)
                   # http://localhost:5173/?scene=taipei   (straight to Taipei)
```

Controls: **WASD** move · **mouse** look (click to capture, or drag) · **E** interact · **Esc** release mouse / stand up.
The room's front door travels to Taipei; the 回家 signpost at the top of the Jiufen street travels home.

## Structure
- `src/game.js` — the shared game: renderer + ink post pass, the player character, third-person
  controller + camera, collision, stairs (scene `heightAt`), sit/lie, HUD (objectives, minimap or
  compass, prompts, captions) and the fade → travel card → load → fade-in transition.
- `src/scenes/` — one module per place, registered in `scenes/index.js`:
  - `room.js` wraps the unchanged `src/room.js` (the loft) and adds the door to Taipei.
  - `taipei.js` builds Jiufen: stepped street with a bend, shrine alley, lower street, lookout,
    shops, lanterns, the tea house auntie, the cat, food stalls, collectibles and objectives.
  A new chapter (Shanghai, Santa Clara) is one new module there plus one line in `index.js`.
- `src/character.js` — chibi rig (hips/spine/neck/head, shoulders/elbows, hips/knees/ankles with
  two-bone leg IK), sculpted single-mesh hair with spring follow-through, walk/idle/turn/stop,
  sit/lie/reach/pickup. `createCharacter({ style: 'auntie' })` makes the tea house NPC.
- `src/ink.js` — ink surface material + outline/paper post pass.
- `src/textures.js`, `src/taipeiTextures.js` — every texture is drawn at load with a wobbly-pen
  canvas helper (`src/sketch.js`), including the Taipei 101 skyline panorama.

## Test scripts (need the dev server running)
- `node scripts/playtest.mjs <dir>` — room playtest (movement, collision, camera, every interaction).
- `node scripts/playtest_taipei.mjs <dir>` — room → Taipei → room: stairs, building fronts, railings,
  camera orbits, every interaction / objective / collectible, both transitions, fps.
- `node scripts/clip.mjs <dir>` — scripted review clip from the gameplay camera.
- `node scripts/shots.mjs <dir>` (`SCENE=taipei` for Jiufen views), `node scripts/charsheet.mjs <png> [scene] [x z facing]`,
  `node scripts/stability.mjs <png>`, `node scripts/stability_taipei.mjs <png>` — stills and outline-stability strips.
