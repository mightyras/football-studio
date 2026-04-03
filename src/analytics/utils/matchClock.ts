import type { Bookmark } from '../types';

export type StandardBookmarks = {
  kickoff: Bookmark | undefined;
  halftime: Bookmark | undefined;
  start2ndHalf: Bookmark | undefined;
  end: Bookmark | undefined;
};

export type MatchClockState =
  | { period: 'pre_match'; display: string }
  | { period: '1st_half'; minutes: number; seconds: number; display: string }
  | { period: 'halftime'; display: string }
  | { period: '2nd_half'; minutes: number; seconds: number; display: string }
  | { period: 'full_time'; display: string };

export function getStandardBookmarks(bookmarks: Bookmark[]): StandardBookmarks {
  return {
    kickoff: bookmarks.find(b => b.category === 'kickoff'),
    halftime: bookmarks.find(b => b.category === 'halftime'),
    start2ndHalf: bookmarks.find(b => b.category === 'start_2nd_half'),
    end: bookmarks.find(b => b.category === 'end'),
  };
}

export function hasAllStandardBookmarks(bookmarks: Bookmark[]): boolean {
  const std = getStandardBookmarks(bookmarks);
  return !!(std.kickoff && std.halftime && std.start2ndHalf && std.end);
}

function formatClockDisplay(minutes: number, seconds: number): string {
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function computeMatchMinute(
  currentTime: number,
  bookmarks: Bookmark[],
): MatchClockState | null {
  const std = getStandardBookmarks(bookmarks);
  if (!std.kickoff || !std.halftime || !std.start2ndHalf || !std.end) return null;

  const ko = std.kickoff.time;
  const ht = std.halftime.time;
  const s2h = std.start2ndHalf.time;
  const end = std.end.time;

  // Validate finite numbers and correct ordering
  if (!isFinite(ko) || !isFinite(ht) || !isFinite(s2h) || !isFinite(end)) return null;
  if (ko >= ht || ht >= s2h || s2h >= end) return null;

  if (currentTime < ko) {
    return { period: 'pre_match', display: '--:--' };
  }

  if (currentTime < ht) {
    const elapsed = Math.max(0, currentTime - ko);
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    return { period: '1st_half', minutes, seconds, display: formatClockDisplay(minutes, seconds) };
  }

  if (currentTime < s2h) {
    return { period: 'halftime', display: 'HT' };
  }

  if (currentTime <= end) {
    const elapsed = Math.max(0, currentTime - s2h);
    const minutes = 45 + Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    return { period: '2nd_half', minutes, seconds, display: formatClockDisplay(minutes, seconds) };
  }

  return { period: 'full_time', display: 'FT' };
}
