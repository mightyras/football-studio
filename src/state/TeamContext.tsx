import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import type { Team, TeamMember, TeamRole, Invite } from '../types';
import * as teamService from '../services/teamService';
import * as inviteService from '../services/inviteService';

type TeamContextValue = {
  /** All teams the current user belongs to */
  teams: Array<Team & { myRole: TeamRole }>;
  /** Currently active team (persisted to localStorage) */
  activeTeam: (Team & { myRole: TeamRole }) | null;
  /** Members of the active team */
  members: TeamMember[];
  /** Whether the current user is a super admin */
  isSuperAdmin: boolean;
  /** Pending invites for the current user */
  pendingInvites: Invite[];
  /** Teams created by this super admin (for admin dashboard) */
  createdTeams: Team[];
  /** Loading state */
  loading: boolean;
  /** Switch active team */
  setActiveTeamId: (teamId: string | null) => void;
  /** Create a new team */
  createTeam: (name: string) => Promise<string | null>;
  /** Refresh teams, members, invites */
  refresh: () => Promise<void>;
  /** Refresh just the pending invites */
  refreshInvites: () => Promise<void>;
  /** Refresh just the created teams (admin dashboard) */
  refreshCreatedTeams: () => Promise<void>;
  /** Update the active team's default formation (admin only) */
  updateDefaultFormation: (formationId: string) => Promise<boolean>;
};

const ACTIVE_TEAM_KEY = 'football-studio-active-team';

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Array<Team & { myRole: TeamRole }>>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [createdTeams, setCreatedTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_TEAM_KEY),
  );
  const [loading, setLoading] = useState(false);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? teams[0] ?? null;

  const setActiveTeamId = useCallback((teamId: string | null) => {
    setActiveTeamIdState(teamId);
    if (teamId) {
      localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
    } else {
      localStorage.removeItem(ACTIVE_TEAM_KEY);
    }
  }, []);

  const refreshInvites = useCallback(async () => {
    if (!user) {
      setPendingInvites([]);
      return;
    }
    const inv = await inviteService.fetchMyInvites();
    setPendingInvites(inv);
  }, [user]);

  const refreshCreatedTeams = useCallback(async () => {
    if (!user) {
      setCreatedTeams([]);
      return;
    }
    const ct = await teamService.fetchCreatedTeams();
    setCreatedTeams(ct);
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setMembers([]);
      setIsSuperAdmin(false);
      setPendingInvites([]);
      setCreatedTeams([]);
      return;
    }

    setLoading(true);
    try {
      const [fetchedTeams, superAdmin, invites] = await Promise.all([
        teamService.fetchMyTeams(),
        teamService.checkSuperAdmin(),
        inviteService.fetchMyInvites(),
      ]);

      setTeams(fetchedTeams);
      setIsSuperAdmin(superAdmin);
      setPendingInvites(invites);

      // Fetch created teams if super admin
      if (superAdmin) {
        const ct = await teamService.fetchCreatedTeams();
        setCreatedTeams(ct);
      } else {
        setCreatedTeams([]);
      }

      // Resolve active team
      const resolvedTeam =
        fetchedTeams.find((t) => t.id === activeTeamId) ??
        fetchedTeams[0] ??
        null;

      if (resolvedTeam) {
        setActiveTeamIdState(resolvedTeam.id);
        localStorage.setItem(ACTIVE_TEAM_KEY, resolvedTeam.id);
        const m = await teamService.fetchTeamMembers(resolvedTeam.id);
        setMembers(m);
      } else {
        setActiveTeamIdState(null);
        localStorage.removeItem(ACTIVE_TEAM_KEY);
        setMembers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, activeTeamId]);

  // Refresh when user changes
  useEffect(() => {
    refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh members when active team changes
  useEffect(() => {
    if (!activeTeam) {
      setMembers([]);
      return;
    }
    teamService.fetchTeamMembers(activeTeam.id).then(setMembers);
  }, [activeTeam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createTeam = useCallback(
    async (name: string): Promise<string | null> => {
      const teamId = await teamService.createTeam(name);
      if (teamId) {
        setActiveTeamId(teamId);
        await refresh();
      }
      return teamId;
    },
    [setActiveTeamId, refresh],
  );

  const updateDefaultFormation = useCallback(
    async (formationId: string): Promise<boolean> => {
      if (!activeTeam) return false;
      const ok = await teamService.updateDefaultFormation(activeTeam.id, formationId);
      if (ok) {
        // Optimistically update local state so UI reflects immediately
        setTeams((prev) =>
          prev.map((t) =>
            t.id === activeTeam.id ? { ...t, default_formation_id: formationId } : t,
          ),
        );
      }
      return ok;
    },
    [activeTeam],
  );

  return (
    <TeamContext.Provider
      value={{
        teams,
        activeTeam,
        members,
        isSuperAdmin,
        pendingInvites,
        createdTeams,
        loading,
        setActiveTeamId,
        createTeam,
        refresh,
        refreshInvites,
        refreshCreatedTeams,
        updateDefaultFormation,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}
