/**
 * Shared access types — contract from 00-SHARED-CONTRACTS.md §4.1.
 *
 * Person A owns this file. This is a local stub so Person B can compile
 * against it before A merges. When A's branch lands, this file is replaced
 * by A's version (identical interface, possibly more JSDoc).
 */

export type ShareCategory =
  | 'IDENTITY'
  | 'CLINICAL'
  | 'IMAGING'
  | 'APPOINTMENTS'
  | 'FINANCIAL'
  | 'INSURANCE';

export type ShareMode = 'OWN_BRANCH' | 'GROUP_READ'; // no GROUP_READ_WRITE, by decision

export interface AccessContext {
  userId: bigint;
  roles: string[];
  permissions: ReadonlySet<string>; // already unioned; '*' only for platform admin
  isPlatformAdmin: boolean;
  accessAllClinics: boolean; // explicit flag; empty list never means "all"
  clinicIds: bigint[]; // own writable scope
  groupClinicIds: bigint[];
  groupId: number | null;
  isGroupAdmin: boolean;
  sharing: Record<ShareCategory, ShareMode>;
  accessVersion: number;
}

// Express augmentation — req.access is optional until A's middleware populates it
declare global {
  namespace Express {
    interface Request {
      access?: AccessContext;
    }
  }
}
