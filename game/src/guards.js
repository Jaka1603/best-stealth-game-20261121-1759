// The gardeners of MOONLIT ESTATE. Each one walks a small state machine,
// driven by a table: one handler per mode, so the machine reads as a list
// of behaviours rather than a branching chain.
//
//   patrol      walk the waypoint loop, pausing a beat at every point
//   stare       something caught the eye: stand still and look (the meter
//               keeps filling while the stare holds)
//   chase       the intruder is plainly seen: run them down
//   investigate walk to the last place seen — or last heard
//   search      arrived, found nothing: look around, then give up
//   return      walk back to the nearest waypoint and rejoin the loop
//
// A guard reports whether he can see the intruder; the game module owns
// the detection meter, the noise, and the catching.

import { GUARD } from './config.js';
import { angleDiff, canSee, moveCircle } from './vision.js';

export const MODE_PATROL = 'patrol';
export const MODE_STARE = 'stare';
export const MODE_CHASE = 'chase';
export const MODE_INVESTIGATE = 'investigate';
export const MODE_SEARCH = 'search';
export const MODE_RETURN = 'return';

export function createGuard(def) {
  const start = def.path[0];
  const second = def.path.length > 1 ? def.path[1] : def.path[0];
  const guard = {
    x: start[0],
    y: start[1],
    dir: Math.atan2(second[1] - start[1], second[0] - start[0]),
    mode: MODE_PATROL,
    path: def.path,
    wp: 1 % Math.max(1, def.path.length),
    waitT: 0,
    target: null,
    lastSeen: null,
    loseT: 0,
    searchT: 0,
    searchBaseDir: 0,
    rippleT: Math.random() * GUARD.stepRippleEvery,
    speedMul: def.speedMul ?? 1,
    seesPlayer: false,
    seeDist: -1,
    moving: false,
  };
  return guard;
}

// Turn toward (tx, ty) at most 3.4 radians a second and step that way.
// Answers true once the guard is standing on the point.
function walkTo(g, tx, ty, speed, dt, blockers, bounds) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) {
    g.moving = false;
    return true;
  }
  const want = Math.atan2(dy, dx);
  const turn = angleDiff(want, g.dir);
  g.dir += Math.max(-3.4 * dt, Math.min(3.4 * dt, turn));
  const step = Math.min(dist, speed * dt);
  moveCircle(g, Math.cos(g.dir) * step, Math.sin(g.dir) * step, blockers, bounds, GUARD.radius);
  g.moving = true;
  return dist <= Math.max(6, step + 2);
}

// Turn in place toward (tx, ty), at most `rate` radians a second.
function faceToward(g, tx, ty, rate, dt) {
  const want = Math.atan2(ty - g.y, tx - g.x);
  const turn = angleDiff(want, g.dir);
  g.dir += Math.max(-rate * dt, Math.min(rate * dt, turn));
}

// Which waypoint is closest to where the guard stands? That is where a
// returning guard walks back to.
function nearestWaypoint(g) {
  let best = 0;
  let bestD = Infinity;
  g.path.forEach(([x, y], i) => {
    const d = (x - g.x) ** 2 + (y - g.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// When the guard can see the intruder, the meter decides the reaction: a
// high meter means a chase, anything lower a stare.
function reactToSight(g, meter) {
  g.mode = meter > 0.55 ? MODE_CHASE : MODE_STARE;
}

// When the trail goes cold, walk to the last seen point — or give up and
// head home when there is none.
function goToLastSeen(g) {
  g.mode = MODE_INVESTIGATE;
  g.target = g.lastSeen ? { x: g.lastSeen.x, y: g.lastSeen.y } : null;
  if (!g.target) g.mode = MODE_RETURN;
}

const BEHAVIOURS = {
  patrol(g, dt, view, events) {
    if (g.seesPlayer) {
      reactToSight(g, view.meter);
      g.waitT = 0;
      return;
    }
    if (view.heardNoise) {
      g.mode = MODE_INVESTIGATE;
      g.target = { x: view.noiseAt.x, y: view.noiseAt.y };
      events.push('heard');
      return;
    }
    if (g.waitT > 0) {
      g.waitT -= dt;
      g.moving = false;
      return;
    }
    const [tx, ty] = g.path[g.wp];
    const arrived = walkTo(g, tx, ty, GUARD.patrolSpeed * g.speedMul, dt, view.blockers, view.bounds);
    if (arrived) {
      g.wp = (g.wp + 1) % g.path.length;
      g.waitT = GUARD.waypointPause;
    }
  },

  stare(g, dt, view) {
    if (!g.seesPlayer) {
      goToLastSeen(g);
      return;
    }
    // Face the intruder and hold still: the meter does the rest.
    faceToward(g, view.player.x, view.player.y, 5, dt);
    g.moving = false;
    if (view.meter > 0.55) g.mode = MODE_CHASE;
  },

  chase(g, dt, view) {
    if (!g.seesPlayer) {
      g.loseT += dt;
      if (g.loseT > GUARD.loseSightAfter) {
        goToLastSeen(g);
        return;
      }
    }
    const tx = g.lastSeen ? g.lastSeen.x : view.player.x;
    const ty = g.lastSeen ? g.lastSeen.y : view.player.y;
    const hurry = view.meter > 0.3 ? 1 + 0.12 : 1;
    walkTo(g, tx, ty, GUARD.chaseSpeed * g.speedMul * hurry, dt, view.blockers, view.bounds);
  },

  investigate(g, dt, view) {
    if (g.seesPlayer && view.meter > 0.55) {
      g.mode = MODE_CHASE;
      return;
    }
    if (!g.target) {
      g.mode = MODE_RETURN;
      return;
    }
    const arrived = walkTo(g, g.target.x, g.target.y, GUARD.investigateSpeed * g.speedMul, dt, view.blockers, view.bounds);
    if (arrived) {
      g.mode = MODE_SEARCH;
      g.searchT = GUARD.searchTime;
      g.searchBaseDir = g.dir;
    }
  },

  search(g, dt, view) {
    if (g.seesPlayer) {
      reactToSight(g, view.meter);
      return;
    }
    g.moving = false;
    g.searchT -= dt;
    g.dir = g.searchBaseDir + Math.sin((GUARD.searchTime - g.searchT) * 2.4) * 0.9;
    if (g.searchT <= 0) g.mode = MODE_RETURN;
  },

  return(g, dt, view) {
    if (g.seesPlayer) {
      reactToSight(g, view.meter);
      return;
    }
    const idx = nearestWaypoint(g);
    const [tx, ty] = g.path[idx];
    const arrived = walkTo(g, tx, ty, GUARD.investigateSpeed * g.speedMul, dt, view.blockers, view.bounds);
    if (arrived) {
      g.wp = (idx + 1) % g.path.length;
      g.mode = MODE_PATROL;
      g.waitT = 0.2;
    }
  },
};

// Advance one guard by dt. `view` carries what he can perceive this step:
// the intruder's position, whether a noise was heard and where, the
// blockers, the garden bounds, and the current meter (a stare turns into a
// chase once the meter passes halfway). Returns events — 'ripple' asks the
// game to draw a footstep ring where the guard stands, 'heard' says he
// turned toward a noise.
export function updateGuard(g, dt, view) {
  const events = [];
  g.seeDist = canSee(g, view.player.x, view.player.y, view.blockers, GUARD.visionRange, GUARD.visionHalfAngle);
  g.seesPlayer = g.seeDist >= 0;
  if (g.seesPlayer) {
    g.lastSeen = { x: view.player.x, y: view.player.y };
    g.loseT = 0;
  }
  const behaviour = BEHAVIOURS[g.mode] ?? BEHAVIOURS.patrol;
  behaviour(g, dt, view, events);

  // Footsteps: a walking guard sheds a ripple ring at a steady beat, so
  // the intruder can hear one coming before the lantern swings into view.
  if (g.moving) {
    g.rippleT -= dt;
    if (g.rippleT <= 0) {
      g.rippleT = GUARD.stepRippleEvery;
      events.push('ripple');
    }
  }
  return events;
}
