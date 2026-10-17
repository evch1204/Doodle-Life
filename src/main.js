import '@fontsource/patrick-hand';
import './style.css';
import { startGame } from './game.js';
import { SCENES } from './scenes/index.js';

const q = new URLSearchParams(location.search).get('scene');
startGame(SCENES, SCENES[q] ? q : 'room');
