// MOONLIT ESTATE — the renderer. A top-down night garden: mow-striped
// lawn, hedges and stone walls, fountains, pools of shadow where the
// lanterns do not reach, and every gardener's lantern cone drawn as the
// ground it really lights (cut short by whatever stands in the way). The
// intruder dims inside shadow; a gardener who suspects something wears a
// ?, one who is chasing wears a !, and both wear their footsteps as
// fading rings on the grass.
//
// The painter works in layers, always in the same order: ground, shade,
// walls, gate, moths, light, ripples, the hush ring, the figures, the
// danger pulse, the HUD, the message line, and finally the menu veil of
// whichever screen is showing.

import { FIELD, FONT, GUARD, HUD_H, PALETTE, PLAYER } from './config.js';
import { LEVELS } from './levels.js';
import {
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PAUSED,
  SCREEN_TITLE,
  SCREEN_VICTORY,
} from './game.js';
import { MODE_CHASE, MODE_INVESTIGATE, MODE_SEARCH, MODE_STARE } from './guards.js';
import { conePolygon } from './vision.js';

// A rounded rectangle path, ready to fill or stroke.
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function txt(ctx, value, x, y, size, colour, align = 'left', weight = '600') {
  ctx.fillStyle = colour;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const hot = {};

  // Several centred lines at once: each row is [text, y, size, colour,
  // align, weight].
  function rows(list) {
    for (const [value, y, size, colour, align, weight] of list) {
      txt(ctx, value, FIELD.width / 2, y, size, colour, align, weight);
    }
  }

  // The lawn: alternating mow stripes, plus a gravel apron where the
  // garden starts and where the exit gate stands.
  function paintGround(state) {
    const stripe = 46;
    let i = 0;
    while (i * stripe < FIELD.width) {
      ctx.fillStyle = i % 2 ? PALETTE.lawnA : PALETTE.lawnB;
      ctx.fillRect(i * stripe, HUD_H, stripe, FIELD.height - HUD_H);
      i += 1;
    }
    const e = state.level.exit;
    ctx.fillStyle = PALETTE.path;
    ctx.fillRect(e.x - 10, e.y - 6, e.w + 20, e.h + 16);
  }

  function paintShade(state) {
    for (const s of state.level.shadows) {
      const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.3, s.x, s.y, s.r);
      g.addColorStop(0, 'rgba(4, 6, 14, 0.62)');
      g.addColorStop(1, 'rgba(4, 6, 14, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintFountain(b, t) {
    ctx.fillStyle = PALETTE.wall;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.waterShine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 14 - Math.sin(t * 2) * 2, -0.6, 0.9);
    ctx.stroke();
    ctx.fillStyle = PALETTE.wallTop;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintHedge(b) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, b.x + 3, b.y + 5, b.w, b.h, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hedge;
    rr(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    const topH = Math.max(4, Math.min(12, b.h - 6));
    ctx.fillStyle = PALETTE.hedgeTop;
    rr(ctx, b.x + 3, b.y + 3, Math.max(4, b.w - 6), topH, 6);
    ctx.fill();
  }

  function paintWall(b) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 3, b.y + 5, b.w, b.h);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(b.x, b.y, b.w, 6);
  }

  function paintWalls(state, t) {
    for (const b of state.level.blockers) {
      if (b.kind === 'fountain') paintFountain(b, t);
      else if (b.kind === 'hedge') paintHedge(b);
      else paintWall(b);
    }
  }

  function paintGate(state, t) {
    const e = state.level.exit;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(242, 201, 76, ${0.25 * pulse})`;
    rr(ctx, e.x - 8, e.y - 8, e.w + 16, e.h + 16, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 3;
    rr(ctx, e.x, e.y, e.w, e.h, 6);
    ctx.stroke();
    txt(ctx, 'GATE', e.x + e.w / 2, e.y + e.h / 2, 14, PALETTE.exit, 'center', '800');
  }

  function paintMoths(state, t) {
    for (const m of state.moths) {
      if (m.got) continue;
      const bob = Math.sin(t * 3 + m.x) * 3;
      const y = m.y + bob;
      ctx.fillStyle = PALETTE.moth;
      ctx.beginPath();
      ctx.ellipse(m.x, y, 5, 3.4, 0.5, 0, Math.PI * 2);
      ctx.ellipse(m.x, y, 5, 3.4, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(191, 227, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(m.x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintRipples(state) {
    for (const r of state.ripples) {
      const frac = r.age / r.life;
      const guardRing = r.kind === 'guard';
      const rad = 6 + frac * (guardRing ? 30 : 20);
      ctx.strokeStyle = guardRing
        ? `rgba(255, 220, 150, ${0.4 * (1 - frac)})`
        : `rgba(200, 220, 255, ${0.3 * (1 - frac)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Every lantern cone, drawn with 'lighter' so overlapping light adds up.
  function paintCones(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of state.guards) {
      const poly = conePolygon(g, state.level.blockers, GUARD.visionRange, GUARD.visionHalfAngle);
      ctx.fillStyle = g.mode === MODE_CHASE ? PALETTE.coneAlert : PALETTE.cone;
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // The dashed ring that shows how far a walking intruder can be heard.
  function paintHush(state) {
    const p = state.player;
    if (!p.moving || p.tiptoe || state.screen !== 'play') return;
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.noiseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // One round figure: a soft shadow, a body, and a cap pushed toward the
  // direction the figure faces. With `face`, a pale face dot as well.
  function paintPerson(x, y, dir, body, cap, face) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    const capX = x + Math.cos(dir) * 6;
    const capY = y + Math.sin(dir) * 6;
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(capX, capY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    if (!face) return;
    ctx.fillStyle = PALETTE.playerFace;
    ctx.beginPath();
    ctx.arc(x + Math.cos(dir) * 3, y + Math.sin(dir) * 3, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintGuards(state) {
    for (const g of state.guards) {
      const chasing = g.mode === MODE_CHASE;
      paintPerson(g.x, g.y, g.dir, chasing ? PALETTE.guardAlert : PALETTE.guard, PALETTE.guardCap, false);
      // The lantern itself: a warm dot at the root of the cone.
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.dir) * 12, g.y + Math.sin(g.dir) * 12, 3.6, 0, Math.PI * 2);
      ctx.fill();
      if (g.mode === MODE_STARE || g.mode === MODE_INVESTIGATE || g.mode === MODE_SEARCH) {
        txt(ctx, '?', g.x, g.y - 26, 19, PALETTE.gold, 'center', '800');
      } else if (chasing) {
        txt(ctx, '!', g.x, g.y - 26, 20, PALETTE.danger, 'center', '800');
      }
    }
  }

  function paintIntruder(state) {
    const p = state.player;
    ctx.save();
    if (p.inShadow) ctx.globalAlpha = 0.55;
    paintPerson(p.x, p.y, p.dir, PALETTE.player, '#1f5a52', true);
    ctx.restore();
  }

  // A filled bar with a rounded outline, for the detection meter.
  function bar(x, y, w, h, frac, colour) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, x, y, w, h, 8);
    ctx.fill();
    if (frac <= 0) return;
    ctx.fillStyle = colour;
    rr(ctx, x, y, Math.max(16, w * frac), h, 8);
    ctx.fill();
  }

  function paintHud(state) {
    ctx.fillStyle = 'rgba(6, 8, 16, 0.92)';
    ctx.fillRect(0, 0, FIELD.width, HUD_H);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(0, HUD_H - 2, FIELD.width, 2);
    txt(ctx, state.level.name, 20, HUD_H / 2, 18, PALETTE.text, 'left', '700');
    // The detection meter.
    const frac = state.meter;
    const colour = frac > 0.75 ? PALETTE.danger : frac > 0.4 ? '#f2994a' : PALETTE.gold;
    bar(360, HUD_H / 2 - 8, 250, 16, frac, colour);
    const word = state.seenNow ? 'SEEN!' : frac > 0.04 ? 'SUSPICIOUS' : 'HIDDEN';
    const wordColour = state.seenNow ? PALETTE.danger : frac > 0.04 ? '#f2994a' : PALETTE.good;
    txt(ctx, word, 360 + 250 + 16, HUD_H / 2, 15, wordColour, 'left', '800');
    const got = state.moths.filter((m) => m.got).length;
    txt(ctx, `MOTHS ${got}/${state.moths.length}`, 830, HUD_H / 2, 15, PALETTE.moth, 'left', '700');
    txt(ctx, `${Math.floor(state.time)}s`, 990, HUD_H / 2, 15, PALETTE.muted, 'left', '600');
    txt(ctx, `SCORE ${state.score}`, 1260, HUD_H / 2, 17, PALETTE.gold, 'right', '800');
  }

  function paintNote(state) {
    if (state.message && state.messageTime > 0 && state.screen === 'play') {
      txt(ctx, state.message, FIELD.width / 2, FIELD.height - 18, 16, PALETTE.text, 'center', '700');
    }
  }

  // A red pulse at the frame's edge while the meter is past halfway.
  function paintDanger(state) {
    if (state.meter <= 0.55 || state.screen !== 'play') return;
    const a = 0.12 + 0.1 * Math.sin(state.time * 9);
    const g = ctx.createRadialGradient(640, 390, 320, 640, 390, 720);
    g.addColorStop(0, 'rgba(229, 83, 75, 0)');
    g.addColorStop(1, `rgba(229, 83, 75, ${a + 0.12})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, HUD_H, FIELD.width, FIELD.height - HUD_H);
  }

  function veil(alpha) {
    ctx.fillStyle = `rgba(5, 7, 14, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  // A menu button. Records its rectangle in `hot` so clicks can find it.
  function paintButton(id, label, x, y, w, h, primary) {
    ctx.fillStyle = primary ? PALETTE.gold : 'rgba(255,255,255,0.1)';
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
    if (!primary) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      rr(ctx, x, y, w, h, 10);
      ctx.stroke();
    }
    txt(ctx, label, x + w / 2, y + h / 2 + 1, 18, primary ? '#241d05' : PALETTE.text, 'center', '800');
    hot[id] = { x, y, w, h };
  }

  function showTitle(best) {
    veil(0.5);
    rows([
      ['MOONLIT ESTATE', 208, 58, PALETTE.text, 'center', '800'],
      ['Cross five gardens in the dark. Reach the gate unseen.', 254, 20, PALETTE.gold, 'center', '600'],
      ['Gardeners patrol with lanterns — the lit cone is what they see. Hedges, walls and', 306, 16, PALETTE.text, 'center', '500'],
      ['fountains block the light; shadow pools slow their suspicion. Walking is heard:', 330, 16, PALETTE.text, 'center', '500'],
      ['hold Shift to tiptoe. A filled eye-meter, or a gardener\u2019s hand, ends the attempt.', 354, 16, PALETTE.text, 'center', '500'],
      ['Move with WASD or the arrow keys. Catch moon moths for score. Slip away after a', 386, 15, PALETTE.muted, 'center', '500'],
      ['near miss and the garden pays you for the story.', 408, 15, PALETTE.muted, 'center', '500'],
    ]);
    paintButton('start', 'BEGIN THE CROSSING', FIELD.width / 2 - 130, 442, 260, 54, true);
    if (best > 0) txt(ctx, `Best score: ${best}`, FIELD.width / 2, 532, 15, PALETTE.muted, 'center', '600');
  }

  function showClear(state) {
    veil(0.55);
    rows([
      ['THROUGH!', 262, 44, PALETTE.good, 'center', '800'],
      [`${state.level.name} crossed in ${Math.floor(state.time)}s — garden score ${state.levelScore}`, 312, 18, PALETTE.text, 'center', '600'],
      [state.seenEver ? 'You were seen, but never held. The gate forgets.' : 'Never seen at all — ghost bonus paid.', 344, 16, PALETTE.muted, 'center', '500'],
    ]);
    const last = state.levelIndex >= LEVELS.length - 1;
    paintButton('next', last ? 'SEE THE RESULT' : 'NEXT GARDEN', FIELD.width / 2 - 110, 388, 220, 52, true);
  }

  function showCaught(state) {
    veil(0.6);
    rows([
      ['CAUGHT', 258, 48, PALETTE.danger, 'center', '800'],
      [`${state.level.name} — ${state.caughtBy}.`, 308, 18, PALETTE.text, 'center', '600'],
      [`The attempt costs ${100} points. The patrols reset; the garden remembers nothing.`, 340, 15, PALETTE.muted, 'center', '500'],
    ]);
    paintButton('retry', 'TRY THE GARDEN AGAIN', FIELD.width / 2 - 130, 384, 260, 52, true);
  }

  function showVictory(state, best) {
    veil(0.55);
    rows([
      ['OUT INTO THE NIGHT', 236, 44, PALETTE.gold, 'center', '800'],
      [`Final score ${state.score}${state.score >= best ? ' — a new best!' : ''}`, 288, 22, PALETTE.text, 'center', '700'],
      [`${state.mothsTotal} moon moths — ${state.nearMisses} near misses — ${Math.floor(state.totalTime)}s across five gardens`, 326, 16, PALETTE.muted, 'center', '500'],
    ]);
    paintButton('retry', 'CROSS AGAIN', FIELD.width / 2 - 100, 372, 200, 52, true);
  }

  function showPaused() {
    veil(0.6);
    rows([
      ['PAUSED', 300, 42, PALETTE.text, 'center', '800'],
      ['P or Esc to slip back into the dark', 346, 16, PALETTE.muted, 'center', '500'],
    ]);
    paintButton('resume', 'RESUME', FIELD.width / 2 - 90, 380, 180, 50, true);
  }

  function draw(state, best, t) {
    for (const key of Object.keys(hot)) delete hot[key];
    paintGround(state);
    paintShade(state);
    paintWalls(state, t);
    paintGate(state, t);
    paintMoths(state, t);
    paintCones(state);
    paintRipples(state);
    paintHush(state);
    paintGuards(state);
    paintIntruder(state);
    paintDanger(state);
    paintHud(state);
    paintNote(state);
    if (state.screen === SCREEN_TITLE) showTitle(best);
    else if (state.screen === SCREEN_CLEAR) showClear(state);
    else if (state.screen === SCREEN_CAUGHT) showCaught(state);
    else if (state.screen === SCREEN_VICTORY) showVictory(state, best);
    else if (state.screen === SCREEN_PAUSED) showPaused();
  }

  return { draw, hot };
}
