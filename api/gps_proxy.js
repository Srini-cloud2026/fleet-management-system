const https = require('https');

// Supabase Config
const SUPABASE_URL = 'https://tcoyxzgkvnutkwavfvgp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3l4emdrdm51dGt3YXZmdmdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgzNTY4MSwiZXhwIjoyMDg5NDExNjgxfQ.JjArqHylrbfqGLL3JtNGWNOdZvLvepBJ3K0pd_OdsqY';

function httpsGet(url, headers) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.status, ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data }));
        }).on('error', (err) => reject(err));
    });
}

async function logToSupabase(data) {
    if (!Array.isArray(data)) return;
    for (const v of data) {
        try {
            const body = JSON.stringify({
                registration: v.registration, latitude: v.latitude, longitude: v.longitude,
                odometer: v.odometer, ignition: v.ignition === 'on' || v.ignition === true,
                address: v.address, last_updated: new Date().toISOString()
            });
            const options = {
                method: 'POST',
                hostname: 'tcoyxzgkvnutkwavfvgp.supabase.co',
                path: '/rest/v1/vehicles_status',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                }
            };
            const req = https.request(options, (res) => {});
            req.on('error', (e) => console.error(e));
            req.write(body);
            req.end();
        } catch (err) { console.error(err); }
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { endpoint, registration } = req.query;
    const auth = Buffer.from('NOBL00001:Admin123!').toString('base64');
    
    const clusters = [
        'https://fleetapi-me.cartrack.com/rest',
        'https://fleetapi.cartrack.com/rest'
    ];

    let lastError = null;
    for (const baseUrl of clusters) {
        const url = endpoint === 'status' ? `${baseUrl}/vehicles/status?odometer_in_km=1` : `${baseUrl}/vehicles/${registration}/odometer`;
        try {
            const result = await httpsGet(url, { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' });
            if (result.ok) {
                const parsed = JSON.parse(result.data);
                if (endpoint === 'status') logToSupabase(parsed);
                return res.status(200).json(parsed);
            }
            lastError = { status: result.statusCode, text: result.data };
        } catch (e) {
            lastError = { status: 500, text: e.message };
        }
    }

    return res.status(lastError.status || 500).json({ error: 'Proxy Error', status: lastError.status, details: lastError.text });
}
