import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { extractSceneData } from '../state/AppStateContext';
import { remoteActionFlag } from '../state/remoteActionFlag';
import { updateBoard } from '../services/boardService';
import type { AppAction } from '../state/appStateReducer';
import type { AppState, OnlineUser, SceneData } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Actions that should be broadcast to collaborators.
 * Anything that changes board content visible to others.
 */
const COLLABORATIVE_ACTIONS = new Set<string>([
  'MOVE_PLAYER', 'ADD_PLAYER', 'DELETE_PLAYER', 'EDIT_PLAYER', 'ROTATE_PLAYER',
  'MOVE_BALL', 'SET_BALL_RADIUS',
  'ADD_ANNOTATION', 'DELETE_ANNOTATION', 'MOVE_ANNOTATION', 'EDIT_ANNOTATION', 'CLEAR_ALL_ANNOTATIONS',
  'APPLY_FORMATION', 'MOVE_FORMATION',
  'RENAME_TEAM', 'SET_TEAM_COLOR', 'SET_TEAM_OUTLINE_COLOR', 'SET_TEAM_DIRECTION',
  'SET_POSSESSION', 'SET_PITCH_SETTINGS', 'SET_PLAYER_RADIUS',
  'LOAD_SCENE', 'RESET',
  'EXECUTE_RUN', 'CLEAR_PLAYER_GHOSTS', 'RESET_RUN',
  'ADD_SUBSTITUTE', 'REMOVE_SUBSTITUTE', 'EDIT_SUBSTITUTE', 'SUBSTITUTE_PLAYER',
  'CAPTURE_KEYFRAME', 'UPDATE_KEYFRAME', 'DELETE_KEYFRAME', 'REORDER_KEYFRAME',
  'SET_KEYFRAME_DURATION', 'SET_KEYFRAME_LABEL', 'SET_ANIMATION_SPEED', 'SET_ANIMATION_NAME',
  'CLEAR_ANIMATION', 'LOAD_ANIMATION',
  'ENTER_ANIMATION_MODE', 'EXIT_ANIMATION_MODE',
  'SET_SHOW_ORIENTATION', 'SET_SHOW_COVER_SHADOW', 'SET_AUTO_ORIENT_TO_BALL',
  'SET_FOV_MODE', 'SET_FOV_EXPANDED',
]);

/** Actions that should be throttled (high-frequency drag operations). */
const THROTTLED_ACTIONS = new Set(['MOVE_PLAYER', 'MOVE_BALL', 'MOVE_ANNOTATION', 'MOVE_FORMATION']);

const THROTTLE_MS = 50; // 20 updates/sec
const AUTO_SAVE_DELAY_MS = 5000;

export function isCollaborativeAction(actionType: string): boolean {
  return COLLABORATIVE_ACTIONS.has(actionType);
}

export type CollaborationHookResult = {
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  sendAction: (action: AppAction) => void;
  disconnect: () => void;
  permission: 'view' | 'edit' | 'owner';
};

export function useCollaboration(
  boardId: string | null,
  dispatch: React.Dispatch<AppAction>,
  stateRef: React.RefObject<AppState>,
  userId: string | null,
  userDisplayName: string | null,
  isOwner: boolean,
  permission: 'view' | 'edit' | 'owner',
): CollaborationHookResult {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const throttleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const throttleBuffers = useRef<Map<string, AppAction>>(new Map());
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedChanges = useRef(false);
  const joinedAtRef = useRef<number>(0);

  // Debounced auto-save for the board owner
  const scheduleAutoSave = useCallback(() => {
    if (!isOwner || !boardId) return;
    hasUnsavedChanges.current = true;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!hasUnsavedChanges.current || !stateRef.current) return;
      const sceneData = extractSceneData(stateRef.current);
      await updateBoard(boardId, { data: sceneData });
      hasUnsavedChanges.current = false;
    }, AUTO_SAVE_DELAY_MS);
  }, [isOwner, boardId, stateRef]);

  // Send an action over the channel
  const sendAction = useCallback((action: AppAction) => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;
    if (!isCollaborativeAction(action.type)) return;

    const actionKey = action.type;

    // Throttle high-frequency actions
    if (THROTTLED_ACTIONS.has(actionKey)) {
      // Build a key that identifies the specific entity being moved
      let throttleKey = actionKey;
      if ('playerId' in action) throttleKey += `-${(action as { playerId: string }).playerId}`;
      if ('annotationId' in action) throttleKey += `-${(action as { annotationId: string }).annotationId}`;
      if ('team' in action) throttleKey += `-${(action as { team: string }).team}`;

      // Buffer the latest action
      throttleBuffers.current.set(throttleKey, action);

      // If no timer running for this key, start one
      if (!throttleTimers.current.has(throttleKey)) {
        throttleTimers.current.set(throttleKey, setTimeout(() => {
          const buffered = throttleBuffers.current.get(throttleKey);
          if (buffered) {
            channel.send({
              type: 'broadcast',
              event: 'action',
              payload: { action: buffered, senderId: userId },
            });
          }
          throttleBuffers.current.delete(throttleKey);
          throttleTimers.current.delete(throttleKey);
        }, THROTTLE_MS));
      }
    } else {
      // Send immediately
      channel.send({
        type: 'broadcast',
        event: 'action',
        payload: { action, senderId: userId },
      });
    }

    scheduleAutoSave();
  }, [isConnected, userId, scheduleAutoSave]);

  // Connect to the channel
  useEffect(() => {
    if (!boardId || !supabase || !userId) {
      setIsConnected(false);
      setOnlineUsers([]);
      return;
    }

    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
        presence: { key: userId },
      },
    });

    channelRef.current = channel;
    joinedAtRef.current = Date.now();

    // ── Presence ──
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: OnlineUser[] = [];
      for (const [, presences] of Object.entries(state)) {
        for (const p of presences as Array<{ userId: string; displayName: string; avatarUrl: string | null }>) {
          if (p.userId !== userId) {
            users.push({
              userId: p.userId,
              displayName: p.displayName,
              avatarUrl: p.avatarUrl,
            });
          }
        }
      }
      setOnlineUsers(users);
    });

    // ── Broadcast: receive actions ──
    channel.on('broadcast', { event: 'action' }, (payload) => {
      const { action, senderId } = payload.payload as { action: AppAction; senderId: string };
      if (senderId === userId) return; // Extra safety: ignore own actions

      // Dispatch as remote action (skips undo stack via remoteActionFlag)
      remoteActionFlag.current = true;
      dispatch(action);
      remoteActionFlag.current = false;
    });

    // ── Broadcast: sync request (new joiner asks for state) ──
    channel.on('broadcast', { event: 'sync_request' }, (payload) => {
      const { requesterId, requesterJoinedAt } = payload.payload as { requesterId: string; requesterJoinedAt: number };
      if (requesterId === userId) return;

      // Only the longest-connected user responds (to avoid flooding)
      // Simple heuristic: if we joined before the requester, we respond
      if (joinedAtRef.current < requesterJoinedAt && stateRef.current) {
        const sceneData = extractSceneData(stateRef.current);
        channel.send({
          type: 'broadcast',
          event: 'sync_response',
          payload: { sceneData, targetId: requesterId },
        });
      }
    });

    // ── Broadcast: sync response (receive full state) ──
    channel.on('broadcast', { event: 'sync_response' }, (payload) => {
      const { sceneData, targetId } = payload.payload as { sceneData: SceneData; targetId: string };
      if (targetId !== userId) return; // Only the requester processes this

      remoteActionFlag.current = true;
      dispatch({ type: 'LOAD_SCENE', data: sceneData });
      remoteActionFlag.current = false;
    });

    // ── Subscribe ──
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);

        // Track presence
        await channel.track({
          userId,
          displayName: userDisplayName ?? 'Anonymous',
          avatarUrl: null,
        });

        // Request state sync from existing users (wait a brief moment for presence to propagate)
        setTimeout(() => {
          channel.send({
            type: 'broadcast',
            event: 'sync_request',
            payload: { requesterId: userId, requesterJoinedAt: joinedAtRef.current },
          });
        }, 500);
      }
    });

    return () => {
      // Cleanup
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
      setOnlineUsers([]);

      // Clear throttle timers
      for (const timer of throttleTimers.current.values()) clearTimeout(timer);
      throttleTimers.current.clear();
      throttleBuffers.current.clear();

      // Clear auto-save timer & flush
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      if (hasUnsavedChanges.current && isOwner && stateRef.current) {
        const sceneData = extractSceneData(stateRef.current);
        updateBoard(boardId, { data: sceneData }); // fire-and-forget
        hasUnsavedChanges.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, userId]);

  const disconnect = useCallback(() => {
    if (channelRef.current && supabase) {
      channelRef.current.unsubscribe();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
      setOnlineUsers([]);
    }
  }, []);

  return {
    isConnected,
    onlineUsers,
    sendAction,
    disconnect,
    permission,
  };
}
