const fs = require('fs');
const path = require('path');

const mdPath = 'c:\\Users\\saadj\\.gemini\\antigravity-ide\\brain\\78543b34-9bf3-45f6-94c5-5feab97b17af\\clinical_management_data.md';
const mdContent = fs.readFileSync(mdPath, 'utf8');

const lines = mdContent.split('\n');

const data = { categories: [] };
let currentCategory = null;
let currentSubCategory = null;

let tableHeaders = [];
let parsingTable = false;

for (const line of lines) {
  const trimmed = line.trim();

  if (trimmed.startsWith('## Category') || trimmed.startsWith('### Category') || trimmed.match(/^## \d+\. /)) {
      if (trimmed.includes('Products Data Dictionary') || trimmed.includes('Category 1: Adjunctive Therapy') || trimmed.includes('Products:')) {
          currentCategory = { name: 'Products', subCategories: [] };
          data.categories.push(currentCategory);
      } else if (trimmed.includes('Category 2: Progress Notes')) {
          currentCategory = { name: 'Progress Notes', subCategories: [] };
          data.categories.push(currentCategory);
      }
      currentSubCategory = null;
      parsingTable = false;
  } else if (trimmed.startsWith('#### Sub-category')) {
      const name = trimmed.split(': ')[1];
      if (currentCategory && name) {
          currentSubCategory = { name: name.trim(), items: [] };
          currentCategory.subCategories.push(currentSubCategory);
      }
      parsingTable = false;
  } else if (trimmed.startsWith('| Choice Name')) {
      parsingTable = true;
      tableHeaders = trimmed.split('|').map(h => h.trim()).filter(h => h);
  } else if (trimmed.startsWith('| :---') && parsingTable) {
      continue;
  } else if (trimmed.startsWith('|') && parsingTable) {
      const row = trimmed.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (row.length === 0) continue;

      const item = {};
      for (let i = 0; i < tableHeaders.length; i++) {
          const header = tableHeaders[i];
          let val = row[i] || '';

          if (header === 'Choice Name') {
              item.choiceName = val;
          } else if (header === 'Is Default') {
              item.isDefault = val.includes('✅');
          } else if (header === 'Instructions') {
              item.instructions = val || null;
          } else if (header === 'Price') {
              item.price = parseFloat(val.replace('$', '')) || 0;
          } else if (header === 'Code') {
              item.code = val || null;
          } else if (header === 'Quick List') {
              item.isQuickList = val.includes('✅');
          } else if (header === 'Is Recommended') {
              item.isRecommended = val.includes('✅');
          }
      }
      if (item.choiceName && currentSubCategory) {
          currentSubCategory.items.push(item);
      }
  } else if (trimmed === '') {
      parsingTable = false;
  }
}

fs.writeFileSync(path.join(__dirname, 'clinicalData.json'), JSON.stringify(data, null, 2));
console.log('Successfully parsed markdown to clinicalData.json');
