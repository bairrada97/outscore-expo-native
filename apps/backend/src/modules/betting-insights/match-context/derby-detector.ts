/**
 * Derby/Rivalry Detection
 *
 * Detects derby and rivalry matches which require special handling
 * in simulations (higher variance, increased motivation).
 *
 * Reference: docs/implementation-plan/phase3.5.md - Section 3.5.5
 * Algorithm: docs/betting-insights-Algorithm.md - Derby Detection section
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Derby/rivalry classification
 */
export type DerbyType =
  | 'LOCAL' // Same city derby
  | 'REGIONAL' // Same region rivalry
  | 'HISTORICAL' // Traditional rivalry
  | 'TITLE' // Title race rivalry
  | 'NONE';

/**
 * Derby match information
 */
export interface DerbyInfo {
  isDerby: boolean;
  derbyType: DerbyType;
  derbyName?: string;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
}

// ============================================================================
// KNOWN RIVALRIES DATABASE
// ============================================================================

/**
 * Known football rivalries by country/competition
 * Format: [team1Id, team2Id, derbyName, type, intensity]
 *
 * This is a starting set - can be expanded with more rivalries
 */
type RivalryEntry = [number, number, string, DerbyType, DerbyInfo['intensity']];

const KNOWN_RIVALRIES: RivalryEntry[] = [
  // ENGLAND - Premier League
  [33, 34, 'Manchester Derby', 'LOCAL', 'EXTREME'], // Man Utd vs Man City
  [40, 39, 'Merseyside Derby', 'LOCAL', 'EXTREME'], // Liverpool vs Everton
  [42, 47, 'North London Derby', 'LOCAL', 'EXTREME'], // Arsenal vs Tottenham
  [33, 40, 'Northwest Derby', 'HISTORICAL', 'HIGH'], // Man Utd vs Liverpool
  [49, 48, 'West Midlands Derby', 'LOCAL', 'HIGH'], // Aston Villa vs West Brom

  // SPAIN - La Liga
  [529, 541, 'El Clásico', 'HISTORICAL', 'EXTREME'], // Barcelona vs Real Madrid
  [530, 531, 'Madrid Derby', 'LOCAL', 'HIGH'], // Real Madrid vs Atlético
  [532, 536, 'Basque Derby', 'REGIONAL', 'HIGH'], // Athletic Bilbao vs Real Sociedad
  [536, 540, 'Valencian Derby', 'REGIONAL', 'MEDIUM'], // Valencia vs Villarreal

  // ITALY - Serie A
  [489, 505, 'Derby della Madonnina', 'LOCAL', 'EXTREME'], // Inter vs AC Milan
  [492, 496, 'Derby dItalia', 'HISTORICAL', 'HIGH'], // Juventus vs Inter
  [497, 498, 'Derby della Capitale', 'LOCAL', 'EXTREME'], // Roma vs Lazio
  [500, 502, 'Derby della Lanterna', 'LOCAL', 'HIGH'], // Genoa vs Sampdoria

  // GERMANY - Bundesliga
  [157, 165, 'Der Klassiker', 'HISTORICAL', 'EXTREME'], // Bayern vs Dortmund
  [157, 169, 'Bavarian Derby', 'REGIONAL', 'MEDIUM'], // Bayern vs Augsburg
  [173, 174, 'Revierderby', 'LOCAL', 'HIGH'], // Dortmund vs Schalke

  // FRANCE - Ligue 1
  [85, 80, 'Le Classique', 'HISTORICAL', 'EXTREME'], // PSG vs Marseille
  [80, 81, 'Olympico', 'HISTORICAL', 'HIGH'], // Marseille vs Lyon

  // PORTUGAL - Primeira Liga
  [211, 212, 'O Clássico', 'HISTORICAL', 'EXTREME'], // Benfica vs Porto
  [211, 228, 'Lisbon Derby', 'LOCAL', 'HIGH'], // Benfica vs Sporting
  [212, 228, 'Clássico dos Invictos', 'HISTORICAL', 'HIGH'], // Porto vs Sporting

  // NETHERLANDS - Eredivisie
  [194, 197, 'De Klassieker', 'HISTORICAL', 'EXTREME'], // Ajax vs Feyenoord
  [194, 195, 'De Topper', 'HISTORICAL', 'HIGH'], // Ajax vs PSV

  // SCOTLAND - Scottish Premiership
  [247, 248, 'Old Firm', 'LOCAL', 'EXTREME'], // Celtic vs Rangers

  // TURKEY - Süper Lig
  [645, 610, 'Intercontinental Derby', 'LOCAL', 'EXTREME'], // Fenerbahçe vs Galatasaray
  [645, 611, 'Kıtalararası Derbi', 'LOCAL', 'HIGH'], // Fenerbahçe vs Beşiktaş
  [610, 611, 'Big Istanbul Derby', 'LOCAL', 'HIGH'], // Galatasaray vs Beşiktaş

  // ARGENTINA - Primera División
  [448, 449, 'Superclásico', 'LOCAL', 'EXTREME'], // Boca Juniors vs River Plate
  [450, 451, 'Clásico de Avellaneda', 'LOCAL', 'HIGH'], // Racing vs Independiente

  // BRAZIL - Brasileirão
  [126, 127, 'Clássico dos Milhões', 'LOCAL', 'EXTREME'], // Flamengo vs Vasco
  [131, 128, 'Clássico Majestoso', 'LOCAL', 'HIGH'], // São Paulo vs Corinthians
  [130, 121, 'Grenal', 'LOCAL', 'EXTREME'], // Grêmio vs Internacional
];

/**
 * Create lookup maps for faster rivalry detection
 */
const RIVALRY_MAP = new Map<string, RivalryEntry>();
for (const rivalry of KNOWN_RIVALRIES) {
  const key1 = `${rivalry[0]}-${rivalry[1]}`;
  const key2 = `${rivalry[1]}-${rivalry[0]}`;
  RIVALRY_MAP.set(key1, rivalry);
  RIVALRY_MAP.set(key2, rivalry);
}

// ============================================================================
// SAME-CITY DETECTION
// ============================================================================

/**
 * Known same-city teams (team IDs grouped by city)
 */
const SAME_CITY_TEAMS: number[][] = [
  // Manchester
  [33, 34],
  // Liverpool
  [40, 39],
  // London (multiple derbies)
  [42, 47, 49, 63, 62, 52, 55],
  // Milan
  [489, 505],
  // Rome
  [497, 498],
  // Madrid
  [541, 530, 531, 546],
  // Barcelona
  [529, 540],
  // Munich
  [157, 175],
  // Istanbul
  [645, 610, 611],
  // Buenos Aires
  [448, 449, 450, 451],
  // São Paulo
  [131, 128, 130],
  // Rio de Janeiro
  [126, 127, 123],
];

/**
 * Create same-city lookup
 */
const SAME_CITY_MAP = new Map<number, number[]>();
for (const cityTeams of SAME_CITY_TEAMS) {
  for (const teamId of cityTeams) {
    SAME_CITY_MAP.set(
      teamId,
      cityTeams.filter((id) => id !== teamId),
    );
  }
}

// ============================================================================
// MAIN DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect if a match is a derby/rivalry
 *
 * @param homeTeamId - Home team API ID
 * @param awayTeamId - Away team API ID
 * @param homeTeamName - Home team name (for fallback detection)
 * @param awayTeamName - Away team name (for fallback detection)
 * @returns Derby information
 */
export function detectDerby(
  homeTeamId: number,
  awayTeamId: number,
  homeTeamName?: string,
  awayTeamName?: string,
): DerbyInfo {
  // Check known rivalries first (most accurate)
  const knownRivalry = checkKnownRivalry(homeTeamId, awayTeamId);
  if (knownRivalry) {
    return knownRivalry;
  }

  // Check same-city teams
  const sameCityDerby = checkSameCityDerby(homeTeamId, awayTeamId);
  if (sameCityDerby) {
    return sameCityDerby;
  }

  // Fallback: name-based detection (less accurate but catches more)
  if (homeTeamName && awayTeamName) {
    const nameDerby = detectDerbyByName(homeTeamName, awayTeamName);
    if (nameDerby) {
      return nameDerby;
    }
  }

  return {
    isDerby: false,
    derbyType: 'NONE',
    intensity: 'LOW',
  };
}

/**
 * Check known rivalries database
 */
function checkKnownRivalry(
  homeTeamId: number,
  awayTeamId: number,
): DerbyInfo | null {
  const key = `${homeTeamId}-${awayTeamId}`;
  const rivalry = RIVALRY_MAP.get(key);

  if (rivalry) {
    return {
      isDerby: true,
      derbyType: rivalry[3],
      derbyName: rivalry[2],
      intensity: rivalry[4],
    };
  }

  return null;
}

/**
 * Check if teams are from the same city
 */
function checkSameCityDerby(
  homeTeamId: number,
  awayTeamId: number,
): DerbyInfo | null {
  const sameCityTeams = SAME_CITY_MAP.get(homeTeamId);

  if (sameCityTeams?.includes(awayTeamId)) {
    return {
      isDerby: true,
      derbyType: 'LOCAL',
      intensity: 'MEDIUM', // Default intensity for unknown same-city matches
    };
  }

  return null;
}

/**
 * Detect derby by team names (fallback)
 * Looks for common city/region identifiers
 */
function detectDerbyByName(
  homeTeamName: string,
  awayTeamName: string,
): DerbyInfo | null {
  const home = homeTeamName.toLowerCase();
  const away = awayTeamName.toLowerCase();

  // Extract city names from team names
  const homeCities = extractCityFromName(home);
  const awayCities = extractCityFromName(away);

  // Check for common city
  for (const homeCity of homeCities) {
    for (const awayCity of awayCities) {
      if (homeCity === awayCity && homeCity.length > 2) {
        return {
          isDerby: true,
          derbyType: 'LOCAL',
          intensity: 'MEDIUM',
        };
      }
    }
  }

  return null;
}

/**
 * Extract potential city names from team name
 */
function extractCityFromName(teamName: string): string[] {
  const cities: string[] = [];

  // Common patterns: "FC City", "City FC", "City United", etc.
  const words = teamName.split(/\s+/);

  for (const word of words) {
    // Skip common football terms
    if (isFootballTerm(word)) continue;

    // Skip very short words
    if (word.length < 3) continue;

    cities.push(word);
  }

  return cities;
}

/**
 * Check if word is a common football term (not a city)
 */
function isFootballTerm(word: string): boolean {
  const terms = [
    'fc',
    'sc',
    'ac',
    'as',
    'cf',
    'united',
    'city',
    'athletic',
    'athletico',
    'atletico',
    'real',
    'sporting',
    'deportivo',
    'club',
    'football',
    'soccer',
    'rovers',
    'wanderers',
    'hotspur',
    'albion',
    'villa',
    'town',
    'county',
    'borough',
    'palace',
    'rangers',
    'celtic',
    'dynamo',
    'spartak',
    'cska',
    'lokomotiv',
  ];

  return terms.includes(word.toLowerCase());
}

// ============================================================================
// WEIGHT ADJUSTMENTS FOR DERBIES
// ============================================================================

/**
 * Get weight adjustments for derby matches
 *
 * @param derbyInfo - Derby information
 * @returns Weight adjustment factors
 */
export function getDerbyWeightAdjustments(derbyInfo: DerbyInfo): {
  motivationMultiplier: number;
  formReliabilityMultiplier: number;
  goalScoringMultiplier: number;
  confidenceReduction: number;
} {
  if (!derbyInfo.isDerby) {
    return {
      motivationMultiplier: 1.0,
      formReliabilityMultiplier: 1.0,
      goalScoringMultiplier: 1.0,
      confidenceReduction: 0,
    };
  }

  switch (derbyInfo.intensity) {
    case 'EXTREME':
      return {
        motivationMultiplier: 1.4, // 40% increase in motivation impact
        formReliabilityMultiplier: 0.75, // 25% reduction in form reliability
        goalScoringMultiplier: 0.9, // Slightly fewer goals (more tactical)
        confidenceReduction: 12, // Higher uncertainty
      };

    case 'HIGH':
      return {
        motivationMultiplier: 1.25, // 25% increase
        formReliabilityMultiplier: 0.85, // 15% reduction
        goalScoringMultiplier: 0.95,
        confidenceReduction: 8,
      };

    case 'MEDIUM':
      return {
        motivationMultiplier: 1.15, // 15% increase
        formReliabilityMultiplier: 0.9, // 10% reduction
        goalScoringMultiplier: 0.97,
        confidenceReduction: 5,
      };

    case 'LOW':
    default:
      return {
        motivationMultiplier: 1.1,
        formReliabilityMultiplier: 0.95,
        goalScoringMultiplier: 1.0,
        confidenceReduction: 3,
      };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get derby name if known
 */
export function getDerbyName(
  homeTeamId: number,
  awayTeamId: number,
): string | undefined {
  const key = `${homeTeamId}-${awayTeamId}`;
  const rivalry = RIVALRY_MAP.get(key);
  return rivalry?.[2];
}

/**
 * Get all known derbies for a team
 */
export function getTeamDerbies(teamId: number): Array<{
  opponentId: number;
  derbyName: string;
  type: DerbyType;
  intensity: DerbyInfo['intensity'];
}> {
  const derbies: Array<{
    opponentId: number;
    derbyName: string;
    type: DerbyType;
    intensity: DerbyInfo['intensity'];
  }> = [];

  for (const rivalry of KNOWN_RIVALRIES) {
    if (rivalry[0] === teamId) {
      derbies.push({
        opponentId: rivalry[1],
        derbyName: rivalry[2],
        type: rivalry[3],
        intensity: rivalry[4],
      });
    } else if (rivalry[1] === teamId) {
      derbies.push({
        opponentId: rivalry[0],
        derbyName: rivalry[2],
        type: rivalry[3],
        intensity: rivalry[4],
      });
    }
  }

  return derbies;
}

/**
 * Check if any known derby exists for a team
 */
export function hasKnownDerbies(teamId: number): boolean {
  return KNOWN_RIVALRIES.some(
    (r) => r[0] === teamId || r[1] === teamId,
  );
}
