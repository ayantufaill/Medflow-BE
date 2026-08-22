import { reportGenerationService } from '../services/report-generation.service';
import { prisma } from '../config/db';

async function testReports() {
  console.log('====================================================');
  console.log('  TESTING MEDFLOW FINANCIAL REPORTS SERVICE LOGIC   ');
  console.log('====================================================\n');

  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Adjustment Report
    console.log('--- 1. Testing Adjustment Report ---');
    const adjReport = (await reportGenerationService.getFinancialReport('adjustment', { date: today, range: 'Daily' })) as any[];
    console.log(`[Adjustment Report] Rows returned: ${Array.isArray(adjReport) ? adjReport.length : 0}`);
    if (Array.isArray(adjReport) && adjReport.length > 0) {
      console.log('Sample record:', JSON.stringify(adjReport[0], null, 2));
    }
    console.log('');

    // 2. Courtesy Credit Report
    console.log('--- 2. Testing Courtesy Credit Report ---');
    const courtesyReport = (await reportGenerationService.getFinancialReport('courtesy-credit', { date: today, range: 'Daily' })) as any[];
    console.log(`[Courtesy Credit Report] Rows returned: ${Array.isArray(courtesyReport) ? courtesyReport.length : 0}`);
    if (Array.isArray(courtesyReport) && courtesyReport.length > 0) {
      console.log('Sample record:', JSON.stringify(courtesyReport[0], null, 2));
    }
    console.log('');

    // 3. Courtesy Credit Modifications Report
    console.log('--- 3. Testing Courtesy Credit Modifications Report ---');
    const courtesyModReport = (await reportGenerationService.getFinancialReport('courtesy-credit-modifications', { date: today, range: 'Daily' })) as any[];
    console.log(`[Courtesy Credit Mod Report] Rows returned: ${Array.isArray(courtesyModReport) ? courtesyModReport.length : 0}`);
    if (Array.isArray(courtesyModReport) && courtesyModReport.length > 0) {
      console.log('Sample record:', JSON.stringify(courtesyModReport[0], null, 2));
    }
    console.log('');

    // 4. Credit Accounts Report
    console.log('--- 4. Testing Credit Accounts Report ---');
    const creditAccountsReport = (await reportGenerationService.getFinancialReport('credit-accounts', { includeInactive: false })) as any[];
    console.log(`[Credit Accounts Report] Rows returned: ${Array.isArray(creditAccountsReport) ? creditAccountsReport.length : 0}`);
    if (Array.isArray(creditAccountsReport) && creditAccountsReport.length > 0) {
      console.log('Sample record:', JSON.stringify(creditAccountsReport[0], null, 2));
    }
    console.log('');

    // 5. Modifications (Audit) Report
    console.log('--- 5. Testing Modifications (Audit) Report ---');
    const modReport = (await reportGenerationService.getFinancialReport('modifications', { date: today, range: 'Daily' })) as any[];
    console.log(`[Modifications Report] Rows returned: ${Array.isArray(modReport) ? modReport.length : 0}`);
    if (Array.isArray(modReport) && modReport.length > 0) {
      console.log('Sample record:', JSON.stringify(modReport[0], null, 2));
    }
    console.log('');

    console.log('====================================================');
    console.log('  ALL 5 FINANCIAL REPORT TESTS EXECUTED SUCCESSFULLY ');
    console.log('====================================================');

  } catch (error) {
    console.error('Error testing financial reports:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReports();
