import dotenv from 'dotenv';
import connectDB from '../config/db';
import { AppointmentTypeModel } from '../models/appointment-type.model';

dotenv.config();

// Professional medical appointment types for healthcare practice
const defaultAppointmentTypes = [
  {
    name: 'Initial Consultation',
    description: 'First-time patient visit for comprehensive evaluation and assessment',
    defaultDuration: 60,
    defaultPrice: 200,
    colorCode: '#2196F3', // Blue
    requiresAuthorization: false,
    bufferBefore: 5,
    bufferAfter: 10,
    isActive: true,
  },
  {
    name: 'Follow-up Visit',
    description: 'Routine follow-up appointment for ongoing care and treatment monitoring',
    defaultDuration: 30,
    defaultPrice: 150,
    colorCode: '#4CAF50', // Green
    requiresAuthorization: false,
    bufferBefore: 5,
    bufferAfter: 5,
    isActive: true,
  },
  {
    name: 'Annual Physical Exam',
    description: 'Comprehensive annual health checkup and preventive care screening',
    defaultDuration: 45,
    defaultPrice: 250,
    colorCode: '#9C27B0', // Purple
    requiresAuthorization: false,
    bufferBefore: 5,
    bufferAfter: 10,
    isActive: true,
  },
  {
    name: 'Urgent Care',
    description: 'Same-day appointment for acute medical conditions requiring immediate attention',
    defaultDuration: 20,
    defaultPrice: 175,
    colorCode: '#F44336', // Red
    requiresAuthorization: false,
    bufferBefore: 0,
    bufferAfter: 5,
    isActive: true,
  },
  {
    name: 'Telehealth Consultation',
    description: 'Remote video consultation for patients unable to visit in person',
    defaultDuration: 30,
    defaultPrice: 150,
    colorCode: '#00BCD4', // Cyan
    requiresAuthorization: false,
    bufferBefore: 5,
    bufferAfter: 5,
    isActive: true,
  },
  {
    name: 'Procedure',
    description: 'Medical procedure or minor surgery requiring specialized equipment',
    defaultDuration: 60,
    defaultPrice: 500,
    colorCode: '#FF9800', // Orange
    requiresAuthorization: true,
    bufferBefore: 10,
    bufferAfter: 15,
    isActive: true,
  },
  {
    name: 'Lab Review',
    description: 'Review and discussion of laboratory test results with patient',
    defaultDuration: 15,
    defaultPrice: 100,
    colorCode: '#795548', // Brown
    requiresAuthorization: false,
    bufferBefore: 5,
    bufferAfter: 5,
    isActive: true,
  },
  {
    name: 'Vaccination',
    description: 'Immunization and vaccination administration appointment',
    defaultDuration: 15,
    defaultPrice: 75,
    colorCode: '#607D8B', // Blue Grey
    requiresAuthorization: false,
    bufferBefore: 5,
    bufferAfter: 5,
    isActive: true,
  },
  {
    name: 'Mental Health Counseling',
    description: 'Therapy session for mental health and behavioral health support',
    defaultDuration: 50,
    defaultPrice: 180,
    colorCode: '#E91E63', // Pink
    requiresAuthorization: true,
    bufferBefore: 5,
    bufferAfter: 10,
    isActive: true,
  },
  {
    name: 'Chronic Disease Management',
    description: 'Specialized appointment for managing chronic conditions like diabetes, hypertension',
    defaultDuration: 40,
    defaultPrice: 200,
    colorCode: '#3F51B5', // Indigo
    requiresAuthorization: false,
    bufferBefore: 5,
    bufferAfter: 10,
    isActive: true,
  },
];

const seedAppointmentTypes = async () => {
  try {
    await connectDB();

    for (const appointmentTypeData of defaultAppointmentTypes) {
      const existingType = await AppointmentTypeModel.findOne({ name: appointmentTypeData.name });

      if (existingType) {
        console.log(`Appointment Type "${appointmentTypeData.name}" already exists, skipping...`);
        continue;
      }

      await AppointmentTypeModel.create(appointmentTypeData);
      console.log(`✓ Created appointment type: ${appointmentTypeData.name}`);
    }

    console.log('\n✅ Appointment types seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding appointment types:', error);
    process.exit(1);
  }
};

seedAppointmentTypes();
