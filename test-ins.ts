import { invoiceService } from './src/services/invoice.service';

async function run() {
  const patientId = 1n; // Andrew
  const items = [
    { code: 'D2140', charge: 85 },
    { code: 'D2160', charge: 145 }
  ];
  const res = await invoiceService.calculateInsuranceEstimates(patientId, items);
  console.log(res);
}
run();
