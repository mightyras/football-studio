import type { AppState, GoalCelebration, GhostPlayer, PitchTransform, RunAnimationOverlay } from '../types';
import { PITCH } from '../constants/pitch';
import { THEME } from '../constants/colors';
import { renderPitch, renderGoalNetRipple } from './PitchRenderer';
import { drawBall } from './BallRenderer';
import { drawPlayer, drawCoverShadow, drawFOV } from './PlayerRenderer';
import { renderBenches } from './BenchRenderer';
import { renderZoneOverlay } from './ZoneOverlayRenderer';
import { renderAnnotationsBase, renderAnnotationsText, renderSnapIndicators, renderDrawingPreview } from './AnnotationRenderer';
import { computeStepOrder, type LineAnnotation } from '../animation/annotationAnimator';

// ── Logo watermark (cached Image for performance) ──

let cachedLogoUrl: string | null = null;
let cachedLogoImg: HTMLImageElement | null = null;

function getLogoImage(dataUrl: string): HTMLImageElement | null {
  if (dataUrl === cachedLogoUrl && cachedLogoImg?.complete) {
    return cachedLogoImg;
  }
  // Start loading (will be ready next frame)
  if (dataUrl !== cachedLogoUrl) {
    cachedLogoUrl = dataUrl;
    cachedLogoImg = new Image();
    cachedLogoImg.src = dataUrl;
  }
  return cachedLogoImg?.complete ? cachedLogoImg : null;
}

// ── Team logo on markers (cached Image for performance) ──

let cachedTeamLogoUrl: string | null = null;
let cachedTeamLogoImg: HTMLImageElement | null = null;

function getTeamLogoImage(url: string): HTMLImageElement | null {
  if (url === cachedTeamLogoUrl && cachedTeamLogoImg?.complete) {
    return cachedTeamLogoImg;
  }
  if (url !== cachedTeamLogoUrl) {
    cachedTeamLogoUrl = url;
    cachedTeamLogoImg = new Image();
    cachedTeamLogoImg.crossOrigin = 'anonymous';
    cachedTeamLogoImg.src = url;
  }
  return cachedTeamLogoImg?.complete ? cachedTeamLogoImg : null;
}

function renderLogoBadge(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  logoDataUrl: string,
) {
  const img = getLogoImage(logoDataUrl);
  if (!img) return;

  // Position in the bottom-right green padding area — fully visible
  const pad = PITCH.padding;
  const logoWorldSize = Math.min(pad * 0.75, 5); // slightly larger than before
  const aspect = img.width / img.height;
  const logoW = (aspect >= 1 ? logoWorldSize : logoWorldSize * aspect) * transform.scale;
  const logoH = (aspect >= 1 ? logoWorldSize / aspect : logoWorldSize) * transform.scale;

  // Place in the bottom-right corner of the green surround
  const anchor = transform.worldToScreen(PITCH.length + pad * 0.5, PITCH.width + pad * 0.5);
  const x = anchor.x - logoW / 2;
  const y = anchor.y - logoH / 2;

  ctx.save();
  // Drop shadow for the logo
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 6 * (transform.scale / 10);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * (transform.scale / 10);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(img, x, y, logoW, logoH);
  ctx.restore();
}

// Ghost fade constants — fast fade so completed-step ghosts don't pile up
const GHOST_HOLD_MS = 200;   // barely visible at full opacity
const GHOST_FADE_MS = 800;   // then fade out quickly

/** Animation context passed from PitchCanvas to control what renders during animation. */
export type AnimContext = {
  /** True when any run/step animation is active or queued. */
  isActive: boolean;
  /** Annotation IDs in the next upcoming step (for filtering preview ghosts). */
  nextStepAnnotationIds?: Set<string>;
};

/** Compute ghost opacity based on elapsed time since fade started. */
function ghostOpacity(baseOpacity: number, createdAt: number, now: number): number {
  if (createdAt <= 0 || !now) return baseOpacity; // fade not started yet
  const elapsed = now - createdAt;
  if (elapsed <= GHOST_HOLD_MS) return baseOpacity;
  const fadeProgress = Math.min(1, (elapsed - GHOST_HOLD_MS) / GHOST_FADE_MS);
  return baseOpacity * (1 - fadeProgress);
}

export function render(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  state: AppState,
  width: number,
  height: number,
  runAnimOverlays?: RunAnimationOverlay[],
  goalCelebration?: GoalCelebration,
  now?: number,
  animContext: AnimContext = { isActive: false },
) {
  ctx.clearRect(0, 0, width, height);

  // Resolve accent color: club identity highlight overrides default theme accent
  const accent = state.clubIdentity.highlightColor || THEME.accent;

  // Resolve board background color
  const bgColor = state.clubIdentity.backgroundColor || THEME.pitchBackground;

  renderPitch(ctx, transform, width, height, state.pitchSettings, bgColor);

  // Goal net ripple effect (during goal celebration)
  if (goalCelebration) {
    renderGoalNetRipple(ctx, transform, goalCelebration, state.pitchSettings.grassColor);
  }

  // Benches — rendered after pitch but before players
  if (state.pitchSettings.stadiumEnabled) {
    renderBenches(
      ctx, transform,
      state.substitutesA, state.substitutesB,
      state.teamAColor, state.teamBColor,
      state.activeBench,
    );
  }

  // Zone overlay — after pitch/benches, before cover shadows and players
  renderZoneOverlay(ctx, transform, state.pitchSettings, accent);

  // Club logo badge — in the green padding area, before players
  if (state.clubIdentity.logoDataUrl) {
    renderLogoBadge(ctx, transform, state.clubIdentity.logoDataUrl);
  }

  const possessionTeam = state.resolvedPossession;
  const outOfPossessionTeam = possessionTeam === 'A' ? 'B' : 'A';

  // Determine which teams have their attack direction pointing toward screen-bottom.
  // If so, place their name labels above the player token instead of below.
  // Team A attacks toward low world-X when teamADirection === 'up', toward high world-X when 'down'.
  // Team B is always opposite.
  const screenOrigin = transform.worldToScreen(0, 0);
  const screenEnd = transform.worldToScreen(1, 0);
  const attackXIncreasesScreenY = screenEnd.y > screenOrigin.y;
  // Team A attacks toward low-X when direction='up', toward high-X when direction='down'
  const teamAAttacksDown = state.teamADirection === 'up'
    ? !attackXIncreasesScreenY  // attacks low-X → screen-down if low-X maps to higher screen-Y
    : attackXIncreasesScreenY;  // attacks high-X → screen-down if high-X maps to higher screen-Y
  const teamBAttacksDown = !teamAAttacksDown;

  // Cover shadow pre-pass (drawn under everything)
  if (state.showCoverShadow) {
    for (const player of state.players) {
      if (player.team === outOfPossessionTeam && !player.isGK) {
        const teamColor = player.team === 'A' ? state.teamAColor : state.teamBColor;
        drawCoverShadow(ctx, transform, player, teamColor, state.playerRadius);
      }
    }
  }

  // FOV pre-pass (drawn below annotations and players)
  if (state.fovMode !== 'off') {
    for (const player of state.players) {
      if (state.fovMode === 'A' && player.team !== 'A') continue;
      if (state.fovMode === 'B' && player.team !== 'B') continue;
      const teamColor = player.team === 'A' ? state.teamAColor : state.teamBColor;
      drawFOV(ctx, transform, player, teamColor, state.playerRadius, state.fovExpanded);
    }
  }

  // Collect all ghost players (state + transient animation ghosts)
  const allGhosts: GhostPlayer[] = [
    ...(state.ghostPlayers || []),
    ...(runAnimOverlays ? runAnimOverlays.map(o => o.ghostPlayer) : []),
  ];

  // Annotations layer 1: lines and polygons (below players).
  // During animation: show only ghost (completed), currently-animating, and next-step lines.
  // Next-step lines act as a preview of what's about to happen.
  {
    // Compute effective animation step order for badges
    const lineAnns = state.annotations.filter(
      (a): a is LineAnnotation =>
        a.type === 'passing-line' || a.type === 'running-line' ||
        a.type === 'curved-run' || a.type === 'dribble-line',
    );
    const effectiveSteps = new Map<string, number>();
    if (lineAnns.length > 0) {
      const stepOrder = computeStepOrder(lineAnns);
      lineAnns.forEach((ann, i) => {
        effectiveSteps.set(ann.id, stepOrder ? stepOrder[i] : (ann.animStep ?? 1));
      });
    }

    // Filter annotations during animation: only ghost (fading) + currently-animating.
    // All other lines (including next step) are hidden until their step plays.
    const visibleAnnotations = animContext.isActive
      ? state.annotations.filter(ann =>
          state.ghostAnnotationIds.includes(ann.id) ||
          runAnimOverlays?.some(o => o.annotationId === ann.id)
        )
      : state.annotations;

    // Hide step badges during animation (the sequence makes the order clear)
    const showSteps = animContext.isActive ? false : state.showStepNumbers;

    renderAnnotationsBase(ctx, transform, visibleAnnotations, state.players, state.selectedAnnotationId, state.playerRadius, accent, state.ghostAnnotationIds, runAnimOverlays, allGhosts, state.previewGhosts ?? [], now, effectiveSteps, showSteps);
  }

  // Ghost players (semi-transparent copies at run origin, below real players)
  if (allGhosts.length) {
    for (const ghost of allGhosts) {
      const opacity = now ? ghostOpacity(0.3, ghost.createdAt, now) : 0.3;
      if (opacity <= 0.001) continue; // fully faded — skip

      ctx.save();
      ctx.globalAlpha = opacity;
      const teamColor = ghost.team === 'A' ? state.teamAColor : state.teamBColor;
      const outlineColor = ghost.team === 'A' ? state.teamAOutlineColor : state.teamBOutlineColor;
      const labelAbove = ghost.team === 'A' ? teamAAttacksDown : teamBAttacksDown;
      drawPlayer(
        ctx,
        transform,
        {
          id: `ghost-${ghost.playerId}`,
          team: ghost.team,
          number: ghost.number,
          name: ghost.name,
          x: ghost.x,
          y: ghost.y,
          facing: ghost.facing,
          isGK: ghost.isGK,
        },
        teamColor,
        false,    // isSelected
        false,    // isHovered
        state.playerRadius,
        false,    // showOrientation
        false,    // isOutOfPossession
        false,    // isCmdHeld
        outlineColor,
        labelAbove,
        false,    // showName — ghosts should not display name labels
        accent,
      );
      ctx.restore();
    }
  }

  // Preview ghosts (semi-transparent at run destination, below real players)
  // Hidden during animation to reduce clutter; shown when building.
  const visiblePreviewGhosts = animContext.isActive
    ? []
    : (state.previewGhosts ?? []);
  if (visiblePreviewGhosts.length) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (const pg of visiblePreviewGhosts) {
      const teamColor = pg.team === 'A' ? state.teamAColor : state.teamBColor;
      const outlineColor = pg.team === 'A' ? state.teamAOutlineColor : state.teamBOutlineColor;
      const labelAbove = pg.team === 'A' ? teamAAttacksDown : teamBAttacksDown;
      drawPlayer(
        ctx,
        transform,
        {
          id: `preview-${pg.sourceAnnotationId}`,
          team: pg.team,
          number: pg.number,
          name: pg.name,
          x: pg.x,
          y: pg.y,
          facing: pg.facing,
          isGK: pg.isGK,
        },
        teamColor,
        false,    // isSelected
        false,    // isHovered
        state.playerRadius,
        false,    // showOrientation
        false,    // isOutOfPossession
        false,    // isCmdHeld
        outlineColor,
        labelAbove,
        false,    // showName — preview ghosts should not display name labels
        accent,
      );
    }
    ctx.restore();
  }

  // Sort players so selected one renders last (on top)
  const sorted = [...state.players].sort((a, b) => {
    if (a.id === state.selectedPlayerId) return 1;
    if (b.id === state.selectedPlayerId) return -1;
    return 0;
  });

  // Resolve team logo image for marker overlay (Team A only)
  const markerLogoSrc = state.showLogoOnMarkers
    ? (state.teamALogoUrl || state.clubIdentity.logoDataUrl || '')
    : '';
  const markerLogoImg = markerLogoSrc
    ? getTeamLogoImage(markerLogoSrc)
    : null;

  for (const player of sorted) {
    const teamColor = player.team === 'A' ? state.teamAColor : state.teamBColor;
    const outlineColor = player.team === 'A' ? state.teamAOutlineColor : state.teamBOutlineColor;
    let labelAbove: boolean;
    if (state.showOrientation) {
      // Place label opposite the orientation notch/FOV direction
      const screenAngle = (Math.PI / 2 - transform.rotation) - player.facing;
      // If notch points upward (sin < 0), label goes below; if downward, label goes above
      labelAbove = Math.sin(screenAngle) >= 0;
    } else {
      // Fallback: team-based positioning when no orientation indicators shown
      labelAbove = player.team === 'A' ? teamAAttacksDown : teamBAttacksDown;
    }
    const showName = player.team === 'A' ? state.showPlayerNamesA : state.showPlayerNamesB;
    // Formation-move visual feedback
    const isFormationHighlighted =
      state.activeTool === 'formation-move'
      && state.formationMoveTeam === player.team
      && !player.isGK;
    const isFormationDimmed = false;

    drawPlayer(
      ctx,
      transform,
      player,
      teamColor,
      player.id === state.selectedPlayerId,
      player.id === state.hoveredPlayerId,
      state.playerRadius,
      state.showOrientation,
      player.team === outOfPossessionTeam,
      state.cmdHeld,
      outlineColor,
      labelAbove,
      showName,
      accent,
      player.id === state.hoveredNotchPlayerId,
      isFormationHighlighted,
      isFormationDimmed,
      player.team === 'A' ? markerLogoImg ?? undefined : undefined,
    );
  }

  // Snap indicators (subtle rings on players connected to lines, above player tokens)
  // Hidden during run animation to reduce visual clutter.
  if (!animContext.isActive) {
    renderSnapIndicators(ctx, transform, state.annotations, state.players, state.playerRadius);
  }

  // Annotations layer 2: text (above players)
  renderAnnotationsText(ctx, transform, state.annotations, state.selectedAnnotationId, accent);

  // Ball renders on top of players
  drawBall(ctx, transform, state.ball, state.ballSelected, state.ballHovered, accent);

  // Drawing preview (topmost layer, above everything)
  if (state.drawingInProgress) {
    const mouseWorld = state.mouseWorldX != null && state.mouseWorldY != null
      ? { x: state.mouseWorldX, y: state.mouseWorldY }
      : null;
    renderDrawingPreview(ctx, transform, state.drawingInProgress, mouseWorld, state.players, state.drawSubTool, state.playerRadius, accent, state.shiftHeld, state.previewGhosts ?? []);
  }
}
