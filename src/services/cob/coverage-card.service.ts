/**
 * Insurance card images, per coverage.
 *
 * WHAT THIS SERVICE DOES NOT DO
 * -----------------------------
 * It does not store bytes, generate URLs, validate mime types or delete files.
 * All of that already exists for patient documents, so a card image IS a
 * document: `uploadToS3` puts the bytes away, `documentService` writes the
 * `document` row with its checksum and metadata, and this service only records
 * which document is which side of which coverage's card.
 *
 * The alternative — a `card_front_url` column on the coverage detail — would
 * have meant a second, weaker file pipeline inside COB with no checksum, no
 * mime filter, no RLS and no delete path. The link table is the smaller idea.
 *
 * WHY `side` IS PART OF THE KEY
 * -----------------------------
 * The front carries the member ID and the back carries the claims address and
 * the phone number a biller actually calls, so both matter. Staff routinely
 * re-shoot one side; keying the upsert on coverage alone would silently
 * destroy the other image.
 */

import type { Request } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { BadRequestError, NotFoundError } from '../../utils/error.util';
import { uploadToS3, deleteFromS3 } from '../../utils/s3.util';
import { documentService } from '../document.service';
import { writeAudit } from '../audit.service';
import { PermType } from '../../constants/audit-types';

export const CARD_SIDES = ['FRONT', 'BACK'] as const;
export type CardSide = (typeof CARD_SIDES)[number];

/** Accepts `front`/`FRONT`/`Front`; rejects anything else. */
export const normalizeSide = (value: unknown): CardSide => {
  const side = String(value || '').trim().toUpperCase();
  if (!CARD_SIDES.includes(side as CardSide)) {
    throw new BadRequestError(`side must be one of: ${CARD_SIDES.join(', ')}`);
  }
  return side as CardSide;
};

/** The coverage, with the patient it belongs to — needed for the document row. */
const loadCoverage = async (coverageId: string) => {
  const patPlanNum = BigInt(coverageId);
  const patPlan = await prisma.patplan.findUnique({
    where: { PatPlanNum: patPlanNum },
    select: { PatPlanNum: true, PatNum: true },
  });
  if (!patPlan) throw new NotFoundError('Coverage not found');
  if (!patPlan.PatNum) {
    // A patplan with no patient cannot own a patient document, and writing one
    // anyway would create an image nothing can scope or ever delete.
    throw new BadRequestError('This coverage is not attached to a patient');
  }
  return { patPlanNum, patNum: patPlan.PatNum };
};

export class CoverageCardService {
  /**
   * Store one side of the card.
   *
   * Replacing a side deletes the old file AFTER the new row is in place, so a
   * failed upload never leaves the coverage with no image at all.
   */
  async upload(
    coverageId: string,
    rawSide: unknown,
    file: Express.Multer.File | undefined,
    userNum: bigint,
    options: { req?: Request } = {}
  ) {
    if (!file) throw new BadRequestError('No file uploaded');
    const side = normalizeSide(rawSide);
    const { patPlanNum, patNum } = await loadCoverage(coverageId);

    const existing = await prisma.cob_coverage_card.findUnique({
      where: { patplan_num_side: { patplan_num: patPlanNum, side } },
    });

    const storagePath = await uploadToS3(file, 'insurance-cards');
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const document = await documentService.createDocument(
      {
        patientId: patNum.toString(),
        documentName: `Insurance card (${side.toLowerCase()}) — coverage ${coverageId}`,
        documentType: 'INSURANCE_CARD',
        storagePath,
        fileSizeInBytes: file.size,
        mimeType: file.mimetype,
        description: `${side} of the insurance card for coverage ${coverageId}`,
        // A card carries the member ID and the subscriber's name: it is PHI
        // and is marked as such so the document layer treats it accordingly.
        isConfidential: true,
        checksum,
        tags: ['insurance-card', side.toLowerCase()],
      },
      userNum.toString()
    );

    const card = await prisma.cob_coverage_card.upsert({
      where: { patplan_num_side: { patplan_num: patPlanNum, side } },
      create: {
        patplan_num: patPlanNum,
        side,
        doc_num: BigInt(document._id),
        uploaded_by: userNum,
      },
      update: {
        doc_num: BigInt(document._id),
        uploaded_by: userNum,
        uploaded_at: new Date(),
      },
    });

    // Only now is the replaced image unreachable, so only now is it safe to
    // remove. A failure here loses a byte-store orphan, not the patient's card.
    if (existing) {
      await this.discardDocument(existing.doc_num).catch((error) => {
        console.error(
          `Replaced insurance card ${existing.doc_num} could not be removed:`,
          error
        );
      });
    }

    await writeAudit({
      userNum,
      permType: PermType.COB_COVERAGE_CARD_UPLOADED,
      patNum,
      text: `Insurance card ${side} ${existing ? 'replaced' : 'uploaded'} for coverage ${coverageId}`,
      req: options.req,
    });

    return this.shape(card, document);
  }

  /** Both sides, with whatever the document layer knows about each. */
  async list(coverageId: string) {
    const { patPlanNum } = await loadCoverage(coverageId);

    const cards = await prisma.cob_coverage_card.findMany({
      where: { patplan_num: patPlanNum },
      orderBy: { side: 'asc' },
    });

    const documents = await Promise.all(
      cards.map((card) =>
        documentService.getDocumentById(card.doc_num.toString()).catch(() => null)
      )
    );

    return {
      coverageId,
      cards: cards.map((card, index) => this.shape(card, documents[index])),
      /** Which sides are still missing — what the UI prompts for. */
      missingSides: CARD_SIDES.filter((side) => !cards.some((card) => card.side === side)),
    };
  }

  async remove(coverageId: string, rawSide: unknown, userNum: bigint, options: { req?: Request } = {}) {
    const side = normalizeSide(rawSide);
    const { patPlanNum, patNum } = await loadCoverage(coverageId);

    const card = await prisma.cob_coverage_card.findUnique({
      where: { patplan_num_side: { patplan_num: patPlanNum, side } },
    });
    if (!card) throw new NotFoundError(`No ${side.toLowerCase()} image on this coverage`);

    await prisma.cob_coverage_card.delete({
      where: { patplan_num_side: { patplan_num: patPlanNum, side } },
    });
    await this.discardDocument(card.doc_num).catch((error) => {
      console.error(`Insurance card ${card.doc_num} could not be removed:`, error);
    });

    await writeAudit({
      userNum,
      permType: PermType.COB_COVERAGE_CARD_DELETED,
      patNum,
      text: `Insurance card ${side} deleted for coverage ${coverageId}`,
      req: options.req,
    });

    return { coverageId, side, deleted: true };
  }

  /** Removes the stored file and the document row behind one card image. */
  private async discardDocument(docNum: bigint) {
    const document = await prisma.document.findUnique({ where: { DocNum: docNum } });
    if (!document) return;
    if (document.FileName) await deleteFromS3(document.FileName);
    await prisma.document.delete({ where: { DocNum: docNum } });
  }

  private shape(card: { side: string; doc_num: bigint; uploaded_at: Date; uploaded_by: bigint | null }, document: any) {
    return {
      side: card.side,
      documentId: card.doc_num.toString(),
      // `documentService` owns URL shaping, so it is read from its mapped
      // row rather than rebuilt from a storage path here.
      url: document?.fileUrl ?? document?.storagePath ?? null,
      mimeType: document?.mimeType ?? null,
      fileSizeInBytes: document?.fileSizeInBytes ?? null,
      uploadedBy: card.uploaded_by?.toString() ?? null,
      uploadedAt: card.uploaded_at,
    };
  }
}

export const coverageCardService = new CoverageCardService();
