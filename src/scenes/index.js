import room from './room.js';
import taipei from './taipei.js';

// Scene registry. The timeline is Taipei -> Shanghai -> Santa Clara; a new
// chapter is one new module in this folder plus one line here.
export const SCENES = { room, taipei };
