# PROJECT ROADMAP: Trip Tracking & Logistics

## 1. Objectives
- Track multiple trips per day (e.g., Trip 1: AD -> Dubai, Trip 2: AD -> Sharjah).
- Automate Financials (Fixed Rental & Driver Tips).
- Monitor Performance (Run KMs, Trip Duration, Idle Time).
- Plan Availability (Trucks currently at Plant).

## 2. Technical Requirements
- **Route Master**: A database/JSON file mapping locations to fixed rates.
- **GPS API**: Integration with existing truck GPS for real-time odometer/location.
- **Persistent Storage**: Transition from `localStorage` to a real DB (PostgreSQL) for long-term history.

## 3. Implementation Steps

### Step 1: Finance Automation
- Create the Route Lookup table.
- Link "Driver Tips" and "Truck Rental" to the trip start action.

### Step 2: Logistics UI
- Add "Current Status" to all vehicles (At Plant, Loading, In Transit).
- Create a "Plant Availability" grid for dispatch planning.

### Step 3: Performance Reports
- Calculate "Idle Time" = Time spent at Plant between trips.
- Calculate "Run KMs" = End Odometer - Start Odometer.

### Step 4: GPS Feed
- Connect real-time coordinate data to the "In Transit" status.
