# Doodle World — Milestone 1: Doodle Loft

A small, walkable 3D room rendered as black ink on cream sketchbook paper (Three.js + Vite).

```
npm install
npm run dev        # http://localhost:5173
```

Controls: **WASD** move · **mouse** look (click to capture, or drag) · **E** interact · **Esc** release mouse.

## How the look is made
- `src/ink.js` — ink surface material (Lambert lighting → world-space crosshatching for
  shadow / turned-away faces) and the post pass: outlines from depth, normal and per-object-id
  edges, world-anchored line wobble, paper grain.
- `src/textures.js` — every texture is drawn at load time with a wobbly-pen canvas helper
  (`src/sketch.js`): floor planks, posters, book spines, rug, the 3-layer parallax window view.
- `src/room.js` — the room layout, built from boxes/cylinders/spheres to match the reference.
- `src/character.js` — chibi character + walk/idle animation.
- `src/main.js` — controller, collision, follow camera, interactions, HUD, minimap.

## Test scripts (need the dev server running)
- `node scripts/playtest.mjs review/` — drives the game with real keyboard/mouse input,
  records a video and checks movement, collision, camera and all interactions.
- `node scripts/shots.mjs review/` — screenshots from fixed viewpoints.
