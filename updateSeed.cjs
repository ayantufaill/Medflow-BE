const fs = require('fs');

let content = fs.readFileSync('src/scripts/seedProcedureCodes.ts', 'utf8');

const preventive = ['D0120','D0140','D0145','D0150','D0160','D0170','D0180','D0210','D0220','D0230','D0240','D0250','D0270','D0272','D0273','D0274','D0277','D0330','D0340','D1110','D1120','D4346','D1206','D1208','D1351','D1352','D1510','D1516','D1520','D1526','D1550','D1555','D0601','D0602','D0603','D1310','D1320','D1330'];
const basic = ['D2140','D2150','D2160','D2161','D2330','D2331','D2332','D2335','D2391','D2392','D2393','D2394','D4341','D4342','D4355','D4910','D7140'];
const major = ['D2740','D2750','D2751','D2752','D2790','D2791','D2792','D2950','D3330','D7210','D6010','D6056','D6058','D6065','D6066','D5110','D5120','D5130','D5140','D5211','D5212','D5213','D5214','D5410','D5411','D5510','D5520'];
const ortho = ['D8010','D8070','D8080','D8090','D8660','D8670','D8680'];

const getCoverage = (code) => {
    if (preventive.includes(code)) return 'Preventive Services';
    if (basic.includes(code)) return 'Basic Services';
    if (major.includes(code)) return 'Major Services';
    if (ortho.includes(code)) return 'Orthodontic Services';
    return null;
}

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("{ code: 'D")) {
        const codeMatch = line.match(/code: '([^']+)'/);
        if (codeMatch) {
            const code = codeMatch[1];
            const coverage = getCoverage(code);
            if (coverage && !line.includes('coverage:')) {
                // Insert coverage before cat:
                lines[i] = line.replace(/cat:/, `coverage: '${coverage}', cat:`);
            }
        }
    }
}

content = lines.join('\n');

// Now update the create/update calls
if (!content.includes('CoverageCategory: proc.coverage')) {
    content = content.replace(
        /existing\.ProcCat !== catDefNum \|\|/,
        `existing.ProcCat !== catDefNum ||\n        existing.CoverageCategory !== (proc.coverage || null) ||`
    );
    content = content.replace(
        /ProcCat: catDefNum,/,
        `ProcCat: catDefNum,\n            CoverageCategory: proc.coverage || null,`
    );
}

fs.writeFileSync('src/scripts/seedProcedureCodes.ts', content);
console.log('Updated seedProcedureCodes.ts');
