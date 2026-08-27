import swaggerJsdoc from 'swagger-jsdoc';

const getServers = () => {
  const servers = [
    {
      url: '/api',
      description: 'Current Server (Auto-detected)'
    }
  ];

  if (process.env.API_BASE_URL) {
    const baseUrl = process.env.API_BASE_URL.replace(/\/$/, '');
    const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
    servers.unshift({
      url: apiUrl,
      description: 'Production Server'
    });
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    servers.unshift({
      url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api`,
      description: 'Railway Server'
    });
  }

  servers.push({
    url: 'http://localhost:5001/api',
    description: 'Local Development Server'
  });

  return servers;
};

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
    servers: getServers(),
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
      { name: 'Patient Insurance' },
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
        },
        ClinicalExamRecord: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            examType: { type: 'string', example: 'periodontal' },
            patientId: { type: 'string', example: '1' },
            appointmentId: { type: 'string', example: '1' },
            providerId: { type: 'string', example: '1' },
            isSigned: { type: 'boolean', example: false },
            signedBy: { type: 'string', nullable: true, example: null },
            signedAt: { type: 'string', format: 'date-time', nullable: true },
            examData: {
              type: 'object',
              description: 'Structured exam findings; shape varies by examType'
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdBy: { type: 'string', example: '1' },
            updatedBy: { type: 'string', example: '1' }
          }
        },
        PeriodontalExamData: {
          type: 'object',
          description: 'Periodontal exam structured findings with pocket depths, bleeding, recession, and furcation data',
          properties: {
            pocketDepths: {
              type: 'object',
              description: 'Per-tooth pocket depth measurements (6 sites per tooth: MB, B, DB, ML, L, DL)',
              example: {
                '1': { buccal: [3, 2, 3], lingual: [2, 3, 2] },
                '2': { buccal: [4, 3, 4], lingual: [3, 3, 3] }
              }
            },
            bleedingOnProbing: {
              type: 'object',
              description: 'Per-tooth bleeding indicators (true/false for each of 6 sites)',
              example: { '1': { buccal: [false, false, true], lingual: [false, false, false] } }
            },
            recession: {
              type: 'object',
              description: 'Per-tooth recession measurements in mm',
              example: { '1': { buccal: [0, 0, 1], lingual: [0, 0, 0] } }
            },
            furcation: {
              type: 'object',
              description: 'Furcation involvement grades (0-3) for multi-rooted teeth',
              example: { '3': 1, '14': 2 }
            },
            mobility: {
              type: 'object',
              description: 'Tooth mobility grades (0-3)',
              example: { '8': 1, '24': 0 }
            },
            notes: { type: 'string', example: 'Generalized moderate periodontitis' }
          }
        },
        TeethStructureExamData: {
          type: 'object',
          description: 'Teeth/tooth structure exam findings including caries, fractures, wear, and restorations',
          properties: {
            teeth: {
              type: 'object',
              description: 'Per-tooth condition map',
              example: {
                '3': { condition: 'caries', surfaces: ['MO'], severity: 'moderate', notes: 'Class II MO caries' },
                '14': { condition: 'fracture', surfaces: ['B'], severity: 'mild', notes: 'Craze line on buccal' },
                '19': { condition: 'restoration', surfaces: ['MOD'], material: 'composite', status: 'intact' }
              }
            },
            generalNotes: { type: 'string', example: 'Generalized attrition on anterior teeth' },
            wearPattern: { type: 'string', example: 'Moderate bruxism-related wear' }
          }
        },
        RadiographicExamData: {
          type: 'object',
          description: 'Radiographic exam findings organized by region',
          properties: {
            findings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  region: { type: 'string', example: 'maxillary right' },
                  toothNumbers: { type: 'array', items: { type: 'integer' }, example: [2, 3, 4] },
                  finding: { type: 'string', example: 'Periapical radiolucency' },
                  severity: { type: 'string', example: 'moderate' },
                  notes: { type: 'string', example: '3mm radiolucency at apex of #3' }
                }
              }
            },
            boneLoss: {
              type: 'object',
              description: 'Bone loss assessment by region',
              example: { 'maxillary right': 'mild', 'mandibular left': 'moderate' }
            },
            radiographType: { type: 'string', example: 'full mouth series' },
            notes: { type: 'string', example: 'No significant pathology noted' }
          }
        },
        ExamHistoryEntry: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date-time' },
            appointmentId: { type: 'string', example: '101' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.ts']
};

export default swaggerOptions;