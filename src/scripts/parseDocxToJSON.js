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

let currentCategory = null;
let currentChecklist = null;
const categoriesMap = new Map();

for (let i = 0; i < tables.length; i++) {
  const table = tables[i];
  if (table.length === 0) continue;

  // 1. Check if category header
  if (table.length === 1 && table[0].length === 1) {
    const text = table[0][0].replace(/<[^>]+>/g, '').trim();
    if (CATEGORIES.includes(text.toUpperCase())) {
      const catName = text.toUpperCase();
      if (!categoriesMap.has(catName)) {
        categoriesMap.set(catName, {
          name: catName,
          checklists: []
        });
      }
      currentCategory = categoriesMap.get(catName);
      currentChecklist = null;
      continue;
    }
  }

  // 2. Check if checklist header
  if (table.length === 1 && table[0].length === 2) {
    const cell1 = table[0][0].replace(/<[^>]+>/g, '').trim();
    const cell2 = table[0][1].replace(/<[^>]+>/g, '').trim();
    if (cell2.startsWith('Short Name:')) {
      const name = cell1;
      const shortName = cell2.replace('Short Name:', '').trim();
      
      currentChecklist = {
        name,
        shortName,
        isTreatment: currentCategory ? currentCategory.name !== 'HYGIENE' : true,
        isHygiene: currentCategory ? currentCategory.name === 'HYGIENE' : false,
        iconId: 'tooth-prep',
        items: []
      };

      if (currentCategory) {
        currentCategory.checklists.push(currentChecklist);
      } else {
        console.warn(`Warning: Checklist "${name}" found before any category!`);
      }
      continue;
    }
  }

  // 3. Check if items table
  if (table[0] && table[0].length === 4 && table[0][0].replace(/<[^>]+>/g, '').trim() === '#') {
    if (!currentChecklist) {
      console.warn(`Warning: Items table found at index ${i} but no active checklist!`);
      continue;
    }

    // Process rows (skip header row 0)
    for (let r = 1; r < table.length; r++) {
      const row = table[r];
      if (row.length < 4) continue;
      
      const itemNum = row[0].replace(/<[^>]+>/g, '').trim();
      const text = row[1].replace(/<[^>]+>/g, '').trim();
      
      // Choices (column 2)
      const rawChoices = row[2].replace(/<[^>]+>/g, '').trim();
      const choices = rawChoices
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0 && c !== '—' && c !== '-');

      // Products (column 3)
      const rawProducts = row[3].replace(/<[^>]+>/g, '').trim();
      const products = rawProducts
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0 && p !== '—' && p !== '-');

      if (text.length > 0) {
        currentChecklist.items.push({
          text,
          choices,
          products
        });
      }
    }
  }
}

// Convert map to array for JSON serialization
const output = Array.from(categoriesMap.values());
fs.writeFileSync('d:/Medflow/seeded_checklists.json', JSON.stringify(output, null, 2), 'utf8');
console.log('Successfully structured checklists data written to d:/Medflow/seeded_checklists.json');
