// Utility Functions for NFL Live Game Simulator

/**
 * Format date to readable string
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Format time to HH:MM:SS or HH:MM
 * @param {Date} date - Date object
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} Formatted time string
 */
function formatTime(date, includeSeconds = false) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (includeSeconds) {
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    return `${hours}:${minutes}`;
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string} Current date
 */
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Generate hash from string for comparison
 * @param {string} str - String to hash
 * @returns {string} Simple hash
 */
function generateHash(str) {
    // Simple hash function that works with Unicode
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

/**
 * Generate state hash from game state for change detection
 * @param {Object} gameState - Game state object
 * @returns {string} Hash of game state
 */
function generateStateHash(gameState) {
    if (!gameState || !gameState.situation) {
        return generateHash(Math.random().toString());
    }

    const state = {
        period: gameState.situation.period || 0,
        clock: gameState.situation.clock || '0:00',
        down: gameState.situation.down || 0,
        distance: gameState.situation.distance || 0,
        yardLine: gameState.situation.yardLine || 0,
        possession: gameState.situation.possession || ''
    };

    return generateHash(JSON.stringify(state));
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 * @param {number} n - Number
 * @returns {string} Number with ordinal suffix
 */
function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }, duration);
}

/**
 * Show banner notification (for persistent messages)
 * @param {string} message - Message to display
 * @param {string} type - Type of banner (warning, error, info)
 * @param {boolean} dismissible - Whether banner can be dismissed
 * @returns {HTMLElement} Banner element
 */
function showBanner(message, type = 'info', dismissible = true) {
    const container = document.getElementById('bannerContainer');
    if (!container) return null;

    // Remove existing banners
    container.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = `banner ${type}`;

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    banner.appendChild(messageSpan);

    if (dismissible) {
        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = '×';
        dismissBtn.className = 'close-btn';
        dismissBtn.style.background = 'none';
        dismissBtn.style.border = 'none';
        dismissBtn.style.fontSize = '1.5rem';
        dismissBtn.style.cursor = 'pointer';
        dismissBtn.style.padding = '0 0 0 10px';
        dismissBtn.onclick = () => {
            banner.remove();
        };
        banner.appendChild(dismissBtn);
    }

    container.appendChild(banner);

    return banner;
}

/**
 * Remove all banners
 */
function clearBanners() {
    const container = document.getElementById('bannerContainer');
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Debounce function to limit rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Format large numbers with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Calculate percentage and format it
 * @param {number} value - Value
 * @param {number} total - Total
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
function formatPercentage(value, total, decimals = 1) {
    if (total === 0) return '0%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
function isEmptyObject(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Wait for specified time (useful for async operations)
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise} Promise that resolves after wait time
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Set query parameter in URL without page reload
 * @param {string} param - Parameter name
 * @param {string} value - Parameter value
 */
function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}

/**
 * Remove query parameter from URL
 * @param {string} param - Parameter name
 */
function removeQueryParam(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.pushState({}, '', url);
}

/**
 * Check if element is in viewport
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if in viewport
 */
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Scroll element into view smoothly
 * @param {HTMLElement} element - Element to scroll to
 */
function scrollToElement(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Add CSS animation to element
 * @param {HTMLElement} element - Element to animate
 * @param {string} animationName - Name of animation
 */
function animateElement(element, animationName) {
    element.style.animation = animationName;
    element.addEventListener('animationend', function handler() {
        element.style.animation = '';
        element.removeEventListener('animationend', handler);
    });
}

/**
 * Create element with classes and attributes
 * @param {string} tag - HTML tag name
 * @param {Object} options - Options (className, textContent, attributes, etc.)
 * @returns {HTMLElement} Created element
 */
function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) {
        element.className = options.className;
    }

    if (options.textContent) {
        element.textContent = options.textContent;
    }

    if (options.innerHTML) {
        element.innerHTML = options.innerHTML;
    }

    if (options.attributes) {
        Object.keys(options.attributes).forEach(key => {
            element.setAttribute(key, options.attributes[key]);
        });
    }

    if (options.events) {
        Object.keys(options.events).forEach(event => {
            element.addEventListener(event, options.events[event]);
        });
    }

    return element;
}

/**
 * Log with timestamp (useful for debugging)
 * @param {string} message - Message to log
 * @param {any} data - Additional data to log
 */
function log(message, data = null) {
    const timestamp = formatTime(new Date(), true);
    if (data) {
        console.log(`[${timestamp}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

/**
 * Error logger
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
function logError(message, error = null) {
    const timestamp = formatTime(new Date(), true);
    if (error) {
        console.error(`[${timestamp}] ERROR: ${message}`, error);
    } else {
        console.error(`[${timestamp}] ERROR: ${message}`);
    }
}

// Export for use in other modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        formatTime,
        getCurrentDate,
        escapeHtml,
        generateHash,
        generateStateHash,
        getOrdinal,
        showToast,
        showBanner,
        clearBanners,
        debounce,
        formatNumber,
        formatPercentage,
        truncateText,
        isEmptyObject,
        deepClone,
        wait,
        getQueryParam,
        setQueryParam,
        removeQueryParam,
        isInViewport,
        scrollToElement,
        animateElement,
        createElement,
        log,
        logError
    };
}
