import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import fs from 'fs';

type ImageField = 'ProfileImagePath' | 'XrayImagePath' | 'TeethCropImagePath';

const imageTypeToField: Record<string, ImageField> = {
  'profile':    'ProfileImagePath',
  'xray':       'XrayImagePath',
  'teeth-crop': 'TeethCropImagePath',
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';

const toUrl = (filePath: string | null | undefined): string | null => {
  if (!filePath) return null;
  return `${BASE_URL}${filePath.replace('/app', '')}`;
};

const mapImageRecord = (record: any) => {
  if (!record) return null;
  return {
    imageId:            record.ImageId.toString(),
    patientId:          record.PatNum.toString(),
    profileImagePath:   toUrl(record.ProfileImagePath),
    xrayImagePath:      toUrl(record.XrayImagePath),
    teethCropImagePath: toUrl(record.TeethCropImagePath),
    createdAt:          record.CreatedAt,
    updatedAt:          record.UpdatedAt,
  };
};

export class PatientImageService {

  async getImages(patientId: string) {
    const patNum = BigInt(patientId);
    const record = await prisma.patientImage.findUnique({
      where: { PatNum: patNum },
    });
    return mapImageRecord(record);
  }

  async upsertImage(patientId: string, imageType: string, filePath: string, userId: string) {
    const patNum = BigInt(patientId);
    const userNum = BigInt(userId);
    const field = imageTypeToField[imageType];

    if (!field) throw new Error(`Invalid imageType: ${imageType}`);

    const existing = await prisma.patientImage.findUnique({
      where: { PatNum: patNum },
    });

    let record;
    if (existing) {
      const oldPath = existing[field] as string | null;
      if (oldPath && oldPath !== filePath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }

      record = await prisma.patientImage.update({
        where: { PatNum: patNum },
        data: { [field]: filePath, UpdatedBy: userNum },
      });
    } else {
      record = await prisma.patientImage.create({
        data: {
          PatNum:    patNum,
          [field]:   filePath,
          CreatedBy: userNum,
          UpdatedBy: userNum,
        },
      });
    }

    await logActivity(userId, 'updated', 'patient_image', patientId, existing, record);
    return mapImageRecord(record);
  }

  async deleteImage(patientId: string, imageType: string, userId: string) {
    const patNum = BigInt(patientId);
    const field = imageTypeToField[imageType];

    if (!field) throw new Error(`Invalid imageType: ${imageType}`);

    const existing = await prisma.patientImage.findUnique({
      where: { PatNum: patNum },
    });

    if (!existing) throw new NotFoundError(`No images found for patient ${patientId}.`);

    const filePath = existing[field] as string | null;
    if (!filePath) throw new NotFoundError(`No ${imageType} image found for patient ${patientId}.`);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const record = await prisma.patientImage.update({
      where: { PatNum: patNum },
      data: { [field]: null, UpdatedBy: BigInt(userId) },
    });

    await logActivity(userId, 'deleted', `patient_image_${imageType}`, patientId, existing, record);
    return true;
  }

  async getSingleImage(patientId: string, imageType: string) {
    const patNum = BigInt(patientId);
    const field = imageTypeToField[imageType];

    if (!field) throw new Error(`Invalid imageType: ${imageType}`);

    const record = await prisma.patientImage.findUnique({
      where: { PatNum: patNum },
      select: { [field]: true, PatNum: true },
    });

    if (!record) throw new NotFoundError(`No images found for patient ${patientId}.`);

    const filePath = record[field] as string | null;

    return {
      patientId,
      imageType,
      url: toUrl(filePath),
    };
  }
}

export const patientImageService = new PatientImageService();
