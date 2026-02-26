export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  selector: string;
  title: string;
  description: string;
  placement: TourPlacement;
  spotlightPadding?: number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    selector: 'pitch',
    title: 'Your Tactical Board',
    description: 'This is your pitch. Drag players to position them anywhere on the field.',
    placement: 'right',
  },
  {
    selector: 'pitch',
    title: 'Edit Players',
    description:
      'Double-click any player to change their name, number, or label. Drag players to reposition them on the pitch.',
    placement: 'right',
  },
  {
    selector: 'team-name-a',
    title: 'Team Settings',
    description: 'Click a team name to change its colors and toggle player names.',
    placement: 'bottom',
  },
  {
    selector: 'formation-a',
    title: 'Formations',
    description:
      "Click here to change your team's formation. Choose from common setups like 4-3-3 or 4-2-3-1.",
    placement: 'bottom',
  },
  {
    selector: 'tool-select',
    title: 'Select & Move',
    description: 'Use this tool to select and drag players and the ball around the pitch.',
    placement: 'right',
  },
  {
    selector: 'tool-formation-move',
    title: 'Formation Move',
    description:
      'Drag all players together to shift your entire formation as a unit across the pitch.',
    placement: 'right',
  },
  {
    selector: 'tool-draw',
    title: 'Draw & Annotate',
    description:
      'Add passing lines, running lines, dribble lines, lofted passes, text labels, ellipses, and polygons. Set the step number on each annotation to build animated tactical sequences — then press Space to play or use arrow keys to step through.',
    placement: 'right',
  },
  {
    selector: 'display-options',
    title: 'Vision & Display',
    description:
      'Toggle player orientation arrows, cover shadow zones, and field-of-vision cones to visualize awareness and defensive coverage.',
    placement: 'bottom',
  },
  {
    selector: 'settings-toggle',
    title: 'Settings & Tactical Overlays',
    description:
      'Customize pitch appearance, player marker size, and apply tactical zone overlays like Corridors, 18 Zones, Thirds, and Phases.',
    placement: 'bottom',
  },
  {
    selector: 'boards-button',
    title: 'Boards & Collaboration',
    description:
      'Save your current board, create new ones, or switch between saved tactical setups. Share boards with your team for real-time collaboration.',
    placement: 'bottom',
  },
  {
    selector: 'zoom-controls',
    title: 'Zoom & View Controls',
    description:
      'Use these controls or scroll to zoom. Click "Top ½" or "Bottom ½" for quick half-pitch views.',
    placement: 'left',
    spotlightPadding: 16,
  },
];
