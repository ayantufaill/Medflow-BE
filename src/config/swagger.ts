import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MedFlow API',
      version: '1.0.0',
      description: 'Medical Practice Management System API',
      contact: {
        name: 'MedFlow Support',
        email: 'support@medflow.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5001/api',
        description: 'Local Development Server'
      }
    ],
    tags: [
      { name: 'Adjustments' },
      { name: 'Admin Finance', description: 'Administrative configurations for adjustments, payments, terminals, and automation' },
      { name: 'Allergies' },
      { name: 'Appointment Types' },
      { name: 'Appointments' },
      { name: 'Auth' },
      { name: 'Authorizations' },
      { name: 'Claims' },
      { name: 'Clinical Exams' },
      { name: 'Clinical Management', description: 'Configurations for clinical settings, checklists, and templates' },
      { name: 'Clinical Notes' },
      { name: 'Communication' },
      { name: 'Deposits' },
      { name: 'Documents' },
      { name: 'ERA' },
      { name: 'Estimates' },
      { name: 'Fee Management', description: 'Dental procedure codes and fee schedules management' },
      { name: 'Finance Dashboard' },
      { name: 'Insurance Companies' },
      { name: 'Insurance Plans' },
      { name: 'Invoices' },
      { name: 'KPIs' },
      { name: 'Lab Cases' },
      { name: 'Languages' },
      { name: 'Note Templates' },
      { name: 'OCR' },
      { name: 'Patient Referrals' },
      { name: 'Patients' },
      { name: 'Payment Plans' },
      { name: 'Payments' },
      { name: 'Permissions' },
      { name: 'Portal' },
      { name: 'Practice Info' },
      { name: 'Providers' },
      { name: 'Recurring Appointments' },
      { name: 'Reporting' },
      { name: 'Roles' },
      { name: 'Rooms' },
      { name: 'Rx' },
      { name: 'Services' },
      { name: 'Treatment Plans' },
      { name: 'Users' },
      { name: 'Vital Signs' },
      { name: 'Waitlist' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'doctor@medflow.com' },
            password: { type: 'string', format: 'password', example: 'password123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    roles: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        },
        CreateAppointmentRequest: {
          type: 'object',
          required: ['patientId', 'providerId', 'startTime'],
          properties: {
            patientId: { type: 'integer', example: 1001 },
            providerId: { type: 'integer', example: 5 },
            startTime: { type: 'string', format: 'date-time', example: '2026-05-01T10:00:00Z' },
            appointmentTypeId: { type: 'integer', example: 1 },
            notes: { type: 'string', example: 'Patient prefers morning' }
          }
        },
        Appointment: {
          type: 'object',
          properties: {
            AptNum: { type: 'integer' },
            PatNum: { type: 'integer' },
            ProvNum: { type: 'integer' },
            AptDateTime: { type: 'string', format: 'date-time' },
            AptStatus: { type: 'integer', enum: [0, 1, 2] },
            Note: { type: 'string' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.ts']
};

export default swaggerOptions;