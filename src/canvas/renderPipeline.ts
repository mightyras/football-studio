import type { AppState, GoalCelebration, GhostPlayer, PitchTransform, RunAnimationOverlay } from '../types';
import { PITCH } from '../constants/pitch';
import { THEME } from '../constants/colors';
import { renderPitch, renderGoalNetRipple } from './PitchRenderer';
import { drawBall } from './BallRenderer';
import { drawPlayer, drawCoverShadow, drawFOV } from './PlayerRenderer';
import { renderBenches } from './BenchRenderer';
import { renderZoneOverlay } from './ZoneOverlayRenderer';
import { renderAnnotationsBase, renderAnnotationsText, renderSnapIndicators, renderDrawingPreview } from './AnnotationRenderer';

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

function renderLogoWatermark(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  logoDataUrl: string,
) {
  const img = getLogoImage(logoDataUrl);
  if (!img) return;

  // Position in the bottom-right green padding area
  const pad = PITCH.padding;
  const logoWorldSize = Math.min(pad * 0.7, 4); // ~4 world units, fits within padding
  const aspect = img.width / img.height;
  const logoW = (aspect >= 1 ? logoWorldSize : logoWorldSize * aspect) * transform.scale;
  const logoH = (aspect >= 1 ? logoWorldSize / aspect : logoWorldSize) * transform.scale;

  // Place in the bottom-right corner of the green surround
  const anchor = transform.worldToScreen(PITCH.length + pad * 0.5, PITCH.width + pad * 0.5);
  const x = anchor.x - logoW / 2;
  const y = anchor.y - logoH / 2;

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.drawImage(img, x, y, logoW, logoH);
  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  transform: PitchTransform,
  state: AppState,
  width: number,
  height: number,
  runAnimOverlay?: RunAnimationOverlay,
  goalCelebration?: GoalCelebration,
) {
  ctx.clearRect(0, 0, width, height);

  // Resolve accent color: club identity overrides default theme accent
  const accent = state.clubIdentity.primaryColor || THEME.accent;

  renderPitch(ctx, transform, width, height, state.pitchSettings);

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

  // Club logo watermark — in the green padding area, before players
  if (state.clubIdentity.logoDataUrl) {
    renderLogoWatermark(ctx, transform, state.clubIdentity.logoDataUrl);
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

  // Collect all ghost players (state + transient animation ghost)
  const allGhosts: GhostPlayer[] = [
    ...(state.ghostPlayers || []),
    ...(runAnimOverlay ? [runAnimOverlay.ghostPlayer] : []),
  ];

  // Annotations layer 1: lines and polygons (below players)
  renderAnnotationsBase(ctx, transform, state.annotations, state.players, state.selectedAnnotationId, state.playerRadius, accent, state.ghostAnnotationIds, runAnimOverlay, allGhosts, state.previewGhosts ?? []);

  // Ghost players (semi-transparent copies at run origin, below real players)
  if (allGhosts.length) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (const ghost of allGhosts) {
      const teamColor = ghost.team === 'A' ? state.teamAColor : state.teamBColor;
      const outlineColor = ghost.team === 'A' ? state.teamAOutlineColor : state.teamBOutlineColor;
      const labelAbove = ghost.team === 'A' ? teamAAttacksDown : teamBAttacksDown;
      const showName = ghost.team === 'A' ? state.showPlayerNamesA : state.showPlayerNamesB;
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
        showName,
        accent,
      );
    }
    ctx.restore();
  }

  // Preview ghosts (semi-transparent at run destination, below real players)
  if (state.previewGhosts?.length) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (const pg of state.previewGhosts) {
      const teamColor = pg.team === 'A' ? state.teamAColor : state.teamBColor;
      const outlineColor = pg.team === 'A' ? state.teamAOutlineColor : state.teamBOutlineColor;
      const labelAbove = pg.team === 'A' ? teamAAttacksDown : teamBAttacksDown;
      const showName = pg.team === 'A' ? state.showPlayerNamesA : state.showPlayerNamesB;
      drawPlayer(
        ctx,
        transform,
        {
          id: `preview-${pg.playerId}`,
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
        showName,
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
    const isFormationDimmed =
      state.activeTool === 'formation-move'
      && state.formationMoveTeam === player.team
      && !!player.isGK;

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
    );
  }

  // Snap indicators (subtle rings on players connected to lines, above player tokens)
  renderSnapIndicators(ctx, transform, state.annotations, state.players, state.playerRadius);

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
