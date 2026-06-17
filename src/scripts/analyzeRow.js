import fs from 'fs';

const xml = fs.readFileSync('d:/Medflow/extracted_docx/word/document.xml', 'utf8');

function getTags(str, tagName) {
  const openTag = `<w:${tagName}`;
  const closeTag = `</w:${tagName}>`;
  const result = [];
  let idx = 0;
  while (true) {
    const start = str.indexOf(openTag, idx);
    if (start === -1) break;
    const end = str.indexOf(closeTag, start);
    if (end === -1) break;
    result.push(str.substring(start, end + closeTag.length));
    idx = end + closeTag.length;
  }
  return result;
}

const tables = getTags(xml, 'tbl');
const table10 = tables[10];
const rows = getTags(table10, 'tr');
const row1 = rows[1];
const cells = getTags(row1, 'tc');

console.log(`Row 1 has ${cells.length} cells`);
cells.forEach((cell, i) => {
  console.log(`--- CELL ${i} ---`);
  console.log(cell);
});
