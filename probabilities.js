// Probability Calculator for NFL scenarios
// Uses historical data from probability-data.json when available
// Falls back to simple heuristics if data not available

/**
 * Probability Calculator Class
 */
class ProbabilityCalculator {
    constructor(probabilityData = null) {
        this.data = probabilityData;
        this.usingFallback = !probabilityData;

        if (this.usingFallback) {
            log('Probability calculator using fallback heuristics (no historical data loaded)');
        } else {
            log('Probability calculator initialized with historical data');
        }
    }

    /**
     * Get distance bucket for probability lookup
     * @param {number} yards - Yards to go
     * @returns {string} Distance bucket
     */
    getDistanceBucket(yards) {
        if (yards <= 3) return 'short';
        if (yards <= 6) return 'medium';
        if (yards <= 10) return 'long';
        return 'very_long';
    }

    /**
     * Get simple fallback probability
     * @param {number} down - Down (1-4)
     * @param {number} distance - Distance in yards
     * @param {string} playType - 'pass' or 'run'
     * @param {string} team - Team abbreviation (for variation)
     * @returns {number} Probability (0-1)
     */
    getFallbackProbability(down, distance, playType, team = null) {
        const bucket = this.getDistanceBucket(distance);

        // Base conversion rates by distance
        const baseRates = {
            'short': 0.65,      // 0-3 yards: 65%
            'medium': 0.50,     // 4-6 yards: 50%
            'long': 0.35,       // 7-10 yards: 35%
            'very_long': 0.20   // 11+ yards: 20%
        };

        let probability = baseRates[bucket] || 0.40;

        // Adjust for down
        if (down === 3 || down === 4) {
            // 3rd and 4th down are harder
            probability *= 0.9;
        }

        // Adjust for play type
        if (playType === 'pass') {
            // Passing is slightly more effective on longer distances
            if (bucket === 'long' || bucket === 'very_long') {
                probability *= 1.1;
            }
        } else if (playType === 'run') {
            // Running is more effective on shorter distances
            if (bucket === 'short') {
                probability *= 1.15;
            } else if (bucket === 'long' || bucket === 'very_long') {
                probability *= 0.85;
            }
        }

        // Add team-based variation (pseudo-random but consistent per team)
        if (team) {
            // Simple hash of team name for variation
            let hash = 0;
            for (let i = 0; i < team.length; i++) {
                hash = ((hash << 5) - hash) + team.charCodeAt(i);
                hash = hash & hash;
            }
            const variation = ((hash % 20) - 10) / 100; // -0.10 to +0.10
            probability += variation;
        }

        // Cap at 0-1 range
        return Math.max(0, Math.min(1, probability));
    }

    /**
     * Get conversion probability from historical data
     * @param {number} down - Down (1-4)
     * @param {number} distance - Distance in yards
     * @param {string} playType - 'pass' or 'run'
     * @param {string} team - Team abbreviation (optional)
     * @returns {number} Probability (0-1)
     */
    getConversionProbability(down, distance, playType, team = null) {
        // Use fallback if no data
        if (this.usingFallback || !this.data) {
            return this.getFallbackProbability(down, distance, playType, team);
        }

        const distBucket = this.getDistanceBucket(distance);

        // Get league-wide baseline
        let leagueRate = 0.40; // Default

        if (this.data.league_conversion_rates) {
            const leagueEntry = this.data.league_conversion_rates.find(
                r => r.down === down &&
                     r.distance === distBucket &&
                     r.play_type === playType
            );

            if (leagueEntry) {
                leagueRate = leagueEntry.success_rate;
            }
        }

        // If no team specified, return league rate
        if (!team) {
            return leagueRate;
        }

        // Try to get team-specific rate
        if (this.data.team_conversion_rates) {
            const teamEntry = this.data.team_conversion_rates.find(
                r => r.team === team &&
                     r.distance === distBucket &&
                     r.play_type === playType
            );

            if (teamEntry && teamEntry.sample_size >= 5) {
                // Weighted blend: 70% team-specific, 30% league-wide
                // This prevents overfitting on small samples
                return (teamEntry.success_rate * 0.7) + (leagueRate * 0.3);
            }
        }

        // No team data, return league rate
        return leagueRate;
    }

    /**
     * Get scenario comparison (pass vs run)
     * @param {Object} gameState - Current game state
     * @param {string} focusTeam - Team abbreviation (optional)
     * @returns {Object} Comparison of pass vs run probabilities
     */
    getScenarioComparison(gameState, focusTeam = null) {
        const down = gameState.situation?.down || 1;
        const distance = gameState.situation?.distance || 10;

        return {
            pass: {
                probability: this.getConversionProbability(down, distance, 'pass', focusTeam),
                label: 'Pass Play Success',
                playType: 'pass'
            },
            run: {
                probability: this.getConversionProbability(down, distance, 'run', focusTeam),
                label: 'Run Play Success',
                playType: 'run'
            }
        };
    }

    /**
     * Get field position impact
     * @param {number} yardsToEndzone - Yards to opponent's endzone
     * @param {string} playType - 'pass' or 'run'
     * @returns {Object} Field position impact data
     */
    getFieldPositionImpact(yardsToEndzone, playType) {
        const zone = this.getFieldZone(yardsToEndzone);

        // Use historical data if available
        if (!this.usingFallback && this.data && this.data.field_position_impact) {
            const zoneData = this.data.field_position_impact.find(
                fp => fp.zone === zone && fp.play_type === playType
            );

            if (zoneData) {
                return {
                    zone: zone,
                    conversionRate: zoneData.conversion_rate,
                    tdRate: zoneData.td_rate,
                    description: this.getZoneDescription(zone)
                };
            }
        }

        // Fallback heuristics
        const fallbackRates = {
            'red_zone': { conversion: 0.60, td: 0.25 },
            'green_zone': { conversion: 0.55, td: 0.15 },
            'mid_field': { conversion: 0.50, td: 0.05 },
            'own_territory': { conversion: 0.45, td: 0.02 }
        };

        const rates = fallbackRates[zone] || fallbackRates['mid_field'];

        return {
            zone: zone,
            conversionRate: rates.conversion,
            tdRate: rates.td,
            description: this.getZoneDescription(zone)
        };
    }

    /**
     * Get field zone from yards to endzone
     * @param {number} yardsToEndzone - Yards to endzone
     * @returns {string} Zone name
     */
    getFieldZone(yardsToEndzone) {
        if (yardsToEndzone <= 10) return 'red_zone';
        if (yardsToEndzone <= 20) return 'green_zone';
        if (yardsToEndzone <= 50) return 'mid_field';
        return 'own_territory';
    }

    /**
     * Get zone description
     * @param {string} zone - Zone name
     * @returns {string} Human-readable description
     */
    getZoneDescription(zone) {
        const descriptions = {
            'red_zone': 'Red Zone (≤10 yards from endzone)',
            'green_zone': 'Green Zone (11-20 yards from endzone)',
            'mid_field': 'Mid-Field (21-50 yards from endzone)',
            'own_territory': 'Own Territory (51+ yards from endzone)'
        };
        return descriptions[zone] || 'Unknown';
    }

    /**
     * Get player impact on success probability
     * @param {string} playerId - Player ID
     * @param {number} baseProbability - Base probability without player
     * @returns {Object} Player impact data
     */
    getPlayerImpact(playerId, baseProbability) {
        // Use historical data if available
        if (!this.usingFallback && this.data && this.data.player_success_rates) {
            const playerData = this.data.player_success_rates.find(
                p => p.player_id === playerId
            );

            if (playerData) {
                return {
                    playerProbability: playerData.conversion_rate,
                    boost: playerData.conversion_rate - baseProbability,
                    hasData: true
                };
            }
        }

        // No player-specific data, return base probability
        return {
            playerProbability: baseProbability,
            boost: 0,
            hasData: false
        };
    }

    /**
     * Calculate win probability based on score differential and time remaining
     * @param {Object} gameState - Current game state
     * @param {string} teamId - Team ID to calculate win probability for
     * @returns {Object} Win probability data
     */
    getWinProbability(gameState, teamId) {
        const isHomeTeam = teamId === gameState.homeTeam.id;
        const teamScore = isHomeTeam ? gameState.homeTeam.score : gameState.awayTeam.score;
        const oppScore = isHomeTeam ? gameState.awayTeam.score : gameState.homeTeam.score;
        const scoreDiff = teamScore - oppScore;

        // Calculate time remaining in seconds
        const quarter = gameState.status.period;
        const clockStr = gameState.status.clock;
        const [minutes, seconds] = clockStr.split(':').map(Number);
        const timeInQuarter = (minutes * 60) + seconds;
        const timeRemaining = (4 - quarter) * 900 + timeInQuarter; // 900 seconds = 15 minutes

        // Win probability based on score differential and time
        // Formula: Base probability from score, adjusted by time remaining
        let winProb = 0.5; // Start at 50%

        // Score differential impact (stronger as time runs out)
        const timeWeight = 1 - (timeRemaining / 3600); // 0 at start, 1 at end
        const scoreFactor = scoreDiff * (0.05 + (0.10 * timeWeight)); // 5-15% per point depending on time
        winProb += scoreFactor;

        // Time/possession adjustment
        if (gameState.possessionTeam && gameState.possessionTeam.id === teamId) {
            winProb += 0.03; // Small boost for having possession
        }

        // Field position adjustment
        if (gameState.situation.yardsToEndzone <= 20 && gameState.possessionTeam && gameState.possessionTeam.id === teamId) {
            winProb += 0.05; // Boost for being in scoring position
        }

        // Clamp to 1-99% (never show 0% or 100% until game ends)
        winProb = Math.max(0.01, Math.min(0.99, winProb));

        return {
            probability: winProb,
            scoreDiff: scoreDiff,
            timeRemaining: timeRemaining,
            description: this.getWinProbabilityDescription(winProb, scoreDiff, timeRemaining)
        };
    }

    /**
     * Get description of win probability
     * @param {number} winProb - Win probability (0-1)
     * @param {number} scoreDiff - Score differential
     * @param {number} timeRemaining - Time remaining in seconds
     * @returns {string} Description
     */
    getWinProbabilityDescription(winProb, scoreDiff, timeRemaining) {
        if (winProb >= 0.90) return 'Highly likely to win';
        if (winProb >= 0.75) return 'Strong advantage';
        if (winProb >= 0.60) return 'Likely to win';
        if (winProb >= 0.40) return 'Competitive game';
        if (winProb >= 0.25) return 'Unlikely to win';
        if (winProb >= 0.10) return 'Significant deficit';
        return 'Very unlikely to win';
    }

    /**
     * Generate insight text comparing scenarios
     * @param {Object} teamScenarios - Team-specific scenarios
     * @param {Object} leagueScenarios - League-wide scenarios
     * @param {string} teamName - Team name
     * @returns {string} Insight text
     */
    generateInsight(teamScenarios, leagueScenarios, teamName) {
        const passDiff = teamScenarios.pass.probability - leagueScenarios.pass.probability;
        const runDiff = teamScenarios.run.probability - leagueScenarios.run.probability;

        if (Math.abs(passDiff) > Math.abs(runDiff)) {
            const direction = passDiff > 0 ? 'better' : 'worse';
            const pct = Math.abs(passDiff * 100).toFixed(0);
            return `${teamName || 'This team'} is ${pct}% ${direction} than league average at passing in this situation.`;
        } else if (Math.abs(runDiff) > 0.01) {
            const direction = runDiff > 0 ? 'better' : 'worse';
            const pct = Math.abs(runDiff * 100).toFixed(0);
            return `${teamName || 'This team'} is ${pct}% ${direction} than league average at rushing in this situation.`;
        } else {
            return `${teamName || 'This team'} performs close to league average in this situation.`;
        }
    }

    /**
     * Get recommended play type
     * @param {Object} scenarios - Scenario comparison
     * @returns {string} 'pass' or 'run'
     */
    getRecommendedPlay(scenarios) {
        return scenarios.pass.probability > scenarios.run.probability ? 'pass' : 'run';
    }

    /**
     * Check if calculator is using fallback
     * @returns {boolean} True if using fallback heuristics
     */
    isUsingFallback() {
        return this.usingFallback;
    }

    /**
     * Get data info for debugging
     * @returns {Object} Data info
     */
    getDataInfo() {
        if (this.usingFallback) {
            return {
                usingFallback: true,
                message: 'Using simple heuristics. Run preprocessing script for historical data.'
            };
        }

        return {
            usingFallback: false,
            season: this.data?.season || 'unknown',
            generatedAt: this.data?.generated_at || 'unknown',
            totalPlays: this.data?.total_plays || 0,
            leagueRates: this.data?.league_conversion_rates?.length || 0,
            teamRates: this.data?.team_conversion_rates?.length || 0,
            playerRates: this.data?.player_success_rates?.length || 0
        };
    }
}

/**
 * Load probability data from JSON file
 * @returns {Promise<Object|null>} Probability data or null if not available
 */
async function loadProbabilityData() {
    try {
        const response = await fetch('probability-data.json');
        if (!response.ok) {
            throw new Error('Probability data file not found');
        }

        const data = await response.json();
        log('Loaded probability data successfully', data.metadata);
        return data;
    } catch (error) {
        logError('Failed to load probability data, using fallback heuristics', error);
        return null;
    }
}

// Global probability calculator instance
let globalProbabilityCalculator = null;

/**
 * Initialize probability calculator
 * @returns {Promise<ProbabilityCalculator>} Initialized calculator
 */
async function initProbabilityCalculator() {
    const data = await loadProbabilityData();
    globalProbabilityCalculator = new ProbabilityCalculator(data);

    if (globalProbabilityCalculator.isUsingFallback()) {
        showToast('Using simplified probability model. Run preprocessing script for historical data.', 'info', 5000);
    }

    return globalProbabilityCalculator;
}

/**
 * Get global probability calculator instance
 * @returns {ProbabilityCalculator|null} Calculator instance
 */
function getProbabilityCalculator() {
    return globalProbabilityCalculator;
}

// Export for use in other modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ProbabilityCalculator,
        loadProbabilityData,
        initProbabilityCalculator,
        getProbabilityCalculator
    };
}
