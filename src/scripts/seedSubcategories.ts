import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const subcategoryMapping: { [code: string]: string } = {
  // Restorative -> Direct
  'D2330': 'Direct',
  'D2331': 'Direct',
  'D2332': 'Direct',
  'D2335': 'Direct',
  'D2391': 'Direct',
  'D2392': 'Direct',
  'D2393': 'Direct',
  'D2394': 'Direct',

  // Restorative -> Indirect
  'D2740': 'Indirect',
  'D2750': 'Indirect',
  'D2751': 'Indirect',
  'D2752': 'Indirect',
  'D2790': 'Indirect',
  'D2791': 'Indirect',
  'D2792': 'Indirect',

  // Restorative -> Recement/Repair
  'D2910': 'Recement/Repair',
  'D2915': 'Recement/Repair',
  'D2920': 'Recement/Repair',
  'D2980': 'Recement/Repair',

  // Restorative -> BU/P&C
  'D2950': 'BU/P&C',
  'D2954': 'BU/P&C',

  // Prosthodontics, Removable -> Complete Denture
  'D5110': 'Complete Denture',
  'D5120': 'Complete Denture',
  'D5130': 'Complete Denture',
  'D5140': 'Complete Denture',

  // Prosthodontics, Removable -> RPD
  'D5211': 'RPD',
  'D5212': 'RPD',
  'D5213': 'RPD',
  'D5214': 'RPD',

  // Prosthodontics, Removable -> Denture adjustment
  'D5410': 'Denture adjustment',
  'D5411': 'Denture adjustment',

  // Prosthodontics, Removable -> Denture repair
  'D5520': 'Denture repair',

  // Endodontics -> Pulp capping
  'D3110': 'Pulp capping',
  'D3120': 'Pulp capping',

  // Endodontics -> Pulpotomy
  'D3220': 'Pulpotomy',

  // Endodontics -> Root Canal
  'D3310': 'Root Canal',
  'D3320': 'Root Canal',
  'D3330': 'Root Canal',

  // Implant Services -> Surgical Placement
  'D6010': 'Surgical Placement',

  // Implant Services -> Abutment
  'D6056': 'Abutment',

  // Implant Services -> Implant-Restorative
  'D6058': 'Implant-Restorative',
  'D6065': 'Implant-Restorative',
  'D6066': 'Implant-Restorative',

  // Prosthodontics, Fixed -> Inlay/Onlay FPD
  'D6245': 'Inlay/Onlay FPD',

  // Prosthodontics, Fixed -> Fixed Bridge
  'D6740': 'Fixed Bridge',
};

const missingCodesData: { [code: string]: { desc: string; abbr: string } } = {
  'D6245': { desc: 'Pontic - porcelain fused to noble metal', abbr: 'Pontic PFM noble' },
  'D6740': { desc: 'Crown - porcelain/ceramic retainer', abbr: 'Crown ceramic retainer' },
};

async function seedSubcategories() {
  console.log('Seeding subcategories...');

  // Get unique subcategory names
  const subcategoryNames = Array.from(new Set(Object.values(subcategoryMapping)));

  const subcategoryDefs: { [name: string]: bigint } = {};

  for (const name of subcategoryNames) {
    // Check if definition already exists
    let existing = await prisma.definition.findFirst({
      where: { Category: 1, ItemName: name },
    });

    if (existing) {
      subcategoryDefs[name] = existing.DefNum;
      console.log(`Subcategory definition for "${name}" already exists with DefNum: ${existing.DefNum}`);
    } else {
      const defNum = await getNextId('definition', 'DefNum');
      await prisma.definition.create({
        data: {
          DefNum: defNum,
          Category: 1,
          ItemOrder: 0,
          ItemName: name,
          ItemValue: '',
          ItemColor: 0,
          IsHidden: 0,
        },
      });
      subcategoryDefs[name] = defNum;
      console.log(`Created subcategory definition for "${name}" with DefNum: ${defNum}`);
    }
  }

  // Update procedure codes to point to these new categories
  let updatedCount = 0;
  for (const [code, subcatName] of Object.entries(subcategoryMapping)) {
    const defNum = subcategoryDefs[subcatName];
    if (!defNum) continue;

    let procCode = await prisma.procedurecode.findFirst({
      where: { ProcCode: code },
    });

    if (!procCode && missingCodesData[code]) {
      const codeNum = await getNextId('procedurecode', 'CodeNum');
      procCode = await prisma.procedurecode.create({
        data: {
          CodeNum: codeNum,
          ProcCode: code,
          Descript: missingCodesData[code].desc,
          AbbrDesc: missingCodesData[code].abbr,
          ProcCat: defNum,
          ProcTime: '0',
          TreatArea: 'MOUTH',
          NoBillIns: 0,
          IsProsth: 0,
          IsHygiene: false,
          IsTaxed: 0,
          PaintType: 0,
          IsCanadianLab: 0,
          PreExisting: 0,
          BaseUnits: 0,
          SubstOnlyIf: 0,
          IsMultiVisit: 0,
          CanadaTimeUnits: 0,
          IsRadiology: 0,
          BypassGlobalLock: 0,
          AreaAlsoToothRange: 0,
          LaymanTerm: missingCodesData[code].desc,
        },
      });
      console.log(`Created missing procedure code ${code} and linked to category "${subcatName}"`);
      updatedCount++;
    } else if (procCode) {
      await prisma.procedurecode.update({
        where: { CodeNum: procCode.CodeNum! },
        data: { ProcCat: defNum },
      });
      console.log(`Updated procedure code ${code} to category "${subcatName}" (DefNum: ${defNum})`);
      updatedCount++;
    } else {
      console.log(`Procedure code ${code} not found and no mock data available.`);
    }
  }

  console.log(`Finished seeding subcategories. Updated/Created ${updatedCount} procedure codes.`);
}

seedSubcategories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding subcategories:', err);
    process.exit(1);
  });
