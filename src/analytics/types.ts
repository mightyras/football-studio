export type VideoAnnotation = {
  id: string;
  type: 'freehand' | 'arrow' | 'circle' | 'rect' | 'text' | 'spotlight';
  color: string;
  lineWidth: number;
  // Freehand: array of normalized 0-1 points
  points?: { x: number; y: number }[];
  // Arrow / Rect: start and end in normalized 0-1 coords
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  // Circle: center and radius in normalized 0-1 coords
  center?: { x: number; y: number };
  radius?: number;
  // Text
  text?: string;
  position?: { x: number; y: number };
  fontSize?: number;
  // Spotlight style (for type: 'spotlight')
  spotlightStyle?: 'circle' | 'arrow';
  // Timing — used for clip replay fade-in/out
  timeIn?: number;
  timeOut?: number;
  // Wall-clock timestamp (performance.now()) when stroke was completed — used for live fade
  drawnAt?: number;
};

export type SessionClip = {
  id: string;
  type: 'screenshot' | 'video';
  mimeType?: string; // e.g. 'video/mp4', 'video/webm', 'image/png'
  timestamp: number;
  inPoint?: number;
  outPoint?: number;
  blob?: Blob;
  thumbnailUrl?: string;
  downloadUrl?: string;
  annotations: VideoAnnotation[];
  label?: string;
  createdAt: number;
  // Attribution
  ownerId?: string;
  createdByName?: string;
  // Persistence fields (set after saving to Supabase)
  cloudId?: string;
  storagePath?: string;
  thumbnailStoragePath?: string;
};

export type StreamStatus = 'idle' | 'loading' | 'resolving' | 'playing' | 'error';
export type RecordingStatus = 'idle' | 'recording' | 'processing';
export type AnalyticsTool = 'select' | 'freehand' | 'arrow' | 'circle' | 'rect' | 'text' | 'eraser';

export type AnalyticsState = {
  streamUrl: string | null;
  resolvedStreamUrl: string | null;
  streamStatus: StreamStatus;
  streamError: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  inPoint: number | null;
  outPoint: number | null;
  recordingStatus: RecordingStatus;
  recordingElapsed: number;
  activeTool: AnalyticsTool;
  activeColor: string;
  activeLineWidth: number;
  annotations: VideoAnnotation[];
  selectedAnnotationId: string | null;
  drawingInProgress: Partial<VideoAnnotation> | null;
  sessionClips: SessionClip[];
  selectedClipId: string | null;
  urlMetadata: UrlMetadata | null;
  bookmarks: Bookmark[];
  sessionId: string | null;
  sessionName: string | null;
  sessionOwnerId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  holdStrokesOnPause: boolean;
};

export type AnalyticsAction =
  | { type: 'SET_STREAM_URL'; url: string }
  | { type: 'SET_RESOLVED_STREAM_URL'; url: string }
  | { type: 'SET_STREAM_STATUS'; status: StreamStatus; error?: string }
  | { type: 'SET_CURRENT_TIME'; time: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_IS_PLAYING'; playing: boolean }
  | { type: 'SET_PLAYBACK_RATE'; rate: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'SET_IN_POINT'; time: number | null }
  | { type: 'SET_OUT_POINT'; time: number | null }
  | { type: 'SET_RECORDING_STATUS'; status: RecordingStatus }
  | { type: 'SET_RECORDING_ELAPSED'; elapsed: number }
  | { type: 'SET_ACTIVE_TOOL'; tool: AnalyticsTool }
  | { type: 'SET_ACTIVE_COLOR'; color: string }
  | { type: 'SET_ACTIVE_LINE_WIDTH'; width: number }
  | { type: 'ADD_ANNOTATION'; annotation: VideoAnnotation }
  | { type: 'DELETE_ANNOTATION'; id: string }
  | { type: 'SELECT_ANNOTATION'; id: string | null }
  | { type: 'UPDATE_DRAWING'; drawing: Partial<VideoAnnotation> | null }
  | { type: 'ADD_SESSION_CLIP'; clip: SessionClip }
  | { type: 'REMOVE_SESSION_CLIP'; id: string }
  | { type: 'SELECT_CLIP'; id: string | null }
  | { type: 'UPDATE_CLIP_LABEL'; id: string; label: string }
  | { type: 'SET_URL_METADATA'; metadata: UrlMetadata | null }
  | { type: 'ADD_BOOKMARK'; bookmark: Bookmark }
  | { type: 'REMOVE_BOOKMARK'; id: string }
  | { type: 'UPDATE_BOOKMARK_COMMENT'; id: string; comment: string }
  | { type: 'SET_SESSION'; id: string; name: string; ownerId: string }
  | { type: 'SET_SESSION_NAME'; name: string }
  | { type: 'SET_SAVE_STATUS'; status: 'idle' | 'saving' | 'saved' | 'error' }
  | { type: 'SET_CLIP_CLOUD_ID'; localId: string; cloudId: string; storagePath: string; thumbnailStoragePath?: string }
  | { type: 'LOAD_SESSION'; clips: SessionClip[]; bookmarks: Bookmark[]; streamUrl: string; metadata: UrlMetadata | null; sessionId: string; sessionName: string; sessionOwnerId: string }
  | { type: 'CLEAR_FREEHAND_ANNOTATIONS' }
  | { type: 'REMOVE_FADED_ANNOTATIONS'; ids: string[] }
  | { type: 'STAMP_FREEHAND_FADE_START'; time: number; videoTime?: number }
  | { type: 'UNSTAMP_FREEHAND_FADE' }
  | { type: 'SET_HOLD_STROKES_ON_PAUSE'; hold: boolean }
  | { type: 'UPDATE_STREAM_URL'; url: string }
  | { type: 'RESET' };

export type UrlType = 'hls' | 'mp4' | 'known-platform' | 'unknown';

export type KnownPlatform = 'fotbollplay' | 'veo' | 'expressen' | 'minfotboll';

export type UrlDetectionResult = {
  type: UrlType;
  platform?: KnownPlatform;
  originalUrl: string;
};

export type UrlMetadata = {
  platform: KnownPlatform | null;
  homeTeam: string | null;
  awayTeam: string | null;
  matchDate: string | null;
  competition: string | null;
  rawSlug: string | null;
};

export const PRESET_COMPETITIONS = [
  'Träningsmatch',
  'Allsvenskan',
  'Superettan',
  'Elitettan',
  'Division 1',
  'Division 2',
  'Division 3',
  'Division 4',
] as const;

export type BookmarkCategory = 'kickoff' | 'halftime' | 'start_2nd_half' | 'end';

export const BOOKMARK_CATEGORY_LABELS: Record<BookmarkCategory, { short: string; full: string }> = {
  kickoff:        { short: 'KO',  full: 'Kickoff' },
  halftime:       { short: 'HT',  full: 'Halftime' },
  start_2nd_half: { short: '2H',  full: 'Start 2nd Half' },
  end:            { short: 'FT',  full: 'Full Time' },
};

export const BOOKMARK_CATEGORY_ORDER: BookmarkCategory[] = ['kickoff', 'halftime', 'start_2nd_half', 'end'];

export type Bookmark = {
  id: string;
  time: number;
  comment: string;
  createdAt: number;
  category?: BookmarkCategory;
  // Attribution
  ownerId?: string;
  createdByName?: string;
  // Persistence
  cloudId?: string;
};
