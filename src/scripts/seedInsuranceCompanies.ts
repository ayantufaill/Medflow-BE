import dotenv from 'dotenv';
import connectDB from '../config/db';
import { InsuranceCompanyModel } from '../models/insurance-company.model';

dotenv.config();

const insuranceCompanies = [
  {
    name: 'Blue Cross Blue Shield',
    payerId: 'BCBS001',
    phone: '+1-800-262-2583',
    fax: '+1-800-262-2584',
    email: 'provider@bcbs.com',
    address: {
      line1: '225 North Michigan Avenue',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
    },
    website: 'https://www.bcbs.com',
    notes: 'One of the largest health insurance providers in the US',
    isActive: true,
  },
  {
    name: 'Aetna',
    payerId: 'AETNA001',
    phone: '+1-800-872-3862',
    fax: '+1-800-872-3863',
    email: 'provider@aetna.com',
    address: {
      line1: '151 Farmington Avenue',
      city: 'Hartford',
      state: 'CT',
      postalCode: '06156',
    },
    website: 'https://www.aetna.com',
    notes: 'Major health insurance company, part of CVS Health',
    isActive: true,
  },
  {
    name: 'UnitedHealthcare',
    payerId: 'UHC001',
    phone: '+1-800-328-5979',
    fax: '+1-800-328-5980',
    email: 'provider@uhc.com',
    address: {
      line1: '9900 Bren Road East',
      city: 'Minnetonka',
      state: 'MN',
      postalCode: '55343',
    },
    website: 'https://www.uhc.com',
    notes: 'Largest healthcare company in the US by revenue',
    isActive: true,
  },
  {
    name: 'Cigna',
    payerId: 'CIGNA001',
    phone: '+1-800-997-1654',
    fax: '+1-800-997-1655',
    email: 'provider@cigna.com',
    address: {
      line1: '900 Cottage Grove Road',
      city: 'Bloomfield',
      state: 'CT',
      postalCode: '06002',
    },
    website: 'https://www.cigna.com',
    notes: 'Global health services company',
    isActive: true,
  },
  {
    name: 'Humana',
    payerId: 'HUMANA001',
    phone: '+1-800-457-4708',
    fax: '+1-800-457-4709',
    email: 'provider@humana.com',
    address: {
      line1: '500 West Main Street',
      city: 'Louisville',
      state: 'KY',
      postalCode: '40202',
    },
    website: 'https://www.humana.com',
    notes: 'Major health insurance company focused on Medicare Advantage',
    isActive: true,
  },
  {
    name: 'Kaiser Permanente',
    payerId: 'KAISER001',
    phone: '+1-800-464-4000',
    fax: '+1-800-464-4001',
    email: 'provider@kaiserpermanente.org',
    address: {
      line1: 'One Kaiser Plaza',
      city: 'Oakland',
      state: 'CA',
      postalCode: '94612',
    },
    website: 'https://www.kaiserpermanente.org',
    notes: 'Integrated managed care consortium',
    isActive: true,
  },
  {
    name: 'Anthem',
    payerId: 'ANTHEM001',
    phone: '+1-800-331-1476',
    fax: '+1-800-331-1477',
    email: 'provider@anthem.com',
    address: {
      line1: '220 Virginia Avenue',
      city: 'Indianapolis',
      state: 'IN',
      postalCode: '46204',
    },
    website: 'https://www.anthem.com',
    notes: 'One of the largest for-profit managed health care companies',
    isActive: true,
  },
  {
    name: 'Molina Healthcare',
    payerId: 'MOLINA001',
    phone: '+1-888-562-5442',
    fax: '+1-888-562-5443',
    email: 'provider@molinahealthcare.com',
    address: {
      line1: '200 Oceangate',
      city: 'Long Beach',
      state: 'CA',
      postalCode: '90802',
    },
    website: 'https://www.molinahealthcare.com',
    notes: 'Specializes in government-sponsored healthcare programs',
    isActive: true,
  },
  {
    name: 'Centene Corporation',
    payerId: 'CENTENE001',
    phone: '+1-800-225-2573',
    fax: '+1-800-225-2574',
    email: 'provider@centene.com',
    address: {
      line1: '7700 Forsyth Boulevard',
      city: 'St. Louis',
      state: 'MO',
      postalCode: '63105',
    },
    website: 'https://www.centene.com',
    notes: 'Largest Medicaid managed care organization in the US',
    isActive: true,
  },
  {
    name: 'WellCare',
    payerId: 'WELLCARE001',
    phone: '+1-866-530-9491',
    fax: '+1-866-530-9492',
    email: 'provider@wellcare.com',
    address: {
      line1: '8735 Henderson Road',
      city: 'Tampa',
      state: 'FL',
      postalCode: '33634',
    },
    website: 'https://www.wellcare.com',
    notes: 'Focus on government-sponsored managed care services',
    isActive: true,
  },
  {
    name: 'Medicare',
    payerId: 'MEDICARE001',
    phone: '+1-800-633-4227',
    fax: '+1-800-633-4228',
    email: 'provider@medicare.gov',
    address: {
      line1: '7500 Security Boulevard',
      city: 'Baltimore',
      state: 'MD',
      postalCode: '21244',
    },
    website: 'https://www.medicare.gov',
    notes: 'Federal health insurance program for people 65+',
    isActive: true,
  },
  {
    name: 'Medicaid',
    payerId: 'MEDICAID001',
    phone: '+1-800-633-4227',
    fax: '+1-800-633-4228',
    email: 'provider@medicaid.gov',
    address: {
      line1: '7500 Security Boulevard',
      city: 'Baltimore',
      state: 'MD',
      postalCode: '21244',
    },
    website: 'https://www.medicaid.gov',
    notes: 'Joint federal and state program for low-income individuals',
    isActive: true,
  },
  {
    name: 'Tricare',
    payerId: 'TRICARE001',
    phone: '+1-800-874-2273',
    fax: '+1-800-874-2274',
    email: 'provider@tricare.mil',
    address: {
      line1: '7700 Arlington Boulevard',
      city: 'Falls Church',
      state: 'VA',
      postalCode: '22042',
    },
    website: 'https://www.tricare.mil',
    notes: 'Healthcare program for military personnel and their families',
    isActive: true,
  },
  {
    name: 'Health Net',
    payerId: 'HEALTHNET001',
    phone: '+1-800-522-0088',
    fax: '+1-800-522-0089',
    email: 'provider@healthnet.com',
    address: {
      line1: '21281 Burbank Boulevard',
      city: 'Woodland Hills',
      state: 'CA',
      postalCode: '91367',
    },
    website: 'https://www.healthnet.com',
    notes: 'Managed care organization in California',
    isActive: true,
  },
  {
    name: 'Oscar Health',
    payerId: 'OSCAR001',
    phone: '+1-855-672-2788',
    fax: '+1-855-672-2789',
    email: 'provider@hioscar.com',
    address: {
      line1: '75 Varick Street',
      city: 'New York',
      state: 'NY',
      postalCode: '10013',
    },
    website: 'https://www.hioscar.com',
    notes: 'Technology-focused health insurance company',
    isActive: true,
  },
];

async function seedInsuranceCompanies() {
  try {
    await connectDB();
    console.log('Connected to database');

    let created = 0;
    let skipped = 0;

    for (const company of insuranceCompanies) {
      const existing = await InsuranceCompanyModel.findOne({
        $or: [{ name: company.name }, { payerId: company.payerId }],
      });

      if (existing) {
        console.log(`Skipping "${company.name}" - already exists`);
        skipped++;
        continue;
      }

      await InsuranceCompanyModel.create(company);
      console.log(`Created insurance company: ${company.name}`);
      created++;
    }

    console.log('\n--- Seed Summary ---');
    console.log(`Created: ${created}`);
    console.log(`Skipped (already exist): ${skipped}`);
    console.log(`Total companies in database: ${await InsuranceCompanyModel.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding insurance companies:', error);
    process.exit(1);
  }
}

seedInsuranceCompanies();
