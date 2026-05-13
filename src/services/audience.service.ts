import { 
  setAudienceMeta, 
  getAllSavedAudiences, 
  deleteAudienceMeta 
} from '../utils/opendental-auth.util';

export class AudienceService {
  async getSavedAudiences() {
    return getAllSavedAudiences();
  }

  async saveAudience(data: { name: string, kind: string, filters: any[] }) {
    const audienceId = BigInt(Date.now());
    await setAudienceMeta(audienceId, data);
    return { _id: audienceId.toString(), ...data };
  }

  async deleteAudience(audienceId: string) {
    await deleteAudienceMeta(BigInt(audienceId));
  }
}

export const audienceService = new AudienceService();
