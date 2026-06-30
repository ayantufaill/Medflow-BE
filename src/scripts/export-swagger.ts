import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from '../config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportSwagger() {
  try {
    const swaggerSpec = swaggerJsdoc(swaggerOptions);
    const outputPath = path.resolve(__dirname, '../../swagger.json');
    fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf-8');
    console.log(`Swagger documentation successfully exported to ${outputPath}`);
  } catch (error) {
    console.error('Error generating swagger documentation:', error);
    process.exit(1);
  }
}

exportSwagger();
