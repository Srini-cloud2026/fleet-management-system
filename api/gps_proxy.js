/**
 * Cartrack API Proxy for Vercel
 * Handles authentication and requests to the Cartrack Fleet API.
 */

export default async function handler(req, res) {
    // Add CORS headers for local development
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    const { endpoint, registration } = req.query;
    
    // In a real production app, use environment variables:
    // const username = process.env.CARTRACK_USERNAME;
    // const password = process.env.CARTRACK_PASSWORD;
    const username = 'NOBL00001';
    const password = 'Admin123!';

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const baseUrl = 'https://fleetapi-me.cartrack.com/rest';

    let url = '';
    if (endpoint === 'status') {
        url = `${baseUrl}/vehicles/status?odometer_in_km=1`;
    } else if (endpoint === 'odometer' && registration) {
        url = `${baseUrl}/vehicles/${registration}/odometer`;
    } else {
        return res.status(400).json({ error: 'Invalid endpoint or missing registration' });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Cartrack API Error:', errorText);
            return res.status(response.status).json({ error: 'Cartrack API returned an error', details: errorText });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
