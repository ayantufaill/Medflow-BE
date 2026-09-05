import { prisma } from '../config/db';

async function verifyProcedureCodes() {
  console.log('='.repeat(70));
  console.log('🔍 Medflow: Procedure Codes & Pricing Verification Report');
  console.log('='.repeat(70));

  try {
    // 1. Total Count
    const totalCount = await prisma.procedurecode.count();
    console.log(`\n📊 Total Procedure Codes in DB: ${totalCount}`);

    // 2. Breakdown by Category (Definition Category = 1)
    const categories = await prisma.definition.findMany({
      where: { Category: 1 },
      orderBy: { ItemOrder: 'asc' },
    });

    console.log('\n📁 Category Breakdown:');
    console.log('-'.repeat(70));
    console.log(
      'Category Name'.padEnd(35) +
      'DefNum'.padEnd(10) +
      'Code Count'
    );
    console.log('-'.repeat(70));

    let sumCategorized = 0;
    for (const cat of categories) {
      const count = await prisma.procedurecode.count({
        where: { ProcCat: cat.DefNum },
      });
      sumCategorized += count;
      console.log(
        (cat.ItemName || 'Unnamed').padEnd(35) +
        String(cat.DefNum).padEnd(10) +
        count
      );
    }
    console.log('-'.repeat(70));
    console.log(`Sum across categories: ${sumCategorized}`);

    // 3. Fee & Pricing Statistics
    const defaultSched = await prisma.feesched.findFirst({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });

    if (defaultSched) {
      const fees = await prisma.fee.findMany({
        where: { FeeSched: defaultSched.FeeSchedNum },
      });

      const validFees = fees.map((f) => f.Amount ?? 0).filter((a) => a > 0);
      const minFee = validFees.length ? Math.min(...validFees) : 0;
      const maxFee = validFees.length ? Math.max(...validFees) : 0;
      const avgFee = validFees.length
        ? (validFees.reduce((a, b) => a + b, 0) / validFees.length).toFixed(2)
        : '0';

      console.log(`\n💰 Pricing Summary (Schedule: "${defaultSched.Description}"):`);
      console.log(`   - Total Fee Entries: ${fees.length}`);
      console.log(`   - Priced Procedures: ${validFees.length}`);
      console.log(`   - Price Range: $${minFee.toFixed(2)} – $${maxFee.toFixed(2)}`);
      console.log(`   - Average Price: $${avgFee}`);
    }

    // 4. Clinical Requirements Flag Summary
    const withXRay = await prisma.procedurecode.count({ where: { RequiresXRay: true } });
    const withNarrative = await prisma.procedurecode.count({ where: { RequiresNarrative: true } });
    const withPerio = await prisma.procedurecode.count({ where: { RequiresPerioChart: true } });
    const withToothImage = await prisma.procedurecode.count({ where: { RequiresToothImage: true } });

    console.log('\n📋 Clinical Requirements Flags:');
    console.log(`   - Requires X-Ray: ${withXRay}`);
    console.log(`   - Requires Narrative: ${withNarrative}`);
    console.log(`   - Requires Periodontal Chart: ${withPerio}`);
    console.log(`   - Requires Tooth Image: ${withToothImage}`);

    // 5. Sample Codes
    const sample = await prisma.procedurecode.findMany({
      take: 5,
      orderBy: { ProcCode: 'asc' },
      select: { ProcCode: true, Descript: true, TreatArea: true, CoverageCategory: true },
    });

    console.log('\n✨ Sample Seeded Procedures:');
    for (const p of sample) {
      console.log(`   - [${p.ProcCode}] ${p.Descript} (${p.TreatArea}, ${p.CoverageCategory || 'N/A'})`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Verification Completed Successfully!');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('❌ Verification error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProcedureCodes();
