import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTeam } from '../state/TeamContext';
import * as squadService from '../services/squadService';
import type { SquadPlayer } from '../types';

export function useSquad() {
  const { activeTeam } = useTeam();
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  const teamId = activeTeam?.id ?? null;

  const refresh = useCallback(async () => {
    if (!teamId) {
      setSquadPlayers([]);
      return;
    }
    setLoading(true);
    const players = await squadService.fetchSquadPlayers(teamId);
    setSquadPlayers(players);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Lookup maps for auto-fill
  const squadByNumber = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of squadPlayers) {
      map.set(p.jersey_number, p.name);
    }
    return map;
  }, [squadPlayers]);

  const squadByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of squadPlayers) {
      map.set(p.name.toLowerCase(), p.jersey_number);
    }
    return map;
  }, [squadPlayers]);

  return { squadPlayers, squadByNumber, squadByName, loading, refresh };
}
