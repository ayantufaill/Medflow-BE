import { prisma } from '../config/db';
import { AuthorizationError } from '../utils/error.util';
import { AccessContextService } from './access-context.service';
import { bumpAccessVersion } from './access-version.service';
import { writeAudit } from './audit.service';
import { getNextId } from '../utils/opendental-ids.util';

export interface SetUserClinicsParams {
  defaultId: string | null;
  restrictedIds: string[];
  accessAll: boolean;
}

export class UserClinicService {
  async getUserClinics(targetUserNum: bigint): Promise<SetUserClinicsParams> {
    const user = await prisma.userod.findUnique({
      where: { UserNum: targetUserNum },
      include: { userclinic: true },
    });
    if (!user) throw new Error('User not found');

    const profile = await (prisma as any).user_access_profile.findUnique({
      where: { user_num: targetUserNum },
    });

    return {
      defaultId: user.ClinicNum ? user.ClinicNum.toString() : null,
      restrictedIds: user.userclinic.map((uc: any) => uc.ClinicNum.toString()),
      accessAll: profile?.access_all_clinics || false,
    };
  }
  async setUserClinics(
    targetUserNum: bigint,
    params: SetUserClinicsParams,
    actingUserId: string,
    isPlatformAdmin: boolean,
    hasSecurityAdmin: boolean
  ): Promise<void> {
    if (params.accessAll && !isPlatformAdmin && !hasSecurityAdmin) {
      throw new AuthorizationError('Only a Security Admin or Platform Admin can grant universal clinic access.');
    }

    const { defaultId, restrictedIds, accessAll } = params;

    await prisma.$transaction(async (tx) => {
      // 1. Set userod.ClinicNum (default clinic)
      await tx.userod.update({
        where: { UserNum: targetUserNum },
        data: { ClinicNum: defaultId ? BigInt(defaultId) : null },
      });

      // 2. Overwrite userclinic assignments
      await tx.userclinic.deleteMany({
        where: { UserNum: targetUserNum },
      });

      if (restrictedIds.length > 0) {
        const insertData = [];
        for (const clinicId of restrictedIds) {
          insertData.push({
            UserClinicNum: await getNextId('userclinic', 'UserClinicNum'),
            UserNum: targetUserNum,
            ClinicNum: BigInt(clinicId),
          });
        }
        await tx.userclinic.createMany({ data: insertData });
      }

      // 3. Set access_all_clinics in user_access_profile
      await (tx as any).user_access_profile.upsert({
        where: { user_num: targetUserNum },
        update: { access_all_clinics: accessAll },
        create: { user_num: targetUserNum, access_all_clinics: accessAll, is_platform_admin: false, access_version: 0 },
      });
    });

    // 4. Invalidate cache / token versions
    await bumpAccessVersion(targetUserNum);
    AccessContextService.clear(targetUserNum);

    // 5. Write audit
    await writeAudit({
      userNum: BigInt(actingUserId),
      patNum: BigInt(0),
      permType: 23, // 23 = UserEdit in Open Dental
      text: `Updated clinic assignments for user ${targetUserNum}. Default: ${defaultId}, AccessAll: ${accessAll}, Restricted: ${restrictedIds.join(',')}`,
    });
  }
}

export const userClinicService = new UserClinicService();
