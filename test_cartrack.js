const https = require('https');

const username = 'NOBL00001';
const password = 'e3605fe074c4eacc31eda89a2ede8e49c7d1eaeed3a1e37825c0329df4d3eaa1';
const auth = Buffer.from(`${username}:${password}`).toString('base64');

const options = {
    headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0'
    }
};

const url = 'https://fleetapi-me.cartrack.com/rest/vehicles/status';

console.log(`Connecting to ${url}...`);

https.get(url, options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
    
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        console.log('--- BODY ---');
        console.log(rawData.substring(0, 1000));
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
