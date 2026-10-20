# Doodle World

A small walkable 3D sketchbook rendered as black ink on cream paper (Three.js + Vite).
Chapter 0 is the doodle loft (Milestones 1–2); chapter 1 is Taiwan, walked on Jiufen old street (Milestone 3).

```
npm install
npm run dev        # http://localhost:5173        (starts in the room)
                   # http://localhost:5173/?scene=taiwan   (straight to Taiwan)
```

Controls: **WASD** move · **mouse** look (click to capture, or drag) · **E** interact · **Esc** settings
(language English / 中文, mouse sensitivity; Esc also stands up from a seat or closes the journal).
The room's front door travels to Taiwan; the 回家 signpost at the top of the Jiufen street travels home.

## Structure
- `src/game.js` — the shared game: renderer + ink post pass, the player character, third-person
  controller + camera, collision, stairs (scene `heightAt`), sit/lie, HUD (objectives, minimap or
  compass, prompts, captions) and the fade → travel card → load → fade-in transition.
- `src/scenes/` — one module per place, registered in `scenes/index.js`:
  - `room.js` wraps the unchanged `src/room.js` (the loft) and adds the door to Taiwan.
  - `taiwan.js` builds Jiufen old street: stepped street with a bend, shrine alley, lower street, lookout,
    shops, lanterns, the tea house auntie, the cat, food stalls, collectibles and objectives.
  A new chapter (Shanghai, Santa Clara) is one new module there plus one line in `index.js`.
- `src/character.js` — the player from the character sheet (messy black mop with fringe + cowlick,
  oversized hoodie with hood, drawstrings and kangaroo pocket, cream backpack, wide black trousers,
  two-tone sneakers) on a chibi rig (hips/spine/neck/head, shoulders/elbows, hips/knees/ankles with
  two-bone leg IK), sculpted single-mesh hair with spring follow-through, backpack sway, walk/idle/
  turn/stop, sit/lie/reach/pickup. `createCharacter({ style: 'auntie' })` makes the tea house NPC.
- `src/i18n.js` — the single string table (English / 中文) for every player-facing string; the choice
  is saved in localStorage. In-world signs (茶, 臭豆腐, ...) are art and stay in Chinese.
- `src/ink.js` — ink surface material + outline/paper post pass.
- `src/textures.js`, `src/taiwanTextures.js` — every texture is drawn at load with a wobbly-pen
  canvas helper (`src/sketch.js`), including the sky panorama. Taipei 101, the city and the hills
  in front of it are 3D geometry in `taiwan.js`.

## Test scripts (need the dev server running)
- `node scripts/playtest.mjs <dir>` — room playtest (movement, collision, camera, every interaction).
- `node scripts/playtest_taiwan.mjs <dir>` — room → Taiwan → room: stairs, building fronts, railings,
  camera orbits, every interaction / objective / collectible, both transitions, fps.
- `node scripts/i18n_check.mjs [dir]` — settings menu, language switching + persistence, a Chinese entry
  for every reachable string, and no text overflow in either language.
- `node scripts/clip.mjs <dir>` — scripted review clip from the gameplay camera.
- `node scripts/charreview.mjs <dir>` — character review: front / side / back / 3/4 stills, gameplay-camera
  stills (room + Taiwan) and a walk-and-turn recording. `node scripts/views.mjs <png> [dist lookY camY]` —
  close six-angle turnaround strip.
- `node scripts/shots.mjs <dir>` (`SCENE=taiwan` for Taiwan views), `node scripts/charsheet.mjs <png> [scene] [x z facing]`,
  `node scripts/stability.mjs <png>`, `node scripts/stability_taiwan.mjs <png>` — stills and outline-stability strips.
