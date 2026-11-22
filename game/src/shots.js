// The screenshot scenes behind ?shot=title|play|play2|clear. Each scene
// starts a real garden and then poses the state a real crossing passes
// through — the intruder caught inside a lantern cone with the meter
// climbing, a chase down a maze corridor — so the frame is what the game
// truly looks like mid-play, and the same scene always gives the same
// frame.
//
// A pose is a small function that takes the game and arranges its state;
// the table below names them. `stageShot` runs the pose for the scene the
// URL asked for.

import { SCREEN_CLEAR, SCREEN_TITLE } from './game.js';
import { MODE_CHASE } from './guards.js';

function placePlayer(state, x, y, dir) {
  state.player.x = x;
  state.player.y = y;
  state.player.dir = dir;
}

function setAlert(state, meter, message) {
  state.meter = meter;
  state.seenNow = true;
  state.message = message;
  state.messageTime = 99;
}

const POSES = {
  play(game) {
    const state = game.state;
    game.startLevel(0);
    // Inside the first gardener's lantern light, meter climbing, not yet
    // chased down.
    placePlayer(state, 392, 168, 0.4);
    setAlert(state, 0.45, 'Spotted — break the line of sight!');
  },

  play2(game) {
    const state = game.state;
    game.startLevel(2);
    // The maze: a chase down the corridor, meter near the top.
    const guard = state.guards[0];
    guard.mode = MODE_CHASE;
    guard.lastSeen = { x: 290, y: 320 };
    placePlayer(state, 290, 330, Math.PI / 2);
    setAlert(state, 0.78, 'Run down — break away around a corner!');
  },

  clear(game) {
    const state = game.state;
    game.startLevel(1);
    state.time = 31;
    state.levelScore = 475;
    state.seenEver = false;
    state.screen = SCREEN_CLEAR;
  },

  title(game) {
    const state = game.state;
    game.startLevel(0);
    state.screen = SCREEN_TITLE;
  },
};

export function stageShot(name, game) {
  const pose = POSES[name] ?? POSES.title;
  pose(game);
}
