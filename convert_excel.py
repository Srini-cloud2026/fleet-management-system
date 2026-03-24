import pandas as pd
import json

def default(obj):
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

try:
    xlsx = pd.ExcelFile('Vechile Master.xlsx')
    all_data = {}
    
    for sheet_name in xlsx.sheet_names:
        df = pd.read_excel(xlsx, sheet_name=sheet_name)
        # Convert to list of dicts
        all_data[sheet_name] = df.to_dict(orient='records')
        print(f"Extracted {len(all_data[sheet_name])} records from sheet: {sheet_name}")

    # Output as JSON to a file
    with open('vehicle_master.json', 'w') as f:
        json.dump(all_data, f, indent=4, default=default)
    print("Successfully converted Vechile Master.xlsx to vehicle_master.json (multi-sheet)")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Error: {e}")
