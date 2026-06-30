import * as fs from 'fs';
import * as path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from '../src/config/swagger.js';

async function exportSwagger() {
  try {
    const swaggerSpec = (swaggerJsdoc as any)(swaggerOptions);
    const outputPath = path.resolve(process.cwd(), 'swagger.json');
    fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf-8');
    console.log(`Swagger documentation successfully exported to ${outputPath}`);
  } catch (error) {
    console.error('Error generating swagger documentation:', error);
    process.exit(1);
  }
}

exportSwagger();
