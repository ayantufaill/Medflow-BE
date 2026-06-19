import fs from 'fs';

const tables = JSON.parse(fs.readFileSync('d:/Medflow/parsed_tables.json', 'utf8'));

console.log('Table 29:', JSON.stringify(tables[29]));
console.log('Table 30:', JSON.stringify(tables[30]));
console.log('Table 31:', JSON.stringify(tables[31]));
