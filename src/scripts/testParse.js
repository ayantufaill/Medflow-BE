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

function extractText(str) {
  const regex = /<w:t[^>]*>(.*?)<\/w:t>/g;
  let match;
  let text = '';
  while ((match = regex.exec(str)) !== null) {
    text += match[1];
  }
  return text.trim();
}

function extractCellTexts(rowXml) {
  const cells = getTags(rowXml, 'tc');
  return cells.map(cell => {
    // We want to preserve newlines for choices/products if they are in different paragraphs
    // A cell has multiple paragraphs <w:p>
    const paragraphs = getTags(cell, 'p');
    if (paragraphs.length <= 1) {
      return extractText(cell);
    }
    return paragraphs.map(p => extractText(p)).filter(t => t.length > 0).join('\n');
  });
}

const tables = getTags(xml, 'tbl');
console.log(`Found ${tables.length} tables`);

// Let's write the structures of the first few tables to a JSON file
const parsedTables = [];
for (const table of tables) {
  const rows = getTags(table, 'tr');
  const rowData = rows.map(row => extractCellTexts(row));
  parsedTables.push(rowData);
}

fs.writeFileSync('d:/Medflow/parsed_tables.json', JSON.stringify(parsedTables, null, 2), 'utf8');
console.log('Tables parsed and saved to d:/Medflow/parsed_tables.json');
