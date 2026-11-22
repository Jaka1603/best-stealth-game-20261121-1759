// Input: held keys become a movement vector on the state — the game reads
// it every fixed step, so a key released mid-frame is never missed. Shift
// is the tiptoe modifier, single taps become named actions, and pointer
// presses are reported in field coordinates for the menu buttons.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';

// One row per key: the browser's code, the direction it walks, and the tap
// action it fires (empty when the key only walks).
const KEYS = [
  ['ArrowUp', 'up', ''],
  ['KeyW', 'up', ''],
  ['ArrowDown', 'down', ''],
  ['KeyS', 'down', ''],
  ['ArrowLeft', 'left', ''],
  ['KeyA', 'left', ''],
  ['ArrowRight', 'right', ''],
  ['KeyD', 'right', ''],
  ['Enter', '', ACTION_CONFIRM],
  ['Space', '', ACTION_CONFIRM],
  ['KeyP', '', ACTION_PAUSE],
  ['Escape', '', ACTION_PAUSE],
  ['KeyM', '', ACTION_MUTE],
  ['KeyR', '', ACTION_RESTART],
];

const BY_CODE = new Map(KEYS.map(([code, dir, action]) => [code, { dir, action }]));

export function createInput(canvas, inputState, handlers) {
  const held = { up: false, down: false, left: false, right: false };

  function refresh() {
    const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    inputState.x = x;
    inputState.y = y;
    inputState.tiptoe = Boolean(inputState.tiptoeKey);
  }

  function onShift(down) {
    inputState.tiptoeKey = down;
    refresh();
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      onShift(true);
      return;
    }
    const key = BY_CODE.get(event.code) ?? BY_CODE.get(event.key);
    if (!key) return;
    if (key.dir) {
      held[key.dir] = true;
      refresh();
      event.preventDefault();
      return;
    }
    if (key.action && !event.repeat) {
      event.preventDefault();
      handlers.onAction(key.action);
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      onShift(false);
      return;
    }
    const key = BY_CODE.get(event.code);
    if (key && key.dir) {
      held[key.dir] = false;
      refresh();
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    handlers.onPoint({
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    });
  });

  return { refresh };
}
