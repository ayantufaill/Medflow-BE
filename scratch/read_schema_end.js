import fs from 'fs';
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');
console.log(content.substring(content.length - 1500));
