const https = require('https');

async function fetchFromCartrack(url, options, redirects = 0) {
    if (redirects > 5) {
        throw { status: 508, error: 'Too Many Redirects' };
    }

    return new Promise((resolve, reject) => {
        const req = https.get(url, options, (apiRes) => {
            // Handle Redirects
            if ([301, 302, 307, 308].includes(apiRes.statusCode) && apiRes.headers.location) {
                console.log(`Redirecting to: ${apiRes.headers.location}`);
                return resolve(fetchFromCartrack(apiRes.headers.location, options, redirects + 1));
            }

            let data = '';
            apiRes.on('data', (chunk) => data += chunk);
            apiRes.on('end', () => {
                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: apiRes.statusCode, data: parsed });
                    } catch (e) {
                        reject({ status: 502, error: 'Bad Gateway', details: 'Invalid JSON', raw: data.substring(0, 500) });
                    }
                } else {
                    reject({ status: apiRes.statusCode, error: 'Cartrack API Error', details: data.substring(0, 500) });
                }
            });
        });

        req.on('error', (err) => {
            reject({ status: 504, error: 'Gateway Timeout', details: err.message });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            reject({ status: 504, error: 'Gateway Timeout', details: 'Cartrack API timed out' });
        });
    });
}

module.exports = async function handler(req, res) {
    try {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') return res.status(200).end();

        const { endpoint, registration } = req.query;
        
        const usernames = ['NOBL00001', 'nobl00001'];
        const passwords = [
            'e3605fe074c4eacc31eda89a2ede8e49c7d1eaeed3a1e37825c0329df4d3eaa1',
            'Admin123$$$'
        ];
        
        const clusters = [
            { name: 'Middle East', url: 'https://fleetapi-me.cartrack.com/rest' },
            { name: 'Middle East V2', url: 'https://fleetapi-me.cartrack.com/rest/v2' },
            { name: 'South Africa', url: 'https://fleetapi-za.cartrack.com/rest' },
            { name: 'Global', url: 'https://fleetapi.cartrack.com/rest' }
        ];

        let lastResult = null;
        let errors = [];

        for (const password of passwords) {
            for (const username of usernames) {
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                const options = {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                    }
                };

                for (const cluster of clusters) {
                    try {
                        const eps = endpoint === 'status' ? ['vehicles/status', 'vehicles'] : [`vehicles/${registration}/odometer`];
                    
                        for (const ep of eps) {
                            try {
                                const url = `${cluster.url}/${ep}`;
                                const result = await fetchFromCartrack(url, options);
                                
                                // Cartrack often wraps arrays in a { data: [...] } object.
                                const payload = result.data && Array.isArray(result.data.data) ? result.data.data : result.data;
                                
                                if (Array.isArray(payload) && payload.length > 0) {
                                    return res.status(200).json(payload);
                                }
                                if (endpoint !== 'status' && payload) {
                                    return res.status(200).json(payload);
                                }
                                lastResult = payload;
                            } catch (epErr) {
                                errors.push({ cluster: cluster.name, ep, username, ...epErr });
                            }
                        }
                    } catch (err) {
                        errors.push({ cluster: cluster.name, username, ...err });
                    }
                }
            }
        }

        // if we have an empty array result, that's better than an error
        if (lastResult && Array.isArray(lastResult) && lastResult.length === 0) {
            return res.status(200).json([]);
        }

        // If all failed, return the first one or a generic error
        const mainError = errors.find(e => e.status !== 401 && e.status !== 404) || errors[0] || { error: 'Unknown Error' };
        
        return res.status(mainError.status || 500).json({
            error: `${mainError.error}: ${mainError.details || ''} ${mainError.raw || ''}`.substring(0, 100),
            details: mainError.details,
            usernameAttempted: mainError.username,
            clustersChecked: Array.from(new Set(errors.map(e => e.cluster))).join(', ')
        });

    } catch (globalErr) {
        return res.status(500).json({ error: 'Internal Proxy Crash', message: globalErr.message });
    }
}

