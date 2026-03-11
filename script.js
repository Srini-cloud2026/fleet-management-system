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

let currentUser = null;
let currentRole = null; // 'driver' or 'admin'

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

        if (VALID_DRIVERS[truckId] && VALID_DRIVERS[truckId].passcode === passcode && empId) {
            currentUser = {
                id: truckId,
                empId: empId,
                name: driverName || VALID_DRIVERS[truckId].name || 'Driver',
                ...VALID_DRIVERS[truckId]
            };
            if (driverName) currentUser.name = driverName; // override name if provided
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

    // Render dynamic trips
    renderStoredTrips();

    showSection('dashboard');
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

        // Log trip to local storage for Admin to see
        const newTrip = {
            id: 'TRP-' + Math.floor(2600 + Math.random() * 100),
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            vehicle: `Truck - ${currentUser.id}`,
            driver: currentUser.name,
            route: routeText,
            statusClass: 'in-transit',
            statusText: 'In Transit',
            revenue: '---'
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
        dashboard: 'Dashboard',
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
    if (sectionId === 'dashboard') initDashboardCharts();
    if (sectionId === 'costs') initCostCharts();
    if (sectionId === 'reports') initReportCharts();
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
function initDashboardCharts() {
    // Revenue vs Expenses
    const revCtx = document.getElementById('revenueChart');
    if (!revCtx) return;
    if (revCtx._chart) revCtx._chart.destroy();

    revCtx._chart = new Chart(revCtx, {
        type: 'bar',
        data: {
            labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [
                {
                    label: 'Revenue',
                    data: [1800000, 2100000, 1950000, 2300000, 2200000, 2400000],
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.6
                },
                {
                    label: 'Expenses',
                    data: [1100000, 1200000, 1150000, 1350000, 1250000, 1300000],
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
                        callback: v => 'AED ' + (v / 1000000).toFixed(1) + 'M'
                    }
                }
            }
        }
    });

    // Utilization Doughnut
    const utilCtx = document.getElementById('utilizationChart');
    if (!utilCtx) return;
    if (utilCtx._chart) utilCtx._chart.destroy();

    utilCtx._chart = new Chart(utilCtx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Maintenance', 'Out of Service', 'Idle'],
            datasets: [{
                data: [41, 3, 2, 2],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initDashboardCharts();

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
