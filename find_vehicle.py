import json

with open('vehicle_master.json', 'r') as f:
    data = json.load(f)

sno_to_find = 59
matches = []
for vehicle in data.get('Sheet1', []):
    sno = vehicle.get('S.NO') or vehicle.get('S no') or vehicle.get('S. NO')
    category = vehicle.get('Category ') or ''
    if str(sno) == '59' and 'Trailer Head' in category:
        matches.append(vehicle)

print(json.dumps(matches, indent=2))
