import type { BallState, PitchTransform } from '../types';
import { THEME } from '../constants/colors';

// ─── Vec3 Math Utilities ─────────────────────────────────────────────────────

type Vec3 = [number, number, number];

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

/** Compute the outward-facing normal of a polygon from its vertices. */
function faceNormal(vertices: Vec3[], center: Vec3): Vec3 {
  // Average cross products of consecutive edges for robustness
  let nx = 0, ny = 0, nz = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const c = vertices[(i + 2) % n];
    const e1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2: Vec3 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const cr = cross(e1, e2);
    nx += cr[0]; ny += cr[1]; nz += cr[2];
  }
  const normal = normalize([nx, ny, nz]);
  // Ensure normal points outward (same direction as center)
  if (dot(normal, center) < 0) {
    return [-normal[0], -normal[1], -normal[2]];
  }
  return normal;
}

// ─── Truncated Icosahedron Geometry ──────────────────────────────────────────

interface PentagonFace {
  center: Vec3;
  vertices: Vec3[];
}

function buildPentagonFaces(): PentagonFace[] {
  const PHI = (1 + Math.sqrt(5)) / 2;

  // Generate all 60 vertices of a truncated icosahedron.
  // They come from even permutations of three coordinate families:
  //   (0, ±1, ±3φ), (±2, ±(1+2φ), ±φ), (±1, ±(2+φ), ±2φ)
  const rawVerts: Vec3[] = [];

  const families: [number, number, number][] = [
    [0, 1, 3 * PHI],
    [2, 1 + 2 * PHI, PHI],
    [1, 2 + PHI, 2 * PHI],
  ];

  for (const [a, b, c] of families) {
    // Even permutations: (a,b,c), (c,a,b), (b,c,a)
    const perms: [number, number, number][] = [
      [a, b, c],
      [c, a, b],
      [b, c, a],
    ];

    for (const [p, q, r] of perms) {
      // All sign combinations
      const signs = [1, -1];
      for (const sp of signs) {
        if (p === 0 && sp === -1) continue; // avoid duplicate ±0
        for (const sq of signs) {
          for (const sr of signs) {
            rawVerts.push(normalize([p * sp, q * sq, r * sr]));
          }
        }
      }
    }
  }

  // Deduplicate vertices (within epsilon)
  const EPS = 0.001;
  const uniqueVerts: Vec3[] = [];
  for (const v of rawVerts) {
    const isDup = uniqueVerts.some(
      u => Math.abs(u[0] - v[0]) < EPS && Math.abs(u[1] - v[1]) < EPS && Math.abs(u[2] - v[2]) < EPS,
    );
    if (!isDup) uniqueVerts.push(v);
  }

  // 12 icosahedron vertices = pentagon centers
  const pentCenters: Vec3[] = [
    [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
    [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
  ].map(v => normalize(v as Vec3));

  // For each pentagon center, find the 5 nearest truncated-icosahedron vertices
  return pentCenters.map(center => {
    const sorted = [...uniqueVerts].sort((a, b) => dot(center, b) - dot(center, a));
    const verts = sorted.slice(0, 5);

    // Sort vertices by angle around center for correct winding order
    // Build a local tangent frame at center
    const ref: Vec3 = Math.abs(center[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const localX = normalize(cross(center, ref));
    const localY = cross(center, localX);

    verts.sort((a, b) => {
      const angleA = Math.atan2(dot(a, localY), dot(a, localX));
      const angleB = Math.atan2(dot(b, localY), dot(b, localX));
      return angleA - angleB;
    });

    return { center, vertices: verts };
  });
}

/** Precomputed at module load — 12 pentagon faces on the unit sphere. */
const PENTAGON_FACES = buildPentagonFaces();

// ─── 3D Spherical Pattern Renderer ──────────────────────────────────────────

const LIGHT_DIR = normalize([0.3, -0.4, 1]);

function drawSphericalPattern(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  screenRadius: number,
  rotationX: number,
  rotationY: number,
) {
  // Collect visible faces after rotation
  const visibleFaces: {
    rotatedCenter: Vec3;
    rotatedVerts: Vec3[];
    normal: Vec3;
  }[] = [];

  for (const face of PENTAGON_FACES) {
    // Apply rotation: X-axis for vertical screen movement, Y-axis for horizontal
    const rotatedCenter = rotateY(rotateX(face.center, -rotationX), rotationY);
    const rotatedVerts = face.vertices.map(v => rotateY(rotateX(v, -rotationX), rotationY));

    // Compute face normal from rotated vertices
    const normal = faceNormal(rotatedVerts, rotatedCenter);

    // Backface culling: skip faces pointing away from viewer (viewer at +Z)
    if (normal[2] <= 0.05) continue;

    visibleFaces.push({ rotatedCenter, rotatedVerts, normal });
  }

  // Sort by depth: draw furthest (smallest Z) first (painter's algorithm)
  visibleFaces.sort((a, b) => a.rotatedCenter[2] - b.rotatedCenter[2]);

  // Draw each visible pentagon
  for (const { rotatedVerts, normal } of visibleFaces) {
    // Project vertices to screen (orthographic)
    const screenVerts = rotatedVerts.map(v => ({
      x: cx + v[0] * screenRadius,
      y: cy + v[1] * screenRadius,
    }));

    // Shading based on light direction
    const brightness = dot(normal, LIGHT_DIR);
    const shade = Math.round((0.12 + Math.max(0, brightness) * 0.38) * 255);

    // Fill pentagon
    ctx.beginPath();
    ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
    for (let i = 1; i < screenVerts.length; i++) {
      ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fill();

    // Seam line (subtle, stronger when facing viewer)
    const seamAlpha = 0.08 + 0.17 * Math.max(0, normal[2]);
    ctx.strokeStyle = `rgba(0, 0, 0, ${seamAlpha.toFixed(2)})`;
    ctx.lineWidth = Math.max(0.5, screenRadius * 0.03);
    ctx.stroke();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Exported API ───────────────────────────────────────────────────────────

export function getBallScreenRadius(transform: PitchTransform, ball: BallState): number {
  return ball.radius * transform.scale;
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  ball: BallState,
  isSelected: boolean,
  isHovered: boolean,
  accent: string = THEME.accent,
) {
  const pos = transform.worldToScreen(ball.x, ball.y);
  const screenRadius = getBallScreenRadius(transform, ball);

  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // White ball base
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, screenRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Clear shadow for remaining draws
  ctx.shadowColor = 'transparent';

  // 3D pentagon pattern (only if large enough to be legible)
  if (screenRadius >= 6) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, screenRadius, 0, Math.PI * 2);
    ctx.clip();
    drawSphericalPattern(ctx, pos.x, pos.y, screenRadius, ball.rotationX, ball.rotationY);
    ctx.restore();
  }

  // Ball outline
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, screenRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = Math.max(1, screenRadius * 0.05);
  ctx.stroke();

  // Subtle shine highlight
  const gradient = ctx.createRadialGradient(
    pos.x - screenRadius * 0.25,
    pos.y - screenRadius * 0.3,
    screenRadius * 0.05,
    pos.x,
    pos.y,
    screenRadius,
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, screenRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Hover ring
  if (isHovered && !isSelected) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, screenRadius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Selected ring (amber, matching player convention)
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, screenRadius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(accent, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}
