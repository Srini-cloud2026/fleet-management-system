/* ============================================
   FLEET MANAGEMENT SYSTEM — JavaScript
   ============================================ */

// --- Authentication & Users Mock Data ---
const VALID_DRIVERS = {
    'T-1045': { passcode: '1234', name: 'Mohammed Ali' },
    'T-1023': { passcode: '1234', name: 'Rashid Khan' }
};

const VALID_ADMINS = {
    'EMP-001': { passcode: 'admin123', name: 'Admin User' }
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
        // Fetch Drivers from several possible names (Discovery)
        let drivers = [];
        const staffTables = [
            'Driver_master', 'Drivers_Master', 'drivers_master', 'DriversMaster',
            'Drivers_Info', 'drivers_info', 'Staff_Master', 'Staff', 'Drivers', 
            'Driver master', 'Drivers Info', 'Manpower', 'manpower_details', 'employee_master'
        ];
        
        for (const tableName of staffTables) {
            console.log(`Trying to fetch staff from table: "${tableName}"...`);
            const { data, error } = await supabaseClient.from(tableName).select('*').limit(300);
            if (!error && data && data.length > 0) {
                drivers = data;
                console.log(`Success! Found ${data.length} staff in "${tableName}"`);
                // Update Badge for feedback
                const stamp = document.getElementById('debug-version');
                if (stamp) stamp.innerHTML += ` | STAFF FOUND in ${tableName}`;
                break;
            }
        }
        
        driverMasterData = drivers || [];
        
        console.log("Data loaded from Supabase. Vehicles:", vehicleMasterData.length, "Staff:", driverMasterData.length);
        if (vehicleMasterData.length > 0) console.log("SAMPLE VEHICLE DATA:", vehicleMasterData[0]);
        if (driverMasterData.length > 0) console.log("SAMPLE STAFF DATA:", driverMasterData[0]);
        
        // Add Version Stamp here for immediate feedback
        const topBar = document.querySelector('.topbar-left');
        if (topBar) {
            const stamp = document.getElementById('debug-version') || document.createElement('span');
            stamp.id = 'debug-version';
            stamp.style = 'font-size:12px; margin-left:15px; padding: 4px 10px; border-radius: 4px; background: #00bcd4; color: white; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2)';
            stamp.textContent = 'v3.3-COMPLETE';
            if (!document.getElementById('debug-version')) topBar.appendChild(stamp);
        }

        refreshAdminUI();
        
    } catch (error) {
        console.error("Error loading data from Supabase:", error);
        alert("CRITICAL ERROR: Failed to connect to Supabase. Check Console (F12) for details.");
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
        const truckId = document.getElementById('truck-id').value.toUpperCase();
        const passcode = document.getElementById('driver-passcode').value;
        const empId = document.getElementById('driver-emp-id').value.trim().toUpperCase();
        const driverName = document.getElementById('driver-name-input').value.trim();

        // For demo, any driver with '1234' passcode and valid truck ID from master or default
        const plateKey = 'PLATE NO';
        const nameKey = "Employee's Name";

        const vehicleExists = vehicleMasterData.some(v => {
            const p = v[plateKey] || v['plate_no'] || '';
            return p.toString().toUpperCase().includes(truckId);
        });

        if (passcode === '1234' && (VALID_DRIVERS[truckId] || vehicleExists)) {
            let userDisplayName = driverName;
            if (!userDisplayName) {
                const driverObj = driverMasterData.find(d => {
                    const dName = d[nameKey] || d['name'] || '';
                    return dName.toLowerCase().includes(driverName.toLowerCase());
                });
                userDisplayName = driverObj ? driverObj[nameKey] : (VALID_DRIVERS[truckId] ? VALID_DRIVERS[truckId].name : 'Driver ' + truckId);
            }

            currentUser = {
                id: truckId,
                empId: empId,
                name: userDisplayName
            };
            currentRole = 'driver';
            success = true;
            initDriverHub();
        }
    } else if (role === 'admin') {
        const empId = document.getElementById('emp-id').value.toUpperCase();
        const passcode = document.getElementById('admin-passcode').value;
        if (VALID_ADMINS[empId] && VALID_ADMINS[empId].passcode === passcode) {
            currentUser = { id: empId, ...VALID_ADMINS[empId] };
            currentRole = 'admin';
            success = true;
            initAdminDashboard();
        }
    }

    if (success) {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-container').style.display = 'flex';
        // Update topbar user avatar letter
        document.querySelector('.user-avatar').textContent = currentUser.name.charAt(0);
    } else {
        alert('Invalid credentials. Please try again.');
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

async function fetchGpsData() {
    console.log("Fetching live GPS data...");
    const statusLabel = document.getElementById('gps-status-badge');
    try {
        const response = await fetch('/api/gps_proxy?endpoint=status');
        if (!response.ok) {
            const errData = await response.json();
            if (statusLabel) {
                statusLabel.style.background = 'var(--accent-red)';
                statusLabel.textContent = `GPS Error: ${errData.status || 'Proxy'}`;
            }
            throw new Error('Proxy error');
        }
        const data = await response.json();
        
        // Map data by registration (PLATE NO)
        const newGpsData = {};
        let movingCount = 0;
        let idleCount = 0;

        if (Array.isArray(data)) {
            data.forEach((v) => {
                newGpsData[v.registration] = v;
                if (v.registration.includes('/')) {
                    const suffix = v.registration.split('/').pop();
                    newGpsData[suffix] = v;
                }
                
                // Track stats
                if (v.ignition === 'on' || v.ignition === true) movingCount++;
                else idleCount++;

                // Update Map Markers
                if (mainMap) {
                    const lat = parseFloat(v.latitude);
                    const lng = parseFloat(v.longitude);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        if (!markers[v.registration]) {
                            markers[v.registration] = L.marker([lat, lng]).addTo(mainMap)
                                .bindPopup(`<b>${v.registration}</b><br>${v.address}<br>Status: ${v.ignition ? 'Moving' : 'Idle'}`);
                        } else {
                            markers[v.registration].setLatLng([lat, lng]);
                        }
                    }
                }
            });
        }
        gpsData = newGpsData;
        
        if (statusLabel) {
            statusLabel.style.background = 'var(--accent-green)';
            statusLabel.textContent = `GPS Synced: ${Object.keys(newGpsData).length} Assets`;
        }

        const mEl = document.getElementById('stat-moving');
        const iEl = document.getElementById('stat-idle');
        if (mEl) mEl.textContent = movingCount;
        if (iEl) iEl.textContent = idleCount;

        console.log(`GPS Synced: ${Object.keys(newGpsData).length} vehicles found.`);
        
        if (currentRole === 'admin') {
            if (currentCategory) renderCategoryVehicles(currentCategory);
        }
    } catch (error) {
        console.error("Failed to fetch GPS data from proxy:", error);
    }
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
        const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || '';
        const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || '';
        return !role.toLowerCase().includes('mechanic');
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
    
    vehicleMasterData.forEach(v => {
        const plate = getFlexVal(v, 'PLATE NO') || 'N/A';
        const cat = getFlexVal(v, 'Category') || 'N/A';
        const mulkiyaDays = parseInt(getFlexVal(v, 'VALID DAYS')) || 999;
        const insDays = parseInt(getFlexVal(v, 'VALID DAYS.1')) || parseInt(getFlexVal(v, 'VALID DAYS_1')) || 999;

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

function renderFleetGrid(categoryFilter = null) {
    const fleetGrid = document.querySelector('.fleet-grid');
    if (!fleetGrid) return;

    fleetGrid.innerHTML = '';

    fleetGrid.innerHTML = '';
    
    // If no category filter, show folders
    if (vehicleMasterData.length > 0) {
        console.log("Rendering Fleet Grid with Data keys:", Object.keys(vehicleMasterData[0]));
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
    
    const vehicles = vehicleMasterData.filter(v => {
        const val = getFlexVal(v, 'Category') || 'Other';
        return val.toString().trim().toLowerCase() === categoryLower;
    });
    
    // Add Back button
    const backBtn = `
        <div class="back-card" onclick="backToCategories()">
            <i class="fas fa-arrow-left"></i>
            <span>Back to Categories</span>
        </div>
    `;
    grid.insertAdjacentHTML('beforeend', backBtn);
    
    vehicles.forEach(v => {
        const plate = getFlexVal(v, 'PLATE NO');
        const account = getFlexVal(v, 'Account') || 'N/A';
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
        const live = gpsData[plate];
        let gpsStatusHtml = `
            <div class="gps-status-badge offline">
                <i class="fas fa-satellite-dish"></i> 
                <span>GPS Offline</span>
            </div>
        `;

        if (live) {
            const moving = live.ignition === 'on' || live.ignition === true;
            gpsStatusHtml = `
                <div class="gps-status-badge ${moving ? 'moving' : 'idle'}">
                    <i class="fas fa-satellite"></i> 
                    <span>${moving ? 'Moving' : 'Idle'}</span>
                    ${moving && live.speed ? `<span class="speed">${live.speed} km/h</span>` : ''}
                </div>
            `;
        }

        const card = `
            <div class="vehicle-card" onclick="showVehicleDetail('${plate}')">
                <div class="vehicle-card-header">
                    <div class="plate-number">${plate}</div>
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
        grid.insertAdjacentHTML('beforeend', card);
    });
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

function findVehicleByPlate(plateNo) {
    if (!plateNo) return null;
    const searchPlate = plateNo.toString().toUpperCase();
    return vehicleMasterData.find(v => {
        const p = v['PLATE NO'] || v['plate_no'] || v['PLATE_NO'] || '';
        return p.toString().toUpperCase() === searchPlate || p.toString().toUpperCase().includes(searchPlate);
    });
}

function showVehicleDetail(plateNo) {
    const vehicle = findVehicleByPlate(plateNo);
    if (!vehicle) return;

    const plate = vehicle['PLATE NO'] || vehicle['plate_no'] || plateNo;

    
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
                <li><span class="label">Expiry Date</span> <span class="value">${new Date(vehicle['MULKIYA EXP DATE']).toLocaleDateString('en-GB')}</span></li>
                <li><span class="label">Validity</span> <span class="value ${vehicle['VALID DAYS'] < 30 ? 'text-danger' : 'text-success'}">${vehicle['VALID DAYS']} Days</span></li>
            </ul>
        </div>
        <div class="detail-card glass-effect">
            <div class="detail-card-header"><h4>Insurance Details</h4></div>
            <ul class="detail-list">
                <li><span class="label">Expiry Date</span> <span class="value">${new Date(vehicle['INSURANCE EXP DATE']).toLocaleDateString('en-GB')}</span></li>
                <li><span class="label">Validity</span> <span class="value ${vehicle['VALID DAYS.1'] < 30 ? 'text-danger' : 'text-success'}">${vehicle['VALID DAYS.1']} Days</span></li>
            </ul>
        </div>
        <div id="modal-gps-info">
            <!-- Populated by updateVehicleModalGpsInfo -->
        </div>
    `;

    modal.classList.add('active');
    updateVehicleModalGpsInfo(plateNo);
}

function closeVehicleModal() {
    const modal = document.getElementById('vehicle-modal');
    if (modal) modal.classList.remove('active');
}

// --- Driver Trip Logic ---
let tripInterval;

function toggleTrip(start) {
    const startBtn = document.getElementById('btn-start-trip');
    const stopBtn = document.getElementById('btn-stop-trip');
    const badge = document.getElementById('driver-status-badge');

    // Elements for manual trip entry
    const fromInput = document.getElementById('trip-from');
    const toInput = document.getElementById('trip-to');
    const entryForm = document.getElementById('trip-entry-form');

    if (start) {
        // Validate inputs
        if (!fromInput.value.trim() || !toInput.value.trim()) {
            alert("Please enter both 'From' and 'To' locations before starting the trip.");
            return;
        }

        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        badge.className = 'driver-status-badge online';
        badge.textContent = 'In Transit';
        entryForm.style.display = 'none'; // hide inputs during trip

        // Use manual entry for the route
        const routeText = `${fromInput.value.trim()} → ${toInput.value.trim()}`;

        // Get live odometer if available
        const live = gpsData[currentUser.id];
        const startOdo = live ? live.odometer : '---';

        // Log trip to local storage for Admin to see
        const newTrip = {
            id: 'TRP-' + Math.floor(2600 + Math.random() * 100),
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            vehicle: `Truck - ${currentUser.id}`,
            driver: currentUser.name,
            route: routeText,
            statusClass: 'in-transit',
            statusText: 'In Transit',
            revenue: '---',
            startOdo: startOdo
        };
        saveStoredTrip(newTrip);

        // Start simulated GPS
        tripInterval = setInterval(updateSimulatedGPS, 5000);
        updateSimulatedGPS();
    } else {
        startBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        badge.className = 'driver-status-badge offline';
        badge.textContent = 'Offline';
        entryForm.style.display = 'block'; // show inputs again for the next trip

        // Clear inputs for the next trip
        fromInput.value = '';
        toInput.value = '';

        // Update local storage status
        updateStoredTripStatus(currentUser.id, 'completed', 'Completed');

        clearInterval(tripInterval);
        document.getElementById('gps-indicator').textContent = 'Tracking stopped.';
        document.getElementById('gps-coords').textContent = '--- | ---';
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
        reports: 'Reports & Profitability'
    };
    document.getElementById('page-title').textContent = titles[sectionId] || 'Dashboard';

    // Initialize charts when section is shown
    if (sectionId === 'dashboard-vehicle') initVehicleCharts();
    if (sectionId === 'dashboard-finance') initFinanceCharts();
    if (sectionId === 'costs') initCostCharts();
    if (sectionId === 'reports') initReportCharts();
    if (sectionId === 'fleet') renderFleetGrid();
    if (sectionId === 'manpower') renderManpowerTable();
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

        const activeCount = vehicleMasterData.filter(v => v['VALID DAYS'] >= 0 && v['VALID DAYS.1'] >= 0).length;
        const oosCount = vehicleMasterData.length - activeCount;

        utilCtx._chart = new Chart(utilCtx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Expired/OOS'],
                datasets: [{
                    data: [activeCount, oosCount],
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
                const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || '';
                if (role.toLowerCase().includes('mechanic')) mCounts['Mechanics']++;
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
            const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || '';
            return !role.toLowerCase().includes('mechanic');
        });
    } else if (currentManpowerFilter === 'mechanic') {
        filteredData = driverMasterData.filter(d => {
            const role = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || '';
            return role.toLowerCase().includes('mechanic');
        });
    } else if (currentManpowerFilter === 'expiring') {
        filteredData = []; 
    }

    filteredData.forEach(d => {
        const name = getFlexVal(d, "Name") || getFlexVal(d, "Employee") || 'Unknown Name';
        const roleStr = getFlexVal(d, "Role") || getFlexVal(d, "Designation") || 'Staff';
        const isMechanic = roleStr.toLowerCase().includes('mechanic');
        const role = isMechanic ? 'Mechanic' : 'Driver';
        const empCode = getFlexVal(d, "Emp Code") || getFlexVal(d, "ID") || 'N/A';
        
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
