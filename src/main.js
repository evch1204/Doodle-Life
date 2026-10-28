import '@fontsource/patrick-hand';
import '@fontsource/lxgw-wenkai-tc/400.css';
import './style.css';
import { startGame } from './game.js';
import { loadChibi } from './character.js';
import { SCENES } from './scenes/index.js';

const q = new URLSearchParams(location.search).get('scene');
loadChibi().then(() => startGame(SCENES, SCENES[q] ? q : 'room'));
