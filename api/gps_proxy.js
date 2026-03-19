const https = require('https');

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { endpoint, registration } = req.query;
    const auth = Buffer.from('NOBL00001:e3605fe074c4eacc31eda89a2ede8e49c7d1eaeed3a1e37825c0329df4d3eaa1').toString('base64');
    
    // Use ME cluster as primary, Global as fallback
    const baseUrl = 'https://fleetapi-me.cartrack.com/rest';
    const url = endpoint === 'status' ? `${baseUrl}/vehicles/status` : `${baseUrl}/vehicles/${registration}/odometer`;

    const options = {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
        }
    };

    https.get(url, options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => data += chunk);
        apiRes.on('end', () => {
            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                try {
                    const parsed = JSON.parse(data);
                    return res.status(200).json(parsed);
                } catch (e) {
                    return res.status(500).json({ error: 'Invalid JSON from Cartrack', details: data });
                }
            } else {
                return res.status(apiRes.statusCode).json({ error: 'Cartrack Error', status: apiRes.statusCode, details: data });
            }
        });
    }).on('error', (err) => {
        return res.status(500).json({ error: 'Network Error', details: err.message });
    });
}

