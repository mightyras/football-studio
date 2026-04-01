import type { UrlDetectionResult, UrlMetadata } from '../types';

export function detectUrlType(url: string): UrlDetectionResult {
  const trimmed = url.trim();

  // Direct video file (MP4, WebM, MOV)
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(trimmed)) {
    return { type: 'mp4', originalUrl: trimmed };
  }

  // Direct HLS stream
  if (trimmed.includes('.m3u8')) {
    return { type: 'hls', originalUrl: trimmed };
  }

  // Known platforms
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // Veo CDN — direct MP4
    if (host.includes('veocdn.com')) {
      return { type: 'mp4', originalUrl: trimmed };
    }

    if (host.includes('fotbollplay.se') || host.includes('forzasys.com')) {
      return { type: 'known-platform', platform: 'fotbollplay', originalUrl: trimmed };
    }
    if (host.includes('veo.co')) {
      return { type: 'known-platform', platform: 'veo', originalUrl: trimmed };
    }
    if (host.includes('expressen.se') || host.includes('livesport.expressen.se')) {
      return { type: 'known-platform', platform: 'expressen', originalUrl: trimmed };
    }
    if (host.includes('minfotboll.svenskfotboll.se') || (host.includes('svenskfotboll.se') && trimmed.includes('magazinegameview'))) {
      return { type: 'known-platform', platform: 'minfotboll', originalUrl: trimmed };
    }
  } catch {
    // Invalid URL
  }

  return { type: 'unknown', originalUrl: trimmed };
}

export function getPlatformDisplayName(platform: string): string {
  switch (platform) {
    case 'fotbollplay': return 'Fotbollplay.se';
    case 'veo': return 'Veo';
    case 'expressen': return 'Expressen Livesport';
    case 'minfotboll': return 'Min Fotboll';
    default: return platform;
  }
}

// --- URL Metadata Extraction ---

/** Known Swedish football abbreviations that should be uppercased */
const UPPER_ABBREVS = new Set([
  'ifk', 'if', 'kif', 'aik', 'bk', 'ff', 'fc', 'ik', 'gif', 'gais',
  'fk', 'hbk', 'iaf', 'bp', 'afc', 'fif',
]);

/** Common Swedish city name corrections (ASCII slug → proper name) */
const SWEDISH_NAMES: Record<string, string> = {
  'orebro': 'Örebro',
  'malmo': 'Malmö',
  'goteborg': 'Göteborg',
  'varnamo': 'Värnamo',
  'norrkoping': 'Norrköping',
  'linkoping': 'Linköping',
  'jonkoping': 'Jönköping',
  'sundsvall': 'Sundsvall',
  'helsingborg': 'Helsingborg',
  'djurgarden': 'Djurgården',
  'djurgardens': 'Djurgårdens',
  'ostersund': 'Östersund',
  'vaxjo': 'Växjö',
  'angelholm': 'Ängelholm',
  'degerfors': 'Degerfors',
  'mjallby': 'Mjällby',
  'hacken': 'Häcken',
  'kalmar': 'Kalmar',
  'sirius': 'Sirius',
  'hammarby': 'Hammarby',
  'elfsborg': 'Elfsborg',
  'sundbyberg': 'Sundbyberg',
  'vasteras': 'Västerås',
  'trelleborg': 'Trelleborg',
  'orgryte': 'Örgryte',
  'landskrona': 'Landskrona',
  'norby': 'Norrby',
};

/** Sorted longest-first so we match greedily */
const SORTED_PREFIXES = [...UPPER_ABBREVS].sort((a, b) => b.length - a.length);

/**
 * Split a compound slug that may lack hyphens (e.g., "ifkvarnamo" → "ifk-varnamo").
 * Checks if the slug starts with a known abbreviation prefix and inserts a hyphen.
 */
function splitCompoundSlug(slug: string): string {
  const lower = slug.toLowerCase();
  // If already contains hyphens, leave as-is
  if (lower.includes('-')) return lower;

  for (const prefix of SORTED_PREFIXES) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      return prefix + '-' + lower.slice(prefix.length);
    }
  }
  return lower;
}

/**
 * Convert a URL slug segment to a display name.
 * e.g. "ifkvarnamo" → "IFK Värnamo", "kif-orebro" → "KIF Örebro"
 */
export function teamSlugToDisplayName(slug: string): string {
  // First handle compound slugs without hyphens (e.g., fotbollplay)
  const normalized = splitCompoundSlug(slug);
  const parts = normalized.split('-');

  const result: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (UPPER_ABBREVS.has(part)) {
      result.push(part.toUpperCase());
    } else if (SWEDISH_NAMES[part]) {
      result.push(SWEDISH_NAMES[part]);
    } else {
      // Title-case
      result.push(part.charAt(0).toUpperCase() + part.slice(1));
    }
  }

  return result.join(' ');
}

/** Known club prefixes used to split compound team slugs in Expressen URLs */
const CLUB_PREFIXES = ['ifk', 'if', 'kif', 'aik', 'bk', 'ff', 'fc', 'ik', 'gif', 'fk', 'hbk', 'bp', 'afc', 'fif'];

/**
 * Split an Expressen video slug like "kif-orebro-if-elfsborg" into two team slugs.
 * Strategy: scan for known club prefix boundaries to find the split point.
 */
export function splitExpressenTeams(slug: string): { home: string; away: string } | null {
  const parts = slug.toLowerCase().split('-');

  // Find split points: positions where a known club prefix starts a new team name
  // Skip index 0 since that's always the start of team 1
  for (let i = 1; i < parts.length; i++) {
    if (CLUB_PREFIXES.includes(parts[i])) {
      const home = parts.slice(0, i).join('-');
      const away = parts.slice(i).join('-');
      if (home && away) {
        return { home, away };
      }
    }
  }

  // Fallback: try splitting in half
  if (parts.length >= 2) {
    const mid = Math.floor(parts.length / 2);
    return {
      home: parts.slice(0, mid).join('-'),
      away: parts.slice(mid).join('-'),
    };
  }

  return null;
}

/**
 * Extract metadata (team names, date) from a URL based on known platform patterns.
 */
export function extractUrlMetadata(url: string): UrlMetadata | null {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathSegments = parsed.pathname.split('/').filter(Boolean);

  // Fotbollplay.se: /ifkvarnamo/playlist/abc123
  if (host.includes('fotbollplay.se') || host.includes('forzasys.com')) {
    const teamSlug = pathSegments[0] || null;
    return {
      platform: 'fotbollplay',
      homeTeam: teamSlug ? teamSlugToDisplayName(teamSlug) : null,
      awayTeam: null,
      matchDate: null,
      rawSlug: teamSlug,
    };
  }

  // Veo: /matches/19700101-1970-01-01-000159-v66c464e/
  if (host.includes('veo.co')) {
    const matchId = pathSegments[1] || null;
    let matchDate: string | null = null;
    if (matchId) {
      // Extract YYYYMMDD from the start of the match ID
      const dateMatch = matchId.match(/^(\d{4})(\d{2})(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        // Validate it's a reasonable date (not 19700101 placeholder)
        const y = parseInt(year);
        if (y >= 2000 && y <= 2100) {
          matchDate = `${year}-${month}-${day}`;
        }
      }
    }
    return {
      platform: 'veo',
      homeTeam: null,
      awayTeam: null,
      matchDate,
      rawSlug: matchId,
    };
  }

  // Expressen: /sv/video/s-highlights-kif-orebro-if-elfsborg-y06bb
  if (host.includes('expressen.se')) {
    const videoSlug = pathSegments.find(s =>
      s.startsWith('s-') || s.startsWith('vs-') || s.includes('-vs-')
    );
    if (videoSlug) {
      // Strip prefix (s-highlights-, s-, vs-)
      let teamsStr = videoSlug;
      teamsStr = teamsStr.replace(/^s-highlights-/, '');
      teamsStr = teamsStr.replace(/^s-/, '');
      teamsStr = teamsStr.replace(/^vs-/, '');
      // Strip trailing ID (last segment that looks like a short alphanumeric code)
      teamsStr = teamsStr.replace(/-[a-z0-9]{4,6}$/, '');

      const teams = splitExpressenTeams(teamsStr);
      if (teams) {
        return {
          platform: 'expressen',
          homeTeam: teamSlugToDisplayName(teams.home),
          awayTeam: teamSlugToDisplayName(teams.away),
          matchDate: null,
          rawSlug: videoSlug,
        };
      }
    }
    return {
      platform: 'expressen',
      homeTeam: null,
      awayTeam: null,
      matchDate: null,
      rawSlug: videoSlug || null,
    };
  }

  // Min Fotboll: /#/magazinegameview/{gameId}
  if (host.includes('svenskfotboll.se')) {
    const gameIdMatch = trimmed.match(/magazinegameview\/(\d+)/);
    const gameId = gameIdMatch?.[1] || null;
    return {
      platform: 'minfotboll',
      homeTeam: null,
      awayTeam: null,
      matchDate: null,
      rawSlug: gameId,
    };
  }

  return null;
}
