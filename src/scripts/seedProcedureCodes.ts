import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import {
  CDT_2026_CATEGORIES,
  CDT_2026_PROCEDURES,
} from '../data/cdt2026-data';
import type { TreatmentArea } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Ensure a `definition` row exists for a given ADA category name (Category=1).
 *  Returns the DefNum of the found or newly created row. */
async function ensureCategoryDef(
  categoryName: string,
  itemOrder: number,
  defNumCache: Map<string, bigint>
): Promise<bigint> {
  if (defNumCache.has(categoryName)) return defNumCache.get(categoryName)!;

  const existing = await prisma.definition.findFirst({
    where: { Category: 1, ItemName: categoryName },
  });

  if (existing) {
    defNumCache.set(categoryName, existing.DefNum);
    return existing.DefNum;
  }

  const defNum = await getNextId('definition', 'DefNum');
  await prisma.definition.create({
    data: {
      DefNum: defNum,
      Category: 1,
      ItemOrder: itemOrder,
      ItemName: categoryName,
      ItemValue: '',
      ItemColor: 0,
      IsHidden: 0,
    },
  });

  console.log(`  ✔ Created category definition: "${categoryName}" (DefNum=${defNum})`);
  defNumCache.set(categoryName, defNum);
  return defNum;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Seeder
// ─────────────────────────────────────────────────────────────────────────────

async function seedProcedureCodes() {
  console.log('='.repeat(70));
  console.log('Seeding ADA CDT 2026 procedure code categories & procedures...');
  console.log('='.repeat(70));

  // 1. Ensure ALL 12 official ADA categories exist in definition table (Category=1)
  const defNumCache = new Map<string, bigint>();
  console.log(`\nStep 1: Ensuring all ${CDT_2026_CATEGORIES.length} ADA categories exist in definition table...`);
  for (const cat of CDT_2026_CATEGORIES) {
    await ensureCategoryDef(cat.name, cat.itemOrder, defNumCache);
  }

  // 2. Seed / update procedure codes
  console.log(`\nStep 2: Processing ${CDT_2026_PROCEDURES.length} CDT procedure codes...`);
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const proc of CDT_2026_PROCEDURES) {
    const catDefNum = defNumCache.get(proc.cat);
    if (!catDefNum) {
      console.warn(`  ⚠ Unknown category "${proc.cat}" for code ${proc.code} — skipping`);
      continue;
    }

    const treatArea = (proc.treatArea || 'MOUTH') as TreatmentArea;
    const reqs = {
      RequiresXRay: Boolean(proc.requiresXRay),
      RequiresNarrative: Boolean(proc.requiresNarrative),
      RequiresPerioChart: Boolean(proc.requiresPerioChart),
      RequiresConsent: Boolean(proc.requiresConsent),
      RequiresMedicalNecessity: Boolean(proc.requiresMedicalNecessity),
      RequiresToothImage: Boolean(proc.requiresToothImage),
    };

    const existing = await prisma.procedurecode.findFirst({
      where: { ProcCode: proc.code },
    });

    if (existing) {
      // Check if any field needs updating
      const needsUpdate =
        existing.ProcCat !== catDefNum ||
        existing.Descript !== proc.desc ||
        existing.AbbrDesc !== (proc.abbr || proc.desc.slice(0, 50)) ||
        existing.TreatArea !== treatArea ||
        existing.CoverageCategory !== (proc.coverage || null) ||
        existing.RequiresXRay !== reqs.RequiresXRay ||
        existing.RequiresNarrative !== reqs.RequiresNarrative ||
        existing.RequiresPerioChart !== reqs.RequiresPerioChart ||
        existing.RequiresConsent !== reqs.RequiresConsent ||
        existing.RequiresMedicalNecessity !== reqs.RequiresMedicalNecessity ||
        existing.RequiresToothImage !== reqs.RequiresToothImage;

      if (needsUpdate) {
        await prisma.procedurecode.update({
          where: { ProcCode: proc.code },
          data: {
            Descript: proc.desc,
            AbbrDesc: proc.abbr || proc.desc.slice(0, 50),
            ProcCat: catDefNum,
            TreatArea: treatArea,
            CoverageCategory: proc.coverage || null,
            LaymanTerm: proc.desc,
            ...reqs,
          },
        });
        updated++;
      } else {
        unchanged++;
      }
      continue;
    }

    const codeNum = await getNextId('procedurecode', 'CodeNum');
    await prisma.procedurecode.create({
      data: {
        CodeNum: codeNum,
        ProcCode: proc.code,
        Descript: proc.desc,
        AbbrDesc: proc.abbr || proc.desc.slice(0, 50),
        ProcCat: catDefNum,
        ProcTime: '0',
        TreatArea: treatArea,
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
        IsRadiology: proc.requiresXRay ? 1 : 0,
        BypassGlobalLock: 0,
        AreaAlsoToothRange: 0,
        LaymanTerm: proc.desc,
        CoverageCategory: proc.coverage || null,
        ...reqs,
      },
    });
    created++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(
    `Seeding Complete! Created: ${created} | Updated: ${updated} | Unchanged: ${unchanged} | Total: ${CDT_2026_PROCEDURES.length}`
  );
  console.log('='.repeat(70));
}

seedProcedureCodes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding procedure codes:', err);
    process.exit(1);
  });