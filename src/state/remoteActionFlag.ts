/**
 * Module-level mutable flag for remote actions (collaboration).
 * When true, the reducer skips pushing to the undo stack.
 * Set by useCollaboration before dispatching remote actions, reset immediately after.
 */
export const remoteActionFlag = { current: false };
