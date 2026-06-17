import fs from 'fs';

const tables = JSON.parse(fs.readFileSync('d:/Medflow/parsed_tables.json', 'utf8'));

tables.forEach((table, idx) => {
  const serialized = JSON.stringify(table);
  if (serialized.includes('Foundation') || serialized.includes('Foundation Restoration')) {
    console.log(`Table ${idx} contains "Foundation":`);
    console.log(JSON.stringify(table, null, 2));
  }
});
