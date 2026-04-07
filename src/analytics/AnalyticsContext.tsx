import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AnalyticsState, AnalyticsAction } from './types';
import { PEN_TOTAL_MS } from './utils/strokeRenderer';

const initialState: AnalyticsState = {
  streamUrl: null,
  resolvedStreamUrl: null,
  streamStatus: 'idle',
  streamError: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1,
  volume: 1,
  isMuted: false,
  inPoint: null,
  outPoint: null,
  recordingStatus: 'idle',
  recordingElapsed: 0,
  activeTool: 'select',
  activeColor: '#00ff88',
  activeLineWidth: 6,
  annotations: [],
  selectedAnnotationId: null,
  drawingInProgress: null,
  sessionClips: [],
  selectedClipId: null,
  urlMetadata: null,
  bookmarks: [],
  sessionId: null,
  sessionName: null,
  sessionOwnerId: null,
  saveStatus: 'idle',
  holdStrokesOnPause: false,
  sourceType: 'stream',
  sourceFiles: [],
  activeSourceFileId: null,
  localFileHint: null,
};

function analyticsReducer(state: AnalyticsState, action: AnalyticsAction): AnalyticsState {
  switch (action.type) {
    case 'SET_STREAM_URL':
      return {
        ...state,
        streamUrl: action.url,
        resolvedStreamUrl: null,
        streamStatus: 'loading',
        streamError: null,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        inPoint: null,
        outPoint: null,
        annotations: [],
        urlMetadata: null,
        bookmarks: [],
        sessionId: null,
        sessionName: null,
        sessionOwnerId: null,
        saveStatus: 'idle',
        sourceType: 'stream',
        sourceFiles: [],
        activeSourceFileId: null,
        localFileHint: null,
      };
    case 'SET_RESOLVED_STREAM_URL':
      return { ...state, resolvedStreamUrl: action.url };
    case 'SET_STREAM_STATUS':
      return {
        ...state,
        streamStatus: action.status,
        streamError: action.error ?? null,
      };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.time };
    case 'SET_DURATION':
      return { ...state, duration: action.duration };
    case 'SET_IS_PLAYING':
      return { ...state, isPlaying: action.playing };
    case 'SET_PLAYBACK_RATE':
      return { ...state, playbackRate: action.rate };
    case 'SET_VOLUME':
      return { ...state, volume: action.volume, isMuted: action.volume === 0 };
    case 'SET_MUTED':
      return { ...state, isMuted: action.muted };
    case 'SET_IN_POINT':
      return { ...state, inPoint: action.time };
    case 'SET_OUT_POINT':
      return { ...state, outPoint: action.time };
    case 'SET_RECORDING_STATUS':
      return {
        ...state,
        recordingStatus: action.status,
        recordingElapsed: action.status === 'idle' ? 0 : state.recordingElapsed,
      };
    case 'SET_RECORDING_ELAPSED':
      return { ...state, recordingElapsed: action.elapsed };
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.tool, selectedAnnotationId: null };
    case 'SET_ACTIVE_COLOR':
      return { ...state, activeColor: action.color };
    case 'SET_ACTIVE_LINE_WIDTH':
      return { ...state, activeLineWidth: action.width };
    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.annotation] };
    case 'DELETE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter(a => a.id !== action.id),
        selectedAnnotationId: state.selectedAnnotationId === action.id ? null : state.selectedAnnotationId,
      };
    case 'SELECT_ANNOTATION':
      return { ...state, selectedAnnotationId: action.id };
    case 'UPDATE_DRAWING':
      return { ...state, drawingInProgress: action.drawing };
    case 'ADD_SESSION_CLIP': {
      const clips = [...state.sessionClips, action.clip].sort((a, b) => a.timestamp - b.timestamp);
      return { ...state, sessionClips: clips };
    }
    case 'REMOVE_SESSION_CLIP': {
      const clip = state.sessionClips.find(c => c.id === action.id);
      if (clip?.thumbnailUrl) URL.revokeObjectURL(clip.thumbnailUrl);
      if (clip?.downloadUrl) URL.revokeObjectURL(clip.downloadUrl);
      return {
        ...state,
        sessionClips: state.sessionClips.filter(c => c.id !== action.id),
        selectedClipId: state.selectedClipId === action.id ? null : state.selectedClipId,
      };
    }
    case 'SELECT_CLIP':
      return { ...state, selectedClipId: action.id };
    case 'UPDATE_CLIP_LABEL':
      return {
        ...state,
        sessionClips: state.sessionClips.map(c =>
          c.id === action.id ? { ...c, label: action.label } : c
        ),
      };
    case 'SET_URL_METADATA':
      return { ...state, urlMetadata: action.metadata };
    case 'ADD_BOOKMARK':
      return {
        ...state,
        bookmarks: [...state.bookmarks, action.bookmark].sort((a, b) => a.time - b.time),
      };
    case 'REMOVE_BOOKMARK':
      return {
        ...state,
        bookmarks: state.bookmarks.filter(b => b.id !== action.id),
      };
    case 'UPDATE_BOOKMARK_COMMENT':
      return {
        ...state,
        bookmarks: state.bookmarks.map(b =>
          b.id === action.id ? { ...b, comment: action.comment } : b
        ),
      };
    case 'SET_SESSION':
      return { ...state, sessionId: action.id, sessionName: action.name, sessionOwnerId: action.ownerId };
    case 'SET_SESSION_NAME':
      return { ...state, sessionName: action.name };
    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.status };
    case 'SET_CLIP_CLOUD_ID':
      return {
        ...state,
        sessionClips: state.sessionClips.map(c =>
          c.id === action.localId
            ? { ...c, cloudId: action.cloudId, storagePath: action.storagePath, thumbnailStoragePath: action.thumbnailStoragePath }
            : c
        ),
      };
    case 'LOAD_SESSION': {
      const sourceType = action.sourceType ?? 'stream';
      const needsFileReselection = sourceType === 'local_file';
      // For uploaded files, the streamUrl from SessionBrowser is already the resolved signed URL
      const isUploadedFiles = sourceType === 'uploaded_files';
      return {
        ...state,
        sessionId: action.sessionId,
        sessionName: action.sessionName,
        sessionOwnerId: action.sessionOwnerId,
        streamUrl: action.streamUrl,
        resolvedStreamUrl: isUploadedFiles ? action.streamUrl : null,
        streamStatus: needsFileReselection ? 'idle' : (action.streamUrl ? 'loading' : 'idle'),
        streamError: null,
        urlMetadata: action.metadata,
        bookmarks: action.bookmarks,
        sessionClips: action.clips,
        selectedClipId: null,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        inPoint: null,
        outPoint: null,
        annotations: [],
        saveStatus: 'idle',
        sourceType,
        sourceFiles: action.sourceFiles ?? [],
        activeSourceFileId: action.sourceFiles?.[0]?.id ?? null,
        localFileHint: action.localFileHint ?? null,
      };
    }
    case 'CLEAR_FREEHAND_ANNOTATIONS':
      return { ...state, annotations: state.annotations.filter(a => a.type !== 'freehand' && a.type !== 'spotlight') };
    case 'REMOVE_FADED_ANNOTATIONS': {
      const idsToRemove = new Set(action.ids);
      return { ...state, annotations: state.annotations.filter(a => !idsToRemove.has(a.id)) };
    }
    case 'STAMP_FREEHAND_FADE_START':
      return {
        ...state,
        annotations: state.annotations.map(a => {
          if ((a.type !== 'freehand' && a.type !== 'spotlight') || a.drawnAt) return a;
          const stamped: typeof a = { ...a, drawnAt: action.time };
          if (action.videoTime !== undefined) {
            stamped.timeIn = action.videoTime;
            stamped.timeOut = action.videoTime + (PEN_TOTAL_MS / 1000);
          }
          return stamped;
        }),
      };
    case 'UNSTAMP_FREEHAND_FADE': {
      const hasStamped = state.annotations.some(a => (a.type === 'freehand' || a.type === 'spotlight') && a.drawnAt);
      if (!hasStamped) return state;
      return {
        ...state,
        annotations: state.annotations.map(a =>
          (a.type === 'freehand' || a.type === 'spotlight') && a.drawnAt
            ? { ...a, drawnAt: undefined, timeIn: undefined, timeOut: undefined }
            : a
        ),
      };
    }
    case 'SET_HOLD_STROKES_ON_PAUSE':
      return { ...state, holdStrokesOnPause: action.hold };
    case 'SET_SOURCE_TYPE':
      return { ...state, sourceType: action.sourceType };
    case 'SET_SOURCE_FILES':
      return { ...state, sourceFiles: action.files };
    case 'SET_ACTIVE_SOURCE_FILE':
      return { ...state, activeSourceFileId: action.id };
    case 'SET_LOCAL_FILE_HINT':
      return { ...state, localFileHint: action.hint };
    case 'UPDATE_STREAM_URL':
      return {
        ...state,
        streamUrl: action.url,
        resolvedStreamUrl: null,
        streamStatus: 'loading',
        streamError: null,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        inPoint: null,
        outPoint: null,
        annotations: [],
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

type AnalyticsContextValue = {
  state: AnalyticsState;
  dispatch: Dispatch<AnalyticsAction>;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(analyticsReducer, initialState);
  return (
    <AnalyticsContext.Provider value={{ state, dispatch }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used within AnalyticsProvider');
  return ctx;
}
