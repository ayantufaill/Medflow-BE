import dotenv from 'dotenv';
import connectDB from '../config/db';
import { ServiceModel } from '../models/service.model';

dotenv.config();

const deleteToothPlantingServices = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    // Find all services with "tooth" or "planting" in the name (case insensitive)
    const servicesToDelete = await ServiceModel.find({
      $or: [
        { name: { $regex: /tooth/i } },
        { name: { $regex: /planting/i } },
        { name: { $regex: /tooth-planting/i } },
        { name: { $regex: /tooth planting/i } },
      ],
    }).lean();

    console.log(`Found ${servicesToDelete.length} services to delete:`);
    servicesToDelete.forEach((service) => {
      console.log(`  - ${service.cptCode}: ${service.name} (ID: ${service._id})`);
    });

    if (servicesToDelete.length === 0) {
      console.log('No services found to delete.');
      process.exit(0);
    }

    // Delete all matching services
    const result = await ServiceModel.deleteMany({
      $or: [
        { name: { $regex: /tooth/i } },
        { name: { $regex: /planting/i } },
        { name: { $regex: /tooth-planting/i } },
        { name: { $regex: /tooth planting/i } },
      ],
    });

    console.log(`\n✅ Successfully deleted ${result.deletedCount} service(s)!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting services:', error);
    process.exit(1);
  }
};

deleteToothPlantingServices();
