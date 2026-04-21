import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { corsOptions, helmetOptions } from './config/security';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes/index';
import swaggerOptions from './config/swagger';

// Initialize Express app
const app = express();

// Security Middleware
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));

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

// Rate limiting (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', apiRateLimiter);
}

// Swagger UI setup
const specs = swaggerJsdoc(swaggerOptions);
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
    status: 'healthyyy',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;