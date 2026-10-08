import { tenantContextStorage } from '../config/tenant-context';
import { BadRequestError } from './error.util';

export function reportingClinicIds(branchId?: string): bigint[] | null {
  const scope = tenantContextStorage.getStore()?.clinicIds;
  if (branchId && branchId !== 'All' && branchId !== 'all') {
    if (!/^\d+$/.test(branchId)) throw new BadRequestError('Invalid reporting branch');
    const id = BigInt(branchId);
    return scope && scope !== '*' && !scope.includes(id) ? [] : [id];
  }
  return scope && scope !== '*' ? scope : null;
}
export function reportingClinicWhere(branchId?: string) {
  const ids = reportingClinicIds(branchId);
  return ids === null ? {} : { ClinicNum: { in: ids } };
}
