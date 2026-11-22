// Boot and the one loop: held keys fill the input vector, the game
// advances in fixed 1/60 s steps, and the renderer paints what is there.
//
// Screens: title, play, garden clear, caught, victory, paused. One shared
// action — the menu button or the Enter key — moves between them.
//
// ?shot=title|play|play2|clear (with &seed=N) stages that scene instead of
// running the loop: it paints the staged frame twice, then sets
// window.__shotReady so a screenshot tool knows the frame is settled.

import { BEST_KEY, STEP } from './config.js';
import { LEVELS } from './levels.js';
import {
  createGame,
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_MOTH,
  EVENT_NEAR_MISS,
  EVENT_NOISE,
  EVENT_SEEN,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
} from './game.js';
import { createInput, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame();
const renderer = createRenderer(canvas);
const audio = createAudio();
const state = game.state;

window.__game = { state, game };

function readBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY) ?? '0';
    return Number.parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best then lasts this visit only.
  }
}

let best = readBest();

// One event bit at a time: play the sound that belongs to it.
function playEvents(events) {
  if (events & EVENT_SEEN) audio.seen();
  if (events & EVENT_MOTH) audio.moth();
  if (events & EVENT_NEAR_MISS) audio.nearMiss();
  if (events & EVENT_NOISE) audio.noise();
  if (events & EVENT_CLEAR) audio.clear();
  if (events & EVENT_CAUGHT) audio.caught();
}

function finishCampaign() {
  state.screen = SCREEN_VICTORY;
  if (state.score > best) {
    best = state.score;
    saveBest(best);
  }
  status.textContent = `All five gardens crossed. Final score ${state.score}.`;
}

// The one action every menu button and the Enter key share, as a table of
// what each screen does with it.
const PRIMARY = {
  [SCREEN_TITLE]() {
    audio.unlock();
    audio.click();
    game.startCampaign();
    status.textContent = LEVELS[0].name;
  },
  [SCREEN_CLEAR]() {
    audio.click();
    if (state.levelIndex >= LEVELS.length - 1) finishCampaign();
    else game.startLevel(state.levelIndex + 1);
  },
  [SCREEN_CAUGHT]() {
    audio.click();
    game.startLevel(state.levelIndex);
  },
  [SCREEN_VICTORY]() {
    audio.click();
    game.startCampaign();
  },
  [SCREEN_PAUSED]() {
    state.screen = SCREEN_PLAY;
  },
};

function primaryAction() {
  const go = PRIMARY[state.screen];
  if (go) go();
}

function togglePause() {
  if (state.screen === SCREEN_PLAY) state.screen = SCREEN_PAUSED;
  else if (state.screen === SCREEN_PAUSED) state.screen = SCREEN_PLAY;
}

function runShot(name) {
  stageShot(name, game);
  let painted = 0;
  const paint = () => {
    renderer.draw(state, best, 1.25);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}

function runGame() {
  createInput(canvas, state.input, {
    onPoint(point) {
      audio.unlock();
      // Paint once more before hit-testing, so a click landing in the same
      // instant as a screen change is tested against the screen the player
      // is actually looking at (the spot game's ledger: hot rects go stale
      // the moment the screen changes).
      renderer.draw(state, best, performance.now() / 1000);
      const hot = renderer.hot;
      const inside = (r) => r && point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h;
      if (inside(hot.start) || inside(hot.next) || inside(hot.retry) || inside(hot.resume)) {
        primaryAction();
      }
    },
    onAction(action) {
      audio.unlock();
      if (action === ACTION_CONFIRM) primaryAction();
      else if (action === ACTION_PAUSE) togglePause();
      else if (action === ACTION_MUTE) audio.toggleMute();
      else if (action === ACTION_RESTART && state.screen !== SCREEN_TITLE) {
        game.startLevel(state.levelIndex);
      }
    },
  });

  let accumulator = 0;
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      playEvents(game.tick(STEP));
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
    renderer.draw(state, best, now / 1000);
  };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
