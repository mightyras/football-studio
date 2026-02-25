import type { Player, PitchTransform } from '../types';
import { THEME } from '../constants/colors';

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (num & 0xff) * (1 - amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount);
  const b = Math.min(255, (num & 0xff) + (255 - (num & 0xff)) * amount);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function getContrastTextColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

/** Parse any CSS color string to hex for contrast/lighten/darken functions */
function toHex(color: string): string {
  if (color.startsWith('#')) return color;
  // For rgb() values from darken/lighten, parse them
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  return color;
}

/** Parse a CSS color to {r, g, b} 0–255 */
function parseRGB(color: string): { r: number; g: number; b: number } {
  const hex = toHex(color).replace('#', '');
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  player: Player,
  teamColor: string,
  isSelected: boolean,
  isHovered: boolean,
  playerRadius: number,
  showOrientation: boolean,
  _isOutOfPossession: boolean,
  isCmdHeld: boolean,
  outlineColor: string,
  labelAbove: boolean,
  showName: boolean,
  accent: string = THEME.accent,
  isNotchHovered: boolean = false,
  isFormationHighlighted: boolean = false,
  isFormationDimmed: boolean = false,
  logoImage?: HTMLImageElement,
) {
  const pos = transform.worldToScreen(player.x, player.y);
  let radius = playerRadius * transform.scale;

  // Enlarge player when CMD is held and hovering (rotate mode affordance)
  if (isCmdHeld && isHovered) {
    radius *= 1.4;
  }
  const isGK = !!player.isGK;

  ctx.save();

  // Dim GK during formation-move to show they won't be moved
  if (isFormationDimmed) {
    ctx.globalAlpha = 0.4;
  }

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // ── Outer ring with subtle gradient ──
  const ringRadius = radius + 2;
  const ringColor = isSelected ? accent : outlineColor;
  const ringRGB = parseRGB(ringColor);
  const outerRingGrad = ctx.createRadialGradient(
    pos.x - ringRadius * 0.2, pos.y - ringRadius * 0.2, ringRadius * 0.1,
    pos.x, pos.y, ringRadius,
  );
  outerRingGrad.addColorStop(0, `rgb(${Math.min(255, ringRGB.r + 30)}, ${Math.min(255, ringRGB.g + 30)}, ${Math.min(255, ringRGB.b + 30)})`);
  outerRingGrad.addColorStop(1, `rgb(${ringRGB.r}, ${ringRGB.g}, ${ringRGB.b})`);

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
  ctx.fillStyle = outerRingGrad;
  ctx.fill();

  // Reset shadow for inner
  ctx.shadowColor = 'transparent';

  // ── Inner fill — 3D radial gradient ──
  const baseColor = isGK ? lighten(teamColor, 0.4) : teamColor;
  const baseRGB = parseRGB(baseColor);
  const highlightColor = `rgb(${Math.min(255, baseRGB.r + 50)}, ${Math.min(255, baseRGB.g + 50)}, ${Math.min(255, baseRGB.b + 50)})`;
  const shadowColor = darken(toHex(baseColor), 0.2);

  const bodyGrad = ctx.createRadialGradient(
    pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.05,
    pos.x, pos.y, radius,
  );
  bodyGrad.addColorStop(0, highlightColor);
  bodyGrad.addColorStop(0.7, baseColor);
  bodyGrad.addColorStop(1, shadowColor);

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // ── Team logo (under lacquer) ──
  if (logoImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.clip();

    // Draw logo zoomed in to fill the marker (clipped to circle)
    const logoSize = radius * 2.5;
    const aspect = logoImage.width / logoImage.height;
    const lw = aspect >= 1 ? logoSize : logoSize * aspect;
    const lh = aspect >= 1 ? logoSize / aspect : logoSize;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(logoImage, pos.x - lw / 2, pos.y - lh / 2, lw, lh);

    // Team color tint overlay — blend logo with team color for lacquer effect
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── GK horizontal band (with gradient blend) ──
  if (isGK) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.clip();

    const bandHeight = radius * 0.4;
    const bandGrad = ctx.createLinearGradient(
      pos.x - radius, pos.y - bandHeight / 2,
      pos.x - radius, pos.y + bandHeight / 2,
    );
    const bandColor = darken(teamColor, 0.15);
    const bandRGB = parseRGB(bandColor);
    bandGrad.addColorStop(0, `rgba(${bandRGB.r}, ${bandRGB.g}, ${bandRGB.b}, 0.6)`);
    bandGrad.addColorStop(0.5, `rgba(${bandRGB.r}, ${bandRGB.g}, ${bandRGB.b}, 0.8)`);
    bandGrad.addColorStop(1, `rgba(${bandRGB.r}, ${bandRGB.g}, ${bandRGB.b}, 0.6)`);
    ctx.fillStyle = bandGrad;
    ctx.fillRect(pos.x - radius, pos.y - bandHeight / 2, radius * 2, bandHeight);
    ctx.restore();
  }

  // ── Specular highlight (glossy shine) ──
  const shine = ctx.createRadialGradient(
    pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.05,
    pos.x, pos.y, radius,
  );
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  shine.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
  shine.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  // ── Rim/edge darkening ──
  const rimGrad = ctx.createRadialGradient(
    pos.x, pos.y, radius * 0.7,
    pos.x, pos.y, radius,
  );
  rimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rimGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0)');
  rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // ── Orientation notch ──
  if (showOrientation) {
    // World-to-screen angle: offset depends on pitch rotation
    const screenAngle = (Math.PI / 2 - transform.rotation) - player.facing;
    const notchLength = radius * 0.55 * (isNotchHovered ? 1.2 : 1.0);
    const notchHalfWidth = Math.PI * 0.14; // ~28° total arc

    const tipX = pos.x + Math.cos(screenAngle) * (radius + notchLength);
    const tipY = pos.y + Math.sin(screenAngle) * (radius + notchLength);
    const baseLeftX = pos.x + Math.cos(screenAngle - notchHalfWidth) * (radius + 1);
    const baseLeftY = pos.y + Math.sin(screenAngle - notchHalfWidth) * (radius + 1);
    const baseRightX = pos.x + Math.cos(screenAngle + notchHalfWidth) * (radius + 1);
    const baseRightY = pos.y + Math.sin(screenAngle + notchHalfWidth) * (radius + 1);

    ctx.beginPath();
    ctx.moveTo(baseLeftX, baseLeftY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseRightX, baseRightY);
    ctx.closePath();

    // High-contrast fill: accent when hovered or selected, white otherwise
    const accentRGB = parseRGB(accent);
    if (isNotchHovered || isSelected) {
      ctx.fillStyle = `rgba(${accentRGB.r}, ${accentRGB.g}, ${accentRGB.b}, 0.95)`;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    }
    ctx.fill();

    // Outline stroke: brighter + thicker when hovered
    if (isNotchHovered) {
      ctx.strokeStyle = `rgba(${accentRGB.r}, ${accentRGB.g}, ${accentRGB.b}, 0.8)`;
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = isSelected ? 'rgba(180, 100, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 1;
    }
    ctx.stroke();
  }

  // ── Number — contrast-aware text with outline stroke ──
  const fillColor = baseColor;
  const textColor = getContrastTextColor(toHex(fillColor));
  const numberStr = player.number.toString();
  const numberFont = `bold ${Math.max(10, radius * 0.85)}px Inter, system-ui, sans-serif`;

  ctx.save();
  ctx.font = numberFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Outline stroke — contrasting colour to make the number pop
  const textOutlineColor = textColor === '#ffffff' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.45)';
  ctx.strokeStyle = textOutlineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.strokeText(numberStr, pos.x, pos.y + 0.5);

  // Fill on top
  ctx.fillStyle = textColor;
  ctx.fillText(numberStr, pos.x, pos.y + 0.5);
  ctx.restore();

  // Hover ring
  if (isHovered && !isSelected) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Selected pulse ring
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2);
    const pulseRGB = parseRGB(accent);
    ctx.strokeStyle = `rgba(${pulseRGB.r}, ${pulseRGB.g}, ${pulseRGB.b}, 0.5)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Formation-move highlight ring (team color, subtle)
  if (isFormationHighlighted && !isSelected) {
    const fRGB = parseRGB(teamColor);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${fRGB.r}, ${fRGB.g}, ${fRGB.b}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Name label (above or below token depending on attack direction)
  if (showName && player.name) {
    const fontSize = Math.max(9, radius * 0.6);
    ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const textWidth = ctx.measureText(player.name).width;
    const px = 3;
    const py = 1;

    let labelY: number;
    if (labelAbove) {
      ctx.textBaseline = 'bottom';
      labelY = pos.y - radius - radius * 0.3 - 4;
      // Background pill
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(pos.x - textWidth / 2 - px, labelY - fontSize - py, textWidth + px * 2, fontSize + py * 2, 3);
      ctx.fill();
    } else {
      ctx.textBaseline = 'top';
      labelY = pos.y + radius + radius * 0.3 + 4;
      // Background pill
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(pos.x - textWidth / 2 - px, labelY - py, textWidth + px * 2, fontSize + py * 2, 3);
      ctx.fill();
    }

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(player.name, pos.x, labelY);
  }

  ctx.restore();
}

export function drawCoverShadow(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  player: Player,
  _teamColor: string,
  playerRadius: number,
) {
  const pos = transform.worldToScreen(player.x, player.y);

  // Cover shadow extends BEHIND the player (opposite of facing direction)
  const screenAngle = (Math.PI / 2 - transform.rotation) - player.facing + Math.PI;

  // Start the cone from the player's outer edge, not the center
  const radius = playerRadius * transform.scale + 2; // match ring radius
  const coneLength = 10 * transform.scale;
  const baseHalfAngle = Math.PI / 4;   // ±45° at player edge (wide start)
  const tipHalfAngle = Math.PI / 10;   // ±18° at far end (narrowing tip)

  // Cone origin is the player center — we'll clip out the player disc
  const coneOriginX = pos.x;
  const coneOriginY = pos.y;

  // Near edge points (wide base at player edge)
  const nearLeftX = coneOriginX + Math.cos(screenAngle - baseHalfAngle) * radius;
  const nearLeftY = coneOriginY + Math.sin(screenAngle - baseHalfAngle) * radius;
  const nearRightX = coneOriginX + Math.cos(screenAngle + baseHalfAngle) * radius;
  const nearRightY = coneOriginY + Math.sin(screenAngle + baseHalfAngle) * radius;

  // Far edge points (narrower tip)
  const farDist = radius + coneLength;
  const farLeftX = coneOriginX + Math.cos(screenAngle - tipHalfAngle) * farDist;
  const farLeftY = coneOriginY + Math.sin(screenAngle - tipHalfAngle) * farDist;
  const farRightX = coneOriginX + Math.cos(screenAngle + tipHalfAngle) * farDist;
  const farRightY = coneOriginY + Math.sin(screenAngle + tipHalfAngle) * farDist;

  ctx.save();

  // Clip: exclude the player disc so the cone never overlaps the player
  ctx.beginPath();
  // Large rectangle covering everything
  ctx.rect(pos.x - farDist - 10, pos.y - farDist - 10, (farDist + 10) * 2, (farDist + 10) * 2);
  // Cut out the player disc (counter-clockwise = hole)
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2, true);
  ctx.clip('evenodd');

  // Gradient from player edge outward
  const gradStartX = pos.x + Math.cos(screenAngle) * radius;
  const gradStartY = pos.y + Math.sin(screenAngle) * radius;
  const gradEndX = pos.x + Math.cos(screenAngle) * farDist;
  const gradEndY = pos.y + Math.sin(screenAngle) * farDist;

  const gradient = ctx.createLinearGradient(gradStartX, gradStartY, gradEndX, gradEndY);
  gradient.addColorStop(0, `rgba(0, 0, 0, 0.28)`);
  gradient.addColorStop(0.3, `rgba(0, 0, 0, 0.16)`);
  gradient.addColorStop(0.7, `rgba(0, 0, 0, 0.06)`);
  gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

  // Draw the trapezoid shape: wide base at player → narrower tip at far end
  ctx.beginPath();
  ctx.moveTo(nearLeftX, nearLeftY);
  ctx.lineTo(farLeftX, farLeftY);
  ctx.lineTo(farRightX, farRightY);
  ctx.lineTo(nearRightX, nearRightY);
  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.restore();
}

export function drawFOV(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  player: Player,
  _teamColor: string,
  playerRadius: number,
  expanded: boolean,
) {
  const pos = transform.worldToScreen(player.x, player.y);

  // Same angle formula as orientation notch (facing direction, NOT +PI like cover shadow)
  const screenAngle = (Math.PI / 2 - transform.rotation) - player.facing;

  const radius = playerRadius * transform.scale + 2; // match ring radius

  // ── Expanded peripheral cone (motion detection ~200° total, 100° each side) ──
  if (expanded) {
    const periHalfAngle = (100 * Math.PI) / 180; // 100° each side
    const periLength = 8 * transform.scale;       // shorter than focused cone
    const periFarDist = radius + periLength;

    ctx.save();

    // Clip out player disc
    ctx.beginPath();
    ctx.rect(pos.x - periFarDist - 10, pos.y - periFarDist - 10, (periFarDist + 10) * 2, (periFarDist + 10) * 2);
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2, true);
    ctx.clip('evenodd');

    // Very subtle radial gradient
    const periGrad = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, periFarDist);
    periGrad.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
    periGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.045)');
    periGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, screenAngle - periHalfAngle, screenAngle + periHalfAngle);
    ctx.arc(pos.x, pos.y, periFarDist, screenAngle + periHalfAngle, screenAngle - periHalfAngle, true);
    ctx.closePath();

    ctx.fillStyle = periGrad;
    ctx.fill();

    ctx.restore();
  }

  // ── Focused cone (tactical, 60° total, 30° each side) ──
  const coneLength = 7 * transform.scale;
  const halfAngle = Math.PI / 6; // 30° each side = 60° total
  const farDist = radius + coneLength;

  ctx.save();

  // Clip out player disc (same pattern as cover shadow)
  ctx.beginPath();
  ctx.rect(pos.x - farDist - 10, pos.y - farDist - 10, (farDist + 10) * 2, (farDist + 10) * 2);
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2, true);
  ctx.clip('evenodd');

  // Radial gradient — fades from translucent white to transparent
  const gradient = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, farDist);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.13)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.07)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  // Pie/wedge shape (circular arc, not trapezoid — visually distinct from cover shadow)
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, screenAngle - halfAngle, screenAngle + halfAngle);
  ctx.arc(pos.x, pos.y, farDist, screenAngle + halfAngle, screenAngle - halfAngle, true);
  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.restore();
}

export function getPlayerScreenRadius(transform: PitchTransform, playerRadius: number): number {
  return playerRadius * transform.scale + 2;
}
