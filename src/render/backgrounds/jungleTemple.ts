/*
 * The jungle's backdrop: flat walls of forest and, rising out of them, an ancient seven-tiered
 * pyramid like Prasat Thom at Koh Ker, its stone broken and cracked, mossy, hung with vines and
 * grown over by trees. Nothing in it moves, so it is drawn once into a cached picture.
 *
 * Drawn in the jungle's scene units: x across from the middle, y up from the water (negative),
 * sized for a 500-unit frame.
 */

// The forest is flat silhouettes, far to near, so its texture never competes with the ball
const FOLIAGE_FAR = '#251a4e';
const FOLIAGE_MIDDLE = '#1e1442';
const FOLIAGE_NEAR = '#170f36';
const FOLIAGE_ON_STONE = '#1a2a40';
const VINE = '#1a2440';
const JADE = '#2dffb3';
const MOSS = 'rgba(45, 255, 179, 0.25)';
const STONE_FACE = '#2e2a52';
const STONE_TOP = '#3e3866';
const STONE_SEAM = '#141030';
const STONE_BROKEN = '#221d42';
const ROOT = '#6f6896';
const MIST_RGB = '183, 155, 255';

/** The pyramid: its foot, its half-widths at the bottom and the top, its height, its tiers. */
export const PYRAMID = { BASE: -8, BASE_HALF: 330, TOP_HALF: 70, HEIGHT: 330, TIERS: 7 } as const;
const TIER = (PYRAMID.HEIGHT * 0.86) / PYRAMID.TIERS;
const SHRINE = { HALF: PYRAMID.TOP_HALF * 0.7, HEIGHT: PYRAMID.HEIGHT * 0.14 } as const;

/** The shrine's doorway on top of the pyramid, which glows from inside with the beat. */
export const SHRINE_DOOR = {
  x: -SHRINE.HALF * 0.25,
  y: PYRAMID.BASE - PYRAMID.TIERS * TIER - SHRINE.HEIGHT * 0.55,
  width: SHRINE.HALF * 0.5,
  height: SHRINE.HEIGHT * 0.55,
} as const;

/** A small seeded PRNG (mulberry32), so the jungle grows the same way on every visit. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adds a leaf to the current path: two curves from the stem to the tip, the tip drooping. */
function leaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  widthShare: number,
  droop: number,
): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tipX = x + dx * length;
  const tipY = y + dy * length + droop * length;
  const midX = x + dx * length * 0.5;
  const midY = y + dy * length * 0.5 + droop * length * 0.15;
  const half = length * widthShare;

  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(midX - dy * half, midY + dx * half, tipX, tipY);
  ctx.quadraticCurveTo(midX + dy * half, midY - dx * half, x, y);
}

/** Adds a clump of leaves fanning out from around (x, y) to the current path. */
function clump(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  x: number,
  y: number,
  size: number,
  count: number,
): void {
  for (let k = 0; k < count; k++) {
    const angle = -Math.PI / 2 + (random() - 0.5) * 3.4;
    const length = size * (0.6 + random() * 0.5);
    leaf(
      ctx,
      x + (random() - 0.5) * size * 0.4,
      y + (random() - 0.5) * size * 0.3,
      angle,
      length,
      0.32,
      0.18,
    );
  }
}

/** Fills and faintly rims the current path. */
function fillRimmed(ctx: CanvasRenderingContext2D, color: string, rim: number): void {
  ctx.fillStyle = color;
  ctx.fill();
  if (rim <= 0) return;
  ctx.save();
  ctx.strokeStyle = JADE;
  ctx.globalAlpha = rim;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
}

/** A flat wall of forest: one silhouette from `top` down to the water, its crowns rounded bumps. */
function canopy(
  ctx: CanvasRenderingContext2D,
  seed: number,
  top: number,
  halfWidth: number,
  color: string,
  rim: number,
): void {
  const random = seeded(seed);
  const left = -halfWidth - 20;
  let y = top + random() * 24;
  ctx.beginPath();
  ctx.moveTo(left, 0);
  ctx.lineTo(left, y);
  for (let x = left; x < halfWidth + 20;) {
    const step = 26 + random() * 34;
    const nextY = top + random() * 24;
    ctx.quadraticCurveTo(x + step / 2, Math.min(y, nextY) - 10 - random() * 16, x + step, nextY);
    x += step;
    y = nextY;
  }
  ctx.lineTo(halfWidth + 20, 0);
  ctx.closePath();
  fillRimmed(ctx, color, rim);
}

/** A band of mist, `top` and `height` in scene units. */
function mist(
  ctx: CanvasRenderingContext2D,
  top: number,
  height: number,
  alpha: number,
  halfWidth: number,
): void {
  const gradient = ctx.createLinearGradient(0, top, 0, top + height);
  gradient.addColorStop(0, `rgba(${MIST_RGB}, 0)`);
  gradient.addColorStop(0.6, `rgba(${MIST_RGB}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${MIST_RGB}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(-halfWidth, top, halfWidth * 2, height);
}

/** Half-width of the pyramid's tier `k`, from 0 at the bottom. */
const halfAt = (k: number) =>
  PYRAMID.BASE_HALF + (PYRAMID.TOP_HALF - PYRAMID.BASE_HALF) * (k / PYRAMID.TIERS);

/**
 * The pyramid: seven tiers, each a wall faced with relief panels under a terrace whose top
 * shows, narrowing to a ruined shrine — every edge chipped, the walls cracked and mossy, vines
 * hanging off every ledge, bushes on the terraces and a tree rooted in the shrine.
 */
function pyramid(ctx: CanvasRenderingContext2D): void {
  const random = seeded(77);
  const { BASE: base, TIERS: tiers } = PYRAMID;
  const ledges: { y: number; half: number }[] = [];

  for (let k = 0; k < tiers; k++) {
    const half = halfAt(k);
    const next = halfAt(k + 1);
    const bottom = base - k * TIER;
    const wallTop = bottom - TIER * 0.72;
    const top = bottom - TIER;
    ledges.push({ y: wallTop, half });

    // The terrace, between this wall and the next tier back
    ctx.beginPath();
    ctx.moveTo(-half, wallTop);
    ctx.lineTo(half, wallTop);
    ctx.lineTo(next, top);
    ctx.lineTo(-next, top);
    ctx.closePath();
    ctx.fillStyle = STONE_TOP;
    ctx.fill();

    // The wall face and its relief panels
    ctx.fillStyle = STONE_FACE;
    ctx.fillRect(-half, wallTop, half * 2, bottom - wallTop);
    ctx.beginPath();
    for (let x = -half + 7; x < half - 3; x += 9) {
      ctx.moveTo(x, wallTop + 3);
      ctx.lineTo(x, bottom - 2);
    }
    ctx.moveTo(-half, bottom - 1);
    ctx.lineTo(half, bottom - 1);
    // Cracks running down the stone
    for (let c = 0; c < 4; c++) {
      let x = (random() * 2 - 1) * half * 0.9;
      let y = wallTop + 2;
      ctx.moveTo(x, y);
      while (y < bottom - 3) {
        x += (random() - 0.5) * 8;
        y += 3 + random() * 5;
        ctx.lineTo(x, Math.min(y, bottom - 3));
      }
    }
    ctx.save();
    ctx.strokeStyle = STONE_SEAM;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Chunks broken out of the ledge and the corners, worn by centuries
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const width = 6 + random() * 10;
      ctx.rect(side > 0 ? half - width : -half, wallTop, width, 4 + random() * 8);
    }
    for (let n = 0; n < 4; n++) {
      const x = (random() * 2 - 1) * (half - 12);
      ctx.moveTo(x, wallTop);
      ctx.lineTo(x + 6 + random() * 10, wallTop);
      ctx.lineTo(x + 3 + random() * 6, wallTop + 3 + random() * 6);
      ctx.closePath();
    }
    ctx.fillStyle = STONE_BROKEN;
    ctx.fill();

    // A faint neon catching the edge of the terrace
    ctx.beginPath();
    ctx.moveTo(-half, wallTop);
    ctx.lineTo(half, wallTop);
    ctx.save();
    ctx.strokeStyle = JADE;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Moss along the ledges and down the walls
  ctx.beginPath();
  for (const { y, half } of ledges) {
    for (let n = 0; n < 18; n++) {
      ctx.rect((random() * 2 - 1) * half, y - 1 + random() * TIER * 0.5, 2 + random() * 6, 1.5);
    }
  }
  ctx.fillStyle = MOSS;
  ctx.fill();

  // The shrine on top, its crown broken off
  const summit = base - tiers * TIER;
  const { HALF: sh, HEIGHT: shH } = SHRINE;
  ctx.beginPath();
  ctx.moveTo(-sh, summit);
  ctx.lineTo(-sh, summit - shH * 0.7);
  ctx.lineTo(-sh * 0.6, summit - shH);
  ctx.lineTo(-sh * 0.2, summit - shH * 0.8);
  ctx.lineTo(sh * 0.1, summit - shH * 1.05);
  ctx.lineTo(sh * 0.5, summit - shH * 0.75);
  ctx.lineTo(sh, summit - shH * 0.85);
  ctx.lineTo(sh, summit);
  ctx.closePath();
  ctx.fillStyle = STONE_FACE;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = JADE;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = STONE_BROKEN;
  ctx.fillRect(SHRINE_DOOR.x, SHRINE_DOOR.y, SHRINE_DOOR.width, SHRINE_DOOR.height);

  // A tree rooted in the shrine, its pale roots pouring down the tiers
  const rootTop = summit - shH * 0.6;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = ROOT;
  for (const [endX, endTier, width] of [
    [-sh * 1.6, 2, 3.5],
    [sh * 1.8, 1, 4],
    [-sh * 0.7, 4, 2.5],
    [sh * 0.9, 3, 2.5],
    [-sh * 2.4, 0, 3],
  ]) {
    const endY = base - endTier * TIER - TIER * 0.3;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(endX > 0 ? 4 : -4, rootTop);
    ctx.quadraticCurveTo(endX * 0.9, rootTop + (endY - rootTop) * 0.25, endX, endY);
    ctx.stroke();
  }
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(sh * 0.3, rootTop + 6);
  ctx.lineTo(sh * 1.1, summit - shH - 6);
  ctx.stroke();
  ctx.restore();

  // Bushes on the terraces, the tree's crown on the shrine, vines off every ledge
  ctx.beginPath();
  for (let k = 0; k < tiers; k++) {
    const half = halfAt(k);
    const y = base - k * TIER - TIER * 0.62;
    for (let n = 0; n < 3; n++) {
      if (random() < 0.3) continue;
      const side = random() < 0.5 ? -1 : 1;
      clump(ctx, random, side * half * (0.25 + random() * 0.7), y, 14 + random() * 10, 7);
    }
  }
  clump(ctx, random, sh * 1.2, summit - shH - 10, 30, 11);
  clump(ctx, random, sh * 0.8, summit - shH, 22, 7);
  clump(ctx, random, sh * 1.6, summit - shH + 4, 22, 7);
  fillRimmed(ctx, FOLIAGE_ON_STONE, 0.3);

  const vines: [x: number, y: number, length: number][] = [];
  for (const { y, half } of ledges) {
    for (let n = 0; n < 9; n++) {
      vines.push([(random() * 2 - 1) * half, y, TIER * (0.3 + random() * 1.3)]);
    }
  }
  ctx.save();
  ctx.strokeStyle = VINE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const [x, y, length] of vines) {
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + (random() - 0.5) * 6,
      y + length / 2,
      x + (random() - 0.5) * 4,
      y + length,
    );
  }
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  for (const [x, y, length] of vines) {
    for (let d = 5; d < length; d += 7) {
      leaf(ctx, x, y + d, Math.PI / 2 + (random() < 0.5 ? 0.9 : -0.9), 4 + random() * 3, 0.45, 0);
    }
  }
  ctx.fillStyle = VINE;
  ctx.fill();

  // Rubble fallen at the foot
  ctx.beginPath();
  for (let n = 0; n < 26; n++) {
    const x = (random() * 2 - 1) * (PYRAMID.BASE_HALF + 30);
    ctx.rect(x, base - 2 - random() * 8, 4 + random() * 8, 3 + random() * 5);
  }
  ctx.fillStyle = STONE_BROKEN;
  ctx.fill();
}

/**
 * The whole backdrop, in scene units: the far forest, the pyramid, and the trees in front of
 * it swallowing its foot, with mist between.
 * @param halfWidth how far the frame reaches either side of the middle, in scene units
 */
export function drawJungleTemple(ctx: CanvasRenderingContext2D, halfWidth: number): void {
  canopy(ctx, 61, -300, halfWidth, FOLIAGE_FAR, 0.12);
  canopy(ctx, 62, -215, halfWidth, FOLIAGE_MIDDLE, 0);
  mist(ctx, -252, 130, 0.18, halfWidth);
  pyramid(ctx);
  canopy(ctx, 67, -64, halfWidth, FOLIAGE_NEAR, 0.25);
  mist(ctx, -70, 70, 0.12, halfWidth);
}
