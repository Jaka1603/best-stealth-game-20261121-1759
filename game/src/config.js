// MOONLIT ESTATE — every number the game balances on, in one file.
//
// The field is a fixed 1280 by 720 logical canvas. A 56-pixel strip at the
// top is the HUD; the garden itself runs from y=56 to the bottom edge. The
// simulation steps at a fixed 1/60 s, so a number here retunes the whole
// estate at once — patrols, sight, suspicion and score alike.

export const FIELD = { width: 1280, height: 720 };
export const HUD_H = 56;
export const STEP = 1 / 60;

// The intruder: a 13-pixel body, quick on foot, slow on tiptoe, and heard
// while walking inside a 74-pixel ring.
export const PLAYER = {
  radius: 13, walkSpeed: 178, tiptoeSpeed: 96, noiseRadius: 74,
};

// A gardener: patrols at 72, hurries to a sound at 98, runs a chase at
// 152. His lantern reaches 168 pixels across a 35-degree half-cone; he
// pauses 0.7 s at each waypoint, searches 1.7 s, and gives up the chase
// 2.2 s after losing sight. A touch inside 30 pixels ends the attempt.
export const GUARD = {
  radius: 14, patrolSpeed: 72, investigateSpeed: 98, chaseSpeed: 152,
  visionRange: 168, visionHalfAngle: 0.62,
  waypointPause: 0.7, searchTime: 1.7, loseSightAfter: 2.2,
  catchDistance: 30, stepRippleEvery: 0.55,
};

// The one detection meter: it fills at 1.5 a second times how close and
// head-on the sighting is (1.15 at point blank, 0 at the cone's edge),
// at 45% speed inside a shadow pool, and drains at 0.55 a second out of
// sight. Past 0.55 the gardener chases; a climb above 0.55 that falls back
// under 0.2 is a near miss, and while the meter sits above 0.3 the patrols
// walk 12% faster.
export const DETECTION = {
  fillBase: 1.5, shadowFactor: 0.45, decayPerSecond: 0.55,
  chaseThreshold: 0.55, nearMissBand: 0.2, alertSpeedBonus: 0.12,
};

// Points: 300 for the garden, 5 a second under its par time, 200 for a
// crossing nobody saw, 50 a moth, 25 a near miss, and 100 lost when
// caught.
export const SCORING = {
  levelBase: 300, timeBonusPerSecond: 5, ghostBonus: 200,
  moth: 50, nearMiss: 25, caughtPenalty: 100,
};

// Night-garden palette: dark lawns, warm lantern light, gold for the gate
// and the score, red for danger, green for hidden.
export const PALETTE = {
  backdrop: '#0b0f1c', lawnA: '#1d3320', lawnB: '#1a2d1d', path: '#4c4438',
  hedge: '#2e5230', hedgeTop: '#3c6b3e', wall: '#5b5f6e', wallTop: '#767b8c',
  water: '#2b5a7a', waterShine: '#7fc4de', shadow: 'rgba(4, 6, 14, 0.5)',
  cone: 'rgba(255, 196, 92, 0.16)', coneEdge: 'rgba(255, 196, 92, 0.35)',
  coneAlert: 'rgba(255, 110, 80, 0.22)',
  player: '#2f8f83', playerFace: '#f2e3c2',
  guard: '#8a4a3a', guardCap: '#5e2f24', guardAlert: '#c8503c',
  exit: '#f2c94c', moth: '#bfe3ff',
  text: '#f2ecd9', muted: '#9aa3b8', danger: '#e5534b',
  good: '#37e08b', gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'moonlit-estate.best';
