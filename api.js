// ESPN API Integration
// This is the abstraction layer - modify this file to switch to paid API

// Auto-detect environment and use appropriate CORS proxy
// Local: http://localhost:8001 (Python proxy server)
// Vercel: /api/cors-proxy
// Azure: /api/cors-proxy
// Netlify: /.netlify/functions/cors-proxy
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isVercel = window.location.hostname.includes('vercel.app') ||
                 window.location.hostname === 'playbyplay.football' ||
                 window.location.hostname === 'www.playbyplay.football';
const isAzure = window.location.hostname.includes('azurestaticapps.net');
const isNetlify = window.location.hostname.includes('netlify.app');

let CORS_PROXY;
let environment;
if (isLocalhost) {
    CORS_PROXY = 'http://localhost:8001/?url=';
    environment = 'localhost';
} else if (isVercel || isAzure) {
    // Vercel and Azure both use /api/
    CORS_PROXY = '/api/cors-proxy?url=';
    environment = isVercel ? 'vercel' : 'azure';
} else if (isNetlify) {
    CORS_PROXY = '/.netlify/functions/cors-proxy?url=';
    environment = 'netlify';
} else {
    // Default to Vercel format for custom domains
    CORS_PROXY = '/api/cors-proxy?url=';
    environment = 'custom-domain';
}

// Debug logging
console.log('🌍 Environment detected:', environment);
console.log('🔗 CORS Proxy URL:', CORS_PROXY);
console.log('🖥️ Hostname:', window.location.hostname);

// ESPN API Endpoints
const ESPN_API = {
    SCOREBOARD: CORS_PROXY + encodeURIComponent('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'),
    GAME_SUMMARY: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary', // Will add proxy dynamically
    PLAY_BY_PLAY: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events', // Will add proxy dynamically
    TEAMS: CORS_PROXY + encodeURIComponent('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams')
};

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
    SCOREBOARD: 5 * 60 * 1000,  // 5 minutes
    GAME_SUMMARY: 30 * 1000,     // 30 seconds
    PLAY_BY_PLAY: 30 * 1000,     // 30 seconds
    TEAMS: 24 * 60 * 60 * 1000   // 24 hours
};

// Rate limiting state
let rateLimited = false;
let retryCount = 0;
const MAX_RETRIES = 3;

/**
 * Fetch data from ESPN API with caching and error handling
 * @param {string} url - API URL
 * @param {string} cacheKey - Cache key
 * @param {number} cacheTTL - Cache TTL in ms
 * @returns {Promise<Object>} API response data
 */
async function fetchFromAPI(url, cacheKey, cacheTTL) {
    // Check cache first
    const cached = getCachedData(cacheKey);

    if (cached && !cached.stale) {
        log(`Using cached data for: ${cacheKey}`);
        return cached.data;
    }

    // If rate limited, return stale cache or throw error
    if (rateLimited) {
        if (cached) {
            log(`Rate limited, returning stale cache for: ${cacheKey}`);
            showBanner('Using cached data due to rate limiting', 'warning');
            return cached.data;
        } else {
            throw new Error('RATE_LIMITED_NO_CACHE');
        }
    }

    try {
        log(`Fetching from API: ${url}`);
        console.log('🔍 Full request URL:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        console.log('📡 Response status:', response.status, response.statusText);

        // Check for rate limiting
        if (response.status === 429) {
            rateLimited = true;
            logError('Rate limited by ESPN API');
            showBanner('Rate limited. Using cached data only.', 'error');

            // Set timeout to reset rate limit flag (try again in 5 minutes)
            setTimeout(() => {
                rateLimited = false;
                log('Rate limit flag reset');
                showToast('Rate limit cleared, resuming API calls', 'info');
            }, 5 * 60 * 1000);

            if (cached) {
                return cached.data;
            } else {
                throw new Error('RATE_LIMITED_NO_CACHE');
            }
        }

        // Check for other errors
        if (!response.ok) {
            const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
            console.error('❌ API Error:', errorMsg);
            console.error('❌ Failed URL:', url);
            throw new Error(errorMsg);
        }

        const data = await response.json();

        // Cache the response
        cacheData(cacheKey, data, cacheTTL);

        // Reset retry count on success
        retryCount = 0;

        return data;
    } catch (error) {
        console.error('❌ API fetch failed:', error.message);
        console.error('❌ Failed URL:', url);
        console.error('❌ Cache key:', cacheKey);
        logError('API fetch failed', error);

        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES && error.message !== 'RATE_LIMITED_NO_CACHE') {
            retryCount++;
            const backoffTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
            log(`Retrying in ${backoffTime / 1000}s (attempt ${retryCount}/${MAX_RETRIES})`);

            await wait(backoffTime);
            return fetchFromAPI(url, cacheKey, cacheTTL);
        }

        // If all retries failed, return cached data if available
        if (cached) {
            log(`All retries failed, returning stale cache for: ${cacheKey}`);
            showBanner('API unavailable. Showing cached data.', 'warning');
            return cached.data;
        }

        // No cache available, throw error
        console.error('❌ No cached data available, throwing error');
        throw error;
    }
}

/**
 * Fetch live games from scoreboard
 * @param {string} date - Optional date in YYYYMMDD format
 * @returns {Promise<Object>} Scoreboard data
 */
async function fetchLiveGames(date = null) {
    const dateParam = date || getCurrentDate().replace(/-/g, '');
    const espnUrl = date
        ? `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dateParam}`
        : 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
    const url = CORS_PROXY + encodeURIComponent(espnUrl);
    const cacheKey = `espn:scoreboard:${dateParam}`;

    try {
        const data = await fetchFromAPI(url, cacheKey, CACHE_TTL.SCOREBOARD);
        log(`Fetched ${data.events?.length || 0} games`);
        return data;
    } catch (error) {
        logError('Failed to fetch live games', error);
        throw error;
    }
}

/**
 * Fetch game summary (current game state)
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Game summary data
 */
async function fetchGameSummary(gameId) {
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
    const url = CORS_PROXY + encodeURIComponent(espnUrl);
    const cacheKey = `espn:game:${gameId}:summary`;

    try {
        const data = await fetchFromAPI(url, cacheKey, CACHE_TTL.GAME_SUMMARY);
        log(`Fetched game summary for: ${gameId}`);
        return data;
    } catch (error) {
        logError(`Failed to fetch game summary for ${gameId}`, error);
        throw error;
    }
}

/**
 * Fetch play-by-play data
 * @param {string} gameId - Game ID
 * @param {number} limit - Number of plays to fetch
 * @returns {Promise<Object>} Play-by-play data
 */
async function fetchPlayByPlay(gameId, limit = 50) {
    const espnUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${gameId}/competitions/${gameId}/plays?limit=${limit}`;
    const url = CORS_PROXY + encodeURIComponent(espnUrl);
    const cacheKey = `espn:game:${gameId}:plays`;

    try {
        const data = await fetchFromAPI(url, cacheKey, CACHE_TTL.PLAY_BY_PLAY);
        log(`Fetched ${data.items?.length || 0} plays for game ${gameId}`);
        return data;
    } catch (error) {
        logError(`Failed to fetch play-by-play for ${gameId}`, error);
        throw error;
    }
}

/**
 * Fetch all NFL teams
 * @returns {Promise<Object>} Teams data
 */
async function fetchTeams() {
    const espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
    const url = CORS_PROXY + encodeURIComponent(espnUrl);
    const cacheKey = 'espn:teams';

    try {
        const data = await fetchFromAPI(url, cacheKey, CACHE_TTL.TEAMS);
        log(`Fetched ${data.sports?.[0]?.leagues?.[0]?.teams?.length || 0} teams`);
        return data;
    } catch (error) {
        logError('Failed to fetch teams', error);
        throw error;
    }
}

/**
 * Parse scoreboard data to extract games
 * @param {Object} scoreboardData - Raw scoreboard data from ESPN
 * @returns {Array} Array of parsed game objects
 */
function parseScoreboardGames(scoreboardData) {
    if (!scoreboardData || !scoreboardData.events) {
        return [];
    }

    return scoreboardData.events.map(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        return {
            id: event.id,
            name: event.name,
            shortName: event.shortName,
            status: {
                type: event.status.type.name,
                state: event.status.type.state,
                completed: event.status.type.completed,
                detail: event.status.type.detail
            },
            period: event.status.period,
            clock: event.status.displayClock,
            homeTeam: {
                id: homeTeam.id,
                name: homeTeam.team.displayName,
                abbreviation: homeTeam.team.abbreviation,
                logo: homeTeam.team.logo,
                score: homeTeam.score,
                record: homeTeam.records?.[0]?.summary || ''
            },
            awayTeam: {
                id: awayTeam.id,
                name: awayTeam.team.displayName,
                abbreviation: awayTeam.team.abbreviation,
                logo: awayTeam.team.logo,
                score: awayTeam.score,
                record: awayTeam.records?.[0]?.summary || ''
            }
        };
    });
}

/**
 * Parse game summary to extract current situation
 * @param {Object} summaryData - Raw game summary from ESPN
 * @returns {Object} Parsed game state
 */
function parseGameState(summaryData) {
    if (!summaryData || !summaryData.header) {
        throw new Error('Invalid game summary data');
    }

    const competition = summaryData.header.competitions[0];
    const situation = competition.situation || {};
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

    // Determine possession team
    let possessionTeam = null;
    if (situation.possession) {
        possessionTeam = situation.possession === homeTeam.id ? homeTeam : awayTeam;
    }

    return {
        gameId: summaryData.header.id,
        status: {
            period: situation.period || 1,
            clock: situation.clock || '15:00',
            completed: competition.status?.type?.completed || false
        },
        situation: {
            down: situation.down || 0,
            distance: situation.distance || 0,
            yardLine: situation.yardLine || 0,
            yardsToEndzone: situation.yardsToEndzone || 0,
            possession: situation.possession || null,
            possessionText: situation.possessionText || '',
            isRedZone: situation.isRedZone || false,
            homeTimeouts: situation.homeTimeouts || 3,
            awayTimeouts: situation.awayTimeouts || 3
        },
        lastPlay: situation.lastPlay || null,
        homeTeam: {
            id: homeTeam.id,
            name: homeTeam.team.displayName,
            abbreviation: homeTeam.team.abbreviation,
            logo: homeTeam.team.logo,
            score: homeTeam.score || 0
        },
        awayTeam: {
            id: awayTeam.id,
            name: awayTeam.team.displayName,
            abbreviation: awayTeam.team.abbreviation,
            logo: awayTeam.team.logo,
            score: awayTeam.score || 0
        },
        possessionTeam: possessionTeam ? {
            id: possessionTeam.id,
            name: possessionTeam.team.displayName,
            abbreviation: possessionTeam.team.abbreviation
        } : null,
        rawData: summaryData
    };
}

/**
 * Parse play-by-play data
 * @param {Object} playData - Raw play-by-play data from ESPN
 * @returns {Array} Array of parsed plays
 */
function parsePlayByPlay(playData) {
    if (!playData || !playData.items) {
        return [];
    }

    return playData.items.map(play => {
        return {
            id: play.id,
            sequenceNumber: play.sequenceNumber,
            type: play.type?.text || 'Unknown',
            text: play.text || '',
            shortText: play.shortText || '',
            period: play.period?.number || 0,
            clock: play.clock?.displayValue || '',
            scoringPlay: play.scoringPlay || false,
            down: play.start?.down || 0,
            distance: play.start?.distance || 0,
            yardLine: play.start?.yardLine || 0,
            yardsGained: play.statYardage || 0
        };
    }).reverse(); // Reverse to show most recent first
}

/**
 * Extract roster from game summary
 * @param {Object} summaryData - Raw game summary data
 * @param {string} teamId - Team ID to get roster for
 * @returns {Array} Array of players
 */
function extractRoster(summaryData, teamId) {
    if (!summaryData || !summaryData.boxscore || !summaryData.boxscore.players) {
        return [];
    }

    // Convert teamId to string for comparison (ESPN uses string IDs)
    const teamIdStr = String(teamId);
    const teamPlayers = summaryData.boxscore.players.find(p => String(p.team.id) === teamIdStr);
    if (!teamPlayers) {
        log(`No roster found for team ${teamIdStr}, available teams: ${summaryData.boxscore.players.map(p => p.team.id).join(', ')}`);
        return [];
    }

    const players = [];

    // Extract offensive players (usually first category)
    teamPlayers.statistics.forEach(statCategory => {
        if (statCategory.athletes) {
            statCategory.athletes.forEach(athlete => {
                players.push({
                    id: athlete.athlete.id,
                    name: athlete.athlete.displayName,
                    shortName: athlete.athlete.shortName,
                    position: athlete.athlete.position?.abbreviation || 'N/A',
                    jersey: athlete.athlete.jersey || '',
                    stats: athlete.stats || []
                });
            });
        }
    });

    return players;
}

/**
 * Check if ESPN API is currently rate limited
 * @returns {boolean} True if rate limited
 */
function isRateLimited() {
    return rateLimited;
}

/**
 * Reset rate limit flag (use with caution)
 */
function resetRateLimit() {
    rateLimited = false;
    retryCount = 0;
    log('Rate limit manually reset');
}

/**
 * Get API status
 * @returns {Object} API status information
 */
function getAPIStatus() {
    return {
        rateLimited: rateLimited,
        retryCount: retryCount,
        maxRetries: MAX_RETRIES
    };
}

// Export for use in other modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchLiveGames,
        fetchGameSummary,
        fetchPlayByPlay,
        fetchTeams,
        parseScoreboardGames,
        parseGameState,
        parsePlayByPlay,
        extractRoster,
        isRateLimited,
        resetRateLimit,
        getAPIStatus
    };
}
