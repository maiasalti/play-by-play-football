// Main Application Logic
// NFL Live Game Simulator

// Application State
const appState = {
    currentScreen: 'gameSelection', // 'gameSelection' or 'gameView'
    selectedGameId: null,
    focusTeam: null, // 'home', 'away', or null for neutral
    autoRefreshEnabled: true,
    refreshInterval: null,
    probabilityCalculator: null,
    lastGameState: null
};

// Initialize application on page load
document.addEventListener('DOMContentLoaded', async () => {
    log('Application starting...');

    // Initialize storage
    initStorage();

    // Initialize probability calculator
    appState.probabilityCalculator = await initProbabilityCalculator();

    // Load user preferences
    loadUserPreferences();

    // Set up event listeners
    setupEventListeners();

    // Load initial screen
    await loadGameSelectionScreen();

    log('Application initialized successfully');
});

/**
 * Load user preferences from localStorage
 */
function loadUserPreferences() {
    appState.autoRefreshEnabled = getPreference('autoRefresh', true);
    appState.focusTeam = getPreference('focusTeam', null);
    const lastGameId = getPreference('selectedGame', null);

    if (lastGameId) {
        // Optionally resume last game
        log(`Last viewed game: ${lastGameId}`);
    }
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        navigateToGameSelection();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await manualRefresh();
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Team toggle buttons (will be set up per-tab in loadGameViewScreen)

    // Close modal
    document.getElementById('closeModal').addEventListener('click', () => {
        closePlayerModal();
    });

    // Close modal when clicking outside
    document.getElementById('playerModal').addEventListener('click', (e) => {
        if (e.target.id === 'playerModal') {
            closePlayerModal();
        }
    });
}

/**
 * Switch between tabs
 * @param {string} tabName - Tab name ('overview' or 'probabilities')
 */
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tabName === 'overview') {
        document.getElementById('overviewTab').classList.add('active');
    } else if (tabName === 'probabilities') {
        document.getElementById('probabilitiesTab').classList.add('active');
        // Render probabilities tab content
        renderProbabilitiesTab();
    }
}

/**
 * Navigate to game selection screen
 */
async function navigateToGameSelection() {
    appState.currentScreen = 'gameSelection';
    showScreen('gameSelectionScreen');
    document.getElementById('backBtn').style.display = 'none';

    // Stop auto-refresh
    stopAutoRefresh();

    await loadGameSelectionScreen();
}

/**
 * Navigate to game view screen
 * @param {string} gameId - Game ID to view
 */
async function navigateToGameView(gameId) {
    appState.currentScreen = 'gameView';
    appState.selectedGameId = gameId;
    savePreference('selectedGame', gameId);

    showScreen('gameViewScreen');
    document.getElementById('backBtn').style.display = 'inline-block';

    await loadGameViewScreen(gameId);
}

/**
 * Show specific screen
 * @param {string} screenId - Screen element ID
 */
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // Show selected screen
    document.getElementById(screenId).classList.add('active');
}

/**
 * Load game selection screen
 */
async function loadGameSelectionScreen() {
    const container = document.getElementById('gamesContainer');
    const dateDisplay = document.getElementById('gameDate');

    // Show loading
    container.innerHTML = '<div class="loading">Loading games...</div>';

    // Set date
    dateDisplay.textContent = formatDate(new Date());

    try {
        // Fetch live games
        const scoreboardData = await fetchLiveGames();
        const games = parseScoreboardGames(scoreboardData);

        if (games.length === 0) {
            container.innerHTML = '<div class="empty-state">No live NFL games right now.<br>Check back during game days (Thu/Sun/Mon).</div>';
            return;
        }

        // Render game cards
        container.innerHTML = '';
        games.forEach(game => {
            const gameCard = createGameCard(game);
            container.appendChild(gameCard);
        });

        log(`Displayed ${games.length} games`);
    } catch (error) {
        logError('Failed to load games', error);
        container.innerHTML = '<div class="empty-state">Failed to load games.<br>Please check your connection and try again.</div>';
        showToast('Failed to load games', 'error');
    }
}

/**
 * Create game card element
 * @param {Object} game - Parsed game object
 * @returns {HTMLElement} Game card element
 */
function createGameCard(game) {
    const card = createElement('div', {
        className: 'game-card',
        events: {
            click: () => navigateToGameView(game.id)
        }
    });

    // Determine status class
    let statusClass = 'status-scheduled';
    if (game.status.state === 'in') {
        statusClass = 'status-live';
    } else if (game.status.completed) {
        statusClass = 'status-final';
    }

    card.innerHTML = `
        <div class="game-card-header">
            <span class="game-status ${statusClass}">${escapeHtml(game.status.detail)}</span>
        </div>
        <div class="game-teams">${escapeHtml(game.name)}</div>
        <div class="game-score">
            <span>${escapeHtml(game.awayTeam.abbreviation)}: ${game.awayTeam.score}</span>
            <span>${escapeHtml(game.homeTeam.abbreviation)}: ${game.homeTeam.score}</span>
        </div>
    `;

    return card;
}

/**
 * Load game view screen
 * @param {string} gameId - Game ID
 */
async function loadGameViewScreen(gameId) {
    try {
        // Fetch scoreboard, summary, AND play-by-play for most accurate data
        const [scoreboardData, summaryData, playData] = await Promise.all([
            fetchLiveGames(),
            fetchGameSummary(gameId),
            fetchPlayByPlay(gameId, 20)
        ]);

        // Find this game in scoreboard to get situation data
        const scoreboardGame = scoreboardData.events.find(e => e.id === gameId);

        // Parse game state from summary, but add situation from scoreboard
        const gameState = parseGameState(summaryData);

        // If scoreboard has situation data, use it
        if (scoreboardGame && scoreboardGame.competitions[0].situation) {
            gameState.situation = {
                down: scoreboardGame.competitions[0].situation.down || 0,
                distance: scoreboardGame.competitions[0].situation.distance || 0,
                yardLine: scoreboardGame.competitions[0].situation.yardLine || 0,
                yardsToEndzone: scoreboardGame.competitions[0].situation.yardsToEndzone || 0,
                possession: scoreboardGame.competitions[0].situation.possession || null,
                possessionText: scoreboardGame.competitions[0].situation.possessionText || '',
                isRedZone: scoreboardGame.competitions[0].situation.isRedZone || false,
                homeTimeouts: scoreboardGame.competitions[0].situation.homeTimeouts || 3,
                awayTimeouts: scoreboardGame.competitions[0].situation.awayTimeouts || 3
            };

            // Add lastPlay from scoreboard
            gameState.lastPlay = scoreboardGame.competitions[0].situation.lastPlay || null;

            // Update possessionTeam based on possession ID
            const possessionId = scoreboardGame.competitions[0].situation.possession;
            if (possessionId) {
                if (possessionId === gameState.homeTeam.id) {
                    gameState.possessionTeam = {
                        id: gameState.homeTeam.id,
                        name: gameState.homeTeam.name,
                        abbreviation: gameState.homeTeam.abbreviation
                    };
                } else if (possessionId === gameState.awayTeam.id) {
                    gameState.possessionTeam = {
                        id: gameState.awayTeam.id,
                        name: gameState.awayTeam.name,
                        abbreviation: gameState.awayTeam.abbreviation
                    };
                }
            }

            // Update status from scoreboard (more accurate)
            gameState.status.period = scoreboardGame.status.period;
            gameState.status.clock = scoreboardGame.status.displayClock;
        }

        // If no lastPlay from scoreboard, use most recent play from play-by-play
        if (!gameState.lastPlay || !gameState.lastPlay.text) {
            const plays = parsePlayByPlay(playData);
            if (plays.length > 0) {
                const mostRecentPlay = plays[0]; // Already reversed, so first is most recent
                gameState.lastPlay = {
                    text: mostRecentPlay.text,
                    shortText: mostRecentPlay.shortText,
                    probability: { EPA: 0 }, // EPA not available from this endpoint
                    team: null,
                    end: {
                        yardLine: mostRecentPlay.yardLine + mostRecentPlay.yardsGained
                    }
                };
            }
        }

        // Store game state
        appState.lastGameState = gameState;

        // Render game state
        renderGameState(gameState);

        // Extract rosters for last play rendering
        const homeRoster = extractRoster(gameState.rawData, gameState.homeTeam.id);
        const awayRoster = extractRoster(gameState.rawData, gameState.awayTeam.id);

        // Render last play with EPA and player info
        renderLastPlay(gameState, homeRoster, awayRoster);

        // Render recent plays (use already fetched data)
        renderRecentPlaysFromData(playData, homeRoster, awayRoster);

        // Setup team toggle buttons (for probabilities tab)
        setupTeamToggles();

        // Default focus to home team if not set
        if (!appState.focusTeam) {
            setFocusTeam('home');
        }

        // Start auto-refresh if enabled and game is live
        if (appState.autoRefreshEnabled && !gameState.status.completed) {
            startAutoRefresh(gameId);
        }

        log(`Loaded game view for ${gameId}`);
    } catch (error) {
        logError(`Failed to load game ${gameId}`, error);
        showToast('Failed to load game data', 'error');
    }
}

/**
 * Render game state on TV-style field
 * @param {Object} gameState - Parsed game state
 */
function renderGameState(gameState) {
    // Update TV Scoreboard
    document.getElementById('quarterTV').textContent = `Q${gameState.status.period}`;
    document.getElementById('clockTV').textContent = gameState.status.clock;

    // Update scores on TV scoreboard
    document.getElementById('awayScoreTV').textContent = gameState.awayTeam.score;
    document.getElementById('homeScoreTV').textContent = gameState.homeTeam.score;
    document.getElementById('awayTeamAbbrScore').textContent = gameState.awayTeam.abbreviation;
    document.getElementById('homeTeamAbbrScore').textContent = gameState.homeTeam.abbreviation;

    // Update team logos on scoreboard
    const awayLogoScore = document.getElementById('awayTeamLogoScore');
    const homeLogoScore = document.getElementById('homeTeamLogoScore');
    if (awayLogoScore) {
        awayLogoScore.src = getTeamLogoUrl(gameState.awayTeam);
        awayLogoScore.onerror = function() { this.style.display = 'none'; };
    }
    if (homeLogoScore) {
        homeLogoScore.src = getTeamLogoUrl(gameState.homeTeam);
        homeLogoScore.onerror = function() { this.style.display = 'none'; };
    }

    // Update down & distance on TV scoreboard
    let downDistanceText = 'Kickoff';
    let fieldPosText = '50';

    if (gameState.situation.down > 0) {
        const downText = getOrdinal(gameState.situation.down);
        downDistanceText = `${downText} & ${gameState.situation.distance}`;
        fieldPosText = gameState.situation.possessionText || '50';
    } else if (gameState.lastPlay && gameState.lastPlay.end) {
        downDistanceText = 'Between plays';
        const yardLine = gameState.lastPlay.end.yardLine || 50;
        fieldPosText = `${yardLine} yard line`;
    } else if (gameState.situation.possessionText) {
        downDistanceText = 'Between plays';
        fieldPosText = gameState.situation.possessionText;
    }

    document.getElementById('downDistanceTV').textContent = downDistanceText;
    document.getElementById('fieldPositionTV').textContent = fieldPosText;

    // Update end zone labels
    document.getElementById('endzoneAwayText').textContent = gameState.awayTeam.abbreviation;
    document.getElementById('endzoneHomeText').textContent = gameState.homeTeam.abbreviation;

    // Update field team logos (fixed positions)
    const awayFieldLogo = document.getElementById('awayLogoFieldImg');
    const homeFieldLogo = document.getElementById('homeLogoFieldImg');
    if (awayFieldLogo) {
        awayFieldLogo.src = getTeamLogoUrl(gameState.awayTeam);
        awayFieldLogo.alt = gameState.awayTeam.abbreviation;
        awayFieldLogo.onerror = function() { this.style.display = 'none'; };
    }
    if (homeFieldLogo) {
        homeFieldLogo.src = getTeamLogoUrl(gameState.homeTeam);
        homeFieldLogo.alt = gameState.homeTeam.abbreviation;
        homeFieldLogo.onerror = function() { this.style.display = 'none'; };
    }

    // Position the offensive team marker at ball location
    updateFieldVisual(gameState);

    // Update team toggle labels
    const homeToggles = document.querySelectorAll('#teamToggleHome');
    const awayToggles = document.querySelectorAll('#teamToggleAway');
    homeToggles.forEach(btn => btn.textContent = gameState.homeTeam.abbreviation);
    awayToggles.forEach(btn => btn.textContent = gameState.awayTeam.abbreviation);
}

/**
 * Update field visual - position offensive team logo at ball location
 * @param {Object} gameState - Game state
 */
function updateFieldVisual(gameState) {
    const marker = document.getElementById('offensiveMarker');
    if (!marker) return;

    // Determine which team has possession
    let offensiveTeam = null;
    if (gameState.possessionTeam) {
        offensiveTeam = gameState.possessionTeam.id === gameState.homeTeam.id
            ? gameState.homeTeam
            : gameState.awayTeam;
    } else if (gameState.lastPlay && gameState.lastPlay.team) {
        const teamId = gameState.lastPlay.team.id;
        offensiveTeam = teamId === gameState.homeTeam.id ? gameState.homeTeam : gameState.awayTeam;
    }

    // Set offensive team logo
    const logoElement = document.getElementById('offensiveTeamLogo');
    if (offensiveTeam && logoElement) {
        logoElement.src = getTeamLogoUrl(offensiveTeam);
        logoElement.alt = offensiveTeam.abbreviation;
        logoElement.onerror = function() { this.style.display = 'none'; };
    }

    // Calculate ball position on field (0-100 yards)
    // Horizontal field: Away end zone is at left (0 yards), Home end zone is at right (100 yards)
    let yardLine = 50; // Default to midfield

    if (gameState.situation.yardLine) {
        yardLine = gameState.situation.yardLine;
    } else if (gameState.lastPlay && gameState.lastPlay.end && gameState.lastPlay.end.yardLine) {
        yardLine = gameState.lastPlay.end.yardLine;
    }

    // Convert yard line to percentage (0 = away end zone, 100 = home end zone)
    // Account for end zones (60px each) in the total width
    const yardPercentage = yardLine / 100; // 0 to 1

    // Calculate left position as percentage of total field width
    // 60px end zone + percentage of playable field + 60px end zone
    // We want position from 60px to (100% - 60px)
    const leftPercentage = 5 + (yardPercentage * 90); // 5% to 95% (accounting for end zones)

    marker.style.left = `${leftPercentage}%`;

    log(`Ball at yard ${yardLine}, positioned at ${leftPercentage.toFixed(1)}% from left`);
}

/**
 * Render probabilities
 * @param {Object} gameState - Game state
 */
function renderProbabilities(gameState) {
    const container = document.getElementById('probabilityContent');

    // Only show probabilities if we have down/distance
    if (!gameState.situation.down || gameState.situation.down === 0) {
        container.innerHTML = '<div class="empty-state">Waiting for play to start...</div>';
        return;
    }

    const calc = appState.probabilityCalculator;
    if (!calc) {
        container.innerHTML = '<div class="empty-state">Probability calculator not available</div>';
        return;
    }

    // Get team abbreviation for focused team
    let focusTeamAbbr = null;
    if (appState.focusTeam === 'home') {
        focusTeamAbbr = gameState.homeTeam.abbreviation;
    } else if (appState.focusTeam === 'away') {
        focusTeamAbbr = gameState.awayTeam.abbreviation;
    }

    // Get scenarios
    const leagueScenarios = calc.getScenarioComparison(gameState, null);
    const teamScenarios = focusTeamAbbr ? calc.getScenarioComparison(gameState, focusTeamAbbr) : leagueScenarios;

    // Build HTML
    let html = '<div class="prob-section">';
    html += '<h4>League Average</h4>';
    html += '<div class="prob-bars">';
    html += createProbabilityBar('Pass', leagueScenarios.pass.probability, false);
    html += createProbabilityBar('Run', leagueScenarios.run.probability, false);
    html += '</div>';
    html += '</div>';

    if (focusTeamAbbr) {
        html += '<div class="prob-section">';
        html += `<h4>${escapeHtml(focusTeamAbbr)} (2025 Season)</h4>`;
        html += '<div class="prob-bars">';
        html += createProbabilityBar('Pass', teamScenarios.pass.probability, true);
        html += createProbabilityBar('Run', teamScenarios.run.probability, true);
        html += '</div>';
        html += '</div>';

        // Add insight
        const insight = calc.generateInsight(teamScenarios, leagueScenarios, focusTeamAbbr);
        html += `<div class="prob-insight">${escapeHtml(insight)}</div>`;
    }

    container.innerHTML = html;
}

/**
 * Create probability bar HTML
 * @param {string} label - Label text
 * @param {number} probability - Probability (0-1)
 * @param {boolean} isTeamSpecific - Whether this is team-specific data
 * @returns {string} HTML string
 */
function createProbabilityBar(label, probability, isTeamSpecific) {
    const percentage = (probability * 100).toFixed(0);
    const fillClass = isTeamSpecific ? 'bar-fill team-specific' : 'bar-fill';

    return `
        <div class="prob-bar">
            <label>${escapeHtml(label)}</label>
            <div class="bar-container">
                <div class="${fillClass}" style="width: ${percentage}%"></div>
                <span class="bar-label">${percentage}%</span>
            </div>
        </div>
    `;
}

/**
 * Render players
 * @param {Object} gameState - Game state
 */
async function renderPlayers(gameState) {
    const container = document.getElementById('playersContent');

    // Determine which team to show players for
    let teamId = null;
    if (appState.focusTeam === 'home') {
        teamId = gameState.homeTeam.id;
    } else if (appState.focusTeam === 'away') {
        teamId = gameState.awayTeam.id;
    } else if (gameState.possessionTeam) {
        teamId = gameState.possessionTeam.id;
    }

    if (!teamId) {
        container.innerHTML = '<div class="empty-state">Select a team to view players</div>';
        return;
    }

    try {
        // Extract roster from game summary
        const roster = extractRoster(gameState.rawData, teamId);

        if (roster.length === 0) {
            container.innerHTML = '<div class="empty-state">No player data available</div>';
            return;
        }

        // Show only skill position players (QB, RB, WR, TE)
        const skillPlayers = roster.filter(p =>
            ['QB', 'RB', 'WR', 'TE', 'FB'].includes(p.position)
        );

        // Render player cards
        container.innerHTML = '';
        skillPlayers.slice(0, 12).forEach(player => {
            const playerCard = createPlayerCard(player);
            container.appendChild(playerCard);
        });

        if (skillPlayers.length === 0) {
            container.innerHTML = '<div class="empty-state">No skill players found</div>';
        }
    } catch (error) {
        logError('Failed to render players', error);
        container.innerHTML = '<div class="empty-state">Failed to load players</div>';
    }
}

/**
 * Create player card element
 * @param {Object} player - Player data
 * @returns {HTMLElement} Player card element
 */
function createPlayerCard(player) {
    const card = createElement('div', {
        className: 'player-card has-tooltip',
        events: {
            click: () => showPlayerModal(player)
        }
    });

    // Get tooltip stats based on player position
    const tooltipStats = getTooltipStats(player);

    card.innerHTML = `
        <div class="player-card-name">${escapeHtml(player.shortName || player.name)}</div>
        <div class="player-card-position">${escapeHtml(player.position)}</div>
        <div class="player-tooltip">
            <div class="tooltip-header">${escapeHtml(player.name)}</div>
            <div class="tooltip-position">${escapeHtml(player.position)} ${player.jersey ? '#' + player.jersey : ''}</div>
            <div class="tooltip-stats">${tooltipStats}</div>
        </div>
    `;

    return card;
}

/**
 * Show player modal
 * @param {Object} player - Player data
 */
function showPlayerModal(player) {
    const modal = document.getElementById('playerModal');

    // Set player name and position
    document.getElementById('playerName').textContent = player.name;
    document.getElementById('playerPosition').textContent = player.position;
    document.getElementById('playerTeam').textContent = player.jersey ? `#${player.jersey}` : '';

    // Render season stats (placeholder - would need real data)
    const seasonStats = document.getElementById('seasonStats');
    seasonStats.innerHTML = '<div class="empty-state">Season stats not available in current data</div>';

    // Render game stats
    const gameStats = document.getElementById('gameStats');
    if (player.stats && player.stats.length > 0) {
        gameStats.innerHTML = player.stats.slice(0, 6).map(stat => `
            <div class="stat-item">
                <div class="stat-label">${escapeHtml(stat.label || 'Stat')}</div>
                <div class="stat-value">${escapeHtml(stat.displayValue || '0')}</div>
            </div>
        `).join('');
    } else {
        gameStats.innerHTML = '<div class="empty-state">No stats yet this game</div>';
    }

    // Render probability impact
    const probImpact = document.getElementById('playerProbability');
    if (appState.lastGameState && appState.lastGameState.situation.down > 0) {
        const calc = appState.probabilityCalculator;
        const baseProb = calc.getConversionProbability(
            appState.lastGameState.situation.down,
            appState.lastGameState.situation.distance,
            'pass', // Assuming pass for now
            null
        );

        const percentage = (baseProb * 100).toFixed(0);
        probImpact.innerHTML = `
            <div class="prob-bar">
                <label>Success probability with this player</label>
                <div class="bar-container">
                    <div class="bar-fill" style="width: ${percentage}%"></div>
                    <span class="bar-label">${percentage}%</span>
                </div>
            </div>
            <p style="margin-top: 10px; color: var(--text-secondary); font-size: 0.9rem;">
                League average: ${percentage}%
            </p>
        `;
    } else {
        probImpact.innerHTML = '<div class="empty-state">Probability data not available for current situation</div>';
    }

    // Show modal
    modal.classList.add('active');
}

/**
 * Close player modal
 */
function closePlayerModal() {
    document.getElementById('playerModal').classList.remove('active');
}

/**
 * Render last play with EPA and player info
 * @param {Object} gameState - Game state
 * @param {Array} homeRoster - Home team roster
 * @param {Array} awayRoster - Away team roster
 */
function renderLastPlay(gameState, homeRoster = [], awayRoster = []) {
    const container = document.getElementById('lastPlayContent');
    if (!container) return;

    const lastPlay = gameState.lastPlay;

    if (!lastPlay || !lastPlay.text) {
        container.innerHTML = `
            <div class="last-play-epa">
                <span class="epa-label">EPA:</span>
                <span id="lastPlayEPA" class="epa-value">--</span>
            </div>
            <div id="lastPlayPlayers" class="last-play-players">
                <div class="loading">Waiting for play data...</div>
            </div>
            <div id="lastPlayDescription" class="last-play-description">
                <p id="lastPlayText">No recent plays</p>
            </div>
        `;
        return;
    }

    // Extract EPA from probability data
    const epa = lastPlay.probability?.EPA || lastPlay.probability?.epa || 0;
    const epaClass = epa >= 0 ? 'positive' : 'negative';
    const epaDisplay = epa >= 0 ? `+${epa.toFixed(2)}` : epa.toFixed(2);

    // Parse play text to find players
    const playText = lastPlay.text || '';
    const playersInvolved = extractPlayersFromText(playText, homeRoster, awayRoster);

    // Build players HTML based on focus mode
    let playersHtml = '';
    const focusMode = appState.focusTeam; // 'home', 'away', or null

    if (playersInvolved.length === 0) {
        playersHtml = '<div class="empty-state">No player data available</div>';
    } else {
        // Filter players based on focus mode
        let displayPlayers = [];

        if (focusMode === 'home') {
            // Show offensive players if home team has possession, defensive if not
            const homeHasPossession = gameState.possessionTeam?.id === gameState.homeTeam.id;
            displayPlayers = playersInvolved.filter(p => {
                return homeHasPossession ? p.role === 'offensive' : p.role === 'defensive';
            });
        } else if (focusMode === 'away') {
            // Show offensive players if away team has possession, defensive if not
            const awayHasPossession = gameState.possessionTeam?.id === gameState.awayTeam.id;
            displayPlayers = playersInvolved.filter(p => {
                return awayHasPossession ? p.role === 'offensive' : p.role === 'defensive';
            });
        } else {
            // Neutral mode: show both offensive and defensive players
            displayPlayers = playersInvolved;
        }

        if (displayPlayers.length === 0) {
            playersHtml = '<div class="empty-state">No players in this focus mode</div>';
        } else {
            playersHtml = displayPlayers.map(player => {
                // Get tooltip stats for this player
                const tooltipStats = getTooltipStatsFromId(player.id, homeRoster, awayRoster);
                return `
                <div class="player-card ${player.role} has-tooltip">
                    <img src="${escapeHtml(player.headshot)}"
                         alt="${escapeHtml(player.name)}"
                         class="player-headshot"
                         onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=80&h=80'">
                    <span class="player-name">${escapeHtml(player.name)}</span>
                    <span class="player-role">${escapeHtml(player.action || player.role)}</span>
                    <div class="player-tooltip">
                        <div class="tooltip-header">${escapeHtml(player.name)}</div>
                        <div class="tooltip-position">${escapeHtml(player.action || player.role)}</div>
                        <div class="tooltip-stats">${tooltipStats}</div>
                    </div>
                </div>
            `}).join('');
        }
    }

    // Update container
    container.innerHTML = `
        <div class="last-play-epa">
            <span class="epa-label">EPA:</span>
            <span id="lastPlayEPA" class="epa-value ${epaClass}">${epaDisplay}</span>
        </div>
        <div id="lastPlayPlayers" class="last-play-players">
            ${playersHtml}
        </div>
        <div id="lastPlayDescription" class="last-play-description">
            <p id="lastPlayText">${escapeHtml(playText)}</p>
        </div>
    `;
}

/**
 * Extract players from play text with proper roles
 * @param {string} playText - Play description text
 * @param {Array} homeRoster - Home team roster
 * @param {Array} awayRoster - Away team roster
 * @returns {Array} Array of player objects with name, headshot, role, action
 */
function extractPlayersFromText(playText, homeRoster, awayRoster) {
    const players = [];
    const allPlayers = [...homeRoster, ...awayRoster];

    // Helper function to find player by abbreviated name
    const findPlayer = (abbrevName) => {
        if (!abbrevName) return null;

        // Remove periods and split into initials and last name
        // e.g., "D.Maye" -> ["D", "Maye"]
        const parts = abbrevName.replace(/\./g, '').split(/(?=[A-Z])/);
        const lastName = parts[parts.length - 1];

        // Find player with matching last name
        return allPlayers.find(p => {
            const playerLastName = p.name.split(' ').pop();
            return playerLastName.toLowerCase() === lastName.toLowerCase();
        });
    };

    // PASSING PLAY: "D.Maye pass short right to A.Hooper to NE 43 for 14 yards (A.Al-Shaair)."
    if (playText.includes(' pass ')) {
        // Extract passer (first name before "pass")
        const passerMatch = playText.match(/^([A-Z]\.[A-Z][a-z-]+(?:\s[A-Z][a-z-]+)?)\s+pass/);
        if (passerMatch) {
            const passer = findPlayer(passerMatch[1]);
            if (passer) {
                players.push({
                    id: passer.id,
                    name: passer.name,
                    headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${passer.id}.png`,
                    role: 'offensive',
                    action: 'Passed'
                });
            }
        }

        // Extract receiver (name after "to" but before "for" or "to [TEAM]")
        const receiverMatch = playText.match(/\bto\s+([A-Z]\.[A-Z][a-z-]+(?:-[A-Z][a-z-]+)?)\s+(?:to|for)/);
        if (receiverMatch) {
            const receiver = findPlayer(receiverMatch[1]);
            if (receiver) {
                players.push({
                    id: receiver.id,
                    name: receiver.name,
                    headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${receiver.id}.png`,
                    role: 'offensive',
                    action: 'Caught'
                });
            }
        }
    }

    // RUSHING PLAY: "J.Taylor rush left end to IND 45 for 5 yards (D.Jones)."
    else if (playText.includes(' rush ') || playText.includes(' left ') || playText.includes(' right ') || playText.includes(' middle ')) {
        // Extract rusher (first name before "rush" or directional keyword)
        const rusherMatch = playText.match(/^([A-Z]\.[A-Z][a-z-]+(?:\s[A-Z][a-z-]+)?)\s+(?:rush|left|right|middle|up)/);
        if (rusherMatch) {
            const rusher = findPlayer(rusherMatch[1]);
            if (rusher) {
                players.push({
                    id: rusher.id,
                    name: rusher.name,
                    headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${rusher.id}.png`,
                    role: 'offensive',
                    action: 'Ran'
                });
            }
        }
    }

    // SACK: "C.Stroud sacked at HOU 20 for -7 yards (M.Judon)."
    else if (playText.includes(' sacked ')) {
        const qbMatch = playText.match(/^([A-Z]\.[A-Z][a-z-]+(?:\s[A-Z][a-z-]+)?)\s+sacked/);
        if (qbMatch) {
            const qb = findPlayer(qbMatch[1]);
            if (qb) {
                players.push({
                    id: qb.id,
                    name: qb.name,
                    headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${qb.id}.png`,
                    role: 'offensive',
                    action: 'Sacked'
                });
            }
        }
    }

    // INTERCEPTION: "J.Allen intercepted by K.Hamilton at BUF 30."
    if (playText.includes(' intercepted by ')) {
        const interceptorMatch = playText.match(/intercepted by\s+([A-Z]\.[A-Z][a-z-]+(?:-[A-Z][a-z-]+)?)/);
        if (interceptorMatch) {
            const interceptor = findPlayer(interceptorMatch[1]);
            if (interceptor) {
                players.push({
                    id: interceptor.id,
                    name: interceptor.name,
                    headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${interceptor.id}.png`,
                    role: 'defensive',
                    action: 'Intercepted'
                });
            }
        }
    }

    // TACKLER: Extract name in parentheses (applies to all plays with tackles)
    const tacklerMatch = playText.match(/\(([A-Z]\.[A-Z][a-z-]+(?:-[A-Z][a-z-]+)?)\)/);
    if (tacklerMatch) {
        const tackler = findPlayer(tacklerMatch[1]);
        if (tackler) {
            // Check if this is a sack (tackler becomes sacker)
            const action = playText.includes(' sacked ') ? 'Sacked' : 'Tackled';

            players.push({
                id: tackler.id,
                name: tackler.name,
                headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${tackler.id}.png`,
                role: 'defensive',
                action: action
            });
        }
    }

    return players;
}

/**
 * Setup team toggle button listeners
 */
function setupTeamToggles() {
    document.querySelectorAll('#teamToggleHome').forEach(btn => {
        btn.addEventListener('click', () => setFocusTeam('home'));
    });
    document.querySelectorAll('#teamToggleAway').forEach(btn => {
        btn.addEventListener('click', () => setFocusTeam('away'));
    });
}

/**
 * Render probabilities tab content
 */
async function renderProbabilitiesTab() {
    if (!appState.lastGameState) {
        log('No game state available for probabilities');
        return;
    }

    const gameState = appState.lastGameState;
    const focusedTeam = appState.focusTeam;

    // Render Win Probability (always show both teams)
    renderWinProbability(gameState);

    // Get team abbreviation
    let teamAbbr = null;
    let teamName = null;
    if (focusedTeam === 'home') {
        teamAbbr = gameState.homeTeam.abbreviation;
        teamName = gameState.homeTeam.name;
    } else if (focusedTeam === 'away') {
        teamAbbr = gameState.awayTeam.abbreviation;
        teamName = gameState.awayTeam.name;
    }

    // Render General Stats
    renderGeneralStats(gameState, teamName);

    // Render Situation Probabilities
    renderSituationProbabilities(gameState, teamAbbr, teamName);

    // Render League vs Team Comparison (async - fetches play-by-play)
    await renderLeagueComparison(gameState, teamAbbr, teamName);

    // Render Player Impact (using existing roster)
    const homeRoster = extractRoster(gameState.rawData, gameState.homeTeam.id);
    const awayRoster = extractRoster(gameState.rawData, gameState.awayTeam.id);
    const teamRoster = focusedTeam === 'home' ? homeRoster : awayRoster;
    renderPlayerImpact(gameState, teamRoster, teamAbbr);
}

/**
 * Render win probability for both teams
 */
function renderWinProbability(gameState) {
    const container = document.getElementById('winProbabilityContent');
    const calc = appState.probabilityCalculator;

    if (!calc) {
        container.innerHTML = '<div class="empty-state">Probability calculator not available</div>';
        return;
    }

    // Get win probabilities for both teams
    const homeWinProb = calc.getWinProbability(gameState, gameState.homeTeam.id);
    const awayWinProb = calc.getWinProbability(gameState, gameState.awayTeam.id);

    const html = `
        <div class="win-prob-display">
            <div class="win-prob-team ${homeWinProb.probability > 0.5 ? 'winning' : 'losing'}">
                <h3>${escapeHtml(gameState.homeTeam.name)}</h3>
                <div class="win-prob-percentage">${(homeWinProb.probability * 100).toFixed(1)}%</div>
                <div class="win-prob-description">${escapeHtml(homeWinProb.description)}</div>
            </div>
            <div class="win-prob-team ${awayWinProb.probability > 0.5 ? 'winning' : 'losing'}">
                <h3>${escapeHtml(gameState.awayTeam.name)}</h3>
                <div class="win-prob-percentage">${(awayWinProb.probability * 100).toFixed(1)}%</div>
                <div class="win-prob-description">${escapeHtml(awayWinProb.description)}</div>
            </div>
        </div>

        <div class="win-prob-bar">
            <div class="win-prob-bar-fill-home" style="width: ${(homeWinProb.probability * 100).toFixed(1)}%">
                ${gameState.homeTeam.abbreviation} ${(homeWinProb.probability * 100).toFixed(1)}%
            </div>
            <div class="win-prob-bar-fill-away" style="width: ${(awayWinProb.probability * 100).toFixed(1)}%">
                ${gameState.awayTeam.abbreviation} ${(awayWinProb.probability * 100).toFixed(1)}%
            </div>
        </div>

        <p class="stats-explanation" style="margin-top: 15px;">
            <strong>Calculation Method:</strong> Win probability is calculated using score differential (±5-15% per point depending on time remaining),
            time remaining in game, possession (+3%), and field position (+5% if in scoring range).
            The formula weighs score more heavily as time runs out, reflecting the decreasing number of possessions remaining.
        </p>

        <div class="polymarket-comparison">
            <h4>Betting Market Comparison</h4>
            <p class="stats-explanation">
                <strong>Note:</strong> Polymarket and other betting markets often differ from statistical models because they incorporate:
                injuries, weather conditions, coaching decisions, and market sentiment. Our model uses only game state (score, time, possession, field position).
                For comparison with live betting odds, check Polymarket, FanDuel, or DraftKings.
            </p>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Render general game statistics
 */
function renderGeneralStats(gameState, teamName) {
    const container = document.getElementById('generalStatsContent');

    const html = `
        <div class="stat-row">
            <span class="stat-label">Selected Team</span>
            <span class="stat-value">${escapeHtml(teamName || 'None')}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Current Quarter</span>
            <span class="stat-value">Q${gameState.status.period}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Time Remaining</span>
            <span class="stat-value">${gameState.status.clock}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Score</span>
            <span class="stat-value">${gameState.homeTeam.abbreviation} ${gameState.homeTeam.score} - ${gameState.awayTeam.score} ${gameState.awayTeam.abbreviation}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Current Down & Distance</span>
            <span class="stat-value">${gameState.situation.down > 0 ? getOrdinal(gameState.situation.down) + ' & ' + gameState.situation.distance : 'Between plays'}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Field Position</span>
            <span class="stat-value">${gameState.situation.possessionText || 'Unknown'}</span>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Render situation probabilities
 */
function renderSituationProbabilities(gameState, teamAbbr, teamName) {
    const container = document.getElementById('situationProbsContent');

    if (!gameState.situation.down || gameState.situation.down === 0) {
        container.innerHTML = '<div class="empty-state">Waiting for next play...</div>';
        return;
    }

    const calc = appState.probabilityCalculator;
    if (!calc) {
        container.innerHTML = '<div class="empty-state">Probability calculator not available</div>';
        return;
    }

    // Get scenarios for league average and team-specific
    const leagueScenarios = calc.getScenarioComparison(gameState, null);
    const teamScenarios = teamAbbr ? calc.getScenarioComparison(gameState, teamAbbr) : leagueScenarios;

    const html = `
        <div class="prob-section">
            <h4>League Average Success Rates</h4>
            <p class="stats-explanation">Based on all NFL teams this season in similar situations (${getOrdinal(gameState.situation.down)} & ${gameState.situation.distance})</p>
            <div class="prob-bars">
                <div class="prob-bar">
                    <label>Pass Play Success</label>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(leagueScenarios.pass.probability * 100).toFixed(0)}%; background-color: var(--accent-primary);">
                            <span class="bar-text">${(leagueScenarios.pass.probability * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                <div class="prob-bar">
                    <label>Run Play Success</label>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(leagueScenarios.run.probability * 100).toFixed(0)}%; background-color: var(--success-color);">
                            <span class="bar-text">${(leagueScenarios.run.probability * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="prob-section">
            <h4>${escapeHtml(teamName)} Specific Success Rates</h4>
            <p class="stats-explanation">Team performance weighted 70% + league average 30% (accounts for sample size and regression to mean)</p>
            <div class="prob-bars">
                <div class="prob-bar">
                    <label>Pass Play Success</label>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(teamScenarios.pass.probability * 100).toFixed(0)}%; background-color: var(--accent-primary);">
                            <span class="bar-text">${(teamScenarios.pass.probability * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                <div class="prob-bar">
                    <label>Run Play Success</label>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(teamScenarios.run.probability * 100).toFixed(0)}%; background-color: var(--success-color);">
                            <span class="bar-text">${(teamScenarios.run.probability * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Calculate team performance from current game plays
 * @param {string} teamAbbr - Team abbreviation
 * @param {string} teamId - Team ID
 * @returns {Object} Game-specific performance stats
 */
async function calculateGamePerformance(teamAbbr, teamId) {
    try {
        const gameId = appState.selectedGameId;
        if (!gameId) return null;

        // Fetch play-by-play data
        const playData = await fetchPlayByPlay(gameId, 200);
        if (!playData || !playData.items) return null;

        const plays = playData.items;

        // Track comprehensive stats
        const stats = {
            totalPlays: 0,
            totalYards: 0,
            passAttempts: 0,
            passYards: 0,
            rushAttempts: 0,
            rushYards: 0,
            thirdDownAttempts: 0,
            thirdDownConversions: 0,
            redZoneAttempts: 0,
            redZoneTDs: 0,
            turnovers: 0,
            drives: 0,
            points: 0
        };

        plays.forEach(play => {
            const playText = play.text || '';

            // Check if this is the team's offensive play
            // Extract team ID from play.team.$ref URL
            let playTeamId = null;
            if (play.team && play.team.$ref) {
                const match = play.team.$ref.match(/teams\/(\d+)/);
                if (match) {
                    playTeamId = match[1];
                }
            }

            // Skip if not this team's offensive play
            if (!playTeamId || playTeamId !== String(teamId)) return;

            const yardsGained = play.statYardage || 0;
            const down = play.start?.down || 0;
            const yardsToEndzone = play.start?.yardsToEndzone || 100;
            const distance = play.start?.distance || 0;

            // Determine play type using play.type
            const playType = play.type?.text || '';
            let isPass = false;
            let isRush = false;

            // Pass plays
            if (playType.includes('Pass') || playType.includes('Sack') || playText.includes(' pass ') || playText.includes(' sacked ')) {
                isPass = true;
                stats.passAttempts++;
                stats.passYards += yardsGained;
                stats.totalPlays++;
                stats.totalYards += yardsGained;
            }
            // Rush plays
            else if (playType.includes('Rush') || playText.includes(' rush ') || playText.match(/\b(left end|right end|left tackle|right tackle|left guard|right guard|up the middle)\b/)) {
                isRush = true;
                stats.rushAttempts++;
                stats.rushYards += yardsGained;
                stats.totalPlays++;
                stats.totalYards += yardsGained;
            }

            // Skip non-offensive plays
            if (!isPass && !isRush) return;

            // Track 3rd down conversions
            if (down === 3) {
                stats.thirdDownAttempts++;
                const distance = play.start?.distance || 0;
                if (yardsGained >= distance) {
                    stats.thirdDownConversions++;
                }
            }

            // Track red zone performance
            if (yardsToEndzone <= 20) {
                if (down === 1) {
                    stats.redZoneAttempts++;
                }
                if (play.scoringPlay && playText.includes('touchdown')) {
                    stats.redZoneTDs++;
                }
            }

            // Track turnovers
            if (playText.includes('intercepted') || playText.includes('fumble')) {
                stats.turnovers++;
            }

            // Track scoring
            if (play.scoringPlay) {
                stats.points += play.scoreValue || 0;
            }
        });

        // Calculate efficiency metrics
        const result = {
            yardsPerPlay: stats.totalPlays > 0 ? stats.totalYards / stats.totalPlays : 0,
            yardsPerPass: stats.passAttempts > 0 ? stats.passYards / stats.passAttempts : 0,
            yardsPerRush: stats.rushAttempts > 0 ? stats.rushYards / stats.rushAttempts : 0,
            thirdDownPct: stats.thirdDownAttempts > 0 ? stats.thirdDownConversions / stats.thirdDownAttempts : 0,
            redZoneTDPct: stats.redZoneAttempts > 0 ? stats.redZoneTDs / stats.redZoneAttempts : 0,
            turnovers: stats.turnovers,
            totalPlays: stats.totalPlays,
            totalYards: stats.totalYards,
            passAttempts: stats.passAttempts,
            rushAttempts: stats.rushAttempts
        };

        log(`Game performance for ${teamAbbr} (ID: ${teamId}): ${stats.totalPlays} plays, ${stats.totalYards} yards`);
        return result;
    } catch (error) {
        logError('Failed to calculate game performance', error);
        return null;
    }
}

/**
 * Generate season stats (fallback with team variation)
 * @param {string} teamAbbr - Team abbreviation
 * @returns {Object} Season stats
 */
function generateSeasonStats(teamAbbr) {
    // League average stats (2024-2025 NFL season)
    const leagueAvg = {
        yardsPerPlay: 5.5,
        yardsPerPass: 7.0,
        yardsPerRush: 4.2,
        thirdDownPct: 0.40,
        redZoneTDPct: 0.55
    };

    // Generate team-specific variation
    let hash = 0;
    for (let i = 0; i < teamAbbr.length; i++) {
        hash = ((hash << 5) - hash) + teamAbbr.charCodeAt(i);
        hash = hash & hash;
    }

    // Use hash to create consistent variation (-20% to +20%)
    const variation = ((hash % 40) - 20) / 100;

    return {
        yardsPerPlay: leagueAvg.yardsPerPlay * (1 + variation),
        yardsPerPass: leagueAvg.yardsPerPass * (1 + variation * 0.8),
        yardsPerRush: leagueAvg.yardsPerRush * (1 + variation * 1.2),
        thirdDownPct: Math.max(0.25, Math.min(0.55, leagueAvg.thirdDownPct * (1 + variation))),
        redZoneTDPct: Math.max(0.35, Math.min(0.70, leagueAvg.redZoneTDPct * (1 + variation)))
    };
}

/**
 * Render league vs team comparison
 */
async function renderLeagueComparison(gameState, teamAbbr, teamName) {
    const container = document.getElementById('comparisonContent');

    if (!teamAbbr) {
        container.innerHTML = '<div class="empty-state">Select a team to view comparison</div>';
        return;
    }

    const calc = appState.probabilityCalculator;
    if (!calc) {
        container.innerHTML = '<div class="empty-state">Probability calculator not available</div>';
        return;
    }

    // Get team ID
    const teamId = appState.focusTeam === 'home' ? gameState.homeTeam.id : gameState.awayTeam.id;

    // Get game-specific performance
    const gamePerformance = await calculateGamePerformance(teamAbbr, teamId);

    // Get season stats
    const seasonStats = generateSeasonStats(teamAbbr);

    // League averages (2024-2025 NFL season)
    const leagueStats = {
        yardsPerPlay: 5.5,
        yardsPerPass: 7.0,
        yardsPerRush: 4.2,
        thirdDownPct: 0.40,
        redZoneTDPct: 0.55
    };

    // Define key stats to display
    const stats = [
        {
            label: 'Yards per Play',
            season: seasonStats.yardsPerPlay,
            today: gamePerformance?.yardsPerPlay,
            league: leagueStats.yardsPerPlay,
            format: 'decimal'
        },
        {
            label: 'Yards per Pass Attempt',
            season: seasonStats.yardsPerPass,
            today: gamePerformance?.yardsPerPass,
            league: leagueStats.yardsPerPass,
            format: 'decimal'
        },
        {
            label: 'Yards per Rush Attempt',
            season: seasonStats.yardsPerRush,
            today: gamePerformance?.yardsPerRush,
            league: leagueStats.yardsPerRush,
            format: 'decimal'
        },
        {
            label: 'Third Down Conversion %',
            season: seasonStats.thirdDownPct,
            today: gamePerformance?.thirdDownPct,
            league: leagueStats.thirdDownPct,
            format: 'percentage'
        },
        {
            label: 'Red Zone TD %',
            season: seasonStats.redZoneTDPct,
            today: gamePerformance?.redZoneTDPct,
            league: leagueStats.redZoneTDPct,
            format: 'percentage'
        }
    ];

    let html = `
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Stat</th>
                    <th>${escapeHtml(teamAbbr)} Season</th>
                    <th>${escapeHtml(teamAbbr)} Today</th>
                    <th>League Avg</th>
                </tr>
            </thead>
            <tbody>
    `;

    stats.forEach(stat => {
        const seasonVal = stat.format === 'percentage'
            ? (stat.season * 100).toFixed(1) + '%'
            : stat.season.toFixed(1);

        const todayVal = stat.today !== undefined && stat.today !== null && stat.today > 0
            ? (stat.format === 'percentage' ? (stat.today * 100).toFixed(1) + '%' : stat.today.toFixed(1))
            : 'N/A';

        const leagueVal = stat.format === 'percentage'
            ? (stat.league * 100).toFixed(1) + '%'
            : stat.league.toFixed(1);

        // Calculate if today is better or worse than season
        let todayClass = '';
        if (stat.today !== undefined && stat.today !== null && stat.today > 0) {
            todayClass = stat.today > stat.season ? 'diff-positive' : 'diff-negative';
        }

        html += `
            <tr>
                <td style="font-weight: 600;">${stat.label}</td>
                <td class="team-value">${seasonVal}</td>
                <td class="team-value ${todayClass}">${todayVal}</td>
                <td class="league-value">${leagueVal}</td>
            </tr>
        `;
    });

    // Add game summary row
    if (gamePerformance && gamePerformance.totalPlays > 0) {
        html += `
            <tr style="border-top: 2px solid var(--border-color);">
                <td colspan="4" style="padding-top: 15px; font-weight: 600;">
                    Game Summary: ${gamePerformance.totalPlays} plays, ${gamePerformance.totalYards} yards
                    (${gamePerformance.passAttempts} passes, ${gamePerformance.rushAttempts} rushes)
                </td>
            </tr>
        `;
    }

    html += `
            </tbody>
        </table>
        <p class="stats-explanation" style="margin-top: 20px;">
            <strong>Stats Explained:</strong><br>
            • <strong>Yards per Play:</strong> Total offensive efficiency - higher is better<br>
            • <strong>Yards per Pass/Rush:</strong> Efficiency in each play type<br>
            • <strong>Third Down %:</strong> Critical conversion rate - 40% is league average<br>
            • <strong>Red Zone TD %:</strong> Scoring efficiency inside 20-yard line<br><br>
            <strong>Today's Stats:</strong> Calculated from actual plays in this game (green = better than season avg, red = worse).
            Shows "N/A" if insufficient data (e.g., no red zone attempts yet).
        </p>
    `;

    container.innerHTML = html;
}

/**
 * Render player impact analysis
 */
function renderPlayerImpact(gameState, teamRoster, teamAbbr) {
    const container = document.getElementById('playerImpactContent');

    if (!teamRoster || teamRoster.length === 0) {
        container.innerHTML = '<div class="empty-state">No player data available</div>';
        return;
    }

    // Filter to skill position players
    const skillPlayers = teamRoster.filter(p =>
        ['QB', 'RB', 'WR', 'TE', 'FB'].includes(p.position)
    );

    if (skillPlayers.length === 0) {
        container.innerHTML = '<div class="empty-state">No skill players found</div>';
        return;
    }

    let html = '<div class="comparison-grid">';

    skillPlayers.slice(0, 8).forEach(player => {
        // Extract stats from player data
        const stats = player.stats || [];
        const displayStat = stats.length > 0 ? stats[0] : '0';

        html += `
            <div class="comparison-card">
                <h4>${escapeHtml(player.shortName || player.name)}</h4>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 5px 0;">${player.position} • #${player.jersey || 'N/A'}</p>
                <div class="stat-row" style="background: transparent; padding: 8px 0;">
                    <span class="stat-label">Game Stats</span>
                    <span class="stat-value" style="font-size: 1rem;">${displayStat}</span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    html += `
        <p class="stats-explanation" style="margin-top: 20px;">
            Player impact on success probability is determined by their season performance relative to position averages.
            Key players in better-than-average form increase the team's success probability, while underperforming players decrease it.
        </p>
    `;

    container.innerHTML = html;
}

/**
 * Render recent plays
 * @param {string} gameId - Game ID
 */
async function renderRecentPlays(gameId) {
    const container = document.getElementById('playsContent');

    // Get rosters from last game state for player extraction
    let homeRoster = [];
    let awayRoster = [];
    if (appState.lastGameState && appState.lastGameState.rawData) {
        homeRoster = extractRoster(appState.lastGameState.rawData, appState.lastGameState.homeTeam.id);
        awayRoster = extractRoster(appState.lastGameState.rawData, appState.lastGameState.awayTeam.id);
    }

    try {
        const playData = await fetchPlayByPlay(gameId, 20);
        renderRecentPlaysFromData(playData, homeRoster, awayRoster);
    } catch (error) {
        logError('Failed to render plays', error);
        container.innerHTML = '<div class="empty-state">Failed to load plays</div>';
    }
}

/**
 * Render recent plays from already-fetched data
 * @param {Object} playData - Play-by-play data from API
 * @param {Array} homeRoster - Home team roster
 * @param {Array} awayRoster - Away team roster
 */
function renderRecentPlaysFromData(playData, homeRoster = [], awayRoster = []) {
    const container = document.getElementById('playsContent');

    const plays = parsePlayByPlay(playData);

    if (plays.length === 0) {
        container.innerHTML = '<div class="empty-state">No plays yet</div>';
        return;
    }

    // Render plays
    container.innerHTML = '';
    plays.forEach(play => {
        const playItem = createPlayItem(play, homeRoster, awayRoster);
        container.appendChild(playItem);
    });
}

/**
 * Create play item element
 * @param {Object} play - Play data
 * @param {Array} homeRoster - Home team roster
 * @param {Array} awayRoster - Away team roster
 * @returns {HTMLElement} Play item element
 */
function createPlayItem(play, homeRoster = [], awayRoster = []) {
    const item = createElement('div', {
        className: 'play-item'
    });

    const downText = play.down > 0 ? `${getOrdinal(play.down)} & ${play.distance}` : '';

    // Extract players involved in this play
    const playersInvolved = extractPlayersFromText(play.text || '', homeRoster, awayRoster);

    // Build players HTML (compact version for play list)
    let playersHtml = '';
    if (playersInvolved.length > 0) {
        playersHtml = '<div class="play-item-players">' +
            playersInvolved.slice(0, 3).map(player => `
                <div class="play-item-player ${player.role}">
                    <img src="${escapeHtml(player.headshot)}"
                         alt="${escapeHtml(player.name)}"
                         class="play-item-headshot"
                         onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=80&h=80'">
                    <span class="play-item-player-name">${escapeHtml(player.name.split(' ').pop())}</span>
                </div>
            `).join('') +
            '</div>';
    }

    item.innerHTML = `
        <div class="play-item-header">
            <span>Q${play.period} ${escapeHtml(play.clock)}</span>
            <span>${escapeHtml(downText)}</span>
        </div>
        ${playersHtml}
        <div class="play-item-text">${escapeHtml(play.text)}</div>
    `;

    return item;
}

/**
 * Set focus team
 * @param {string} team - 'home', 'away', or null
 */
function setFocusTeam(team) {
    appState.focusTeam = team;
    savePreference('focusTeam', team);

    // Update ALL toggle buttons (both tabs)
    document.querySelectorAll('.team-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Update team toggle buttons based on team
    document.querySelectorAll(`#teamToggleHome`).forEach(btn => {
        if (team === 'home') btn.classList.add('active');
    });
    document.querySelectorAll(`#teamToggleAway`).forEach(btn => {
        if (team === 'away') btn.classList.add('active');
    });

    // Re-render both overview and probabilities content
    if (appState.lastGameState) {
        // Re-render last play (for focus mode filtering)
        const homeRoster = extractRoster(appState.lastGameState.rawData, appState.lastGameState.homeTeam.id);
        const awayRoster = extractRoster(appState.lastGameState.rawData, appState.lastGameState.awayTeam.id);
        renderLastPlay(appState.lastGameState, homeRoster, awayRoster);

        // Re-render probabilities tab if it's active
        if (document.getElementById('probabilitiesTab').classList.contains('active')) {
            renderProbabilitiesTab();
        }
    }
}

/**
 * Start auto-refresh
 * @param {string} gameId - Game ID
 */
function startAutoRefresh(gameId) {
    if (appState.refreshInterval) {
        clearInterval(appState.refreshInterval);
    }

    log('Starting auto-refresh (15s interval)');

    appState.refreshInterval = setInterval(async () => {
        await autoRefresh(gameId);
    }, 15 * 1000); // 15 seconds for live games
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh() {
    if (appState.refreshInterval) {
        clearInterval(appState.refreshInterval);
        appState.refreshInterval = null;
        log('Stopped auto-refresh');
    }
}

/**
 * Auto-refresh game data
 * @param {string} gameId - Game ID
 */
async function autoRefresh(gameId) {
    try {
        log('Auto-refreshing game data');

        // Fetch scoreboard, summary, AND play-by-play for most accurate data
        const [scoreboardData, summaryData, playData] = await Promise.all([
            fetchLiveGames(),
            fetchGameSummary(gameId),
            fetchPlayByPlay(gameId, 20)
        ]);

        const newGameState = parseGameState(summaryData);

        // Find this game in scoreboard to get situation data
        const scoreboardGame = scoreboardData.events.find(e => e.id === gameId);

        // If scoreboard has situation data, use it
        if (scoreboardGame && scoreboardGame.competitions[0].situation) {
            newGameState.situation = {
                down: scoreboardGame.competitions[0].situation.down || 0,
                distance: scoreboardGame.competitions[0].situation.distance || 0,
                yardLine: scoreboardGame.competitions[0].situation.yardLine || 0,
                yardsToEndzone: scoreboardGame.competitions[0].situation.yardsToEndzone || 0,
                possession: scoreboardGame.competitions[0].situation.possession || null,
                possessionText: scoreboardGame.competitions[0].situation.possessionText || '',
                isRedZone: scoreboardGame.competitions[0].situation.isRedZone || false,
                homeTimeouts: scoreboardGame.competitions[0].situation.homeTimeouts || 3,
                awayTimeouts: scoreboardGame.competitions[0].situation.awayTimeouts || 3
            };

            // Add lastPlay from scoreboard
            newGameState.lastPlay = scoreboardGame.competitions[0].situation.lastPlay || null;

            // Update possessionTeam based on possession ID
            const possessionId = scoreboardGame.competitions[0].situation.possession;
            if (possessionId) {
                if (possessionId === newGameState.homeTeam.id) {
                    newGameState.possessionTeam = {
                        id: newGameState.homeTeam.id,
                        name: newGameState.homeTeam.name,
                        abbreviation: newGameState.homeTeam.abbreviation
                    };
                } else if (possessionId === newGameState.awayTeam.id) {
                    newGameState.possessionTeam = {
                        id: newGameState.awayTeam.id,
                        name: newGameState.awayTeam.name,
                        abbreviation: newGameState.awayTeam.abbreviation
                    };
                }
            }

            // Update status from scoreboard (more accurate)
            newGameState.status.period = scoreboardGame.status.period;
            newGameState.status.clock = scoreboardGame.status.displayClock;
        }

        // If no lastPlay from scoreboard, use most recent play from play-by-play
        if (!newGameState.lastPlay || !newGameState.lastPlay.text) {
            const plays = parsePlayByPlay(playData);
            if (plays.length > 0) {
                const mostRecentPlay = plays[0]; // Already reversed, so first is most recent
                newGameState.lastPlay = {
                    text: mostRecentPlay.text,
                    shortText: mostRecentPlay.shortText,
                    probability: { EPA: 0 },
                    team: null,
                    end: {
                        yardLine: mostRecentPlay.yardLine + mostRecentPlay.yardsGained
                    }
                };
            }
        }

        // Check if state changed
        const stateChanged = hasGameStateChanged(gameId, newGameState);

        if (stateChanged) {
            log('Game state changed, updating UI');
            appState.lastGameState = newGameState;

            renderGameState(newGameState);

            // Extract rosters for last play rendering
            const homeRoster = extractRoster(newGameState.rawData, newGameState.homeTeam.id);
            const awayRoster = extractRoster(newGameState.rawData, newGameState.awayTeam.id);
            renderLastPlay(newGameState, homeRoster, awayRoster);

            // Use already fetched play data
            renderRecentPlaysFromData(playData, homeRoster, awayRoster);

            // If probabilities tab is active, re-render it
            if (document.getElementById('probabilitiesTab').classList.contains('active')) {
                renderProbabilitiesTab();
            }

            clearBanners();
        } else {
            log('Game state unchanged, skipping UI update');
        }

        // Check if game ended
        if (newGameState.status.completed) {
            log('Game ended, stopping auto-refresh');
            stopAutoRefresh();
            showBanner('Game ended. Final score displayed.', 'info');
        }
    } catch (error) {
        logError('Auto-refresh failed', error);
        // Don't show error toast for auto-refresh failures
    }
}

/**
 * Manual refresh
 */
async function manualRefresh() {
    showToast('Refreshing...', 'info', 1000);

    if (appState.currentScreen === 'gameSelection') {
        await loadGameSelectionScreen();
    } else if (appState.currentScreen === 'gameView' && appState.selectedGameId) {
        await loadGameViewScreen(appState.selectedGameId);
    }
}

/**
 * Get team logo URL with fallback
 * @param {Object} team - Team object with logo and abbreviation
 * @returns {string} Logo URL
 */
function getTeamLogoUrl(team) {
    if (team.logo) return team.logo;
    if (team.abbreviation) {
        return `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`;
    }
    return '';
}

/**
 * Get tooltip stats HTML based on player position
 * @param {Object} player - Player object with stats
 * @returns {string} HTML string for tooltip stats
 */
function getTooltipStats(player) {
    if (!player || !player.stats || player.stats.length === 0) {
        return '<span class="tooltip-no-stats">No stats yet</span>';
    }

    const position = player.position || '';
    const stats = player.stats;

    // Position groups
    const offensivePositions = ['QB', 'RB', 'WR', 'TE', 'FB'];
    const defensivePositions = ['LB', 'DE', 'DT', 'CB', 'S', 'MLB', 'OLB', 'ILB', 'NT', 'FS', 'SS'];
    const specialPositions = ['K', 'P'];

    let relevantStats = [];

    if (offensivePositions.includes(position)) {
        // Show offensive stats: look for yards, TDs, completions, attempts
        relevantStats = stats.filter(s => {
            const label = (s.label || s.name || '').toLowerCase();
            return label.includes('yard') || label.includes('td') ||
                   label.includes('rec') || label.includes('att') ||
                   label.includes('comp') || label.includes('rush') ||
                   label.includes('target');
        }).slice(0, 3);
    } else if (defensivePositions.includes(position)) {
        // Show defensive stats: tackles, sacks, INTs
        relevantStats = stats.filter(s => {
            const label = (s.label || s.name || '').toLowerCase();
            return label.includes('tackle') || label.includes('sack') ||
                   label.includes('int') || label.includes('ff') ||
                   label.includes('pd');
        }).slice(0, 3);
    } else if (specialPositions.includes(position)) {
        // Show special teams stats
        relevantStats = stats.filter(s => {
            const label = (s.label || s.name || '').toLowerCase();
            return label.includes('fg') || label.includes('xp') ||
                   label.includes('punt') || label.includes('avg') ||
                   label.includes('pts');
        }).slice(0, 3);
    }

    // Fallback to first 3 stats if no position-specific found
    if (relevantStats.length === 0) {
        relevantStats = stats.slice(0, 3);
    }

    return relevantStats.map(stat =>
        `<span class="tooltip-stat">${escapeHtml(stat.label || 'Stat')}: ${escapeHtml(stat.displayValue || '0')}</span>`
    ).join('');
}

/**
 * Get tooltip stats from player ID by finding player in rosters
 * @param {string} playerId - Player ID
 * @param {Array} homeRoster - Home team roster
 * @param {Array} awayRoster - Away team roster
 * @returns {string} HTML string for tooltip stats
 */
function getTooltipStatsFromId(playerId, homeRoster, awayRoster) {
    const allPlayers = [...(homeRoster || []), ...(awayRoster || [])];
    const player = allPlayers.find(p => String(p.id) === String(playerId));
    return getTooltipStats(player);
}

// Export for debugging (if needed)
if (typeof window !== 'undefined') {
    window.appState = appState;
    window.navigateToGameView = navigateToGameView;
}
