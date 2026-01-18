// Azure Function - CORS Proxy for ESPN API
// Deployed at: /api/cors-proxy?url=ENCODED_URL

const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async function (context, req) {
    // Get target URL from query parameter
    const targetUrl = req.query.url;

    if (!targetUrl) {
        context.res = {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Missing url parameter' })
        };
        return;
    }

    // Validate URL
    let urlObj;
    try {
        urlObj = new URL(targetUrl);
    } catch (e) {
        context.res = {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Invalid URL' })
        };
        return;
    }

    // Security: Only allow ESPN API domains
    const allowedDomains = [
        'site.api.espn.com',
        'sports.core.api.espn.com'
    ];

    if (!allowedDomains.includes(urlObj.hostname)) {
        context.res = {
            status: 403,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Domain not allowed' })
        };
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
                    context.res = {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'ESPN API rate limited',
                            message: 'Too many requests'
                        })
                    };
                    resolve();
                    return;
                }

                // Handle other errors
                if (proxyRes.statusCode >= 400) {
                    context.res = {
                        status: proxyRes.statusCode,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: `ESPN API returned ${proxyRes.statusCode}`,
                            message: proxyRes.statusMessage
                        })
                    };
                    resolve();
                    return;
                }

                // Success - return data with CORS headers
                context.res = {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Cache-Control': 'public, max-age=30'
                    },
                    body: data
                };
                resolve();
            });
        });

        proxyReq.on('error', (error) => {
            context.log.error('Proxy request failed:', error);
            context.res = {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Proxy request failed',
                    message: error.message
                })
            };
            resolve();
        });

        proxyReq.end();
    });
};
