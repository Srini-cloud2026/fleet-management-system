/* ============================================
   FLEET MANAGEMENT SYSTEM — JavaScript
   ============================================ */

// --- Authentication & Users Mock Data ---
const VALID_DRIVERS = {
    'T-1045': { passcode: '1234', name: 'Mohammed Ali' },
    'T-1023': { passcode: '1234', name: 'Rashid Khan' }
};

const VALID_ADMINS = {
    'EMP-001': { passcode: 'admin123', name: 'Admin User', role: 'admin' },
    'EMP-8705': { passcode: 'admin123', name: 'Super Admin', role: 'super' }
};

// --- Data Variables ---
let vehicleMasterData = [];
let driverMasterData = []; // To store data from 'Drivers Info' sheet
let currentUser = null;
let currentRole = null; // 'driver' or 'admin'
let currentCategory = null;
let currentAssetHubType = 'all';
let currentExpiryFilter = 'all';
let gpsData = {}; // Stores live data from Cartrack
let gpsSyncInterval = null;
let trackMap = null;
let trackLayer = null;
let html5QrScanner = null;

// --- Supabase Initialization ---
const SUPABASE_URL = 'https://tcoyxzgkvnutkwavfvgp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3l4emdrdm51dGt3YXZmdmdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgzNTY4MSwiZXhwIjoyMDg5NDExNjgxfQ.JjArqHylrbfqGLL3JtNGWNOdZvLvepBJ3K0pd_OdsqY';
let supabaseClient = null;

function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.warn("Supabase library not found yet, retrying...");
        setTimeout(initSupabase, 500);
    }
}
initSupabase();

// --- Robust Key Helper ---
function getFlexVal(obj, search) {
    if (!obj) return null;
    const keys = Object.keys(obj);
    const s = search.toLowerCase().trim();
    // Try exact match first
    if (obj[search]) return obj[search];
    // Try lowercase trim match
    const foundKey = keys.find(k => k.toLowerCase().trim() === s);
    if (foundKey) return obj[foundKey];
    // Try partial match
    const partialKey = keys.find(k => k.toLowerCase().includes(s));
    if (partialKey) return obj[partialKey];
    return null;
}

// --- Category Certificates Data ---
let categoryCertificates = [
    { id: 1, category: 'Trailer Head', name: 'ADFCA Permit', issueDate: '2025-01-10', expiryDate: '2026-01-09', status: 'Valid', file: null },
    { id: 2, category: 'Trailer Head', name: 'Route Pass (E11)', issueDate: '2025-03-01', expiryDate: '2025-09-01', status: 'Valid', file: null },
    { id: 3, category: 'Bus', name: 'RTA Passenger Transport', issueDate: '2024-05-15', expiryDate: '2025-05-14', status: 'Valid', file: null },
    { id: 4, category: 'Pick up', name: 'Civil Defense Approval', issueDate: '2023-11-20', expiryDate: '2025-11-19', status: 'Valid', file: null },
    { id: 5, category: 'Forklift', name: 'Safety Operation Certificate', issueDate: '2024-06-01', expiryDate: '2025-06-01', status: 'Expiring Soon', file: null },
    { id: 6, category: 'Van', name: 'Food Transport Permit', issueDate: '2023-01-01', expiryDate: '2024-01-01', status: 'Expired', file: null }
];

let tripTicketRates = []; // Will be populated from Supabase table: Trip_Rates

// --- Data Loading ---
async function loadVehicleData() {
    console.log("Loading vehicle data strictly from Supabase...");
    
    try {
        if (!supabaseClient) {
            console.error("Supabase client not initialized.");
            // Wait a bit more if it's still initializing
            if (window.supabase) {
                initSupabase();
                if (!supabaseClient) return; 
            } else {
                return;
            }
        }

        // Fetch Vehicles from Vechile_Master (using exact name from user screenshot)
        const { data: vehicles, error: vError } = await supabaseClient
            .from('Vechile_Master')
            .select('*');
        
        if (vError) {
            if (vError.code === '401' || vError.status === 401) {
                alert("Supabase Authentication Failed (401). Please check your Public API Key.");
            }
            throw vError;
        }
        vehicleMasterData = vehicles || [];
        // Fetch Drivers - DIRECT REST API (bypasses all permission issues)
        let drivers = [];
        let successfulTable = null;
        
        try {
            console.log('Manpower: Fetching Driver_master via direct REST API...');
            const driverResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/Driver_master?select=*&limit=300`,
                {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (driverResponse.ok) {
                const driverData = await driverResponse.json();
                if (driverData && driverData.length > 0) {
                    drivers = driverData;
                    successfulTable = 'Driver_master';
                    console.log(`SUCCESS! Found ${driverData.length} staff via direct REST API`);
                } else {
                    console.warn('Driver_master table is empty (0 rows)');
                }
            } else {
                const errText = await driverResponse.text();
                console.error(`Direct REST API failed (${driverResponse.status}):`, errText);
            }
        } catch (fetchErr) {
            console.error('Direct REST API error:', fetchErr);
        }
        
        driverMasterData = drivers || [];
        
        // --- Feedback Badge ---
        const topBar = document.querySelector('.topbar-left');
        if (topBar) {
            let stamp = document.getElementById('debug-version');
            if (!stamp) {
                stamp = document.createElement('span');
                stamp.id = 'debug-version';
                stamp.style = 'font-size:12px; margin-left:15px; padding: 4px 10px; border-radius: 4px; background: #00bcd4; color: white; font-weight: bold; font-family: sans-serif;';
                topBar.appendChild(stamp);
            }
            stamp.textContent = `v3.5.1 | ${successfulTable ? 'STAFF: ' + successfulTable + ' (' + drivers.length + ')' : 'STAFF NOT FOUND'}`;
            if (!successfulTable) stamp.style.background = '#f44336';
            else stamp.style.background = '#4caf50';
        }
        // --- Fetch Trip Rates from Supabase (Direct REST API for Reliability) ---
        try {
            console.log('Fetching Trip Rates with Direct REST API fallbacks...');
            let ratesData = null;
            let successTable = null;
            let isForbidden = false;
            
            const baseNames = [
                'Driver_tip_master', 'Driver_trip_master', 'Trip_Rates', 'Trip_Rate', 
                'Driver_Trip_Master', 'Driver Tip Master', 'driver_trip_master', 
                'trip_rates', 'TripPrices', 'NSGT_Trip_Rates', 'NSGT Trip Rates', 
                'Trip_Ticket_Rates', 'trip_ticket_rates', 'Trip_Ticket_Rate'
            ];
            
            const tablesToTry = [...new Set(baseNames.flatMap(t => [t, `"${t}"`]))];
            const logs = [];

            for (const tName of tablesToTry) {
                try {
                    const resp = await fetch(
                        `${SUPABASE_URL}/rest/v1/${encodeURIComponent(tName)}?select=*`,
                        {
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data && data.length > 0) {
                            ratesData = data;
                            successTable = tName;
                            break;
                        } else {
                            logs.push(`${tName}: Empty (200 OK)`);
                        }
                    } else {
                        const err = await resp.text();
                        if (resp.status === 403) isForbidden = true;
                        logs.push(`${tName}: ${resp.status} (${err})`);
                    }
                } catch (e) {
                    logs.push(`${tName}: Fetch Error (${e.message})`);
                }
            }
            
            if (ratesData) {
                // Smart Key Matcher: handles "From Location", "from_location", "FROM", "Loc From", etc.
                const findValue = (obj, searchStr) => {
                    if (!obj) return null;
                    const normalizedSearch = searchStr.toLowerCase().replace(/[\s_]/g, '');
                    const keys = Object.keys(obj);
                    // Priority 1: Exact normalized match
                    let key = keys.find(k => k.toLowerCase().replace(/[\s_]/g, '') === normalizedSearch);
                    // Priority 2: Includes search string
                    if (!key) key = keys.find(k => k.toLowerCase().replace(/[\s_]/g, '').includes(normalizedSearch));
                    return key ? obj[key] : null;
                };

                tripTicketRates = ratesData.map(r => ({
                    from: findValue(r, 'from') || findValue(r, 'loc') || 'Unknown',
                    to: findValue(r, 'to') || findValue(r, 'dest') || 'Unknown',
                    rate: findValue(r, 'rate') || findValue(r, 'price') || 0
                })).filter(r => r.from !== 'Unknown' || r.to !== 'Unknown');
                
                console.log(`SUCCESS! Loaded ${tripTicketRates.length} trip rates from ${successTable}.`);
                
                const dbg = document.createElement('div');
                dbg.id = 'trip-debug-info';
                dbg.style = 'color:#4caf50; font-size:11px; padding:10px; background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.3); border-radius:4px; margin-bottom:15px; font-family: monospace;';
                const firstRow = ratesData[0];
                const cols = Object.keys(firstRow).join(', ');
                dbg.innerHTML = `<strong style="color:#4caf50">✅ TABLE FOUND:</strong> ${successTable}<br><strong>ROWS:</strong> ${ratesData.length}<br><strong>COLUMNS:</strong> ${cols}`;
                
                const existingDbg = document.getElementById('trip-debug-info');
                if (existingDbg) existingDbg.remove();
                document.getElementById('trip-entry-form')?.prepend(dbg);

                populateLocationDropdowns();
            } else {
                console.error("Trip Rates: All tables failed.", logs);
                const dbg = document.createElement('div');
                dbg.id = 'trip-debug-info';
                dbg.style = 'color:#f44336; font-size:11px; padding:12px; background: rgba(244,67,54,0.05); border: 2px solid #f44336; border-radius:8px; margin-bottom:15px; font-family: sans-serif;';
                
                let html = `<strong style="font-size:14px">⚠️ Trip Data Blocked (403 Forbidden)</strong><br>`;
                html += `<p style="margin:8px 0; font-size:12px">Supabase is denying access to <code>Driver_tip_master</code>. Please run this SQL in your Supabase SQL Editor:</p>`;
                html += `<pre style="background:#000; color:#0f0; padding:10px; border-radius:4px; font-size:11px; overflow-x:auto;">ALTER TABLE "Driver_tip_master" DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "Driver_tip_master" TO anon, authenticated, service_role;</pre>`;
                html += `<div style="font-size:10px; color:#666; margin-top:10px; border-top:1px solid #ddd; padding-top:5px;"><strong>Details:</strong><br>${logs.join('<br>')}</div>`;
                
                dbg.innerHTML = html;
                
                const existingDbg = document.getElementById('trip-debug-info');
                if (existingDbg) existingDbg.remove();
                document.getElementById('trip-entry-form')?.prepend(dbg);
            }
        } catch (err) {
            console.error("Critical Trip Rates Error:", err);
        }

        console.log("Data loaded. Vehicles:", vehicleMasterData.length, "Staff:", driverMasterData.length);
        refreshAdminUI();
        
    } catch (error) {
        console.error("Error loading data from Supabase:", error);
    }
}

// Manual Table Fetcher for Emergency
async function manualFetchStaff() {
    const table = prompt("Enter the EXACT table name for your Staff/Drivers from Supabase:", "Driver_master");
    if (!table) return;
    
    try {
        const resp = await fetch(
            `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=300`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (!resp.ok) {
            const errText = await resp.text();
            alert(`Error (${resp.status}) fetching '${table}': ${errText}`);
            return;
        }
        
        const data = await resp.json();
        if (data && data.length > 0) {
            driverMasterData = data;
            alert(`Success! Found ${data.length} entries in ${table}`);
            renderManpowerTable();
            updateVehicleKPIs();
            
            const stamp = document.getElementById('debug-version');
            if (stamp) {
                stamp.textContent = `v3.5.1 | STAFF: ${table} (${data.length})`;
                stamp.style.background = '#4caf50';
            }
        } else {
            alert(`Table '${table}' is empty or not found.`);
        }
    } catch (err) {
        alert("Network error: " + err.message);
    }
}

function refreshAdminUI() {
    if (currentRole === 'admin') {
        updateVehicleKPIs();
        updateFinanceKPIs();
        renderFleetGrid();
        renderManpowerTable();
        renderAttendanceTable();
    }
}

// --- Login Logic ---
function switchLoginTab(role) {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`tab-${role}`).classList.add('active');

    if (role === 'driver') {
        document.getElementById(`driver-login-form`).classList.add('active');
        document.getElementById(`driver-login-form`).style.display = 'block';
        document.getElementById(`admin-login-form`).style.display = 'none';
    } else {
        document.getElementById(`admin-login-form`).classList.add('active');
        document.getElementById(`admin-login-form`).style.display = 'block';
        document.getElementById(`driver-login-form`).style.display = 'none';
    }
}

function handleLogin(e, role) {
    e.preventDefault();
    let success = false;

    if (role === 'driver') {
        const truckId = document.getElementById('truck-id').value;
        const empId = document.getElementById('driver-emp-id').value.trim().toUpperCase();
        const driverName = document.getElementById('driver-name-input').value.trim();

        if (!truckId) {
            alert('Please scan a vehicle QR code first.');
            return;
        }

        // Find vehicle details
        const plateKey = 'PLATE NO';
        const vehicle = vehicleMasterData.find(v => {
            const p = v[plateKey] || v['plate_no'] || '';
            return p.toString().toUpperCase() === truckId.toUpperCase();
        });

        if (vehicle) {
            const userDisplayName = driverName || 'Driver ' + empId;

            currentUser = {
                id: truckId,
                empId: empId,
                name: userDisplayName
            };
            currentRole = 'driver';
            success = true;
            
            // Record access to Supabase
            recordVehicleAccess(truckId, empId, userDisplayName);
            
            document.body.classList.add('mobile-view');
            initDriverHub();
        }
    } else if (role === 'admin') {
        let empId = document.getElementById('emp-id').value.trim().toUpperCase();
        if (empId && !empId.startsWith('EMP-')) empId = 'EMP-' + empId;
        const passcode = document.getElementById('admin-passcode').value.trim();
        if (VALID_ADMINS[empId] && VALID_ADMINS[empId].passcode === passcode) {
            currentUser = { id: empId, ...VALID_ADMINS[empId] };
            currentRole = 'admin';
            success = true;
            applyRoleUI(currentUser.role);
            initAdminDashboard();
        }
    }

    if (success) {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-container').style.display = 'flex';
        // Update topbar user avatar letter
        document.querySelector('.user-avatar').textContent = currentUser.name.charAt(0);
    } else {
        alert('Invalid credentials or vehicle not found. Please try again.');
    }
}

// --- QR Scanner Logic ---
function startQrScanner() {
    document.getElementById('qr-scan-placeholder').style.display = 'none';
    document.getElementById('scanned-vehicle-info').style.display = 'none';
    document.getElementById('qr-reader-container').style.display = 'block';

    if (!html5QrScanner) {
        html5QrScanner = new Html5QrcodeScanner(
            "qr-reader", 
            { fps: 10, qrbox: {width: 250, height: 250} },
            /* verbose= */ false
        );
    }
    html5QrScanner.render(onScanSuccess, onScanFailure);
}

function stopQrScanner() {
    if (html5QrScanner) {
        html5QrScanner.clear().catch(error => {
            console.error("Failed to clear html5QrScanner", error);
        });
    }
    document.getElementById('qr-reader-container').style.display = 'none';
    
    const truckId = document.getElementById('truck-id').value;
    if (truckId) {
        document.getElementById('scanned-vehicle-info').style.display = 'flex';
    } else {
        document.getElementById('qr-scan-placeholder').style.display = 'flex';
    }
}

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Code matched = ${decodedText}`, decodedResult);
    
    // Assume decodedText is the Plate No / Truck ID
    const truckId = decodedText.trim().toUpperCase();
    
    // Find vehicle in master data
    const plateKey = 'PLATE NO';
    const vehicle = vehicleMasterData.find(v => {
        const p = v[plateKey] || v['plate_no'] || '';
        return p.toString().toUpperCase() === truckId;
    });

    if (vehicle) {
        // Success: Found vehicle
        document.getElementById('truck-id').value = truckId;
        document.getElementById('display-truck-id').textContent = truckId;
        
        const category = getFlexVal(vehicle, 'Category') || 'N/A';
        const model = getFlexVal(vehicle, 'Model') || getFlexVal(vehicle, 'Make') || '';
        document.getElementById('display-vehicle-details').textContent = `${model} | ${category}`;
        
        document.getElementById('driver-login-btn').disabled = false;
        
        stopQrScanner();
        document.getElementById('qr-scan-placeholder').style.display = 'none';
        document.getElementById('scanned-vehicle-info').style.display = 'flex';
    } else {
        alert(`Vehicle with Plate No ${truckId} not found in system.`);
    }
}

function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
}

async function recordVehicleAccess(vehicleId, empId, name) {
    console.log(`Recording access: ${vehicleId} by ${empId} (${name})`);
    
    try {
        if (!supabaseClient) return;
        
        const { error } = await supabaseClient
            .from('vehicle_access_logs')
            .insert([
                { 
                    vehicle_id: vehicleId, 
                    employee_id: empId, 
                    driver_name: name 
                }
            ]);
            
        if (error) {
            console.error("Error recording vehicle access:", error);
            // Fallback: If table doesn't exist, it might fail, but let login proceed
        } else {
            console.log("Vehicle access recorded successfully.");
        }
    } catch (err) {
        console.error("Critical error recording access:", err);
    }
}

function initDriverHub() {
    // Hide sidebar for driver
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';

    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.marginLeft = '0';

    // Hide general topbar widgets
    document.querySelectorAll('.topbar-search, .topbar-btn').forEach(el => el.style.display = 'none');

    document.getElementById('current-driver-name').textContent = currentUser.name;
    document.getElementById('current-truck-id').textContent = `Truck: ${currentUser.id} | Emp ID: ${currentUser.empId}`;

    showSection('driver');
}

function initAdminDashboard() {
    document.body.classList.remove('mobile-view');
    // Show sidebar for admin
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'flex';

    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.marginLeft = '260px'; // Set back to default from CSS

    // Show topbar widgets
    document.querySelectorAll('.topbar-search, .topbar-btn').forEach(el => el.style.display = 'flex');

    // Update KPIs and render fleet from master data
    updateVehicleKPIs();
    updateFinanceKPIs();
    renderFleetGrid();
    renderExpiryDashboard();
    
    // Render dynamic trips
    renderStoredTrips();
    renderManpowerTable();
    renderAttendanceTable();

    // Start GPS Sync
    startGpsSync();

    showSection('dashboard-vehicle');
}

// --- Cartrack GPS Integration ---
let mainMap, markers = {};

function initTracker() {
    if (mainMap) return;
    const mapEl = document.getElementById('main-map');
    if (!mapEl) return;

    mainMap = L.map('main-map').setView([25.276987, 55.296249], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mainMap);
    console.log("Tracker Map Initialized.");
}

function generateMockGpsData() {
    const mockData = [
        { registration: 'T-1045', location: { latitude: 24.4539, longitude: 54.3773, position_description: 'Abu Dhabi Plant Area' }, speed: 0, ignition: 'on', odometer: 120500 },
        { registration: 'T-1023', location: { latitude: 25.0772, longitude: 55.1311, position_description: 'Dubai Jebel Ali Port' }, speed: 45, ignition: 'on', odometer: 89400 },
        { registration: 'A-5521', location: { latitude: 25.3463, longitude: 55.4209, position_description: 'Sharjah Industrial' }, speed: 0, ignition: 'off', odometer: 45200 }
    ];
    // Also include other vehicles from master data to ensure they appear
    vehicleMasterData.slice(0, 10).forEach(v => {
        const plate = getFlexVal(v, 'PLATE NO');
        if (plate && !mockData.find(m => m.registration === plate)) {
            mockData.push({
                registration: plate,
                location: { latitude: 25.0 + Math.random(), longitude: 55.0 + Math.random(), position_description: 'Simulated Location' },
                speed: 0,
                ignition: 'off',
                odometer: Math.floor(Math.random() * 100000)
            });
        }
    });
    return mockData;
}

async function fetchGpsData() {
    console.log("Fetching live GPS data...");
    const statusLabel = document.getElementById('gps-status-badge');
    try {
        const response = await fetch('/api/gps_proxy?endpoint=status');
        let data;
        if (!response.ok) {
            console.warn("GPS proxy failed (expected on local dev), using mock data fallback.");
            data = generateMockGpsData();
        } else {
            data = await response.json();
        }
        
        // Map data by registration (PLATE NO)
        const newGpsData = {};
        let movingCount = 0;
        let idleCount = 0;
        let offCount = 0;

        if (Array.isArray(data)) {
            data.forEach((v) => {
                newGpsData[v.registration] = v;
                if (v.registration.includes('/')) {
                    const suffix = v.registration.split('/').pop();
                    newGpsData[suffix] = v;
                }
                if (v.odometer) {
                    v.odometer = parseFloat((v.odometer / 1000).toFixed(2)); // Convert meters to km
                }
                
                // Track stats
                if (v.ignition === 'on' || v.ignition === true) {
                    if (v.speed > 0) movingCount++;
                    else idleCount++;
                } else {
                    offCount++;
                }

                // Update Map Markers
                if (mainMap) {
                    const lat = v.location ? parseFloat(v.location.latitude) : NaN;
                    const lng = v.location ? parseFloat(v.location.longitude) : NaN;
                    const address = v.location ? v.location.position_description : '';
                    if (!isNaN(lat) && !isNaN(lng)) {
                        const isIgnitionOn = v.ignition === 'on' || v.ignition === true;
                        const statusStr = isIgnitionOn ? (v.speed > 0 ? 'Moving' : 'Idle') : 'Ignition Off';
                        const customIcon = getVehicleIcon(v.registration, isIgnitionOn, v.speed || 0);
                        
                        if (!markers[v.registration]) {
                            markers[v.registration] = L.marker([lat, lng], { icon: customIcon }).addTo(mainMap)
                                .bindPopup(`<div style="cursor:pointer;" onclick="showVehicleDetail('${v.registration}')"><b>${v.registration}</b><br>${address}<br>Status: ${statusStr} <br><br><span style="color:var(--accent-blue)">Click to view details</span></div>`)
                                .bindTooltip(v.registration, { permanent: true, direction: 'right', className: 'vehicle-tooltip', offset: [5, 0] });
                        } else {
                            markers[v.registration].setLatLng([lat, lng]).setIcon(customIcon)
                                .getPopup().setContent(`<div style="cursor:pointer;" onclick="showVehicleDetail('${v.registration}')"><b>${v.registration}</b><br>${address}<br>Status: ${statusStr} <br><br><span style="color:var(--accent-blue)">Click to view details</span></div>`);
                        }
                    }
                }
            });
        }
        gpsData = newGpsData;
        const assetCount = Object.keys(newGpsData).length;
        
        if (statusLabel) {
            if (assetCount > 0) {
                statusLabel.style.background = 'var(--accent-green)';
                statusLabel.textContent = `GPS Synced: ${assetCount} Assets`;
            } else {
                statusLabel.style.background = 'var(--accent-orange)';
                statusLabel.textContent = `GPS Connected: 0 Assets Found`;
            }
        }

        const mEl = document.getElementById('stat-moving');
        const iEl = document.getElementById('stat-idle');
        const oEl = document.getElementById('stat-off');
        if (mEl) mEl.textContent = movingCount;
        if (iEl) iEl.textContent = idleCount;
        if (oEl) oEl.textContent = offCount;

        console.log(`GPS Synced: ${assetCount} vehicles found.`);
        
        if (currentRole === 'admin') {
            if (currentCategory) renderCategoryVehicles(currentCategory);
            // Refresh dashboard charts if we are physically looking at it
            const dashboardSec = document.getElementById('section-dashboard-vehicle');
            if (dashboardSec && dashboardSec.classList.contains('active')) {
                initVehicleCharts();
            }
        }
    } catch (error) {
        console.error("Failed to fetch GPS data from proxy:", error);
    }
}

function showGpsBreakdownModal(type) {
    const modal = document.getElementById('breakdown-modal');
    if (!modal) return;
    
    let title = 'Total Vehicles';
    if (type === 'tracked') title = 'Tracked Vehicles (GPS)';
    if (type === 'untracked') title = 'Untracked Vehicles';

    document.getElementById('modal-title').textContent = title;
    
    const body = document.getElementById('modal-body');
    body.innerHTML = '';
    
    const filtered = vehicleMasterData.filter(v => {
        const isTracked = findGpsMatch(getFlexVal(v, 'PLATE NO'), gpsData) !== null;
        if (type === 'tracked') return isTracked;
        if (type === 'untracked') return !isTracked;
        return true; 
    });

    const grouped = {};
    filtered.forEach(v => {
        const cat = (getFlexVal(v, 'Category') || 'Other').toString().trim();
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(v);
    });

    let html = '<div class="table-responsive"><table class="data-table"><thead><tr><th style="width:25%">Category</th><th style="width:15%">Count</th><th style="width:60%">Vehicles</th></tr></thead><tbody>';
    
    Object.keys(grouped).sort().forEach(cat => {
        const plates = grouped[cat].map(v => `<span style="display:inline-block; padding:2px 6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; margin:2px;">${getFlexVal(v, 'PLATE NO')}</span>`).join(' ');
        html += `
            <tr>
                <td style="font-weight:bold; color:var(--text-primary);">${cat}</td>
                <td style="color:var(--accent-blue);">${grouped[cat].length}</td>
                <td style="font-size:12px; color:var(--text-muted); line-height: 1.5;">${plates}</td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    
    body.innerHTML = html;
    modal.classList.add('active');
}

function startGpsSync() {
    if (gpsSyncInterval) clearInterval(gpsSyncInterval);
    fetchGpsData(); // Initial fetch
    gpsSyncInterval = setInterval(fetchGpsData, 60000); // Sync every minute
}

async function renderVehicleTrack(registration) {
    const mapContainer = document.getElementById('vehicle-track-map');
    if (!mapContainer) return;

    mapContainer.style.display = 'block';

    // Initialize map if it doesn't exist
    if (!trackMap) {
        trackMap = L.map('vehicle-track-map').setView([25.2048, 55.2708], 10); // Center on Dubai
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(trackMap);
    } else {
        // Clear previous layers
        if (trackLayer) trackMap.removeLayer(trackLayer);
    }

    try {
        // Fetch last 50 logs from Supabase for this registration
        const { data: logs, error } = await supabaseClient
            .from('gps_logs')
            .select('*')
            .eq('registration', registration)
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (logs && logs.length > 0) {
            const points = logs.map(l => [l.latitude, l.longitude]);
            
            // Create polyline (the track)
            trackLayer = L.featureGroup();
            
            // Draw path
            L.polyline(points, { color: 'var(--accent-blue)', weight: 3, opacity: 0.8 }).addTo(trackLayer);
            
            // Add start/end markers
            const current = logs[0];
            L.marker([current.latitude, current.longitude])
                .bindPopup(`<b>Current Location</b><br>${current.registration}<br>${new Date(current.timestamp).toLocaleTimeString()}`)
                .addTo(trackLayer);

            trackLayer.addTo(trackMap);
            
            // Fit map to points
            trackMap.fitBounds(L.polyline(points).getBounds(), { padding: [20, 20] });
            
            // Force redraw due to modal display issues
            setTimeout(() => { trackMap.invalidateSize(); }, 200);
        } else {
            console.log("No tracking history found for", registration);
            mapContainer.innerHTML = '<p style="padding:20px; text-align:center; color:var(--text-muted)">No tracking history logs found yet.</p>';
        }
    } catch (err) {
        console.error("Error rendering track map:", err);
    }
}

function updateVehicleModalGpsInfo(plate) {
    const live = gpsData[plate];
    const gpsContainer = document.getElementById('modal-gps-info');
    if (!gpsContainer) return;

    if (live) {
        gpsContainer.innerHTML = `
            <div class="detail-card glass-effect gps-highlight">
                <div class="detail-card-header"><h4><i class="fas fa-satellite"></i> Live GPS Status</h4></div>
                <ul class="detail-list">
                    <li><span class="label">Last Seen</span> <span class="value">${new Date(live.timestamp).toLocaleString('en-GB')}</span></li>
                    <li><span class="label">Status</span> <span class="value status-badge ${live.ignition ? 'in-transit' : 'idle'}">${live.ignition ? 'Ignition ON' : 'Ignition OFF'}</span></li>
                    <li><span class="label">Location</span> <span class="value">${live.address || live.latitude.toFixed(4) + ', ' + live.longitude.toFixed(4)}</span></li>
                    <li><span class="label">Odometer</span> <span class="value" style="font-weight:700; color:var(--accent-blue)">${live.odometer ? live.odometer.toLocaleString() : '0'} km</span></li>
                </ul>
            </div>
        `;
        // Also render the track history
        renderVehicleTrack(live.registration || plate);
    } else {
        gpsContainer.innerHTML = `
            <div class="detail-card glass-effect">
                <div class="detail-card-header"><h4>Live GPS Status</h4></div>
                <p style="padding:15px; color:var(--text-muted); font-size:12px;">No live GPS data available for this vehicle.</p>
            </div>
        `;
        // Hide map if no data
        const mapContainer = document.getElementById('vehicle-track-map');
        if (mapContainer) mapContainer.style.display = 'none';
    }
}

// --- Dashboard & Fleet UI Rendering ---
function updateVehicleKPIs() {
    const total = vehicleMasterData.length;
    const active = vehicleMasterData.filter(v => {
        const status = v['Status'] || v['status'] || '';
        return status.toLowerCase().includes('active') || status.toLowerCase().includes('in service');
    }).length;

    document.querySelector('.kpi-total-vehicles').textContent = total;
    document.querySelector('.kpi-active-vehicles').textContent = active || total; // Fallback to total for demo
    
    // Update sidebar badge
    const sidebarBadge = document.querySelector('.badge-vehicle-count');
    if (sidebarBadge) sidebarBadge.textContent = total;

    // Total Manpower
    const manpowerEl = document.querySelector('.kpi-total-manpower');
    if (manpowerEl) manpowerEl.textContent = driverMasterData.length;

    // Manpower Section KPIs
    const manpowerTotalEl = document.querySelector('.kpi-manpower-total');
    if (manpowerTotalEl) manpowerTotalEl.textContent = driverMasterData.length;

    const driversCount = driverMasterData.filter(d => {
        const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || d["Employee's Name"] || '';
        const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || getFlexVal(d, "Category") || '';
        return !role.toLowerCase().includes('mechanic') && !name.toLowerCase().includes('mechanic');
    }).length;
    const mechanicsCount = driverMasterData.length - driversCount;

    const driversEl = document.querySelector('.kpi-manpower-drivers');
    if (driversEl) driversEl.textContent = driversCount;

    const mechanicsEl = document.querySelector('.kpi-manpower-mechanics');
    if (mechanicsEl) mechanicsEl.textContent = mechanicsCount;

    // Expiring Documents (< 30 days)
    const expiringSoon = vehicleMasterData.filter(v => 
        (v['VALID DAYS'] >= 0 && v['VALID DAYS'] < 30) || 
        (v['VALID DAYS.1'] >= 0 && v['VALID DAYS.1'] < 30)
    ).length;
    const expiringSoonEl = document.querySelector('.kpi-expiring-docs');
    if (expiringSoonEl) expiringSoonEl.textContent = expiringSoon;
}

function updateFinanceKPIs() {
    // In a real app, these would come from the billing/trips data
    // For now, we'll keep the mock values but ensure the classes match index.html
    const totalRevenue = "AED 2.4M";
    const totalExpenses = "AED 1.3M";
    const netProfit = "AED 1.1M";
    const profitMargin = "45.8%";

    const revEl = document.querySelector('.kpi-total-revenue');
    if (revEl) revEl.textContent = totalRevenue;

    const expEl = document.querySelector('.kpi-total-expenses');
    if (expEl) expEl.textContent = totalExpenses;

    const profitEl = document.querySelector('.kpi-net-profit');
    if (profitEl) profitEl.textContent = netProfit;

    const marginEl = document.querySelector('.kpi-profit-margin');
    if (marginEl) marginEl.textContent = profitMargin;
}

function switchExpiryTab(btn, filter) {
    const tabs = btn.parentElement.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    
    currentExpiryFilter = filter;
    renderExpiryDashboard();
}

function renderExpiryDashboard() {
    const tbody = document.getElementById('expiry-dashboard-tbody');
    if (!tbody || vehicleMasterData.length === 0) return;

    tbody.innerHTML = '';
    
    // Create a flat list of all expiring items
    let expiryItems = [];
    
    let mulkiyaExpired = 0, mulkiyaExpiring = 0;
    let insExpired = 0, insExpiring = 0;
    
    vehicleMasterData.forEach(v => {
        const plate = getFlexVal(v, 'PLATE NO') || 'N/A';
        const cat = getFlexVal(v, 'Category') || 'N/A';
        
        let mVal = getFlexVal(v, 'VALID DAYS');
        const mulkiyaDays = (mVal === null || mVal === '' || isNaN(parseInt(mVal))) ? 9999 : parseInt(mVal);
        
        let iVal = getFlexVal(v, 'VALID DAYS.1') || getFlexVal(v, 'VALID DAYS_1');
        const insDays = (iVal === null || iVal === '' || isNaN(parseInt(iVal))) ? 9999 : parseInt(iVal);

        // Update counts
        if (mulkiyaDays < 0) mulkiyaExpired++;
        else if (mulkiyaDays < 30) mulkiyaExpiring++;

        if (insDays < 0) insExpired++;
        else if (insDays < 30) insExpiring++;

        // Mulkiya
        if (mulkiyaDays < 30) {
            expiryItems.push({
                plate: plate,
                category: cat,
                type: 'Mulkiya',
                date: getFlexVal(v, 'MULKIYA EXP DATE'),
                days: mulkiyaDays
            });
        }
        // Insurance
        if (insDays < 30) {
            expiryItems.push({
                plate: plate,
                category: cat,
                type: 'Insurance',
                date: getFlexVal(v, 'INSURANCE EXP DATE'),
                days: insDays
            });
        }
    });

    // Populate Highlight Summary
    const meEl = document.getElementById('mulkiya-expired-count');
    if (meEl) meEl.textContent = mulkiyaExpired;
    const msEl = document.getElementById('mulkiya-expiring-count');
    if (msEl) msEl.textContent = mulkiyaExpiring;
    
    const ieEl = document.getElementById('insurance-expired-count');
    if (ieEl) ieEl.textContent = insExpired;
    const isEl = document.getElementById('insurance-expiring-count');
    if (isEl) isEl.textContent = insExpiring;

    // Filter by type
    if (currentExpiryFilter !== 'all') {
        expiryItems = expiryItems.filter(item => item.type.toLowerCase() === currentExpiryFilter);
    }

    // Sort by days left
    expiryItems.sort((a, b) => a.days - b.days);

    expiryItems.forEach(item => {
        const statusClass = item.days < 0 ? 'inactive' : item.days < 7 ? 'high-alert' : 'pending';
        const statusText = item.days < 0 ? 'Expired' : item.days < 7 ? 'Urgent' : 'Expiring';

        const row = `
            <tr>
                <td style="color:var(--accent-blue);font-weight:600">${item.plate}</td>
                <td>${item.category}</td>
                <td style="font-weight:500">${item.type}</td>
                <td>${new Date(item.date).toLocaleDateString('en-GB')}</td>
                <td><span style="color:${item.days < 7 ? 'var(--accent-red)' : 'inherit'}">${item.days} Days</span></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    if (expiryItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No ${currentExpiryFilter !== 'all' ? currentExpiryFilter : ''} policies expiring soon.</td></tr>`;
    }
}

function getVehicleIcon(gpsRegistration, isIgnitionOn, speed) {
    let iconClass = 'fa-truck'; // default Trailer Head
    const isMoving = speed > 0;
    
    if (gpsRegistration && vehicleMasterData && vehicleMasterData.length > 0) {
        const search = String(gpsRegistration).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (search.length >= 3) {
            for (const v of vehicleMasterData) {
                const p = (v['PLATE NO'] || v['plate_no'] || v['PLATE_NO'] || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (p && (p === search || (p.length >= 4 && search.length >= 4 && (p.includes(search) || search.includes(p))))) {
                    const cat = (getFlexVal(v, 'Category') || getFlexVal(v, 'VEHICLE TYPE') || '').toLowerCase();
                    if (cat.includes('car')) iconClass = 'fa-car';
                    else if (cat.includes('pick up') || cat.includes('pickup')) iconClass = 'fa-truck-pickup';
                    else if (cat.includes('bus')) iconClass = 'fa-bus';
                    else if (cat.includes('van')) iconClass = 'fa-shuttle-van';
                    else if (cat.includes('forklift')) iconClass = 'fa-tractor';
                    else if (cat.includes('trailer bogie')) iconClass = 'fa-trailer';
                    break;
                }
            }
        }
    }
    
    const statusClass = isIgnitionOn ? (isMoving ? 'moving' : 'idle') : 'offline';
    
    return L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div class="custom-marker ${statusClass}"><i class="fas ${iconClass}"></i></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        tooltipAnchor: [15, 0],
        popupAnchor: [0, -15]
    });
}

function findGpsMatch(plateStr, dataMap) {
    if (!plateStr || !dataMap) return null;
    const str = String(plateStr);
    
    // Exact match first
    if (dataMap[str]) return dataMap[str];
    
    // Fuzzy match
    const search = str.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!search || search.length < 3) return null;

    for (const [key, val] of Object.entries(dataMap)) {
        const cleanKey = String(key).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!cleanKey) continue;
        
        if (cleanKey === search || 
           (cleanKey.length >= 4 && search.length >= 4 && (cleanKey.includes(search) || search.includes(cleanKey)))) {
            return val;
        }
    }
    return null;
}

function renderFleetGrid(categoryFilter = null) {
    const fleetGrid = document.querySelector('.fleet-grid');
    if (!fleetGrid) return;

    fleetGrid.innerHTML = '';

    fleetGrid.innerHTML = '';
    
    // If no category filter, show folders
    if (vehicleMasterData.length > 0) {
        console.log("Rendering Fleet Grid with Data keys:", Object.keys(vehicleMasterData[0]));
    }
    
    // GPS Tracked Virtual Folder
    const gpsTrackedVehicles = vehicleMasterData.filter(v => findGpsMatch(getFlexVal(v, 'PLATE NO'), gpsData) !== null);
    if (gpsTrackedVehicles.length > 0) {
        const gpsFolderCard = `
            <div class="folder-card" style="background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2);" onclick="renderCategoryVehicles('gps_monitored')">
                <div class="folder-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                    <i class="fas fa-satellite-dish"></i>
                </div>
                <div class="folder-info">
                    <div class="folder-name">GPS Monitored</div>
                    <div class="folder-count">${gpsTrackedVehicles.length} Vehicles</div>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
        `;
        fleetGrid.insertAdjacentHTML('beforeend', gpsFolderCard);
    }

    // Generate unique categories (Super Robust Case)
    const categories = [...new Set(vehicleMasterData
        .map(v => {
            const val = getFlexVal(v, 'Category') || 'Other';
            return val.toString().trim().toLowerCase();
        })
    )];
    
    if (categories.length === 0 && vehicleMasterData.length > 0) {
        console.error("No categories found in vehicle data! Keys present:", Object.keys(vehicleMasterData[0]));
    }

    categories.forEach(cat => {
        const matchingVehicles = vehicleMasterData.filter(v => {
            const val = getFlexVal(v, 'Category') || 'Other';
            return val.toString().trim().toLowerCase() === cat;
        });
        const firstMatch = matchingVehicles[0];
        const displayName = firstMatch ? (getFlexVal(firstMatch, 'Category') || 'Other').toString().trim() : 'Other';
        
        // Count specific "Trailer Head" (59 mentioned by user)
        const isHeader = cat === 'trailer head';
        
        const card = `
            <div class="folder-card" onclick="renderCategoryVehicles('${cat}')">
                <div class="folder-icon">
                    <i class="fas fa-folder"></i>
                    ${isHeader ? '<span class="rev-badge"><i class="fas fa-star" title="Revenue Generating"></i> Revenue</span>' : ''}
                </div>
                <div class="folder-info">
                    <div class="folder-name">${displayName}</div>
                    <div class="folder-count">${matchingVehicles.length} Vehicles</div>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
        `;
        fleetGrid.insertAdjacentHTML('beforeend', card);
    });
}

function renderCategoryVehicles(categoryLower) {
    currentCategory = categoryLower;
    const grid = document.querySelector('.fleet-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    let vehicles = [];
    if (categoryLower === 'gps_monitored') {
        vehicles = vehicleMasterData.filter(v => {
            const plate = getFlexVal(v, 'PLATE NO');
            return findGpsMatch(plate, gpsData) !== null;
        });
    } else {
        vehicles = vehicleMasterData.filter(v => {
            const val = getFlexVal(v, 'Category') || 'Other';
            return val.toString().trim().toLowerCase() === categoryLower;
        });
    }
    
    // Add Back button
    const backBtn = `
        <div class="back-card" onclick="backToCategories()">
            <i class="fas fa-arrow-left"></i>
            <span>Back to Categories</span>
        </div>
    `;
    grid.insertAdjacentHTML('beforeend', backBtn);
    
    if (categoryLower === 'gps_monitored') {
        const grouped = {};
        vehicles.forEach(v => {
            const cat = (getFlexVal(v, 'Category') || 'Other').toString().trim();
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(v);
        });
        
        const sortedCats = Object.keys(grouped).sort();
        sortedCats.forEach(catName => {
            const subhead = `
                <div style="grid-column: 1 / -1; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                    <h3 style="color: var(--text-primary); margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                        ${catName} <span style="font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 12px;">${grouped[catName].length} Vehicles</span>
                    </h3>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', subhead);
            grouped[catName].forEach(v => grid.insertAdjacentHTML('beforeend', generateVehicleCardHTML(v)));
        });
    } else {
        vehicles.forEach(v => grid.insertAdjacentHTML('beforeend', generateVehicleCardHTML(v)));
    }
}

function generateVehicleCardHTML(v) {
    const plate = getFlexVal(v, 'PLATE NO');
    const account = getFlexVal(v, 'Account') || 'N/A';
    const vCategory = getFlexVal(v, 'Category') || 'Other';
    const insuranceExpiry = getFlexVal(v, 'INSURANCE EXP DATE');
    const mulkiyaExpiry = getFlexVal(v, 'MULKIYA EXP DATE');
    const insuranceDays = parseInt(getFlexVal(v, 'VALID DAYS.1')) || 999;
    const mulkiyaDays = parseInt(getFlexVal(v, 'VALID DAYS')) || 999;
    
    const insuranceStatus = 
        insuranceDays < 0 ? 'expired' : 
        insuranceDays < 30 ? 'expiring' : 'valid';
        
    const mulkiyaStatus = 
        mulkiyaDays < 0 ? 'expired' : 
        mulkiyaDays < 30 ? 'expiring' : 'valid';

    // GPS status check
    const live = findGpsMatch(plate, gpsData);
    let gpsStatusHtml = `
        <div style="display:flex; gap:8px; align-items:center;">
            <div class="gps-status-badge offline">
                <i class="fas fa-satellite-dish"></i> 
                <span>GPS Offline</span>
            </div>
            <!-- Always show Map button even if offline, falls back to static location -->
            <button class="btn btn-secondary btn-icon" style="padding: 4px 8px; border-radius:4px; font-size:12px; background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); border: 1px solid rgba(59,130,246,0.3);" onclick="event.stopPropagation(); showVehicleDetail('${plate}')" title="View Map">
                <i class="fas fa-map-marker-alt"></i> Map
            </button>
        </div>
    `;

    if (live) {
        const isIgnitionOn = live.ignition === 'on' || live.ignition === true;
        const moving = isIgnitionOn && live.speed > 0;
        const statusClass = isIgnitionOn ? (moving ? 'moving' : 'idle') : 'offline';
        const statusText = isIgnitionOn ? (moving ? 'Moving' : 'Idle') : 'Ignition Off';
        
        gpsStatusHtml = `
            <div style="display:flex; gap:8px; align-items:center;">
                <div class="gps-status-badge ${statusClass}">
                    <i class="fas fa-satellite"></i> 
                    <span>${statusText}</span>
                    ${moving && live.speed ? `<span class="speed">${live.speed} km/h</span>` : ''}
                </div>
                <button class="btn btn-secondary btn-icon" style="padding: 4px 8px; border-radius:4px; font-size:12px; background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); border: 1px solid rgba(59,130,246,0.3);" onclick="event.stopPropagation(); showVehicleDetail('${plate}')" title="View Map">
                    <i class="fas fa-map-marker-alt"></i> Map
                </button>
            </div>
        `;
    }

    return `
        <div class="vehicle-card" onclick="showVehicleDetail('${plate}')">
            <div class="vehicle-card-header">
                <div style="display:flex; align-items:center; gap: 8px; flex-wrap:wrap;">
                    <div class="plate-number">${plate}</div>
                    <span style="padding: 2px 6px; font-size: 10px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1);">${vCategory}</span>
                </div>
                <div class="status-indicator">
                    <span class="status-dot ${insuranceStatus}" title="Insurance: ${insuranceStatus}"></span>
                    <span class="status-dot ${mulkiyaStatus}" title="Mulkiya: ${mulkiyaStatus}"></span>
                </div>
            </div>
            <div class="account-name">${account}</div>
            <div class="vehicle-card-body">
                ${gpsStatusHtml}
                <div class="info-row">
                    <i class="fas fa-shield-alt"></i>
                    <div class="info-content">
                        <span class="info-label">Insurance</span>
                        <span class="info-value ${insuranceStatus}">${new Date(insuranceExpiry).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</span>
                    </div>
                </div>
                <div class="info-row">
                    <i class="fas fa-file-contract"></i>
                    <div class="info-content">
                        <span class="info-label">Registration</span>
                        <span class="info-value ${mulkiyaStatus}">${new Date(mulkiyaExpiry).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</span>
                    </div>
                </div>
            </div>
            <div class="vehicle-card-footer">
                <span class="vehicle-type-tag">${getFlexVal(v, 'VEHICLE TYPE') || 'Truck'}</span>
                ${live ? `<span class="odometer-tag">${live.odometer.toLocaleString()} km</span>` : ''}
            </div>
        </div>
    `;
}

function backToCategories() {
    currentCategory = null;
    renderFleetGrid();
}


// --- Live Data Syncing (Mockup) ---
function loadStoredTrips() {
    const stored = localStorage.getItem('fleet_trips');
    return stored ? JSON.parse(stored) : [];
}

function saveStoredTrip(trip) {
    const trips = loadStoredTrips();
    trips.unshift(trip); // Add to beginning
    localStorage.setItem('fleet_trips', JSON.stringify(trips));
}

function updateStoredTripStatus(truckId, newStatusClass, newStatusText) {
    const trips = loadStoredTrips();
    // Find the most recent trip for this truck
    const trip = trips.find(t => t.vehicle.includes(truckId));
    if (trip) {
        trip.statusClass = newStatusClass;
        trip.statusText = newStatusText;
        localStorage.setItem('fleet_trips', JSON.stringify(trips));
    }
}

function renderStoredTrips() {
    const trips = loadStoredTrips();
    if (trips.length === 0) return;

    const tbody = document.getElementById('recent-trips-tbody');
    if (!tbody) return;

    // Keep the hardcoded rows but clean previous dynamic rows if re-rendered
    // For mockup simplicity, we'll just prepend to existing HTML
    // A better approach is to tag dynamic rows.

    // Remove old dynamic rows
    document.querySelectorAll('tr.dynamic-row').forEach(e => e.remove());

    let html = '';
    trips.forEach(trip => {
        html += `
            <tr class="dynamic-row">
                <td style="color:var(--accent-blue);font-weight:600">${trip.id}</td>
                <td>${trip.date}</td>
                <td>${trip.vehicle}</td>
                <td>${trip.driver}</td>
                <td>${trip.route}</td>
                <td><span class="status-badge ${trip.statusClass}">${trip.statusText}</span></td>
                <td style="font-weight:600">${trip.revenue}</td>
            </tr>
        `;
    });

    tbody.insertAdjacentHTML('afterbegin', html);
}

function safeFormatDateString(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-GB');
}

function findVehicleByPlate(plateNo) {
    if (!plateNo) return null;
    const searchPlate = plateNo.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return vehicleMasterData.find(v => {
        const p = (v['PLATE NO'] || v['plate_no'] || v['PLATE_NO'] || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        return p === searchPlate || (p.length >= 4 && searchPlate.length >= 4 && (p.includes(searchPlate) || searchPlate.includes(p)));
    });
}

function showVehicleDetail(plateNo) {
    const vehicle = findVehicleByPlate(plateNo);
    if (!vehicle) return;

    const plate = vehicle['PLATE NO'] || vehicle['plate_no'] || plateNo;

    const detailsContainer = document.getElementById('modal-vehicle-details');
    if (!detailsContainer) return;
    
    detailsContainer.innerHTML = `
        <div class="detail-card glass-effect">
            <div class="detail-card-header"><h4>Core Information</h4></div>
            <ul class="detail-list">
                <li><span class="label">Type</span> <span class="value">${vehicle['VEHICLE TYPE']}</span></li>
                <li><span class="label">Model Year</span> <span class="value">${vehicle['MODEL'] || 'N/A'}</span></li>
                <li><span class="label">Category</span> <span class="value">${vehicle['Category '] || 'N/A'}</span></li>
                <li><span class="label">Account</span> <span class="value">${vehicle['Account '] || 'N/A'}</span></li>
            </ul>
        </div>
        <div class="detail-card glass-effect">
            <div class="detail-card-header"><h4>Registration / Mulkiya</h4></div>
            <ul class="detail-list">
                <li><span class="label">Expiry Date</span> <span class="value">${safeFormatDateString(vehicle['MULKIYA EXP DATE'])}</span></li>
                <li><span class="label">Validity</span> <span class="value ${vehicle['VALID DAYS'] < 30 ? 'text-danger' : 'text-success'}">${vehicle['VALID DAYS']} Days</span></li>
            </ul>
        </div>
        <div class="detail-card glass-effect">
            <div class="detail-card-header"><h4>Insurance Details</h4></div>
            <ul class="detail-list">
                <li><span class="label">Expiry Date</span> <span class="value">${safeFormatDateString(vehicle['INSURANCE EXP DATE'])}</span></li>
                <li><span class="label">Validity</span> <span class="value ${vehicle['VALID DAYS.1'] < 30 ? 'text-danger' : 'text-success'}">${vehicle['VALID DAYS.1']} Days</span></li>
            </ul>
        </div>
        <div id="modal-gps-info">
            <!-- Populated by updateVehicleModalGpsInfo -->
        </div>
    `;

    const modal = document.getElementById('vehicle-modal');
    if (modal) modal.classList.add('active');
    updateVehicleModalGpsInfo(plateNo);
}

function updateVehicleModalGpsInfo(plateNo) {
    const container = document.getElementById('modal-gps-info');
    if (!container) return;

    const live = findGpsMatch(plateNo, gpsData);
    if (!live) {
        container.innerHTML = `
            <div class="detail-card glass-effect" style="border-color: rgba(239, 68, 68, 0.3);">
                <div class="detail-card-header"><h4 style="color:var(--accent-red)"><i class="fas fa-satellite-dish"></i> GPS Tracking (Offline)</h4></div>
                <div style="padding: 15px; text-align:center; color: var(--text-muted);">
                    No live GPS data available for this vehicle.
                </div>
            </div>
        `;
        return;
    }

    const lat = live.location ? parseFloat(live.location.latitude) : NaN;
    const lng = live.location ? parseFloat(live.location.longitude) : NaN;
    const address = live.location && live.location.position_description ? live.location.position_description : 'N/A';
    const isIgnitionOn = live.ignition === 'on' || live.ignition === true;
    const statusText = isIgnitionOn ? (live.speed > 0 ? 'Moving' : 'Idle') : 'Ignition Off';
    const speedText = live.speed > 0 ? `${live.speed} km/h` : '0 km/h';

    container.innerHTML = `
        <div class="detail-card glass-effect" style="border-color: rgba(59, 130, 246, 0.3);">
            <div class="detail-card-header"><h4 style="color:var(--accent-blue)"><i class="fas fa-satellite"></i> Live GPS Feed</h4></div>
            <ul class="detail-list">
                <li><span class="label">Status</span> <span class="value" style="color: ${isIgnitionOn ? (live.speed > 0 ? 'var(--accent-green)' : 'var(--accent-orange)') : 'var(--text-muted)'}; font-weight:600;">${statusText}</span></li>
                <li><span class="label">Speed</span> <span class="value">${speedText}</span></li>
                <li><span class="label">Location</span> <span class="value" style="font-size: 11px; max-width: 250px;">${address}</span></li>
                <li><span class="label">Odometer</span> <span class="value">${live.odometer ? live.odometer.toLocaleString() + ' km' : 'N/A'}</span></li>
            </ul>
            ${(!isNaN(lat) && !isNaN(lng)) ? `
                <div style="margin-top: 15px; border-radius: 8px; overflow: hidden; height: 180px; width: 100%; position: relative;" id="modal-mini-map"></div>
            ` : ''}
        </div>
    `;

    // Render Leaflet Map
    if (!isNaN(lat) && !isNaN(lng)) {
        setTimeout(() => {
            const mapEl = document.getElementById('modal-mini-map');
            if (!mapEl) return;
            
            // Clean up old map instance if it exists
            const containerHtml = mapEl.parentNode;
            mapEl.remove();
            containerHtml.insertAdjacentHTML('beforeend', '<div style="border-radius: 8px; overflow: hidden; height: 180px; width: 100%; border: 1px solid rgba(255,255,255,0.1);" id="modal-mini-map"></div>');
            
            const miniMap = L.map('modal-mini-map').setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(miniMap);
            
            const customIcon = getVehicleIcon(plateNo, isIgnitionOn, live.speed || 0);
            L.marker([lat, lng], { icon: customIcon }).addTo(miniMap)
                .bindTooltip(plateNo, { permanent: true, direction: 'right', className: 'vehicle-tooltip', offset: [5, 0] });
        }, 150);
    }
}

function closeVehicleModal() {
    const modal = document.getElementById('vehicle-modal');
    if (modal) modal.classList.remove('active');
}

// --- Driver Trip Logic ---
let tripInterval;
let activeTripId = null; // To track the ID of the ongoing trip in Supabase

async function toggleTrip(start) {
    const startBtn = document.getElementById('btn-start-trip');
    const stopBtn = document.getElementById('btn-stop-trip');
    const badge = document.getElementById('driver-status-badge');

    // Elements for manual trip entry
    const fromInput = document.getElementById('trip-from');
    const toInput = document.getElementById('trip-to');
    const entryForm = document.getElementById('trip-entry-form');
    const gpsIndicator = document.getElementById('gps-indicator');
    const gpsCoordsPanel = document.getElementById('gps-coords');

    if (start) {
        // 1. Validate inputs
        const fromVal = fromInput.value.trim();
        const toVal = toInput.value.trim();
        if (!fromVal || !toVal) {
            alert("Please select both 'From' and 'To' locations before starting the trip.");
            return;
        }

        // 2. UI Feedback
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
        startBtn.disabled = true;

        // 3. Capture Start GPS
        let startLat = null, startLng = null;
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            startLat = pos.coords.latitude;
            startLng = pos.coords.longitude;
            gpsIndicator.textContent = 'GPS Active (Started)';
            gpsCoordsPanel.textContent = `Lat: ${startLat.toFixed(4)} | Lng: ${startLng.toFixed(4)}`;
        } catch (err) {
            console.warn("Browser GPS failed, trying Cartrack data...", err);
            const live = gpsData[currentUser.id];
            if (live && live.location) {
                startLat = live.location.latitude;
                startLng = live.location.longitude;
            }
        }

        // 4. Create Trip in Supabase
        try {
            const tripData = {
                driver_id: currentUser.empId || 'Unknown',
                driver_name: currentUser.name || 'Unknown',
                vehicle_id: currentUser.id || 'Unknown',
                from_loc: fromVal,
                to_dest: toVal,
                start_lat: startLat,
                start_lng: startLng,
                start_odometer: gpsData[currentUser.id]?.odometer || 0,
                status: 'In Transit'
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/trips`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(tripData)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to create trip record: ${errText}`);
            }

            const result = await response.json();
            activeTripId = result[0]?.id;
            console.log("Trip started successfully in Supabase. ID:", activeTripId);

            // Update UI
            startBtn.style.display = 'none';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Trip';
            stopBtn.style.display = 'flex';
            badge.className = 'driver-status-badge online';
            badge.textContent = 'In Transit';
            entryForm.style.display = 'none';

            // Log locally for admin view (fallback/instant update)
            const newTripLocal = {
                id: activeTripId || ('TRP-' + Math.floor(Math.random() * 1000)),
                date: new Date().toLocaleDateString('en-GB'),
                vehicle: currentUser.id,
                driver: currentUser.name,
                route: `${fromVal} → ${toVal}`,
                statusClass: 'in-transit',
                statusText: 'In Transit',
                revenue: '---'
            };
            saveStoredTrip(newTripLocal);
            renderStoredTrips();

        } catch (error) {
            console.error("Critical error starting trip:", error);
            alert("Could not start trip in database. Please check your connectivity and ensure the 'trips' table exists.");
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Trip';
            return;
        }

        // Start simulated GPS updates for UI
        tripInterval = setInterval(updateSimulatedGPS, 10000);

    } else {
        // ---- END TRIP ----
        stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ending...';
        stopBtn.disabled = true;

        // 1. Capture End GPS
        let endLat = null, endLng = null;
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            endLat = pos.coords.latitude;
            endLng = pos.coords.longitude;
        } catch (err) {
            const live = gpsData[currentUser.id];
            if (live && live.location) {
                endLat = live.location.latitude;
                endLng = live.location.longitude;
            }
        }

        // 2. Calculate Rate (Tip)
        const fromVal = fromInput.value;
        const toVal = toInput.value;
        const rateRecord = tripTicketRates.find(r => 
            r.from.toLowerCase() === fromVal.toLowerCase() && 
            r.to.toLowerCase() === toVal.toLowerCase()
        );
        const finalRate = rateRecord ? rateRecord.rate : 0;

        // 3. Update Trip in Supabase
        if (activeTripId) {
            try {
                const updateData = {
                    end_time: new Date().toISOString(),
                    end_lat: endLat,
                    end_lng: endLng,
                    end_odometer: gpsData[currentUser.id]?.odometer || 0,
                    rate: finalRate,
                    status: 'Completed'
                };

                await fetch(`${SUPABASE_URL}/rest/v1/trips?id=eq.${activeTripId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updateData)
                });
                console.log("Trip marked as completed in Supabase.");
            } catch (error) {
                console.error("Error updating trip record:", error);
            }
        }

        // 4. UI Reset
        startBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        stopBtn.disabled = false;
        stopBtn.innerHTML = '<i class="fas fa-stop"></i> End Trip';
        
        badge.className = 'driver-status-badge offline';
        badge.textContent = 'Offline';
        entryForm.style.display = 'block';

        // Update local logs
        updateStoredTripStatus(currentUser.id, 'completed', 'Completed');
        renderStoredTrips();

        // Clear state
        activeTripId = null;
        clearInterval(tripInterval);
        gpsIndicator.textContent = 'Tracking stopped.';
        gpsCoordsPanel.textContent = '--- | ---';
        
        // Show success summary
        alert(`Trip Completed Successfully!\nRoute: ${fromVal} → ${toVal}\ncalculated Rate: AED ${finalRate}`);
        
        // Reset dropdowns
        fromInput.value = '';
        toInput.value = '';
    }
}

function updateLoadStatus() {
    // In a real app, this would push to the backend
    console.log("Load status updated to:", document.getElementById('driver-load-status').value);
}

function requestGPS() {
    document.getElementById('gps-indicator').textContent = 'Locating...';
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            document.getElementById('gps-indicator').textContent = 'GPS Active';
            document.getElementById('gps-coords').textContent = `Lat: ${position.coords.latitude.toFixed(4)} | Lng: ${position.coords.longitude.toFixed(4)}`;
        }, err => {
            document.getElementById('gps-indicator').textContent = 'GPS Error';
            updateSimulatedGPS(); // fallback
        });
    } else {
        updateSimulatedGPS(); // fallback
    }
}

function updateSimulatedGPS() {
    document.getElementById('gps-indicator').textContent = 'Simulated GPS Active';
    const lat = (25.2048 + (Math.random() * 0.01)).toFixed(4); // Near Dubai
    const lng = (55.2708 + (Math.random() * 0.01)).toFixed(4);
    document.getElementById('gps-coords').textContent = `Lat: ${lat} | Lng: ${lng}`;
}

// --- Logout ---
function logout() {
    document.body.classList.remove('mobile-view');
    // Clear user data
    currentUser = null;
    currentRole = null;

    // Stop any active trips if driver forgets
    if (tripInterval) {
        clearInterval(tripInterval);
        document.getElementById('gps-indicator').textContent = 'Searching for signal...';
        document.getElementById('gps-coords').textContent = 'Lat: --- | Lng: ---';
    }

    // Reset driver UI
    document.getElementById('btn-start-trip').style.display = 'flex';
    document.getElementById('btn-stop-trip').style.display = 'none';
    document.getElementById('driver-status-badge').className = 'driver-status-badge offline';
    document.getElementById('driver-status-badge').textContent = 'Offline';
    document.getElementById('trip-entry-form').style.display = 'block';
    document.getElementById('trip-from').value = '';
    document.getElementById('trip-to').value = '';

    // Show login screen
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('app-container').style.display = 'none';

    // Reset login forms
    document.getElementById('truck-id').value = 'T-1045';
    document.getElementById('driver-passcode').value = '1234';
    document.getElementById('emp-id').value = 'EMP-001';
    document.getElementById('admin-passcode').value = 'admin123';
}

// Navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    // Remove active from all nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show selected section
    const section = document.getElementById('section-' + sectionId);
    if (section) section.classList.add('active');

    // Activate nav item
    const navItem = document.getElementById('nav-' + sectionId);
    if (navItem) navItem.classList.add('active');

    // Update page title
    const titles = {
        'dashboard-vehicle': 'Vehicle Dashboard',
        'dashboard-finance': 'Finance Dashboard',
        certification: 'Certification & ISO',
        fleet: 'Asset Management',
        manpower: 'Manpower Management',
        attendance: 'Attendance & Timesheet',
        trips: 'Trip Management',
        costs: 'Cost Management',
        invoices: 'Service Invoices',
        reports: 'Reports & Profitability',
        'vehicle-requests': 'Vehicle Requests',
        'vehicle-assignment': 'Vehicle Assignment',
        'trip-monitor': 'Trip Monitor'
    };
    document.getElementById('page-title').textContent = titles[sectionId] || 'Dashboard';

    // Initialize charts when section is shown
    if (sectionId === 'dashboard-vehicle') initVehicleCharts();
    if (sectionId === 'dashboard-finance') initFinanceCharts();
    if (sectionId === 'costs') initCostCharts();
    if (sectionId === 'reports') initReportCharts();
    if (sectionId === 'fleet') renderFleetGrid();
    if (sectionId === 'manpower') renderManpowerTable();
    // New feature sections
    if (sectionId === 'vehicle-requests') loadMyVehicleRequests();
    if (sectionId === 'vehicle-assignment') loadAssignmentBoard();
    if (sectionId === 'trip-monitor') loadTripMonitor();
    if (sectionId === 'tracker') {
        initTracker();
        // Redraw markers from cached gpsData immediately if they weren't drawn yet
        setTimeout(() => {
            if (mainMap) {
                mainMap.invalidateSize();
                for (const plate in gpsData) {
                    const v = gpsData[plate];
                    // Verify it is a valid registration and not the duplicated suffix key
                    if (v.registration === plate) {
                        const lat = v.location ? parseFloat(v.location.latitude) : NaN;
                        const lng = v.location ? parseFloat(v.location.longitude) : NaN;
                        const address = v.location ? v.location.position_description : '';
                        const isIgnitionOn = v.ignition === 'on' || v.ignition === true;
                        const statusStr = isIgnitionOn ? (v.speed > 0 ? 'Moving' : 'Idle') : 'Ignition Off';
                        const customIcon = getVehicleIcon(v.registration, isIgnitionOn, v.speed || 0);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            if (!markers[v.registration]) {
                                markers[v.registration] = L.marker([lat, lng], { icon: customIcon }).addTo(mainMap)
                                    .bindPopup(`<div style="cursor:pointer;" onclick="showVehicleDetail('${v.registration}')"><b>${v.registration}</b><br>${address}<br>Status: ${statusStr} <br><br><span style="color:var(--accent-blue)">Click to view details</span></div>`)
                                    .bindTooltip(v.registration, { permanent: true, direction: 'right', className: 'vehicle-tooltip', offset: [5, 0] });
                            } else {
                                markers[v.registration].setLatLng([lat, lng]).setIcon(customIcon)
                                    .getPopup().setContent(`<div style="cursor:pointer;" onclick="showVehicleDetail('${v.registration}')"><b>${v.registration}</b><br>${address}<br>Status: ${statusStr} <br><br><span style="color:var(--accent-blue)">Click to view details</span></div>`);
                            }
                        }
                    }
                }
                const group = new L.featureGroup(Object.values(markers));
                if (group.getLayers().length > 0) {
                    mainMap.fitBounds(group.getBounds(), { padding: [30, 30] });
                }
            }
        }, 300); // Slight delay to ensure DOM is fully visible before resizing leaflet
    }
    
    if (sectionId === 'certification') {
        renderCategoryCertificates();
    }
}

// --- Category Certificates Logic ---
function renderCategoryCertificates() {
    const tbody = document.getElementById('cert-category-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    // Sort array by expiry ascending
    const sortedCerts = [...categoryCertificates].sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    let activeCerts = 0;
    let expiringSoon = 0;

    sortedCerts.forEach(cert => {
        const daysLeft = Math.ceil((new Date(cert.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        
        let statusClass = 'valid';
        let statusText = 'Valid';
        
        if (daysLeft < 0) {
            statusClass = 'inactive'; // red
            statusText = 'Expired';
        } else if (daysLeft <= 30) {
            statusClass = 'expiring'; // orange
            statusText = 'Expiring Soon';
            expiringSoon++;
        } else {
            activeCerts++;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight:600; color:var(--text-primary)">${cert.category}</td>
            <td>${cert.name}</td>
            <td>${new Date(cert.issueDate).toLocaleDateString('en-GB')}</td>
            <td>${new Date(cert.expiryDate).toLocaleDateString('en-GB')}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px" onclick="alert('Viewing Certificate: ${cert.name}')"><i class="fas fa-eye"></i> View</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (sortedCerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No certificates found.</td></tr>';
    }

    // Update KPIs
    const kActive = document.getElementById('cert-kpi-active');
    const kExpiring = document.getElementById('cert-kpi-expiring');
    const kTotal = document.getElementById('cert-kpi-total');
    
    if (kActive) kActive.textContent = activeCerts;
    if (kExpiring) kExpiring.textContent = expiringSoon;
    if (kTotal) kTotal.textContent = sortedCerts.length;
}

function openCertUploadModal() {
    const modal = document.getElementById('cert-upload-modal');
    if (modal) {
        document.getElementById('cert-upload-form').reset();
        modal.classList.add('active');
    }
}

function closeCertUploadModal() {
    const modal = document.getElementById('cert-upload-modal');
    if (modal) modal.classList.remove('active');
}

function handleCertUpload(event) {
    event.preventDefault();
    
    const cat = document.getElementById('cert-category').value;
    const name = document.getElementById('cert-name').value;
    const expiry = document.getElementById('cert-expiry').value;
    const issueObj = new Date(); // Issue date today as default for new proxy uploads
    
    const newCert = {
        id: Date.now(),
        category: cat,
        name: name,
        issueDate: issueObj.toISOString().split('T')[0],
        expiryDate: expiry,
        status: 'Valid', 
        file: null
    };

    categoryCertificates.push(newCert);
    
    closeCertUploadModal();
    renderCategoryCertificates();
    
    // Show a success toast or alert
    alert(`Successfully uploaded ${name} for ${cat}.`);
}

function switchAssetHubTab(btn, type) {
    const tabs = btn.parentElement.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    
    currentAssetHubType = type;
    
    // Refresh the current view
    if (currentCategory) {
        renderCategoryVehicles(currentCategory);
    } else {
        renderFleetGrid();
    }
}

// Tab switching
function switchTab(el, section) {
    const tabs = el.parentElement.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}

function switchTripTab(el, type) {
    switchTab(el, 'trips');
    
    const tripTable = document.querySelector('#section-trips .data-table-wrapper:not(#trip-rates-container)');
    const ratesTable = document.getElementById('trip-rates-container');
    const kpiGrid = document.querySelector('#section-trips .kpi-grid');

    if (type === 'rates') {
        tripTable.style.display = 'none';
        kpiGrid.style.display = 'none';
        ratesTable.style.display = 'block';
        renderTripRatesTable();
    } else {
        tripTable.style.display = 'block';
        kpiGrid.style.display = 'flex';
        ratesTable.style.display = 'none';
    }
}

function renderTripRatesTable() {
    const tbody = document.getElementById('trip-rates-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = tripTicketRates.map(r => `
        <tr>
            <td style="font-weight:600">${r.from}</td>
            <td>${r.to}</td>
            <td style="color:var(--accent-blue); font-weight:700">AED ${r.rate}</td>
        </tr>
    `).join('');
}

function exportTripRates() {
    // Basic CSV export
    let csv = "From Location,To Destination,Rate (AED)\n";
    tripTicketRates.forEach(r => {
        csv += `"${r.from}","${r.to}",${r.rate}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'NSGT_Trip_Rates.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function populateLocationDropdowns() {
    const fromSelect = document.getElementById('trip-from');
    const toSelect = document.getElementById('trip-to');
    if (!fromSelect || !toSelect) return;

    // Get unique locations
    const fromLocs = [...new Set(tripTicketRates.map(r => r.from))].sort();
    const toLocs = [...new Set(tripTicketRates.map(r => r.to))].sort();

    // Populate From
    fromSelect.innerHTML = '<option value="">Select From Location</option>' + 
        fromLocs.map(loc => `<option value="${loc}">${loc}</option>`).join('');

    // Populate To
    toSelect.innerHTML = '<option value="">Select To Destination</option>' + 
        toLocs.map(loc => `<option value="${loc}">${loc}</option>`).join('');
        
    console.log("Populated driver location dropdowns.");
}

// ============ CHART.JS CONFIG ============
const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: '#94a3b8',
                font: { family: 'Inter', size: 12 },
                padding: 16
            }
        }
    },
    scales: {
        x: {
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
            grid: { color: 'rgba(30, 41, 59, 0.5)' }
        },
        y: {
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
            grid: { color: 'rgba(30, 41, 59, 0.5)' }
        }
    }
};

// Dashboard charts
// Dashboard charts split
function initVehicleCharts() {
    if (vehicleMasterData.length === 0) return;

    // Utilization Doughnut (REAL DATA)
    const utilCtx = document.getElementById('utilizationChart');
    if (utilCtx) {
        if (utilCtx._chart) utilCtx._chart.destroy();

        // Calculate metrics
        const totalVehicles = vehicleMasterData.length;
        const activeCount = vehicleMasterData.filter(v => {
            const insDays = parseInt(getFlexVal(v, 'VALID DAYS.1'));
            const mulkDays = parseInt(getFlexVal(v, 'VALID DAYS'));
            return (!isNaN(insDays) && insDays >= 0) && (!isNaN(mulkDays) && mulkDays >= 0);
        }).length;
        
        // Tracked by GPS count
        const trackedCount = vehicleMasterData.filter(v => findGpsMatch(getFlexVal(v, 'PLATE NO'), gpsData) !== null).length;
        const untrackedCount = totalVehicles - trackedCount;

        // Update tags
        const totalTag = document.getElementById('fleet-total-tag');
        if (totalTag) totalTag.textContent = 'Total Vehicles: ' + totalVehicles;

        const activeTag = document.getElementById('fleet-active-tag');
        if (activeTag) activeTag.textContent = activeCount;

        const trackedTag = document.getElementById('fleet-tracked-tag');
        if (trackedTag) trackedTag.textContent = trackedCount;

        const untrackedTag = document.getElementById('fleet-untracked-tag');
        if (untrackedTag) untrackedTag.textContent = untrackedCount;

        utilCtx._chart = new Chart(utilCtx, {
            type: 'doughnut',
            data: {
                labels: ['Tracked (GPS)', 'Untracked'],
                datasets: [{
                    data: [trackedCount, untrackedCount],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: '#1a2035',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        showGpsBreakdownModal(index === 0 ? 'tracked' : 'untracked');
                    }
                },
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 12 },
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10
                        }
                    }
                }
            }
        });
    }
}

function initFinanceCharts() {
    // 1. Revenue vs Expenses (Last 6 Months)
    const revCtx = document.getElementById('revenueChart');
    if (revCtx) {
        if (revCtx._chart) revCtx._chart.destroy();
        revCtx._chart = new Chart(revCtx, {
            type: 'bar',
            data: {
                labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
                datasets: [
                    {
                        label: 'Revenue',
                        data: [1800, 2100, 1950, 2300, 2200, 2400],
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.6
                    },
                    {
                        label: 'Expenses',
                        data: [1100, 1200, 1150, 1350, 1250, 1300],
                        backgroundColor: 'rgba(239, 68, 68, 0.5)',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.6
                    }
                ]
            },
            options: {
                ...chartDefaults,
                scales: {
                    ...chartDefaults.scales,
                    y: {
                        ...chartDefaults.scales.y,
                        ticks: {
                            ...chartDefaults.scales.y.ticks,
                            callback: v => 'AED ' + v + 'K'
                        }
                    }
                }
            }
        });
    }

    // 2. Revenue by Client (Doughnut)
    const clientCtx = document.getElementById('revenueByClientChartFinance');
    if (clientCtx) {
        if (clientCtx._chart) clientCtx._chart.destroy();
        clientCtx._chart = new Chart(clientCtx, {
            type: 'doughnut',
            data: {
                labels: ['ADNOC Logistics', 'ENOC Distribution', 'Emirates Steel', 'Dubai Municipality', 'RAK Ceramics', 'Others'],
                datasets: [{
                    data: [32, 24, 18, 12, 8, 6],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(6, 182, 212, 0.8)',
                        'rgba(100, 116, 139, 0.5)'
                    ],
                    borderColor: '#1a2035',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 11 },
                            padding: 12,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
}

// Cost charts
function initCostCharts() {
    // Cost Breakdown Pie
    const costCtx = document.getElementById('costBreakdownChart');
    if (!costCtx) return;
    if (costCtx._chart) costCtx._chart.destroy();

    costCtx._chart = new Chart(costCtx, {
        type: 'doughnut',
        data: {
            labels: ['Fuel', 'Maintenance & Spares', 'Consumables', 'Accidents', 'Insurance'],
            datasets: [{
                data: [890, 245, 52, 35, 78],
                backgroundColor: [
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(6, 182, 212, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderColor: '#1a2035',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        padding: 12,
                        usePointStyle: true
                    }
                }
            }
        }
    });

    // Cost Trend Line
    const trendCtx = document.getElementById('costTrendChart');
    if (!trendCtx) return;
    if (trendCtx._chart) trendCtx._chart.destroy();

    trendCtx._chart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [
                {
                    label: 'Fuel',
                    data: [720, 810, 780, 850, 830, 890],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                },
                {
                    label: 'Maintenance',
                    data: [180, 220, 195, 260, 210, 245],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                },
                {
                    label: 'Consumables',
                    data: [40, 45, 38, 55, 48, 52],
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    ticks: {
                        ...chartDefaults.scales.y.ticks,
                        callback: v => 'AED ' + v + 'K'
                    }
                }
            }
        }
    });
}

// Report charts
function initReportCharts() {
    // Profit by Vehicle
    const profitCtx = document.getElementById('profitByVehicleChart');
    if (!profitCtx) return;
    if (profitCtx._chart) profitCtx._chart.destroy();

    profitCtx._chart = new Chart(profitCtx, {
        type: 'bar',
        data: {
            labels: ['T-1012', 'T-1023', 'T-1052', 'T-1045', 'T-1031', 'T-1067'],
            datasets: [
                {
                    label: 'Revenue',
                    data: [118, 102, 92, 85, 67, 34],
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.5
                },
                {
                    label: 'Cost',
                    data: [52, 48, 40, 38, 35, 28],
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.5
                }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    ticks: {
                        ...chartDefaults.scales.y.ticks,
                        callback: v => 'AED ' + v + 'K'
                    }
                }
            }
        }
    });

    // Revenue by Client
    const clientCtx = document.getElementById('revenueByClientChart');
    if (!clientCtx) return;
    if (clientCtx._chart) clientCtx._chart.destroy();

    clientCtx._chart = new Chart(clientCtx, {
        type: 'doughnut',
        data: {
            labels: ['ADNOC Logistics', 'ENOC Distribution', 'Emirates Steel', 'Dubai Municipality', 'RAK Ceramics', 'Others'],
            datasets: [{
                data: [32, 24, 18, 12, 8, 6],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(6, 182, 212, 0.8)',
                    'rgba(100, 116, 139, 0.5)'
                ],
                borderColor: '#1a2035',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        padding: 12,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

// --- Breakdown Modal Logic ---
function showKPIBreakdown(type) {
    const modal = document.getElementById('breakdown-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');

    if (!modal || !titleEl || !bodyEl) return;

    let title = "";
    let breakdownData = [];

    switch (type) {
        case 'total-vehicles':
        case 'active-vehicles':
            title = type === 'total-vehicles' ? "Fleet Breakdown" : "Active Fleet Breakdown";
            const counts = {};
            vehicleMasterData.forEach(v => {
                const cat = (getFlexVal(v, 'Category') || 'Other').trim();
                counts[cat] = (counts[cat] || 0) + 1;
            });
            breakdownData = Object.entries(counts)
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value);
            break;

        case 'total-manpower':
        case 'manpower-roles':
            title = "Manpower Roles";
            const mCounts = { 'Drivers': 0, 'Mechanics': 0 };
            driverMasterData.forEach(d => {
                const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || d["Employee's Name"] || '';
                const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || getFlexVal(d, "Category") || '';
                if (role.toLowerCase().includes('mechanic') || name.toLowerCase().includes('mechanic')) mCounts['Mechanics']++;
                else mCounts['Drivers']++;
            });
            breakdownData = Object.entries(mCounts).map(([label, value]) => ({ label, value }));
            break;

        case 'expiring-policies':
            title = "Expiring Policies Breakdown";
            const pCounts = { 'Mulkiya': 0, 'Insurance': 0 };
            vehicleMasterData.forEach(v => {
                const mDays = parseInt(getFlexVal(v, 'VALID DAYS')) || 999;
                const iDays = parseInt(getFlexVal(v, 'VALID DAYS.1')) || 999;
                if (mDays >= 0 && mDays < 30) pCounts['Mulkiya']++;
                if (iDays >= 0 && iDays < 30) pCounts['Insurance']++;
            });
            breakdownData = Object.entries(pCounts).map(([label, value]) => ({ label, value }));
            break;

        default:
            title = "Data Breakdown";
            breakdownData = [];
    }

    titleEl.textContent = title;
    renderBreakdownModal(breakdownData);
    modal.classList.add('active');
}

function renderBreakdownModal(data) {
    const body = document.getElementById('modal-body');
    const total = data.reduce((sum, item) => sum + item.value, 0);

    let html = '<div class="breakdown-list">';
    data.forEach(item => {
        const percent = total > 0 ? (item.value / total * 100).toFixed(0) : 0;
        html += `
            <div class="breakdown-item">
                <div class="breakdown-row">
                    <span class="breakdown-label">${item.label}</span>
                    <span class="breakdown-value">${item.value}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    body.innerHTML = html;
}

function closeBreakdownModal() {
    const modal = document.getElementById('breakdown-modal');
    if (modal) modal.classList.remove('active');
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('breakdown-modal');
    if (event.target == modal) {
        closeBreakdownModal();
    }
}

// --- Manpower & Attendance ---
let currentManpowerFilter = 'all';

function switchManpowerTab(btn, filter) {
    document.querySelectorAll('#section-manpower .tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentManpowerFilter = filter;
    renderManpowerTable();
}

function renderManpowerTable() {
    const tbody = document.getElementById('manpower-roster-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    // Filter data
    let filteredData = driverMasterData;
    if (currentManpowerFilter === 'driver') {
        filteredData = driverMasterData.filter(d => {
            const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || d["Employee's Name"] || '';
            const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || getFlexVal(d, "Category") || '';
            return !role.toLowerCase().includes('mechanic') && !name.toLowerCase().includes('mechanic');
        });
    } else if (currentManpowerFilter === 'mechanic') {
        filteredData = driverMasterData.filter(d => {
            const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || d["Employee's Name"] || '';
            const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || getFlexVal(d, "Category") || '';
            return role.toLowerCase().includes('mechanic') || name.toLowerCase().includes('mechanic');
        });
    } else if (currentManpowerFilter === 'expiring') {
        filteredData = []; 
    }

    filteredData.forEach(d => {
        const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || d["Employee's Name"] || 'Unknown Name';
        const roleStr = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || getFlexVal(d, "Category") || 'Driver';
        const isMechanic = roleStr.toLowerCase().includes('mechanic') || name.toLowerCase().includes('mechanic');
        const role = isMechanic ? 'Mechanic' : 'Driver';
        
        // Even more robust Emp Code matching
        let empCodeRaw = getFlexVal(d, "Emp Code") || getFlexVal(d, "Emp_Code") || getFlexVal(d, "ID") || d["Emp Code"] || d["emp_code"] || d["EMP CODE"] || d["Employee Code"];
        // Try looking through all keys manually just in case
        if (!empCodeRaw) {
            const keys = Object.keys(d);
            const ecKey = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, '').includes('empcode') || k.toLowerCase().replace(/[^a-z]/g, '').includes('employeeid'));
            if (ecKey) empCodeRaw = d[ecKey];
        }
        
        const empCode = empCodeRaw || 'N/A';
        
        const row = `
            <tr>
                <td style="font-weight:600">
                    <div style="display:flex; align-items:center; gap:10px">
                        <div class="user-avatar" style="width:32px; height:32px; font-size:12px">${name.split(' ').map(n=>n[0]).join('').substring(0,2)}</div>
                        <div>
                            <div>${name}</div>
                            <div style="font-size:11px; color:var(--text-muted)">Emp Code: ${empCode}</div>
                        </div>
                    </div>
                </td>
                <td><span class="role-badge ${role.toLowerCase()}">${roleStr}</span></td>
                <td>${getFlexVal(d, "License") || getFlexVal(d, "UAE") || '—'}</td>
                <td>${getFlexVal(d, "Visa") || getFlexVal(d, "EID") || '—'}</td>
                <td><span class="status-badge active">${getFlexVal(d, "Status") || 'Active'}</span></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

function renderAttendanceTable() {
    const tbody = document.getElementById('attendance-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    driverMasterData.slice(0, 15).forEach(d => {
        const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || 'Unknown Staff';
        const row = `
            <tr>
                <td style="font-weight:600">${name}</td>
                <td>06:00 AM</td>
                <td>—</td>
                <td>4.5h</td>
                <td>—</td>
                <td><span class="status-badge active">Present</span></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadVehicleData();
    initVehicleCharts();
    initFinanceCharts();

    // Animate KPI values on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.kpi-card, .vehicle-card, .data-table-wrapper, .chart-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });

    // Stagger animation delays
    document.querySelectorAll('.kpi-card').forEach((card, i) => {
        card.style.transitionDelay = (i * 0.08) + 's';
    });
    document.querySelectorAll('.vehicle-card').forEach((card, i) => {
        card.style.transitionDelay = (i * 0.1) + 's';
    });
});

/* showSection is already handled above — no patch needed */

/* ============================================================
   ROLE-BASED ACCESS CONTROL
   ============================================================ */

function applyRoleUI(role) {
    // 'super' and 'assigner' see assigner-only nav items
    const showAssigner = role === 'super' || role === 'assigner';
    document.querySelectorAll('.nav-assigner-only').forEach(el => {
        el.style.display = showAssigner ? 'flex' : 'none';
    });
    // Vehicle requests badge visible to all admins
    updateRequestBadge();
}

/* ============================================================
   VEHICLE REQUESTS — localStorage-backed
   ============================================================ */

const REQUESTS_KEY = 'fleetVehicleRequests';

function getVehicleRequests() {
    return JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
}

function saveVehicleRequests(requests) {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}

function generateRequestId() {
    const existing = getVehicleRequests();
    const nums = existing.map(r => parseInt((r.id || 'REQ-0').split('-')[1]) || 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1000;
    return 'REQ-' + next;
}

function openNewRequestForm() {
    const container = document.getElementById('new-request-form-container');
    if (!container) return;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Pre-fill with current user if available
    if (currentUser) {
        const nameEl = document.getElementById('req-name');
        const empEl = document.getElementById('req-empid');
        if (nameEl && !nameEl.value) nameEl.value = currentUser.name || '';
        if (empEl && !empEl.value) empEl.value = currentUser.id || '';
    }
}

function closeNewRequestForm() {
    const container = document.getElementById('new-request-form-container');
    if (container) container.style.display = 'none';
    document.getElementById('vehicle-request-form')?.reset();
}

function submitVehicleRequest(event) {
    event.preventDefault();
    const name = document.getElementById('req-name').value.trim();
    const empId = document.getElementById('req-empid').value.trim().toUpperCase();
    const from = document.getElementById('req-from').value.trim();
    const to = document.getElementById('req-to').value.trim();
    const date = document.getElementById('req-date').value;
    const time = document.getElementById('req-time').value;
    const vtype = document.getElementById('req-vtype').value;
    const notes = document.getElementById('req-notes').value.trim();

    const request = {
        id: generateRequestId(),
        requesterName: name,
        requesterEmpId: empId,
        from, to, date, time,
        vehicleType: vtype,
        notes,
        status: 'Pending',
        assignedVehicle: null,
        assignedDriver: null,
        assignedAt: null,
        createdAt: new Date().toISOString(),
        tripStartTime: null,
        estimatedDurationMin: estimateDistanceDuration(from, to)
    };

    const requests = getVehicleRequests();
    requests.unshift(request);
    saveVehicleRequests(requests);

    closeNewRequestForm();
    loadMyVehicleRequests();
    updateRequestBadge();

    // Show success toast
    showToast('✅ Request ' + request.id + ' submitted successfully!', 'success');
}

function estimateDistanceDuration(from, to) {
    // Rough estimate: 60 min default. With GPS route keys we could do better.
    const knownDistances = {
        'abu dhabi': { 'dubai': 90, 'sharjah': 100, 'rak': 150, 'fujairah': 200 },
        'dubai': { 'abu dhabi': 90, 'sharjah': 30, 'rak': 120, 'fujairah': 130 },
        'sharjah': { 'dubai': 30, 'abu dhabi': 100, 'rak': 90 }
    };
    const fromKey = (from || '').toLowerCase().trim();
    const toKey = (to || '').toLowerCase().trim();
    for (const [k, v] of Object.entries(knownDistances)) {
        if (fromKey.includes(k)) {
            for (const [d, mins] of Object.entries(v)) {
                if (toKey.includes(d)) return mins;
            }
        }
    }
    return 60; // default 60 minutes
}

function loadMyVehicleRequests() {
    const tbody = document.getElementById('my-requests-tbody');
    if (!tbody) return;
    const requests = getVehicleRequests();
    // Filter by current user emp ID
    const myId = currentUser?.id || '';
    const mine = myId ? requests.filter(r => r.requesterEmpId === myId || currentUser?.role === 'super') : requests;

    if (!mine.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">No requests submitted yet.</td></tr>';
        return;
    }
    tbody.innerHTML = mine.map(r => `
        <tr>
            <td style="color:var(--accent-blue); font-weight:600;">${r.id}</td>
            <td>${escHtml(r.from)} → ${escHtml(r.to)}</td>
            <td>${r.date} ${r.time}</td>
            <td>${escHtml(r.vehicleType)}</td>
            <td>${r.assignedVehicle ? `<strong style="color:var(--accent-green);">${escHtml(r.assignedVehicle)}</strong>` : '<span style="color:var(--text-muted);">—</span>'}</td>
            <td>${requestStatusBadge(r.status)}</td>
        </tr>
    `).join('');
}

function requestStatusBadge(status) {
    const map = {
        'Pending': 'background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);',
        'Assigned': 'background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3);',
        'In Progress': 'background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);',
        'Completed': 'background:rgba(99,102,241,0.15); color:#6366f1; border:1px solid rgba(99,102,241,0.3);',
        'Cancelled': 'background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);'
    };
    const style = map[status] || 'background:rgba(255,255,255,0.05); color:var(--text-muted);';
    return `<span style="padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; ${style}">${status}</span>`;
}

function updateRequestBadge() {
    const badge = document.getElementById('req-pending-badge');
    if (!badge) return;
    const count = getVehicleRequests().filter(r => r.status === 'Pending').length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function useGpsForRequest() {
    if (!navigator.geolocation) { alert('GPS not supported on this device.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        // Reverse geocode with Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`)
            .then(r => r.json())
            .then(data => {
                const addr = data.display_name || `${lat}, ${lng}`;
                const fromEl = document.getElementById('req-from');
                if (fromEl) fromEl.value = addr;
            })
            .catch(() => {
                const fromEl = document.getElementById('req-from');
                if (fromEl) fromEl.value = `${lat}, ${lng}`;
            });
    }, () => { alert('Could not get GPS location. Please ensure location permission is granted.'); });
}

/* ============================================================
   VEHICLE ASSIGNMENT BOARD
   ============================================================ */

let currentAssignRequestId = null;
let selectedAssignVehicle = null;
let assignHistoryFilter = 'all';

function loadAssignmentBoard() {
    renderPendingRequests();
    renderAvailableVehiclesPanel();
    renderAssignHistory();
    updateAssignKPIs();
}

function updateAssignKPIs() {
    const requests = getVehicleRequests();
    const pending = requests.filter(r => r.status === 'Pending').length;
    const active = requests.filter(r => r.status === 'In Progress').length;
    const completed = requests.filter(r => {
        if (r.status !== 'Completed') return false;
        if (!r.assignedAt) return false;
        return new Date(r.assignedAt).toDateString() === new Date().toDateString();
    }).length;

    // Available vehicles = vehicles not currently assigned
    const assignedPlates = requests
        .filter(r => r.status === 'Assigned' || r.status === 'In Progress')
        .map(r => r.assignedVehicle)
        .filter(Boolean);
    const availableCount = vehicleMasterData.filter(v => {
        const plate = getFlexVal(v, 'PLATE NO') || '';
        return !assignedPlates.includes(plate);
    }).length;

    const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setKpi('assign-kpi-pending', pending);
    setKpi('assign-kpi-available', availableCount);
    setKpi('assign-kpi-active', active);
    setKpi('assign-kpi-completed', completed);
    updateRequestBadge();
}

function renderPendingRequests() {
    const container = document.getElementById('pending-requests-list');
    if (!container) return;
    const pending = getVehicleRequests().filter(r => r.status === 'Pending');
    if (!pending.length) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:30px;">No pending requests.</p>';
        return;
    }
    container.innerHTML = pending.map(r => `
        <div style="background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.2); border-radius:10px; padding:14px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div>
                    <div style="font-weight:700; color:var(--accent-orange);">${r.id}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${escHtml(r.requesterName)} · ${r.requesterEmpId}</div>
                </div>
                ${requestStatusBadge(r.status)}
            </div>
            <div style="font-size:13px; margin-bottom:4px;"><i class="fas fa-route" style="color:var(--accent-blue); width:14px;"></i> ${escHtml(r.from)} → ${escHtml(r.to)}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;"><i class="fas fa-calendar" style="width:14px;"></i> ${r.date} at ${r.time} · ${escHtml(r.vehicleType)}</div>
            ${r.notes ? `<div style="font-size:11px; color:var(--text-muted); font-style:italic; margin-bottom:8px;">"${escHtml(r.notes)}"</div>` : ''}
            <button class="btn btn-primary" style="width:100%; padding:8px; font-size:13px;" onclick="openAssignModal('${r.id}')">
                <i class="fas fa-truck"></i> Assign Vehicle
            </button>
        </div>
    `).join('');
}

function renderAvailableVehiclesPanel() {
    const container = document.getElementById('available-vehicles-list');
    if (!container) return;
    const assignedPlates = getVehicleRequests()
        .filter(r => r.status === 'Assigned' || r.status === 'In Progress')
        .map(r => r.assignedVehicle).filter(Boolean);

    const available = vehicleMasterData.filter(v => {
        const plate = getFlexVal(v, 'PLATE NO') || '';
        return plate && !assignedPlates.includes(plate);
    }).slice(0, 20);

    if (!available.length) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:30px;">No available vehicles.</p>';
        return;
    }
    container.innerHTML = available.map(v => {
        const plate = getFlexVal(v, 'PLATE NO') || '—';
        const cat = getFlexVal(v, 'Category') || '—';
        const model = getFlexVal(v, 'Model') || getFlexVal(v, 'Make') || '—';
        return `
        <div style="background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); border-radius:8px; padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:700; color:var(--accent-green); font-size:13px;">${escHtml(plate)}</div>
                <div style="font-size:11px; color:var(--text-muted);">${escHtml(model)} · ${escHtml(cat)}</div>
            </div>
            <span style="padding:2px 8px; border-radius:12px; font-size:10px; font-weight:600; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);">Available</span>
        </div>`;
    }).join('');
}

function filterAssignHistory(btn, filter) {
    assignHistoryFilter = filter;
    document.querySelectorAll('#section-vehicle-assignment .tab.mini').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAssignHistory();
}

function renderAssignHistory() {
    const tbody = document.getElementById('assign-history-tbody');
    if (!tbody) return;
    let requests = getVehicleRequests();
    if (assignHistoryFilter !== 'all') {
        requests = requests.filter(r => r.status === assignHistoryFilter);
    }
    if (!requests.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">No requests found.</td></tr>';
        return;
    }
    tbody.innerHTML = requests.map(r => `
        <tr>
            <td style="color:var(--accent-blue); font-weight:600;">${r.id}</td>
            <td>${escHtml(r.requesterName)}<br><small style="color:var(--text-muted);">${r.requesterEmpId}</small></td>
            <td>${escHtml(r.from)} → ${escHtml(r.to)}</td>
            <td>${r.date} ${r.time}</td>
            <td>${r.assignedVehicle ? `<strong style="color:var(--accent-green);">${escHtml(r.assignedVehicle)}</strong>${r.assignedDriver ? '<br><small>' + escHtml(r.assignedDriver) + '</small>' : ''}` : '—'}</td>
            <td>${requestStatusBadge(r.status)}</td>
            <td>
                ${r.status === 'Pending' ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:11px;" onclick="openAssignModal('${r.id}')"><i class="fas fa-truck"></i> Assign</button>` : ''}
                ${r.status === 'Assigned' ? `<button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="markTripStarted('${r.id}')"><i class="fas fa-play"></i> Start</button>` : ''}
                ${r.status === 'In Progress' ? `<button class="btn" style="padding:4px 10px;font-size:11px;background:var(--accent-green);color:#fff;" onclick="markTripCompleted('${r.id}')"><i class="fas fa-flag-checkered"></i> Complete</button>` : ''}
                ${r.status === 'Completed' ? '<span style="color:var(--text-muted);font-size:11px;">Done</span>' : ''}
            </td>
        </tr>
    `).join('');
}

function openAssignModal(requestId) {
    currentAssignRequestId = requestId;
    selectedAssignVehicle = null;
    const requests = getVehicleRequests();
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    // Populate request info
    document.getElementById('assign-modal-request-info').innerHTML = `
        <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 14px; font-size:13px;">
            <span style="color:var(--text-muted);">Request:</span><strong>${req.id}</strong>
            <span style="color:var(--text-muted);">Requester:</span><span>${escHtml(req.requesterName)} (${req.requesterEmpId})</span>
            <span style="color:var(--text-muted);">Route:</span><strong>${escHtml(req.from)} → ${escHtml(req.to)}</strong>
            <span style="color:var(--text-muted);">When:</span><span>${req.date} at ${req.time}</span>
            <span style="color:var(--text-muted);">Type:</span><span>${escHtml(req.vehicleType)}</span>
            ${req.notes ? `<span style="color:var(--text-muted);">Notes:</span><span style="font-style:italic;">"${escHtml(req.notes)}"</span>` : ''}
        </div>
    `;

    // Populate available vehicles
    const assignedPlates = requests
        .filter(r => (r.status === 'Assigned' || r.status === 'In Progress') && r.id !== requestId)
        .map(r => r.assignedVehicle).filter(Boolean);

    let candidates = vehicleMasterData.filter(v => {
        const plate = getFlexVal(v, 'PLATE NO') || '';
        return plate && !assignedPlates.includes(plate);
    });
    // Filter by preference if not 'Any'
    if (req.vehicleType && req.vehicleType !== 'Any') {
        const filtered = candidates.filter(v => (getFlexVal(v, 'Category') || '').toLowerCase().includes(req.vehicleType.toLowerCase()));
        if (filtered.length) candidates = filtered;
    }
    candidates = candidates.slice(0, 20);

    const vehicleGrid = document.getElementById('assign-modal-vehicles');
    if (!candidates.length) {
        vehicleGrid.innerHTML = '<p style="color:var(--text-muted); padding:20px; text-align:center; grid-column:1/-1;">No available vehicles of this type.</p>';
    } else {
        vehicleGrid.innerHTML = candidates.map(v => {
            const plate = getFlexVal(v, 'PLATE NO') || '—';
            const cat = getFlexVal(v, 'Category') || '—';
            const model = getFlexVal(v, 'Model') || getFlexVal(v, 'Make') || '—';
            return `
            <div class="assign-vehicle-card" id="avc-${plate}" onclick="selectAssignVehicle('${plate}', this)" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; cursor:pointer; transition:all 0.2s;">
                <div style="font-weight:700; color:var(--accent-green); font-size:14px; margin-bottom:4px;">${escHtml(plate)}</div>
                <div style="font-size:11px; color:var(--text-muted);">${escHtml(model)}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${escHtml(cat)}</div>
            </div>`;
        }).join('');
    }

    document.getElementById('assign-driver-name').value = '';
    document.getElementById('confirm-assign-btn').disabled = true;
    document.getElementById('assign-modal').classList.add('active');
}

function selectAssignVehicle(plate, cardEl) {
    selectedAssignVehicle = plate;
    document.querySelectorAll('.assign-vehicle-card').forEach(c => {
        c.style.borderColor = 'rgba(255,255,255,0.08)';
        c.style.background = 'rgba(255,255,255,0.03)';
    });
    cardEl.style.borderColor = 'var(--accent-blue)';
    cardEl.style.background = 'rgba(59,130,246,0.1)';
    document.getElementById('confirm-assign-btn').disabled = false;
}

function confirmAssignment() {
    if (!currentAssignRequestId || !selectedAssignVehicle) return;
    const driverName = document.getElementById('assign-driver-name').value.trim();
    const requests = getVehicleRequests();
    const idx = requests.findIndex(r => r.id === currentAssignRequestId);
    if (idx === -1) return;

    requests[idx].status = 'Assigned';
    requests[idx].assignedVehicle = selectedAssignVehicle;
    requests[idx].assignedDriver = driverName || null;
    requests[idx].assignedAt = new Date().toISOString();

    saveVehicleRequests(requests);
    showToast(`✅ ${selectedAssignVehicle} assigned to ${currentAssignRequestId}`, 'success');
    closeAssignModal();
    loadAssignmentBoard();
    loadTripMonitor();
}

function closeAssignModal() {
    document.getElementById('assign-modal')?.classList.remove('active');
    currentAssignRequestId = null;
    selectedAssignVehicle = null;
}

function markTripStarted(requestId) {
    const requests = getVehicleRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) return;
    requests[idx].status = 'In Progress';
    requests[idx].tripStartTime = new Date().toISOString();
    saveVehicleRequests(requests);
    loadAssignmentBoard();
    loadTripMonitor();
    showToast('🚛 Trip started for ' + requestId, 'info');
}

function markTripCompleted(requestId) {
    const requests = getVehicleRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) return;
    requests[idx].status = 'Completed';
    requests[idx].completedAt = new Date().toISOString();
    saveVehicleRequests(requests);
    loadAssignmentBoard();
    loadTripMonitor();
    showToast('🏁 Trip completed for ' + requestId, 'success');
}

/* ============================================================
   TRIP PROGRESS MONITOR
   ============================================================ */

let monitorIntervalId = null;
const monitorCharts = {}; // cache Chart.js instances

function loadTripMonitor() {
    const requests = getVehicleRequests();
    const active = requests.filter(r => ['Assigned', 'In Progress', 'Completed'].includes(r.status));
    const grid = document.getElementById('trip-monitor-grid');
    if (!grid) return;

    // Update summary strip
    const setMon = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const assignedPlates = requests.filter(r => r.status === 'Assigned' || r.status === 'In Progress').map(r => r.assignedVehicle).filter(Boolean);
    setMon('mon-available', vehicleMasterData.filter(v => {
        const p = getFlexVal(v, 'PLATE NO') || '';
        return p && !assignedPlates.includes(p);
    }).length);
    setMon('mon-inprogress', requests.filter(r => r.status === 'In Progress').length);
    setMon('mon-completed', requests.filter(r => r.status === 'Completed').length);
    setMon('mon-assigned', requests.filter(r => r.status === 'Assigned').length);

    if (!active.length) {
        // Destroy old charts
        Object.values(monitorCharts).forEach(c => c?.destroy?.());
        grid.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); padding:60px; grid-column:1/-1;">
                <i class="fas fa-satellite-dish" style="font-size:48px; opacity:0.3; display:block; margin-bottom:16px;"></i>
                No active trips to monitor.
            </div>`;
        return;
    }

    grid.innerHTML = active.map(r => buildMonitorCard(r)).join('');

    // Draw charts
    active.forEach(r => {
        const prog = calculateTripProgress(r);
        const canvasId = 'doughnut-' + r.id;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (monitorCharts[r.id]) monitorCharts[r.id].destroy();
        const pct = prog.percent;
        const color = pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : '#8b5cf6';
        monitorCharts[r.id] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [pct, 100 - pct],
                    backgroundColor: [color, 'rgba(255,255,255,0.05)'],
                    borderWidth: 0,
                    circumference: 360
                }]
            },
            options: {
                cutout: '72%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: { duration: 800 }
            }
        });
    });

    // Refresh timestamp
    const lastEl = document.getElementById('monitor-last-refresh');
    if (lastEl) lastEl.textContent = 'Last refresh: ' + new Date().toLocaleTimeString();

    // Auto-refresh every 30 seconds
    if (monitorIntervalId) clearInterval(monitorIntervalId);
    monitorIntervalId = setInterval(loadTripMonitor, 30000);
}

function calculateTripProgress(req) {
    const durationMin = req.estimatedDurationMin || 60;
    if (req.status === 'Assigned') {
        return { percent: 0, etaMinutes: durationMin, label: 'Awaiting Departure', color: '#8b5cf6' };
    }
    if (req.status === 'Completed') {
        return { percent: 100, etaMinutes: 0, label: '✅ Trip Complete', color: '#10b981' };
    }
    // In Progress: calculate based on start time
    if (!req.tripStartTime) {
        return { percent: 0, etaMinutes: durationMin, label: 'Trip in Progress', color: '#f59e0b' };
    }
    const elapsed = (Date.now() - new Date(req.tripStartTime).getTime()) / 60000; // minutes
    const percent = Math.min(Math.round((elapsed / durationMin) * 100), 99); // cap at 99 until marked complete
    const remaining = Math.max(Math.round(durationMin - elapsed), 0);
    let label = '';
    if (remaining <= 0) label = 'Arriving Soon…';
    else if (remaining <= 5) label = `Arrives in ~${remaining} min`;
    else if (remaining <= 15) label = `~${remaining} min remaining`;
    else label = `Trip in Progress (~${remaining} min left)`;
    return { percent, etaMinutes: remaining, label, color: '#f59e0b' };
}

function buildMonitorCard(req) {
    const prog = calculateTripProgress(req);
    const pct = prog.percent;
    const barColor = pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : '#8b5cf6';
    const vehicle = req.assignedVehicle || '—';
    const driver = req.assignedDriver || 'Unassigned';

    return `
    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:20px; position:relative; overflow:hidden;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div>
                <div style="font-weight:700; font-size:18px; color:var(--text-primary);">${escHtml(vehicle)}</div>
                <div style="font-size:12px; color:var(--text-muted);"><i class="fas fa-user" style="margin-right:4px;"></i>${escHtml(driver)}</div>
            </div>
            ${requestStatusBadge(req.status)}
        </div>
        <!-- Route -->
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:14px;">
            <i class="fas fa-map-marker-alt" style="color:var(--accent-green); margin-right:6px;"></i>${escHtml(req.from)}
            <i class="fas fa-arrow-right" style="margin:0 8px; color:var(--text-muted); font-size:10px;"></i>
            <i class="fas fa-flag-checkered" style="color:var(--accent-orange); margin-right:6px;"></i>${escHtml(req.to)}
        </div>
        <!-- Doughnut + Info -->
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
            <div style="position:relative; width:80px; height:80px; flex-shrink:0;">
                <canvas id="doughnut-${req.id}" width="80" height="80"></canvas>
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; color:${barColor};">${pct}%</div>
            </div>
            <div style="flex:1;">
                <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:6px;">${prog.label}</div>
                <div style="font-size:11px; color:var(--text-muted);">Request ${req.id} · ${req.date} ${req.time}</div>
                ${req.notes ? `<div style="font-size:11px; color:var(--text-muted); font-style:italic; margin-top:4px;">"${escHtml(req.notes)}"</div>` : ''}
            </div>
        </div>
        <!-- Progress Bar -->
        <div style="height:6px; background:rgba(255,255,255,0.06); border-radius:99px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${barColor}; border-radius:99px; transition:width 1s ease;"></div>
        </div>
    </div>`;
}

/* ============================================================
   GPS START LOCATION ENFORCEMENT
   GPS_TOLERANCE_METERS — configurable
   ============================================================ */
const GPS_TOLERANCE_METERS = 500;
let gpsValidateMap = null;
let gpsValidatePassed = false;
let gpsValidateCallback = null;

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // metres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeLocation(address) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
    } catch (e) {}
    return null;
}

function openGpsValidation(fromLocation, onSuccess) {
    gpsValidatePassed = false;
    gpsValidateCallback = onSuccess;
    const modal = document.getElementById('gps-validate-modal');
    if (!modal) { onSuccess?.(); return; }
    modal.classList.add('active');

    // Reset UI
    document.getElementById('gps-validate-status').style.display = 'block';
    document.getElementById('gps-validate-status').innerHTML = `
        <i class="fas fa-satellite-dish" style="font-size:40px; color:var(--accent-blue);"></i>
        <p style="margin-top:12px; color:var(--text-muted);">Acquiring GPS signal for validation…</p>`;
    document.getElementById('gps-validate-map').style.display = 'none';
    document.getElementById('gps-validate-result').style.display = 'none';
    document.getElementById('gps-proceed-btn').disabled = true;

    if (!navigator.geolocation) {
        document.getElementById('gps-validate-status').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size:40px; color:var(--accent-orange);"></i>
            <p style="margin-top:12px; color:var(--text-muted);">GPS not supported on this device. Trip can proceed without location validation.</p>`;
        document.getElementById('gps-proceed-btn').disabled = false;
        gpsValidatePassed = true;
        return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
        const gpsLat = pos.coords.latitude;
        const gpsLng = pos.coords.longitude;

        document.getElementById('gps-validate-status').innerHTML = `
            <i class="fas fa-search-location" style="font-size:32px; color:var(--accent-blue);"></i>
            <p style="margin-top:10px; color:var(--text-muted);">Geocoding declared location…</p>`;

        const declared = await geocodeLocation(fromLocation);
        const resultEl = document.getElementById('gps-validate-result');
        resultEl.style.display = 'block';

        if (!declared) {
            // Cannot geocode — allow trip but warn
            resultEl.innerHTML = `<div style="padding:12px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:8px; color:var(--accent-orange);">
                <i class="fas fa-exclamation-triangle"></i> Could not geocode the declared location. Location validation skipped.</div>`;
            document.getElementById('gps-proceed-btn').disabled = false;
            document.getElementById('gps-validate-status').style.display = 'none';
            gpsValidatePassed = true;
            return;
        }

        const dist = haversineDistance(gpsLat, gpsLng, declared.lat, declared.lng);
        const distText = dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km';
        const passed = dist <= GPS_TOLERANCE_METERS;
        gpsValidatePassed = passed;

        document.getElementById('gps-validate-status').style.display = 'none';

        // Show result
        if (passed) {
            resultEl.innerHTML = `<div style="padding:12px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:8px; color:#10b981;">
                <i class="fas fa-check-circle"></i> <strong>Location Verified!</strong> Your GPS is ${distText} from the declared start location.</div>`;
            document.getElementById('gps-proceed-btn').disabled = false;
        } else {
            resultEl.innerHTML = `<div style="padding:12px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; color:#ef4444;">
                <i class="fas fa-times-circle"></i> <strong>Location Mismatch!</strong> Your GPS is ${distText} away from "<em>${escHtml(declared.name?.split(',')[0] || fromLocation)}</em>". You must be within ${GPS_TOLERANCE_METERS}m to start the trip.</div>`;
            document.getElementById('gps-proceed-btn').disabled = true;
        }

        // Show mini map
        const mapContainer = document.getElementById('gps-validate-map');
        mapContainer.style.display = 'block';
        if (gpsValidateMap) {
            gpsValidateMap.remove();
            gpsValidateMap = null;
        }
        setTimeout(() => {
            gpsValidateMap = L.map('gps-validate-map').setView([gpsLat, gpsLng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(gpsValidateMap);

            // GPS marker (blue)
            L.circleMarker([gpsLat, gpsLng], { radius: 10, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8 })
                .bindPopup('<b>Your GPS Location</b>').addTo(gpsValidateMap);

            // Declared marker (orange/green)
            L.circleMarker([declared.lat, declared.lng], {
                radius: 10,
                color: passed ? '#10b981' : '#ef4444',
                fillColor: passed ? '#10b981' : '#ef4444',
                fillOpacity: 0.8
            }).bindPopup(`<b>Declared: ${escHtml(fromLocation)}</b>`).addTo(gpsValidateMap);

            // Tolerance circle
            L.circle([declared.lat, declared.lng], {
                radius: GPS_TOLERANCE_METERS,
                color: passed ? '#10b981' : '#ef4444',
                fillOpacity: 0.05,
                weight: 1
            }).addTo(gpsValidateMap);

            gpsValidateMap.fitBounds([[gpsLat, gpsLng], [declared.lat, declared.lng]], { padding: [30, 30] });
            gpsValidateMap.invalidateSize();
        }, 150);

    }, err => {
        document.getElementById('gps-validate-status').innerHTML = `
            <i class="fas fa-times-circle" style="font-size:40px; color:var(--accent-red);"></i>
            <p style="margin-top:12px; color:var(--accent-red);">GPS permission denied. Please allow location access and try again.</p>`;
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

function closeGpsValidateModal() {
    document.getElementById('gps-validate-modal')?.classList.remove('active');
    if (gpsValidateMap) { gpsValidateMap.remove(); gpsValidateMap = null; }
}

function proceedAfterGpsValidation() {
    if (!gpsValidatePassed) return;
    closeGpsValidateModal();
    gpsValidateCallback?.();
}

// Patch toggleTrip to run GPS validation before starting
const _origToggleTrip = typeof toggleTrip === 'function' ? toggleTrip : null;
function toggleTrip(isStart) {
    if (isStart) {
        const fromEl = document.getElementById('trip-from');
        const toEl = document.getElementById('trip-to');
        const from = fromEl ? fromEl.options[fromEl.selectedIndex]?.text : '';
        const to = toEl ? toEl.options[toEl.selectedIndex]?.text : '';
        if (!from || from === 'Select From Location') {
            alert('Please select a From Location before starting the trip.');
            return;
        }
        openGpsValidation(from, () => {
            if (_origToggleTrip) _origToggleTrip(true);
        });
    } else {
        if (_origToggleTrip) _origToggleTrip(false);
    }
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:10px;';
        document.body.appendChild(toastContainer);
    }
    const colors = { success: '#10b981', info: '#3b82f6', error: '#ef4444', warning: '#f59e0b' };
    const icons = { success: 'check-circle', info: 'info-circle', error: 'times-circle', warning: 'exclamation-triangle' };
    const toast = document.createElement('div');
    toast.style.cssText = `background:rgba(20,24,40,0.95); border:1px solid ${colors[type] || '#3b82f6'}; border-left:4px solid ${colors[type] || '#3b82f6'}; color:#fff; padding:12px 18px; border-radius:10px; font-size:13px; display:flex; align-items:center; gap:10px; min-width:260px; max-width:380px; box-shadow:0 8px 32px rgba(0,0,0,0.5); animation:slideInRight 0.3s ease;`;
    toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}" style="color:${colors[type]}; flex-shrink:0;"></i>${escHtml(message)}`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 4000);
}

/* ============================================================
   HELPER: HTML Escaping
   ============================================================ */
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* showSection is already defined above at line 1684 — no patch needed */


