// Netlify Function - CORS Proxy for ESPN API
// This replaces the local Python proxy server

exports.handler = async (event, context) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Get the target URL from query parameter
    const targetUrl = event.queryStringParameters.url;

    if (!targetUrl) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing url parameter' })
        };
    }

    // Validate that it's an ESPN API URL (security measure)
    const allowedDomains = [
        'site.api.espn.com',
        'sports.core.api.espn.com'
    ];

    let urlObj;
    try {
        urlObj = new URL(targetUrl);
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid URL' })
        };
    }

    if (!allowedDomains.includes(urlObj.hostname)) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Domain not allowed' })
        };
    }

    try {
        // Fetch from ESPN API
        const response = await fetch(targetUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; PlayByPlay.football/1.0)'
            }
        });

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: `ESPN API returned ${response.status}`,
                    message: response.statusText
                })
            };
        }

        const data = await response.json();

        // Return with CORS headers
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30'
            },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Proxy error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Proxy request failed',
                message: error.message
            })
        };
    }
};
