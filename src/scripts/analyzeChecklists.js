import fs from 'fs';

const tables = JSON.parse(fs.readFileSync('d:/Medflow/parsed_tables.json', 'utf8'));

const CATEGORIES = [
  'ANESTHETIC',
  'ENDODONTICS',
  'RESTORATIVE',
  'RESTORATIVE-COHESIVE',
  'RESTORATIVE-ADHESIVE',
  'PREVENTATIVE',
  'HYGIENE',
  'DIAGNOSTIC',
  'OCCLUSION',
  'PROSTHODONTICS',
  'PERIODONTICS',
  'ORAL SURGERY',
  'ORTHODONTIC'
];

let currentCategory = '';
const structuredData = [];

for (let i = 0; i < tables.length; i++) {
  const table = tables[i];
  if (table.length === 0) continue;

  // Check if it's a category header
  if (table.length === 1 && table[0].length === 1) {
    const text = table[0][0].trim();
    const cleanText = text.replace(/<[^>]+>/g, '').trim(); // strip any XML leftovers if any
    if (CATEGORIES.includes(cleanText.toUpperCase())) {
      currentCategory = cleanText.toUpperCase();
      console.log(`Table ${i}: CATEGORY -> ${currentCategory}`);
      continue;
    }
  }

  // Check if it's a checklist header
  if (table.length === 1 && table[0].length === 2) {
    const cell1 = table[0][0].replace(/<[^>]+>/g, '').trim();
    const cell2 = table[0][1].replace(/<[^>]+>/g, '').trim();
    if (cell1.startsWith('Anesthetic:') || cell1.includes(':') || cell2.startsWith('Short Name:')) {
      // It's a checklist header
      let name = cell1;
      let shortName = cell2.replace('Short Name:', '').trim();
      // Sometimes the name might contain category prefix, e.g., "Anesthetic: IA Block"
      // Let's clean it up or keep it as is
      console.log(`  Table ${i}: CHECKLIST -> Name: "${name}", ShortName: "${shortName}" (Category: ${currentCategory})`);
      continue;
    }
  }

  // Check if it's an item table
  if (table[0] && table[0].length === 4 && table[0][0].replace(/<[^>]+>/g, '').trim() === '#') {
    console.log(`    Table ${i}: ITEMS table with ${table.length - 1} items`);
  }
}
