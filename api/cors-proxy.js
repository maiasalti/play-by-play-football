// Vercel Serverless Function - CORS Proxy for ESPN API
// Deployed at: /api/cors-proxy?url=ENCODED_URL

const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Get target URL from query parameter
    const targetUrl = req.query.url;

    if (!targetUrl) {
        res.status(400).json({ error: 'Missing url parameter' });
        return;
    }

    // Validate URL
    let urlObj;
    try {
        urlObj = new URL(targetUrl);
    } catch (e) {
        res.status(400).json({ error: 'Invalid URL' });
        return;
    }

    // Security: Only allow ESPN API domains
    const allowedDomains = [
        'site.api.espn.com',
        'sports.core.api.espn.com'
    ];

    if (!allowedDomains.includes(urlObj.hostname)) {
        res.status(403).json({ error: 'Domain not allowed' });
        return;
    }

    // Make request to ESPN API
    return new Promise((resolve) => {
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; PlayByPlay.football/1.0)'
            }
        };

        const proxyReq = protocol.request(options, (proxyRes) => {
            let data = '';

            proxyRes.on('data', (chunk) => {
                data += chunk;
            });

            proxyRes.on('end', () => {
                // Handle rate limiting
                if (proxyRes.statusCode === 429) {
                    res.status(429).json({
                        error: 'ESPN API rate limited',
                        message: 'Too many requests'
                    });
                    resolve();
                    return;
                }

                // Handle other errors
                if (proxyRes.statusCode >= 400) {
                    res.status(proxyRes.statusCode).json({
                        error: `ESPN API returned ${proxyRes.statusCode}`,
                        message: proxyRes.statusMessage
                    });
                    resolve();
                    return;
                }

                // Success - return data
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'public, max-age=30');
                res.status(200).send(data);
                resolve();
            });
        });

        proxyReq.on('error', (error) => {
            console.error('Proxy request failed:', error);
            res.status(500).json({
                error: 'Proxy request failed',
                message: error.message
            });
            resolve();
        });

        proxyReq.end();
    });
};
