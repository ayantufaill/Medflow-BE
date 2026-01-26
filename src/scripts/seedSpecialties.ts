import dotenv from 'dotenv';
import connectDB from '../config/db';
import { SpecialtyModel } from '../models/specialty.model';

dotenv.config();

const defaultSpecialties = [
  { name: 'Family Medicine', description: 'Primary care for patients of all ages' },
  { name: 'Internal Medicine', description: 'Adult primary care and complex medical conditions' },
  { name: 'Pediatrics', description: 'Medical care for infants, children, and adolescents' },
  { name: 'Cardiology', description: 'Heart and cardiovascular system disorders' },
  { name: 'Dermatology', description: 'Skin, hair, and nail conditions' },
  { name: 'Neurology', description: 'Brain, spinal cord, and nervous system disorders' },
  { name: 'Orthopedics', description: 'Musculoskeletal system including bones, joints, and muscles' },
  { name: 'Psychiatry', description: 'Mental health and behavioral disorders' },
  { name: 'Radiology', description: 'Medical imaging and diagnostic procedures' },
  { name: 'Oncology', description: 'Cancer diagnosis and treatment' },
  { name: 'Gynecology', description: 'Female reproductive system health' },
  { name: 'Ophthalmology', description: 'Eye and vision care' },
  { name: 'ENT', description: 'Ear, nose, and throat conditions' },
  { name: 'Gastroenterology', description: 'Digestive system disorders' },
  { name: 'Endocrinology', description: 'Hormonal and metabolic disorders' },
  { name: 'Nephrology', description: 'Kidney diseases and disorders' },
  { name: 'Pulmonology', description: 'Respiratory system and lung diseases' },
  { name: 'Rheumatology', description: 'Autoimmune and inflammatory conditions' },
  { name: 'Urology', description: 'Urinary tract and male reproductive system' },
  { name: 'Emergency Medicine', description: 'Acute illness and injury care' },
];

const seedSpecialties = async () => {
  try {
    await connectDB();

    for (const specialtyData of defaultSpecialties) {
      const existingSpecialty = await SpecialtyModel.findOne({ name: specialtyData.name });

      if (existingSpecialty) {
        console.log(`Specialty "${specialtyData.name}" already exists, skipping...`);
        continue;
      }

      await SpecialtyModel.create({
        ...specialtyData,
        isActive: true,
      });
      console.log(`✓ Created specialty: ${specialtyData.name}`);
    }

    console.log('\n✅ Specialties seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding specialties:', error);
    process.exit(1);
  }
};

seedSpecialties();
