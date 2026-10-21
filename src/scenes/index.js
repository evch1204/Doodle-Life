import room from './room.js';
import taiwan from './taiwan.js';
import shanghai from './shanghai.js';
import lobby from './lobby.js';
import bayarea from './bayarea.js';

// Scene registry. The timeline is Taiwan -> Shanghai -> Santa Clara; a new
// chapter is one new module in this folder plus one line here.
export const SCENES = { room, lobby, taiwan, shanghai, bayarea };
