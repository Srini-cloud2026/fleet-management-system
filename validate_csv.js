const fs = require('fs');

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

console.log('--- VEHICLE MASTER CHECK ---');
const vRows = parseCSV('Vechile Master.csv');
console.log('Header:', vRows[0]);
console.log('Total vehicle data rows:', vRows.length - 1);

const vBad = vRows.filter((r, idx) => r.length !== vRows[0].length);
console.log('Vehicle rows with column count mismatch:', vBad.length);

const vPlates = vRows.slice(1).map(r => r[1]);
const vPlatesSet = new Set(vPlates);
console.log('Total plates:', vPlates.length, 'Unique plates:', vPlatesSet.size);

const plateCounts = {};
vPlates.forEach(p => plateCounts[p] = (plateCounts[p] || 0) + 1);
const vDups = Object.entries(plateCounts).filter(([p, c]) => c > 1);
if (vDups.length > 0) console.log('Duplicate plates:', vDups);

console.log('\n--- DRIVERS MASTER CHECK ---');
const dRows = parseCSV('Drivers Master.csv');
console.log('Header:', dRows[0]);
console.log('Total driver data rows:', dRows.length - 1);

const dCodes = dRows.slice(1).map(r => r[1]);
const dCodesSet = new Set(dCodes);
console.log('Total driver codes:', dCodes.length, 'Unique driver codes:', dCodesSet.size);

const codeCounts = {};
dCodes.forEach(c => codeCounts[c] = (codeCounts[c] || 0) + 1);
const dDups = Object.entries(codeCounts).filter(([p, c]) => c > 1);
if (dDups.length > 0) console.log('Duplicate driver codes:', dDups);
