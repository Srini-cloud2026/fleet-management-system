// Supabase Config
const SUPABASE_URL = 'https://tcoyxzgkvnutkwavfvgp.supabase.co';
// Use Environment Variable for the Secret Key (Security Best Practice)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_sgQZySDIfsvonSuccVwjAA_ztQ-dTmO';

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
    const baseUrl = 'https://fleetapi-me.cartrack.com/rest';

    let url = '';
    if (endpoint === 'status') {
        url = `${baseUrl}/vehicles/status?odometer_in_km=1`;
    } else if (endpoint === 'odometer' && registration) {
        url = `${baseUrl}/vehicles/${registration}/odometer`;
    } else {
        return res.status(400).json({ error: 'Invalid endpoint' });
    }

    try {
        console.log(`Fetching from Cartrack: ${url}`);
        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Cartrack API Error (${response.status}):`, errorText);
            
            // Return a more descriptive error to the frontend
            return res.status(response.status).json({ 
                error: 'Cartrack API Error', 
                status: response.status,
                details: errorText,
                attempted_user: username,
                attempted_url: url,
                tip: response.status === 401 ? 'Check Cartrack Username/Password' : 'Contact Support'
            });
        }

        const data = await response.json();
        
        // --- LOG TO SUPABASE IN BACKGROUND ---
        if (endpoint === 'status') {
            await logToSupabase(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
