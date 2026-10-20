import room from './room.js';
import taiwan from './taiwan.js';
import shanghai from './shanghai.js';

// Scene registry. The timeline is Taiwan -> Shanghai -> Santa Clara; a new
// chapter is one new module in this folder plus one line here.
export const SCENES = { room, taiwan, shanghai };
