// Sight and movement geometry. A blocker is one of two shapes — a
// rectangle (hedge or wall, with x, y, w, h) or a circle (fountain, with
// x, y, r) — and everything in this file works on those two shapes only:
//
//   * whether a straight sightline crosses a blocker,
//   * whether a gardener can see a point,
//   * the lit shape of a lantern cone,
//   * how a round body slides around the garden's obstacles.

// The sightline from (ax, ay) to (bx, by) meets a rectangle when the two
// axes' crossing intervals overlap. Each axis is handled on its own: the
// segment's parameter t runs from 0 at the start to 1 at the end, and the
// rectangle clips that range once per axis.
function crossesRect(ax, ay, bx, by, rect) {
  let tMin = 0;
  let tMax = 1;
  const dx = bx - ax;
  const dy = by - ay;
  // X axis: the segment enters the rectangle's x-span at one t and leaves
  // it at another; a parallel segment outside the span misses outright.
  if (dx === 0) {
    if (ax < rect.x || ax > rect.x + rect.w) return false;
  } else {
    let a = (rect.x - ax) / dx;
    let b = (rect.x + rect.w - ax) / dx;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > tMin) tMin = a;
    if (b < tMax) tMax = b;
    if (tMin > tMax) return false;
  }
  // Y axis: same clipping against the rectangle's y-span.
  if (dy === 0) {
    if (ay < rect.y || ay > rect.y + rect.h) return false;
  } else {
    let a = (rect.y - ay) / dy;
    let b = (rect.y + rect.h - ay) / dy;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > tMin) tMin = a;
    if (b < tMax) tMax = b;
    if (tMin > tMax) return false;
  }
  return true;
}

// The sightline meets a circle when the closest point on the segment to
// the centre falls inside the radius.
function crossesCircle(ax, ay, bx, by, circle) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((circle.x - ax) * dx + (circle.y - ay) * dy) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const px = ax + dx * t - circle.x;
  const py = ay + dy * t - circle.y;
  return px * px + py * py <= circle.r * circle.r;
}

export function segmentBlocked(ax, ay, bx, by, blockers) {
  for (const b of blockers) {
    const hit = b.kind === 'fountain'
      ? crossesCircle(ax, ay, bx, by, b)
      : crossesRect(ax, ay, bx, by, b);
    if (hit) return true;
  }
  return false;
}

// The smallest signed turn from angle a to angle b, wrapped to (-PI, PI].
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Can this guard see the point (tx, ty)? The point must be inside the
// lantern's range and inside the cone — unless it is very close, because
// a gardener notices someone breathing down his neck — and no blocker may
// stand between them. Answers the distance, or -1 when the point stays
// hidden.
export function canSee(guard, tx, ty, blockers, range, halfAngle) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > range) return -1;
  if (dist > 26) {
    const facing = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(facing, guard.dir)) > halfAngle) return -1;
  }
  return segmentBlocked(guard.x, guard.y, tx, ty, blockers) ? -1 : dist;
}

export function pointInBlocker(x, y, blockers) {
  for (const b of blockers) {
    if (b.kind === 'fountain') {
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) return true;
    } else if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return true;
    }
  }
  return false;
}

// The ground a lantern actually lights: a fan of rays from the guard,
// each one stepping outward 8 pixels at a time until it meets a blocker
// or runs out of range. The corners come back in field coordinates,
// starting at the guard himself.
export function conePolygon(guard, blockers, range, halfAngle) {
  const corners = [[guard.x, guard.y]];
  const rays = 26;
  let i = 0;
  while (i <= rays) {
    const ang = guard.dir - halfAngle + (2 * halfAngle * i) / rays;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    let reach = range;
    let s = 8;
    while (s <= range) {
      if (pointInBlocker(guard.x + ux * s, guard.y + uy * s, blockers)) {
        reach = s - 4;
        break;
      }
      s += 8;
    }
    corners.push([guard.x + ux * reach, guard.y + uy * reach]);
    i += 1;
  }
  return corners;
}

// Would a circle of this radius, centred here, overlap any blocker? The
// rectangle case clamps the centre to the rectangle's nearest point.
function circleOverlaps(x, y, radius, blockers) {
  for (const b of blockers) {
    if (b.kind === 'fountain') {
      const dx = x - b.x;
      const dy = y - b.y;
      const rr = radius + b.r;
      if (dx * dx + dy * dy < rr * rr) return true;
    } else {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

// Slide a round body by (dx, dy): one axis at a time, so it glides along
// a hedge instead of sticking to it, and never leaves the garden bounds.
export function moveCircle(e, dx, dy, blockers, bounds, radius) {
  const tryX = e.x + dx;
  if (dx !== 0 && !circleOverlaps(tryX, e.y, radius, blockers)) e.x = tryX;
  const tryY = e.y + dy;
  if (dy !== 0 && !circleOverlaps(e.x, tryY, radius, blockers)) e.y = tryY;
  const minX = bounds.x + radius;
  const maxX = bounds.x + bounds.w - radius;
  const minY = bounds.y + radius;
  const maxY = bounds.y + bounds.h - radius;
  if (e.x < minX) e.x = minX;
  else if (e.x > maxX) e.x = maxX;
  if (e.y < minY) e.y = minY;
  else if (e.y > maxY) e.y = maxY;
}
