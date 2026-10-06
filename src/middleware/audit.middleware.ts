import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { writeAudit } from '../services/audit.service';
import { PermType } from '../constants/audit-types';

export const auditCrossBranchRead = (category: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    
    try {
      const patNumStr = req.params.patientId || req.query.patientId;
      const aptNumStr = req.params.appointmentId || req.params.aptNum;
      const procNumStr = req.params.procedureId || req.params.procNum;
      const docNumStr = req.params.documentId || req.params.docNum;

      let patNum: bigint | undefined;
      let clinicNum: bigint | undefined;

      try {
        if (patNumStr && !isNaN(Number(patNumStr))) {
          const patient = await prisma.patient.findUnique({
            where: { PatNum: BigInt(patNumStr.toString()) },
            select: { PatNum: true, ClinicNum: true }
          });
          if (patient) {
            patNum = patient.PatNum;
            clinicNum = patient.ClinicNum ?? undefined;
          }
        } else if (aptNumStr && !isNaN(Number(aptNumStr))) {
        const apt = await prisma.appointment.findUnique({
          where: { AptNum: BigInt(aptNumStr.toString()) },
          select: { PatNum: true, ClinicNum: true }
        });
        if (apt) {
          patNum = apt.PatNum ?? undefined;
          clinicNum = apt.ClinicNum ?? undefined;
        }
      } else if (procNumStr && !isNaN(Number(procNumStr))) {
        const proc = await prisma.procedurelog.findUnique({
          where: { ProcNum: BigInt(procNumStr.toString()) },
          select: { PatNum: true, ClinicNum: true }
        });
        if (proc) {
          patNum = proc.PatNum ?? undefined;
          clinicNum = proc.ClinicNum ?? undefined;
        }
      } else if (docNumStr && !isNaN(Number(docNumStr))) {
        const doc = await prisma.document.findUnique({
          where: { DocNum: BigInt(docNumStr.toString()) },
          select: { PatNum: true }
        });
        if (doc && doc.PatNum) {
          patNum = doc.PatNum;
          const patient = await prisma.patient.findUnique({
            where: { PatNum: doc.PatNum },
            select: { ClinicNum: true }
          });
          if (patient) clinicNum = patient.ClinicNum ?? undefined;
        }
      }
      } catch (parseError) {
        // Ignored
      }

      if (clinicNum && req.branchAccess && req.branchAccess.clinicIds) {
        const userClinics = req.branchAccess.clinicIds.map(id => id.toString());
        if (!userClinics.includes(clinicNum.toString())) {
          await writeAudit({
            userNum: BigInt(req.userId || 0),
            permType: 1050, // CROSS_BRANCH_READ
            patNum,
            clinicNum,
            text: `Cross-branch read accessed in category: ${category}`,
            req
          });
        }
      }
    } catch (err) {
      console.error('Failed to audit cross branch read', err);
    }
    
    next();
  };
};

/**
 * HIPAA access trail for a patient's record: logs every successful read and
 * every refused attempt (403/404 — under RLS a patient outside the caller's
 * scope simply isn't found) with actor, patient and time. Written after the
 * response is sent so it never slows or fails the request.
 */
export const auditPatientAccess = (req: Request, res: Response, next: NextFunction) => {
  const requestedId = req.params.patientId;
  // Only numeric ids are patient records; '/search' etc. also match '/:patientId'.
  if (!req.userId || !requestedId || !/^\d+$/.test(requestedId)) return next();

  const userNum = BigInt(req.userId);
  res.on('finish', () => {
    const status = res.statusCode;
    const isRead = req.method === 'GET' && status >= 200 && status < 300;
    const isDenied = status === 403 || status === 404;
    if (!isRead && !isDenied) return;

    const permType = isRead ? PermType.PATIENT_RECORD_READ : PermType.PATIENT_ACCESS_DENIED;
    const text = isRead
      ? `Patient record read: ${req.method} ${req.originalUrl}`
      : `Patient record access denied (${status}) for patient ${requestedId}: ${req.method} ${req.originalUrl}`;

    void (async () => {
      const written = await writeAudit({ userNum, permType, patNum: BigInt(requestedId), text, req });
      // securitylog.PatNum is a foreign key; a denied id that doesn't exist at
      // all can't be stored there, so keep the attempt with the id in the text.
      if (!written && isDenied) await writeAudit({ userNum, permType, text, req });
    })();
  });
  next();
};
