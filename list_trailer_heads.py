import json

with open('vehicle_master.json', 'r') as f:
    data = json.load(f)

category_to_find = 'Trailer Head'
matches = []
for vehicle in data.get('Sheet1', []):
    category = vehicle.get('Category ') or ''
    if category_to_find.lower() in category.lower():
        matches.append(vehicle['PLATE NO'])

print(f"Total Matches: {len(matches)}")
print(json.dumps(matches))
