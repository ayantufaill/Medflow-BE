import fs from 'fs';
const content = fs.readFileSync('d:\\Medflow\\medflow-BE\\src\\services\\appointment.service.ts', 'utf8');
const lines = content.split('\n');
const matching = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('prisma.appointment.create') || lines[i].includes('prisma.appointment.update')) {
    matching.push(`${i+1}: ${lines[i]}`);
  }
}
console.log(matching.join('\n'));
