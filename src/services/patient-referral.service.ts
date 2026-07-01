import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

export class PatientReferralService {
  async getPatientReferrals(patientId?: string, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (patientId) {
      where.PatNum = BigInt(patientId);
    }

    const [rows, total] = await Promise.all([
      prisma.refattach.findMany({
        where,
        include: {
          referral: {
            include: {
              definition: true // To get specialty name from definition if needed, though referral has a Note/Title
            }
          }
        },
        orderBy: { RefDate: 'desc' },
        skip,
        take: limit
      }),
      prisma.refattach.count({ where })
    ]);

    const referrals = rows.map((row: any) => {
      const specialistName = row.referral 
        ? `${row.referral.FName} ${row.referral.LName}`.trim() 
        : 'Unknown Specialist';
      
      // Specialist specialty - in OpenDental it's often a definition or a field.
      // Referral model has Specialty (BigInt) which links to definition.
      const specialtyName = row.referral?.definition?.ItemName || 'General';

      return {
        id: row.RefAttachNum.toString(),
        date: row.RefDate ? row.RefDate.toISOString().split('T')[0] : '',
        specialist: specialistName,
        specialty: specialtyName,
        reason: row.Note || ''
      };
    });

    return {
      referrals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async createPatientReferral(data: { patientId: string; specialist: string; specialty: string; reason: string }) {
    // 1. Find or Create the Specialist in the 'referral' table
    const names = data.specialist.split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || 'Specialist';

    let referral = await prisma.referral.findFirst({
      where: {
      }
    });

    if (!referral) {
      const referralNum = await getNextId('referral', 'ReferralNum');
      referral = await prisma.referral.create({
        data: {
          ReferralNum: referralNum,
          FName: firstName,
          LName: lastName,
          IsHidden: 0,
          // We could map specialty to definition here if we had a mapping, 
          // but for now, we'll store it as requested in refattach or notes.
        }
      });
    }

    // 2. Create the Link (refattach)
    const refAttachNum = await getNextId('refattach', 'RefAttachNum');

    const row = await prisma.refattach.create({
      data: {
        RefAttachNum: refAttachNum,
        PatNum: BigInt(data.patientId),
        ReferralNum: referral.ReferralNum,
        RefDate: new Date(),
        Note: data.reason,
        RefType: 1, // 1 usually means "Referral To"
      },
      include: {
        referral: true
      }
    });

    return {
      id: row.RefAttachNum.toString(),
      date: row.RefDate ? row.RefDate.toISOString().split('T')[0] : '',
      specialist: `${row.referral?.FName} ${row.referral?.LName}`.trim(),
      specialty: data.specialty, // Echo back the specialty from input
      reason: row.Note
    };
  }
}

export const patientReferralService = new PatientReferralService();
