import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { swaggerSpec } from '../config/swagger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, '../config/swagger-spec.json');

fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log('✅ Swagger JSON spec generated successfully!');