// Use native fetch if available (Node 18+), otherwise fallback to node-fetch
if (typeof fetch === 'undefined') {
    var fetch = require('node-fetch');
}

// Supabase Config
const SUPABASE_URL = 'https://tcoyxzgkvnutkwavfvgp.supabase.co';
// Use Environment Variable for the Secret Key (Security Best Practice)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3l4emdrdm51dGt3YXZmdmdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgzNTY4MSwiZXhwIjoyMDg5NDExNjgxfQ.JjArqHylrbfqGLL3JtNGWNOdZvLvepBJ3K0pd_OdsqY';

async function logToSupabase(data) {
    if (!Array.isArray(data)) return;

    for (const v of data) {
        try {
            // 1. Update Current Status
            await fetch(`${SUPABASE_URL}/rest/v1/vehicles_status?registration=eq.${encodeURIComponent(v.registration)}`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    registration: v.registration,
                    latitude: v.latitude,
                    longitude: v.longitude,
                    odometer: v.odometer,
                    ignition: v.ignition === 'on' || v.ignition === true,
                    address: v.address,
                    last_updated: new Date().toISOString()
                })
            });

            // 2. Insert into History Logs
            await fetch(`${SUPABASE_URL}/rest/v1/gps_logs`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    registration: v.registration,
                    latitude: v.latitude,
                    longitude: v.longitude,
                    odometer: v.odometer,
                    ignition: v.ignition === 'on' || v.ignition === true,
                    address: v.address,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (err) {
            console.error('Error logging to Supabase:', err);
        }
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { endpoint, registration } = req.query;
    const username = 'NOBL00001';
    const password = 'Admin123!';

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Try Middle East first, then Global
    const clusters = [
        'https://fleetapi-me.cartrack.com/rest',
        'https://fleetapi.cartrack.com/rest'
    ];

    let lastError = null;
    let successfulData = null;

    for (const baseUrl of clusters) {
        let url = '';
        if (endpoint === 'status') {
            url = `${baseUrl}/vehicles/status?odometer_in_km=1`;
        } else if (endpoint === 'odometer' && registration) {
            url = `${baseUrl}/vehicles/${registration}/odometer`;
        } else {
            return res.status(400).json({ error: 'Invalid endpoint' });
        }

        try {
            console.log(`Attempting Cartrack (${baseUrl}): ${url}`);
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                successfulData = await response.json();
                console.log(`Successfully fetched from ${baseUrl}`);
                break; 
            } else {
                lastError = { status: response.status, text: await response.text(), url: baseUrl };
            }
        } catch (error) {
            lastError = { status: 500, text: error.message, url: baseUrl };
        }
    }

    if (successfulData) {
        // --- LOG TO SUPABASE IN BACKGROUND ---
        if (endpoint === 'status') {
            await logToSupabase(successfulData);
        }
        return res.status(200).json(successfulData);
    } else {
        return res.status(lastError.status || 500).json({
            error: 'Cartrack API Error',
            status: lastError.status,
            details: lastError.text,
            attempted_clusters: clusters,
            tip: lastError.status === 401 ? 'Check Cartrack Username/Password' : 'Contact Support'
        });
    }
}
