import { prisma } from '../config/db';

export class CarrierMatchingService {
  private async getSetting(key: string) {
    const setting = await prisma.clinicalsystemsetting.findUnique({
      where: { Key: key },
    });
    if (!setting) return null;
    try {
      return JSON.parse(setting.Value);
    } catch {
      return setting.Value;
    }
  }

  private async saveSetting(key: string, value: any) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await prisma.clinicalsystemsetting.upsert({
      where: { Key: key },
      update: { Value: stringValue },
      create: { Key: key, Value: stringValue },
    });
  }

  // --- Converted Carriers ---

  async getConvertedOldPayers() {
    // Return a list of old payers that were converted and need matching
    return [
      { id: 'old-1', name: 'AETNA (OLD CONVERTED)', phone: '800-555-0199', address: '123 Old St, Hartford CT', payerId: 'AET01' },
      { id: 'old-2', name: 'DELTA DENTAL OF CA (OLD)', phone: '800-555-0200', address: '456 Old Way, San Francisco CA', payerId: 'DELCA' },
      { id: 'old-3', name: 'METLIFE DENTAL (CONVERTED)', phone: '800-555-0211', address: '789 Old Ave, New York NY', payerId: 'MET03' },
      { id: 'old-4', name: 'CIGNA DENTAL (PRE-MIGRATION)', phone: '800-555-0222', address: '321 Old Blvd, Philadelphia PA', payerId: 'CIG04' },
      { id: 'old-5', name: 'HUMANA DENTAL (OLD)', phone: '800-555-0233', address: '654 Old Pl, Louisville KY', payerId: 'HUM05' },
    ];
  }

  async getConvertedOryxPayers() {
    // Retrieve real carriers from DB
    const dbCarriers = await prisma.carrier.findMany({
      where: { IsHidden: 0 },
      take: 50,
    });

    const oryxPayers = dbCarriers.map(c => ({
      id: c.CarrierNum.toString(),
      name: c.CarrierName ?? '',
      phone: c.Phone ?? '',
      address: `${c.Address ?? ''} ${c.City ?? ''} ${c.State ?? ''}`.trim(),
      payerId: c.ElectID ?? '',
    }));

    // If database is empty, return defaults so frontend has options to match
    if (oryxPayers.length === 0) {
      return [
        { id: '1', name: 'Aetna Dental', phone: '800-872-3862', address: '151 Farmington Ave, Hartford CT', payerId: 'AETNA' },
        { id: '2', name: 'Delta Dental of California', phone: '800-765-6003', address: 'P.O. Box 997100, Sacramento CA', payerId: '00540' },
        { id: '3', name: 'MetLife Insurance', phone: '800-942-0854', address: 'P.O. Box 14090, Lexington KY', payerId: '59263' },
        { id: '4', name: 'Cigna', phone: '800-244-6224', address: 'P.O. Box 188037, Chattanooga TN', payerId: 'CIGNA' },
        { id: '5', name: 'Humana', phone: '800-233-4013', address: 'P.O. Box 14611, Lexington KY', payerId: '61103' },
      ];
    }

    return oryxPayers;
  }

  async getConvertedMatchedPayers() {
    const data = await this.getSetting('converted_carrier_matches');
    return Array.isArray(data) ? data : [];
  }

  async matchConvertedCarrier(oldPayerId: string, oryxPayerId: string, matchedBy = 'Admin') {
    const oldPayers = await this.getConvertedOldPayers();
    const oryxPayers = await this.getConvertedOryxPayers();

    const oldPayer = oldPayers.find(p => p.id === oldPayerId) || { name: 'AETNA (OLD CONVERTED)' };
    const oryxPayer = oryxPayers.find(p => p.id === oryxPayerId) || { name: 'Aetna Dental' };

    const matches = await this.getConvertedMatchedPayers();
    // Remove existing match for this old payer if any
    const filtered = matches.filter((m: any) => m.oldPayerId !== oldPayerId);

    const newMatch = {
      id: `match-c-${Date.now()}`,
      oldPayerId,
      oldPayerName: oldPayer.name,
      oryxPayerId,
      oryxPayerName: oryxPayer.name,
      matchedAt: new Date().toISOString(),
      matchedBy,
    };

    filtered.push(newMatch);
    await this.saveSetting('converted_carrier_matches', filtered);
    return newMatch;
  }

  async deleteConvertedMatch(oldPayerId: string) {
    const matches = await this.getConvertedMatchedPayers();
    const filtered = matches.filter((m: any) => m.oldPayerId !== oldPayerId);
    await this.saveSetting('converted_carrier_matches', filtered);
    return { success: true };
  }

  // --- Vyne Carriers ---

  async getVyneOfficePayers() {
    // Local carriers that are syncable with Vyne
    const dbCarriers = await prisma.carrier.findMany({
      where: { IsHidden: 0 },
      take: 20,
    });

    const matches = await this.getVyneMatchedPayers();
    const matchedMap = new Map(matches.map((m: any) => [m.officePayerId, m]));

    const officePayers = dbCarriers.map(c => {
      const id = c.CarrierNum.toString();
      const match = matchedMap.get(id) as any;
      return {
        id,
        name: c.CarrierName ?? '',
        payerId: c.ElectID ?? '',
        vyneStatus: match ? 'matched' as const : 'unmatched' as const,
        vyneMasterId: match ? match.vyneMasterId : '',
      };
    });

    if (officePayers.length === 0) {
      // Fallback office payers
      return Array.from({ length: 15 }).map((_, idx) => {
        const id = `office-${idx + 1}`;
        const match = matchedMap.get(id) as any;
        return {
          id,
          name: `Office Payer ${idx + 1}`,
          payerId: `PAYER-${100 + idx}`,
          vyneStatus: match ? 'matched' as const : 'unmatched' as const,
          vyneMasterId: match ? match.vyneMasterId : '',
        };
      });
    }

    return officePayers;
  }

  async getVynePayers() {
    // National Vyne Payer List
    return [
      { id: 'vyne-1', name: 'Aetna Dental National List', payerId: 'AETNA', source: 'Vyne' as const },
      { id: 'vyne-2', name: 'Delta Dental National Payer', payerId: '00540', source: 'Vyne' as const },
      { id: 'vyne-3', name: 'MetLife Dental Payer', payerId: '59263', source: 'Vyne' as const },
      { id: 'vyne-4', name: 'Cigna Dental Payer', payerId: 'CIGNA', source: 'Vyne' as const },
      { id: 'vyne-5', name: 'Humana Dental National', payerId: '61103', source: 'Vyne' as const },
      { id: 'vyne-6', name: 'UnitedHealthcare Dental', payerId: 'UHCDE', source: 'Vyne' as const },
      { id: 'vyne-7', name: 'Guardian Life Insurance', payerId: 'GUA01', source: 'Vyne' as const },
    ];
  }

  async getVyneMatchedPayers() {
    const data = await this.getSetting('vyne_carrier_matches');
    return Array.isArray(data) ? data : [];
  }

  async matchVyneCarrier(officePayerId: string, vynePayerId: string, vyneMasterId: string) {
    const officePayers = await this.getVyneOfficePayers();
    const vynePayers = await this.getVynePayers();

    const officePayer = officePayers.find(p => p.id === officePayerId) || { name: 'Office Payer 1' };
    const vynePayer = vynePayers.find(p => p.id === vynePayerId) || { name: 'Aetna Dental National List' };

    const matches = await this.getVyneMatchedPayers();
    const filtered = matches.filter((m: any) => m.officePayerId !== officePayerId);

    const newMatch = {
      officePayerId,
      officePayerName: officePayer.name,
      vynePayerId,
      vynePayerName: vynePayer.name,
      vyneMasterId: vyneMasterId || `VM-${Date.now()}`,
      matchedAt: new Date().toISOString(),
    };

    filtered.push(newMatch);
    await this.saveSetting('vyne_carrier_matches', filtered);
    return newMatch;
  }

  async deleteVyneMatch(officePayerId: string) {
    const matches = await this.getVyneMatchedPayers();
    const filtered = matches.filter((m: any) => m.officePayerId !== officePayerId);
    await this.saveSetting('vyne_carrier_matches', filtered);
    return { success: true };
  }
}

export const carrierMatchingService = new CarrierMatchingService();
