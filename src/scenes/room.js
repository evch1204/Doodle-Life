import * as THREE from 'three';
import { buildRoom, ROOM, OUTLINE } from '../room.js';

// Chapter 0: the doodle loft (Milestones 1-2). The room itself is built by
// room.js unchanged; this module only adds what the shared game needs:
// HUD text, start point, the explore objective and the door to Taipei.
export default {
  id: 'room',
  name: 'the loft',
  travelText: 'Heading home…',
  hud: {
    title: 'Objective:',
    style: 'single',
    map: 'minimap',
    objectives: [
      { id: 'explore', text: 'Explore the room' },
      { id: 'journal', text: 'Find the hidden journal ☆' },
      { id: 'stars', text: 'Stars collected', count: true },
    ],
  },
  start: { x: -0.3, z: 1.4, facing: Math.PI, yaw: 0, pitch: 0.4 },
  sun: { dir: [-0.3, 2.2, 1.0], extent: 7 },
  camera: { far: 100, dist: 2.6 },

  build(scene) {
    const room = buildRoom(scene);
    // the front door leads to the first chapter
    room.interactables.push({
      id: 'door', label: 'Travel to Taipei', kind: 'action', x: -2.4, z: 3.55, radius: 0.85,
      pos: new THREE.Vector3(-2.4, 1.5, 4.1), noReach: false,
      act: (ctx) => ctx.travel('taipei'),
    });
    // explore objective: visit the main areas of the room
    const zones = [[-3.2, -1.5], [-0.7, -3.6], [2.4, -2.6], [3.6, -0.6], [2.5, 3.2], [-3.4, 2.6]];
    const visited = new Set();
    return {
      ...room,
      camBounds: ROOM,
      minimap: { outline: OUTLINE, scale: 17, ox: 0, oz: 0.4 },
      explored: () => visited.size,
      update(t, dt, ctx) {
        room.update(t, dt);
        const p = ctx.player.pos;
        for (let i = 0; i < zones.length; i++) if (Math.hypot(p.x - zones[i][0], p.z - zones[i][1]) < 1.3) visited.add(i);
        if (visited.size >= 5) ctx.complete('explore');
      },
    };
  },
};
