import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { corsOptions, helmetOptions } from './config/security';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes/index';
import swaggerOptions from './config/swagger';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Initialize Express app
const app = express();
app.set('trust proxy', 1);

// Security Middleware
app.use(cors(corsOptions));
app.use(helmet(helmetOptions));

// Serve static uploads with explicit CORS and Cross-Origin-Resource-Policy headers
app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Body parsing middleware
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString('utf8');
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting completely disabled to fix "Too Many Requests" 429 error in production behind proxy
// if (process.env.NODE_ENV !== 'test') {
//   app.use('/api', apiRateLimiter);
// }

// Swagger UI setup
// In production, TypeScript compilation strips JSDoc comments, so we use
// the pre-generated swagger.json instead of runtime scanning.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerJsonPath = path.resolve(__dirname, '../swagger.json');

let specs: object;
if (fs.existsSync(swaggerJsonPath)) {
  console.log('[Swagger] Loading pre-generated swagger.json');
  specs = JSON.parse(fs.readFileSync(swaggerJsonPath, 'utf-8'));
} else {
  console.log('[Swagger] Generating spec from source files (development mode)');
  specs = swaggerJsdoc(swaggerOptions);
}
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Health check route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to MedFlow API',
    status: 'success',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);



export default app;