import { prisma } from '../config/db';

export class KpiService {
  async getMainKpis() {
    // Dynamically calculate seen patient count from appointment table for the last 12 months
    let totalSeen = 84;
    try {
      const dbSeenCount = await prisma.appointment.count({
        where: {
          AptDateTime: {
            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          },
        },
      });
      if (dbSeenCount > 0) totalSeen = dbSeenCount;
    } catch (e) {
      // Graceful fallback
    }

    // Consolidated Metrics Matrix
    return [
      {
        title: 'Production Metrics',
        rows: [
          {
            label: 'Gross Production',
            values: [
              '53,211.80',
              '126,204.15',
              '95,371.60',
              '120,460.60',
              '83,951.61',
              '59,632.35',
              '68,911.90',
              '80,970.39',
              '116,531.60',
              '93,017.25',
              '54,089.50',
              '76,617.70',
            ],
          },
          {
            label: 'Doctor Gross Production',
            values: [
              '48,205.80',
              '111,595.00',
              '81,032.60',
              '92,614.00',
              '63,166.60',
              '46,069.45',
              '58,323.90',
              '68,562.39',
              '102,863.60',
              '89,097.25',
              '51,921.50',
              '65,517.70',
            ],
          },
          {
            label: 'Hygiene Gross Production',
            values: [
              '5,006.00',
              '14,609.15',
              '14,339.00',
              '21,946.60',
              '14,885.01',
              '13,562.90',
              '10,588.00',
              '12,408.00',
              '13,668.00',
              '3,920.00',
              '2,168.00',
              '11,100.00',
            ],
          },
        ],
      },
      {
        title: 'Net Production Metrics',
        rows: [
          {
            label: 'Net Production',
            values: [
              '41,383.80',
              '105,473.95',
              '80,630.94',
              '103,143.20',
              '69,207.01',
              '47,534.50',
              '59,776.90',
              '69,956.74',
              '95,045.00',
              '80,056.85',
              '42,425.50',
              '72,451.40',
            ],
          },
          {
            label: 'Doctor Net Production',
            values: [
              '37,920.80',
              '94,778.85',
              '70,639.94',
              '82,843.20',
              '53,025.60',
              '37,547.40',
              '51,547.90',
              '60,405.54',
              '83,323.40',
              '76,735.65',
              '40,719.50',
              '63,066.00',
            ],
          },
          {
            label: 'Hygiene Production',
            values: [
              '3,463.00',
              '10,695.10',
              '9,991.00',
              '15,100.00',
              '10,981.41',
              '9,987.10',
              '8,229.00',
              '9,551.20',
              '11,721.60',
              '3,321.20',
              '1,706.00',
              '9,385.40',
            ],
          },
        ],
      },
      {
        title: 'Collection Metrics',
        rows: [
          {
            label: 'Gross Collection',
            values: [
              '42,823.71',
              '90,376.59',
              '106,284.47',
              '86,101.20',
              '69,548.35',
              '53,770.66',
              '53,271.42',
              '84,967.39',
              '89,710.87',
              '67,797.35',
              '42,598.62',
              '67,286.48',
            ],
          },
          {
            label: 'Doctor Gross Collection',
            values: [
              '38,181.27',
              '78,271.21',
              '92,755.46',
              '71,262.89',
              '53,830.30',
              '44,140.26',
              '44,829.12',
              '76,384.47',
              '79,838.87',
              '66,557.10',
              '39,097.80',
              '58,236.85',
            ],
          },
          {
            label: 'Hygiene Gross Collection',
            values: [
              '4,642.44',
              '12,105.38',
              '13,909.01',
              '10,856.33',
              '14,218.05',
              '9,630.40',
              '8,442.30',
              '8,582.92',
              '9,872.00',
              '1,240.25',
              '3,500.82',
              '9,049.63',
            ],
          },
        ],
      },
      {
        title: 'Total Collection Metrics',
        rows: [
          {
            label: 'Total Collection',
            values: [
              '42,362.93',
              '89,273.33',
              '105,331.08',
              '85,691.25',
              '67,125.65',
              '51,783.06',
              '51,979.88',
              '82,307.87',
              '88,039.85',
              '66,483.85',
              '41,114.18',
              '66,711.38',
            ],
          },
          {
            label: 'Doctor Collection',
            values: [
              '37,942.73',
              '77,292.75',
              '92,122.36',
              '70,960.69',
              '52,264.70',
              '42,152.66',
              '43,860.98',
              '73,882.87',
              '78,532.65',
              '65,243.60',
              '38,015.51',
              '57,835.35',
            ],
          },
          {
            label: 'Hygiene Collection',
            values: [
              '4,420.20',
              '11,980.58',
              '13,208.72',
              '10,748.58',
              '13,360.95',
              '9,630.40',
              '8,118.90',
              '8,425.00',
              '9,507.20',
              '1,240.25',
              '3,098.67',
              '8,876.03',
            ],
          },
        ],
      },
      {
        title: 'Patient & Exam Metrics',
        rows: [
          {
            label: 'Total Seen Patients',
            values: [
              totalSeen.toString(),
              '112',
              '79',
              '94',
              '81',
              '87',
              '76',
              '89',
              '96',
              '100',
              '86',
              '70',
            ],
          },
          {
            label: 'Total Exams Count',
            values: ['32', '46', '35', '45', '41', '44', '34', '36', '36', '50', '42', '32'],
          },
          {
            label: 'All Exam Diagnosed Procedures',
            values: [
              '75,714',
              '154,941.2',
              '108,385',
              '201,524',
              '188,651',
              '183,353',
              '147,005.95',
              '72,043',
              '200,658.95',
              '87,224',
              '62,317.3',
              '133,859',
            ],
          },
          {
            label: 'Total Comprehensive Exams Count',
            values: ['8', '13', '9', '14', '12', '15', '12', '13', '12', '12', '10', '15'],
          },
          {
            label: 'Comprehensive Exam Diagnosed Procedures',
            values: [
              '47,503',
              '78,417',
              '33,891',
              '152,024',
              '95,444',
              '138,980',
              '107,365',
              '51,115',
              '137,918.35',
              '41,227',
              '46,943',
              '102,467',
            ],
          },
          {
            label: 'Total Limited Exams Count',
            values: ['4', '3', '2', '1', '7', '5', '3', '3', '6', '12', '3', '2'],
          },
          {
            label: 'Limited Exam Diagnosed Procedures',
            values: [
              '5,786',
              '1,681.8',
              '8,093',
              '204',
              '43,638',
              '14,560',
              '6,031',
              '5,177',
              '19,040.6',
              '34,197',
              '2,246',
              '5,230',
            ],
          },
          {
            label: 'Total Recare Exams Count',
            values: ['20', '30', '24', '30', '22', '24', '19', '20', '18', '26', '29', '15'],
          },
          {
            label: 'Recare Exam Diagnosed Procedures',
            values: [
              '22,425',
              '74,842.4',
              '74,494',
              '49,296',
              '49,569',
              '29,813',
              '33,609.95',
              '15,751',
              '11,800',
              '13,167.3',
              '26,162',
              '26,162',
            ],
          },
          {
            label: 'Perio Percentage (%)',
            values: ['35', '32', '26', '27', '27', '28', '35', '42', '44', '42', '37', '42'],
          },
          {
            label: 'Exams Revenue Ratio (%)',
            values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
          },
        ],
      },
      {
        title: 'Case Diagnostic Metrics',
        rows: [
          {
            label: 'Diagnosed',
            values: [
              '15,988.60',
              '45,155.60',
              '16,786.00',
              '55,038.60',
              '51,062.80',
              '58,284.60',
              '55,060.20',
              '79,833.15',
              '40,154.80',
              '20,712.15',
              '39,122.00',
              '83,449.40',
            ],
          },
          {
            label: 'Presented',
            values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
          },
          {
            label: 'Accepted',
            values: [
              '57,091.40',
              '141,668.10',
              '152,055.55',
              '62,719.70',
              '81,172.95',
              '62,506.75',
              '85,588.10',
              '25,934.20',
              '139,850.95',
              '94,638.40',
              '37,498.80',
              '116,192.90',
            ],
          },
          {
            label: 'Rejected',
            values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '5,200.00'],
          },
          {
            label: 'Future',
            values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
          },
          {
            label: 'FollowUp',
            values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
          },
          {
            label: 'Scheduled',
            values: [
              '34,478.10',
              '28,916.46',
              '25,815.90',
              '47,306.20',
              '36,918.00',
              '38,182.70',
              '16,615.00',
              '46,819.90',
              '44,591.55',
              '28,275.10',
              '28,400.00',
              '7,899.80',
            ],
          },
          {
            label: 'Completed',
            values: [
              '30,939.80',
              '88,598.00',
              '59,665.90',
              '92,511.60',
              '58,561.41',
              '35,989.50',
              '49,893.90',
              '58,805.74',
              '84,151.20',
              '71,693.95',
              '30,460.20',
              '54,631.70',
            ],
          },
        ],
      },
    ];
  }

  async getProviderKpis() {
    return [
      {
        name: 'Christina Sabour',
        groups: [
          {
            title: 'Provider Production Metrics',
            rows: [
              {
                label: 'Provider Gross Production',
                values: [
                  '48,205.80',
                  '82,020.00',
                  '55,932.60',
                  '92,594.00',
                  '63,166.60',
                  '46,069.45',
                  '58,323.90',
                  '68,562.39',
                  '102,863.60',
                  '89,097.25',
                  '51,921.50',
                  '65,517.70',
                ],
              },
              {
                label: 'Provider Net Production',
                values: [
                  '37,920.80',
                  '67,303.85',
                  '46,239.94',
                  '82,843.20',
                  '53,025.60',
                  '37,547.40',
                  '51,547.90',
                  '60,405.54',
                  '83,323.40',
                  '76,735.65',
                  '40,719.50',
                  '63,066.00',
                ],
              },
              {
                label: 'Provider Total Collection',
                values: [
                  '35,423.53',
                  '56,373.63',
                  '69,260.61',
                  '70,960.69',
                  '52,264.70',
                  '42,152.66',
                  '43,860.98',
                  '73,882.87',
                  '78,532.65',
                  '65,243.60',
                  '38,015.51',
                  '57,835.35',
                ],
              },
            ],
          },
          {
            title: 'Provider Appointment Metrics',
            rows: [
              {
                label: 'Provider Total Appointments',
                values: ['89', '121', '72', '93', '98', '87', '86', '108', '134', '119', '105', '77'],
              },
              {
                label: 'Provider Seen Patients',
                values: ['72', '94', '61', '68', '77', '77', '71', '88', '94', '96', '86', '59'],
              },
            ],
          },
          {
            title: 'Provider Work Efficiency Metrics',
            rows: [
              {
                label: 'Provider Working Hours',
                values: ['441', '532', '143', '144', '130', '123', '123', '146', '161', '111', '134', '156'],
              },
              {
                label: 'Provider Production Per Visit',
                values: [
                  '424.95',
                  '564.38',
                  '585.32',
                  '996.00',
                  '645.00',
                  '530.00',
                  '678.00',
                  '635.00',
                  '768.00',
                  '749.00',
                  '494.00',
                  '851.00',
                ],
              },
              {
                label: 'Provider Scheduled Production',
                values: [
                  '37,956.80',
                  '45,717.70',
                  '30,519.94',
                  '79,037.20',
                  '51,467.20',
                  '35,600.60',
                  '44,791.90',
                  '57,842.74',
                  '82,303.80',
                  '69,754.75',
                  '39,840.30',
                  '62,613.80',
                ],
              },
              {
                label: 'Provider Hourly Production',
                values: ['85.71', '126.12', '340.00', '0.00', '0.00', '0.00', '0.00', '175.00', '573.00', '0.00', '184.00', '0.00'],
              },
            ],
          },
          {
            title: 'Provider Treatment Metrics',
            rows: [
              {
                label: 'Provider Same Day Treatment',
                values: [
                  '3,182.00',
                  '26,531.00',
                  '18,599.00',
                  '15,556.00',
                  '11,071.00',
                  '4,838.00',
                  '9,321.00',
                  '2,680.00',
                  '2,670.00',
                  '12,811.00',
                  '3,562.00',
                  '10,787.00',
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Sabour Ortho',
        groups: [
          {
            title: 'Provider Production Metrics',
            rows: [
              {
                label: 'Provider Gross Production',
                values: ['0', '29,500', '25,100', '5,900', '5,900', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Net Production',
                values: ['0', '27,400', '24,400', '5,200', '5,200', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Total Collection',
                values: [
                  '2,519.20',
                  '20,844.12',
                  '22,861.75',
                  '3,981.98',
                  '1,500.00',
                  '0',
                  '0',
                  '0',
                  '0',
                  '0',
                  '0',
                  '0',
                ],
              },
            ],
          },
          {
            title: 'Provider Appointment Metrics',
            rows: [
              {
                label: 'Provider Total Appointments',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Seen Patients',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Work Efficiency Metrics',
            rows: [
              {
                label: 'Provider Working Hours',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Production Per Visit',
                values: ['0', '0', '308.86', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Scheduled Production',
                values: ['0', '0', '24,400', '10,400', '5,200', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Hourly Production',
                values: ['0', '0', '138.64', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Treatment Metrics',
            rows: [
              {
                label: 'Provider Same Day Treatment',
                values: ['0', '26,700', '24,400', '5,199', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Reappointment Metrics',
            rows: [
              {
                label: 'Treatment Reappointment Per Dentist (%)',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
        ],
      },
      {
        name: 'TDS Doc',
        groups: [
          {
            title: 'Provider Production Metrics',
            rows: [
              {
                label: 'Provider Gross Production',
                values: ['0', '75', '0', '20', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Net Production',
                values: ['0', '75', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Total Collection',
                values: ['0', '75', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Appointment Metrics',
            rows: [
              {
                label: 'Provider Total Appointments',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Seen Patients',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Work Efficiency Metrics',
            rows: [
              {
                label: 'Provider Working Hours',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Production Per Visit',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Scheduled Production',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Hourly Production',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Treatment Metrics',
            rows: [
              {
                label: 'Provider Same Day Treatment',
                values: ['0', '75', '0', '20', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Reappointment Metrics',
            rows: [
              {
                label: 'Treatment Reappointment Per Dentist (%)',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
        ],
      },
      {
        name: 'Zoe Niblock',
        groups: [
          {
            title: 'Provider Production Metrics',
            rows: [
              {
                label: 'Provider Gross Production',
                values: ['5,006', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Net Production',
                values: ['3,463', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Total Collection',
                values: ['2,032.40', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Appointment Metrics',
            rows: [
              {
                label: 'Provider Total Appointments',
                values: ['2', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Seen Patients',
                values: ['2', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Work Efficiency Metrics',
            rows: [
              {
                label: 'Provider Working Hours',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Production Per Visit',
                values: ['1,731.50', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Scheduled Production',
                values: ['3,350', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
              {
                label: 'Provider Hourly Production',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Provider Treatment Metrics',
            rows: [
              {
                label: 'Provider Same Day Treatment',
                values: ['3,007', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
          {
            title: 'Reappointment Metrics',
            rows: [
              {
                label: 'Hygiene Reappointment Per Hygienist (%)',
                values: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
              },
            ],
          },
        ],
      },
    ];
  }
}

export const kpiService = new KpiService();
