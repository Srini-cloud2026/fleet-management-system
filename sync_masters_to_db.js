const fs = require('fs');

const SUPABASE_URL = 'https://tcoyxzgkvnutkwavfvgp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3l4emdrdm51dGt3YXZmdmdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgzNTY4MSwiZXhwIjoyMDg5NDExNjgxfQ.JjArqHylrbfqGLL3JtNGWNOdZvLvepBJ3K0pd_OdsqY';

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some(col => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(col => col.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function parseInteger(val) {
  if (val === null || val === undefined) return null;
  const str = val.toString().trim().replace(/[^0-9-]/g, '');
  if (!str) return null;
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

function cleanString(val) {
  if (val === null || val === undefined) return null;
  const s = val.toString().trim();
  return s.length > 0 ? s : null;
}

async function syncVehicles(dryRun = false) {
  console.log('\n========================================');
  console.log('1. PROCESSING VEHICLE MASTER');
  console.log('========================================');
  
  const rawRows = parseCSV('Vechile Master.csv');
  const dataRows = rawRows.slice(1);
  console.log(`Parsed ${dataRows.length} vehicle rows from CSV.`);
  
  const vehicles = dataRows.map((r, idx) => {
    return {
      'S.NO': parseInteger(r[0]) || (idx + 1),
      'PLATE NO': cleanString(r[1]),
      'VEHICLE TYPE': cleanString(r[2]),
      'MODEL': parseInteger(r[3]),
      'MULKIYA EXP DATE': cleanString(r[4]),
      'VALID DAYS': parseInteger(r[5]),
      'INSURANCE EXP DATE': cleanString(r[6]),
      'VALID DAYS_1': parseInteger(r[7]),
      'Category': cleanString(r[8]),
      'Account': cleanString(r[9]),
      'Loaction': cleanString(r[10]),
      'Car Given to': cleanString(r[11])
    };
  }).filter(v => Boolean(v['PLATE NO']));

  console.log(`Valid vehicles with PLATE NO: ${vehicles.length}`);
  
  if (dryRun) {
    console.log('Sample parsed vehicle:', vehicles[0]);
    return;
  }

  // Upload in chunks of 50
  const chunkSize = 50;
  let totalUploaded = 0;
  
  for (let i = 0; i < vehicles.length; i += chunkSize) {
    const chunk = vehicles.slice(i, i + chunkSize);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/Vechile_Master`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(chunk)
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Failed uploading vehicle chunk ${i} - ${i + chunk.length}: ${err}`);
    }
    totalUploaded += chunk.length;
    console.log(`Uploaded ${totalUploaded}/${vehicles.length} vehicles...`);
  }

  // Check and delete any stale vehicles in DB not present in CSV
  try {
    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/Vechile_Master?select=PLATE NO&limit=1000`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const existingDb = await existingRes.json();
    const csvPlateSet = new Set(vehicles.map(v => v['PLATE NO']));
    const staleVehicles = existingDb.filter(v => !csvPlateSet.has(v['PLATE NO']));
    if (staleVehicles.length > 0) {
      console.log(`Pruning ${staleVehicles.length} obsolete vehicle(s) not in CSV...`);
      for (const st of staleVehicles) {
        await fetch(`${SUPABASE_URL}/rest/v1/Vechile_Master?PLATE%20NO=eq.${encodeURIComponent(st['PLATE NO'])}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
      }
      console.log(`Pruned ${staleVehicles.length} obsolete vehicles.`);
    }
  } catch (pruneErr) {
    console.warn('Prune notice:', pruneErr.message);
  }

  // Update local cache files
  try {
    const freshRes = await fetch(`${SUPABASE_URL}/rest/v1/Vechile_Master?select=*&limit=1000`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const freshData = await freshRes.json();
    fs.writeFileSync('vehicle_master.json', JSON.stringify(freshData, null, 2), 'utf8');
    fs.writeFileSync('vehicle_master_data.js', 'const VEHICLE_MASTER_DATA = ' + JSON.stringify(freshData) + ';', 'utf8');
    fs.writeFileSync('vehicle_master_data_utf8.js', 'const VEHICLE_MASTER_DATA = ' + JSON.stringify(freshData) + ';', 'utf8');
    console.log(`Updated local cache files with ${freshData.length} vehicles.`);
  } catch (cacheErr) {
    console.warn('Cache update notice:', cacheErr.message);
  }
}

async function syncDrivers(dryRun = false) {
  console.log('\n========================================');
  console.log('2. PROCESSING DRIVERS MASTER');
  console.log('========================================');
  
  const rawRows = parseCSV('Drivers Master.csv');
  const dataRows = rawRows.slice(1);
  console.log(`Parsed ${dataRows.length} driver rows from CSV.`);

  const drivers = dataRows.map((r, idx) => {
    const sNo = parseInteger(r[0]) || (idx + 1);
    const empCode = parseInteger(r[1]);
    const name = cleanString(r[2]);
    const isMechanic = name && name.toLowerCase().includes('mechanic');
    const category = isMechanic ? 'Mechanic' : 'Driver';

    return {
      'S no': sNo,
      'Emp\nCode': empCode,
      "Employee's Name": name,
      'Category': category
    };
  }).filter(d => Boolean(d['Emp\nCode']));

  console.log(`Valid drivers with Emp Code: ${drivers.length}`);

  if (dryRun) {
    console.log('Sample parsed driver:', drivers[0]);
    return;
  }

  // Upload drivers
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/Driver_master`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(drivers)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed uploading drivers: ${err}`);
  }

  console.log(`SUCCESS: Upserted all ${drivers.length} drivers into 'Driver_master'.`);
}

async function run() {
  try {
    console.log('Starting DB sync from CSV files...');
    await syncVehicles(false);
    await syncDrivers(false);
    console.log('\n--- ALL MASTERS SUCCESSFULLY UPDATED ON SUPABASE DB! ---');
  } catch (err) {
    console.error('ERROR during sync:', err);
  }
}

run();
