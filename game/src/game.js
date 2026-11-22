// MOONLIT ESTATE — the rules. One state object holds the garden, the
// intruder, the gardeners and the detection meter, and one fixed step
// moves all of them through their phases:
//
//   walk the intruder, then listen for the noise he makes,
//   let every gardener look, listen and move,
//   fill or drain the single detection meter,
//   gather moths, then check the gate.
//
// The meter is the whole game in one number. A gardener who sees you
// fills it — slower while you stand in shadow, faster the closer you are.
// Out of sight it drains. Past 0.55 the gardener runs at you, and a chase
// that reaches you — or a meter that fills — ends the attempt. Fill it and
// slip away again and that was a near miss: the garden remembers, the
// score pays a little, and the patrols quicken while the meter stays
// high. Walking is heard; tiptoeing on Shift is silent and slow.

import { DETECTION, FIELD, GUARD, HUD_H, PLAYER, SCORING } from './config.js';
import { LEVELS } from './levels.js';
import { createGuard, MODE_CHASE, updateGuard } from './guards.js';
import { moveCircle } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_PAUSED = 'paused';

export const EVENT_SEEN = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_CLEAR = 4;
export const EVENT_MOTH = 8;
export const EVENT_NEAR_MISS = 16;
export const EVENT_NOISE = 32;

// Where a body may walk: the whole field except the HUD strip and a thin
// margin around the garden's edge.
const BOUNDS = {
  x: 8,
  y: HUD_H + 6,
  w: FIELD.width - 16,
  h: FIELD.height - HUD_H - 14,
};

export function createGame() {
  const state = {
    screen: SCREEN_TITLE,
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, dir: -Math.PI / 2, moving: false, tiptoe: false, inShadow: false },
    guards: [],
    meter: 0,
    seenNow: false,
    seenEver: false,
    meterWasHigh: false,
    nearMisses: 0,
    score: 0,
    levelScore: 0,
    time: 0,
    totalTime: 0,
    moths: [],
    mothsGot: 0,
    mothsTotal: 0,
    ripples: [],
    message: '',
    messageTime: 0,
    caughtBy: '',
    input: { x: 0, y: 0, tiptoe: false },
    rippleT: 0,
  };

  function startLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.playerStart.x;
    state.player.y = level.playerStart.y;
    state.player.dir = -Math.PI / 2;
    state.player.moving = false;
    state.guards = level.guards.map(createGuard);
    state.meter = 0;
    state.seenNow = false;
    state.seenEver = false;
    state.meterWasHigh = false;
    state.time = 0;
    state.moths = level.moths.map(([x, y]) => ({ x, y, got: false }));
    state.ripples = [];
    state.message = level.name;
    state.messageTime = 2.2;
    state.levelScore = 0;
    state.screen = SCREEN_PLAY;
  }

  function startCampaign() {
    state.score = 0;
    state.totalTime = 0;
    state.mothsTotal = 0;
    state.nearMisses = 0;
    startLevel(0);
  }

  function standingInShadow(x, y) {
    for (const s of state.level.shadows) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy <= s.r * s.r) return true;
    }
    return false;
  }

  function endAttempt(reason) {
    state.screen = SCREEN_CAUGHT;
    state.caughtBy = reason;
    state.score = Math.max(0, state.score - SCORING.caughtPenalty);
    return EVENT_CAUGHT;
  }

  function finishGarden() {
    const under = Math.max(0, state.level.par - state.time);
    const timeBonus = Math.round(under * SCORING.timeBonusPerSecond);
    const ghost = state.seenEver ? 0 : SCORING.ghostBonus;
    state.levelScore = SCORING.levelBase + timeBonus + ghost;
    state.score += state.levelScore;
    state.totalTime += state.time;
    state.screen = SCREEN_CLEAR;
    return EVENT_CLEAR;
  }

  // Phase 1: walk the intruder along the held input, leaving a fading
  // ring on the grass every few steps while he walks out loud.
  function walkPlayer(dt) {
    const p = state.player;
    const pace = state.input.tiptoe ? PLAYER.tiptoeSpeed : PLAYER.walkSpeed;
    p.tiptoe = state.input.tiptoe;
    const ix = state.input.x;
    const iy = state.input.y;
    const mag = Math.sqrt(ix * ix + iy * iy);
    p.moving = mag > 0.01;
    if (!p.moving) {
      p.inShadow = standingInShadow(p.x, p.y);
      return;
    }
    const nx = ix / (mag > 1 ? mag : 1);
    const ny = iy / (mag > 1 ? mag : 1);
    p.dir = Math.atan2(ny, nx);
    moveCircle(p, nx * pace * dt, ny * pace * dt, state.level.blockers, BOUNDS, PLAYER.radius);
    p.inShadow = standingInShadow(p.x, p.y);
    if (p.tiptoe) return;
    state.rippleT -= dt;
    if (state.rippleT > 0) return;
    state.rippleT = 0.42;
    state.ripples.push({ x: p.x, y: p.y, age: 0, life: 0.8, kind: 'player' });
  }

  // Phase 2: every gardener looks and listens. Returns the events of the
  // step, or a catch when a chase reaches the intruder.
  function watchGuards(dt, noiseAt) {
    let events = 0;
    let anySee = false;
    let nearestSee = Infinity;
    const p = state.player;
    for (const g of state.guards) {
      let heard = false;
      if (noiseAt) {
        const dx = g.x - p.x;
        const dy = g.y - p.y;
        heard = Math.sqrt(dx * dx + dy * dy) <= PLAYER.noiseRadius;
      }
      const gEvents = updateGuard(g, dt, {
        player: p,
        blockers: state.level.blockers,
        bounds: BOUNDS,
        meter: state.meter,
        heardNoise: heard,
        noiseAt: noiseAt ?? p,
      });
      if (gEvents.includes('ripple')) {
        state.ripples.push({ x: g.x, y: g.y, age: 0, life: 1.1, kind: 'guard' });
      }
      if (gEvents.includes('heard')) events |= EVENT_NOISE;
      if (!g.seesPlayer) continue;
      anySee = true;
      if (g.seeDist < nearestSee) nearestSee = g.seeDist;
      if (g.mode !== MODE_CHASE) continue;
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) > GUARD.catchDistance) continue;
      events |= endAttempt('run down by a gardener');
      return { events, caught: true };
    }
    return { events, caught: false, anySee, nearestSee };
  }

  // Phase 3: the meter. Seen, it fills — faster up close, slower in
  // shadow. Unseen, it drains, and a climb that falls back low is a near
  // miss that pays.
  function updateMeter(dt, seen, nearest) {
    let events = 0;
    if (!seen) {
      state.seenNow = false;
      state.meter = Math.max(0, state.meter - DETECTION.decayPerSecond * dt);
      if (state.meterWasHigh && state.meter < DETECTION.nearMissBand) {
        state.meterWasHigh = false;
        state.nearMisses += 1;
        state.score += SCORING.nearMiss;
        state.message = `Near miss! +${SCORING.nearMiss}`;
        state.messageTime = 1.6;
        events |= EVENT_NEAR_MISS;
      }
      return events;
    }
    if (!state.seenNow) events |= EVENT_SEEN;
    state.seenNow = true;
    state.seenEver = true;
    const closeness = 1.15 - nearest / GUARD.visionRange;
    let rate = DETECTION.fillBase * Math.max(0, closeness);
    if (state.player.inShadow) rate *= DETECTION.shadowFactor;
    state.meter = Math.min(1, state.meter + rate * dt);
    if (state.meter > DETECTION.chaseThreshold) state.meterWasHigh = true;
    if (state.meter >= 1) events |= endAttempt('seen plain as day');
    return events;
  }

  // Phase 4: moths within reach are caught, and the gate ends the garden.
  function gatherAndGate() {
    let events = 0;
    const p = state.player;
    for (const m of state.moths) {
      if (m.got) continue;
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) >= 24) continue;
      m.got = true;
      state.mothsGot += 1;
      state.mothsTotal += 1;
      state.score += SCORING.moth;
      state.message = `A moon moth! +${SCORING.moth}`;
      state.messageTime = 1.4;
      events |= EVENT_MOTH;
    }
    const e = state.level.exit;
    const inside = p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h;
    if (inside) events |= finishGarden();
    return events;
  }

  function tick(dt) {
    let events = 0;
    if (state.messageTime > 0) state.messageTime -= dt;
    // Ripples fade even while the garden is not playing.
    for (const r of state.ripples) r.age += dt;
    state.ripples = state.ripples.filter((r) => r.age < r.life);
    if (state.screen !== SCREEN_PLAY) return events;
    state.time += dt;

    walkPlayer(dt);
    const p = state.player;
    const noiseAt = p.moving && !p.tiptoe ? { x: p.x, y: p.y } : null;
    const watch = watchGuards(dt, noiseAt);
    events |= watch.events;
    if (watch.caught) return events;
    events |= updateMeter(dt, watch.anySee, watch.nearestSee);
    if (state.screen !== SCREEN_PLAY) return events;
    events |= gatherAndGate();
    return events;
  }

  return { state, startCampaign, startLevel, tick, bounds: BOUNDS };
}
