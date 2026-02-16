import type { SavedScene } from '../types';

const SCENES_KEY = 'football-studio-scenes';

export function loadScenes(): SavedScene[] {
  try {
    const raw = localStorage.getItem(SCENES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedScene[];
  } catch {
    return [];
  }
}

function persist(scenes: SavedScene[]): void {
  try {
    localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
  } catch {
    // Storage full — silently ignore
  }
}

export function addScene(scene: SavedScene): SavedScene[] {
  const scenes = loadScenes();
  scenes.unshift(scene); // newest first
  persist(scenes);
  return scenes;
}

export function deleteScene(id: string): SavedScene[] {
  const scenes = loadScenes().filter(s => s.id !== id);
  persist(scenes);
  return scenes;
}

export function renameScene(id: string, name: string): SavedScene[] {
  const scenes = loadScenes().map(s => (s.id === id ? { ...s, name } : s));
  persist(scenes);
  return scenes;
}
