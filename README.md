# Doodle World

A small walkable 3D sketchbook rendered as black ink on cream paper (Three.js + Vite).
Chapter 0 is the doodle loft (Milestones 1–2); chapter 1 is Taiwan, walked on Jiufen old street (Milestone 3);
chapter 2 is Shanghai, on the Bund promenade across the Huangpu River from the Pudong skyline (Milestone 4).

```
npm install
npm run dev        # http://localhost:5173        (starts in the room)
                   # http://localhost:5173/?scene=taiwan     (straight to Taiwan)
                   # http://localhost:5173/?scene=shanghai   (straight to the Bund)
```

Controls: **WASD** move · **mouse** look (click to capture, or drag) · **E** interact · **Esc** settings
(language English / 中文, mouse sensitivity; Esc also stands up from a seat or closes the journal).
The room's front door travels to Taiwan and the Shanghai postcard pinned left of it travels to the Bund;
the 回家 signposts in Jiufen and on the Bund travel home.

## Structure
- `src/game.js` — the shared game: renderer + ink post pass, the player character, third-person
  controller + camera, collision, stairs (scene `heightAt`), sit/lie, HUD (objectives, minimap or
  compass, prompts, captions) and the fade → travel card → load → fade-in transition.
- `src/scenes/` — one module per place, registered in `scenes/index.js`:
  - `room.js` wraps the unchanged `src/room.js` (the loft) and adds the door to Taiwan.
  - `taiwan.js` builds Jiufen old street: stepped street with a bend, shrine alley, lower street, lookout,
    shops, lanterns, the tea house auntie, the cat, food stalls, collectibles and objectives.
  - `shanghai.js` builds the Bund: the paved promenade with its iron railing (the river is a hard
    boundary), benches, cast-iron lamps, life ring, bin, seagull, the 外灘 pylon, Bund Coffee (enterable,
    barista at the counter), ferries and birds. The far scenery is built in `scenes/shanghai/`:
    `bund.js` (the old Bund fronts from one kit: rusticated arcades, recessed windows with surrounds and
    hoods, giant columns, quoins, bracketed cornices, balustrades; the Customs House clock tower, HSBC
    dome, Peace Hotel pyramid and Bank of China roof), `pudong.js` (the four landmarks modelled from their
    structure, and the city from a small library of tower types, facades and crowns in three levels of
    detail), `river.js` (the water shader: ripple rows spaced by viewing angle, drifting with the current,
    and stroke-drawn reflections looked up from the skyline's silhouette) and
    `scenes/kit.js` (merged batches, one draw call per material, each piece keeping its outline id). The
    ink pass fades distant lines and tones (aerial perspective) except for the landmarks. Interactions: the viewpoint, the photo spot (saves the frame as a postcard into an album that
    lasts the session), the barista's dialogue panel, benches, the seagull and the life ring.
  A new chapter (Santa Clara) is one new module there plus one line in `index.js`.
- `src/character.js` — the player from the character sheet (messy black mop with fringe + cowlick,
  oversized hoodie with hood, drawstrings and kangaroo pocket, cream backpack, wide black trousers,
  two-tone sneakers) on a chibi rig (hips/spine/neck/head, shoulders/elbows, hips/knees/ankles with
  two-bone leg IK), sculpted single-mesh hair with spring follow-through, backpack sway, walk/idle/
  turn/stop, sit/lie/reach/pickup. `createCharacter({ style: 'auntie' })` makes the tea house NPC.
- `src/i18n.js` — the single string table (English / 中文) for every player-facing string; the choice
  is saved in localStorage. In-world signs (茶, 臭豆腐, ...) are art and stay in Chinese.
- `src/ink.js` — ink surface material + outline/paper post pass.
- `src/textures.js`, `src/taiwanTextures.js`, `src/shanghaiTextures.js` — every texture is drawn at load
  with a wobbly-pen canvas helper (`src/sketch.js`), including the sky panoramas. Taipei 101, the city and
  the hills in front of it are 3D geometry in `taiwan.js`; the Pudong skyline is 3D geometry in `scenes/shanghai/`.

## Test scripts (need the dev server running)
Every script takes the server address from `URL` (default `http://localhost:5173/`).
- `node scripts/playtest.mjs <dir>` — room playtest (movement, collision, camera, every interaction).
- `node scripts/playtest_taiwan.mjs <dir>` — room → Taiwan → room: stairs, building fronts, railings,
  camera orbits, every interaction / objective / collectible, both transitions, fps.
- `node scripts/playtest_shanghai.mjs <dir>` — room → postcard → the Bund → room: spawn to the railing,
  the river boundary pushed every 1.5 m along the whole railing, props / ends / café walls, camera orbits
  (incl. inside the café), every interaction and objective, boats / birds / river animating, fps, the trip home.
- `node scripts/i18n_check.mjs [dir]` — settings menu, language switching + persistence, a Chinese entry
  for every reachable string (all three scenes), and no text overflow in either language.
- `node scripts/clip.mjs <dir>` — scripted review clip from the gameplay camera (`node scripts/clip_shanghai.mjs <dir>` for the Bund).
- `node scripts/charreview.mjs <dir>` — character review: front / side / back / 3/4 stills, gameplay-camera
  stills (room + Taiwan) and a walk-and-turn recording. `node scripts/views.mjs <png> [dist lookY camY]` —
  close six-angle turnaround strip.
- `node scripts/shots.mjs <dir>` (`SCENE=taiwan` / `SCENE=shanghai` for those views), `node scripts/charsheet.mjs <png> [scene] [x z facing]`,
  `node scripts/stability.mjs <png>`, `node scripts/stability_taiwan.mjs <png>`, `node scripts/stability_shanghai.mjs <png>` — stills and outline-stability strips.
