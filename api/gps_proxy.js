const https = require('https');

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { endpoint, registration } = req.query;
    const auth = Buffer.from('NOBL00001:Admin1234!').toString('base64');
    
    // Use ME cluster as primary, Global as fallback
    const baseUrl = 'https://fleetapi-me.cartrack.com/rest';
    const url = endpoint === 'status' ? `${baseUrl}/vehicles/status?odometer_in_km=1` : `${baseUrl}/vehicles/${registration}/odometer`;

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

