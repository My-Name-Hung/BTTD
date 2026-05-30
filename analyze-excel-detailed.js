const XLSX = require('xlsx');
const wb = XLSX.readFile('c:\\Users\\.Freelancer\\BTTD\\Copy of 0. 131.xlsx');
console.log('=== WORKBOOK INFO ===');
console.log('Sheets:', wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];

console.log('\n=== SHEET RANGE & MERGES ===');
console.log('Range:', ws['!ref']);
console.log('Merges:', JSON.stringify(ws['!merges'] || []));

console.log('\n=== RAW CELL OBJECTS (showing ALL cells) ===');
const keys = Object.keys(ws).filter(k => k.startsWith('!') === false);
keys.forEach(cellRef => {
  console.log(cellRef + ':', JSON.stringify(ws[cellRef]));
});

console.log('\n=== ROW-BY-ROW ANALYSIS (First 20 rows) ===');
for (let r = 1; r <= 20; r++) {
  const rowCells = keys.filter(k => {
    const decoded = XLSX.utils.decode_cell(k);
    return decoded.r === r - 1; // 0-indexed
  });
  if (rowCells.length > 0) {
    console.log(`\n--- Row ${r} ---`);
    rowCells.forEach(cellRef => {
      const cell = ws[cellRef];
      console.log(`  ${cellRef}: {v:${JSON.stringify(cell.v)}, t:${cell.t}, w:${JSON.stringify(cell.w)}}`);
    });
  }
}
