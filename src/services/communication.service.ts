import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  EMPTY_EMAIL_DOMAIN,
  createDomainIdentity,
  normalizeDomain,
  verifyDomainIdentity,
  type EmailDomainState,
} from './email-domain.service';

import {
  defaultMessagingState,
  isValidAreaCode,
  normalizeUsPhone,
  sanitizePracticeDetails,
  searchAvailableNumbers,
  validatePracticeDetails,
  type MessagingServiceState,
  type PracticeDetails,
  type PracticeDetailsInput,
} from './messaging-number.service';
import { practiceInfoService } from './practice-info.service';
import {
  applyAutomationUpdate,
  buildAutomation,
  buildDefaultAutomations,
  isAutomationCategory,
  summarizeAutomations,
  validateAutomation,
  type AutomationCategory,
  type AutomationInput,
  type AutomationMessage,
} from './automation.service';

const AUTOMATIONS_PREF = 'medflow.communication.automations';

interface AutomationsState {
  messages: Record<AutomationCategory, AutomationMessage[]>;
}

const EMAIL_DOMAIN_PREF = 'medflow.communication.email-domain';
const EMAIL_PREFERENCES_PREF = 'medflow.communication.email-preferences';
const MESSAGING_SERVICE_PREF = 'medflow.communication.messaging-service';
const MESSAGING_PRACTICE_DETAILS_PREF = 'medflow.communication.messaging-practice-details';

export interface EmailPreferences {
  sentFromEmail: string | null;
  replyToEmail: string | null;
}

const getClinicNum = async (): Promise<bigint> => {
  const clinic = await prisma.clinic.findFirst({ orderBy: { ClinicNum: 'asc' } });
  if (clinic) return clinic.ClinicNum;

  // No clinic row exists yet — create a default one so clinicpref FK is satisfied.
  const nextId = await getNextId('clinic', 'ClinicNum');
  const created = await prisma.clinic.create({
    data: {
      ClinicNum: nextId,
      Description: 'Default Clinic',
    },
  });
  return created.ClinicNum;
};

export class CommunicationService {
  private async setClinicPref(clinicNum: bigint, prefName: string, value: string) {
    const existing = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: prefName },
    });
    if (existing) {
      await prisma.clinicpref.update({
        where: { ClinicPrefNum: existing.ClinicPrefNum },
        data: { ValueString: value },
      });
    } else {
      const clinicPrefNum = await getNextId('clinicpref', 'ClinicPrefNum');
      await prisma.clinicpref.create({
        data: {
          ClinicPrefNum: clinicPrefNum,
          ClinicNum: clinicNum,
          PrefName: prefName,
          ValueString: value,
        },
      });
    }
  }

  /* ─── Communication Settings ─── */
  async getSettings() {
    const clinicNum = await getClinicNum();
    const pref = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: 'medflow.communication.settings' },
    });
    if (!pref || !pref.ValueString) {
      return {
        skippedDays: [],
        emailConfig: { days: 'Weekdays', startTime: '08:00', endTime: '17:00' },
        textConfig: { days: 'Custom', startTime: '08:00', endTime: '20:00', enabledDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
        reminders: [
          { label: 'Existing Appointments (Treatment and Hygiene)', checked: true, hasLinks: true },
          { label: 'Recall (Patients without recare appointments)', checked: true, hasLinks: true },
          { label: 'Birthdays', checked: true, hasLinks: false },
          { label: 'Appointment Reminder After Confirmation', checked: true, hasLinks: false },
          { label: "Include Don't Remind Me Again Button", checked: true, hasLinks: false },
          { label: 'Include All Same-Day Appointments for Each Patient in Reminders (Not only the First Appt Time) *', checked: true, hasLinks: false },
          { label: 'Appointment Notification After Cancellation using Email *', checked: false, hasLinks: false },
          { label: "Automatic reply for patient's missed calls", checked: false, hasLinks: false },
        ],
        socialLinks: { facebook: '', instagram: '', linkedin: '', twitter: '', googlePlus: '' },
        mapCoords: { lat: 33.018, lng: -97.081, address: '2345 Olympia Dr. Suite 200 Flower Mound, TX 75028' }
      };
    }
    return JSON.parse(pref.ValueString);
  }

  async updateSettings(data: any) {
    const clinicNum = await getClinicNum();
    const current = await this.getSettings();
    const updated = { ...current, ...data };
    
    await this.setClinicPref(clinicNum, 'medflow.communication.settings', JSON.stringify(updated));
    return updated;
  }

  /* ─── Email Domain (Email Services) ─── */
  async getEmailDomain(): Promise<EmailDomainState> {
    const clinicNum = await getClinicNum();
    const pref = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: EMAIL_DOMAIN_PREF },
    });
    if (!pref || !pref.ValueString) return { ...EMPTY_EMAIL_DOMAIN };
    return JSON.parse(pref.ValueString);
  }

  /** Registers a new sending domain (or replaces the current one) and issues fresh DNS records. */
  async setEmailDomain(input: string): Promise<EmailDomainState> {
    const domain = normalizeDomain(input);
    if (!domain) {
      throw new BadRequestError('Enter a valid domain, e.g. yourpractice.com');
    }
    const current = await this.getEmailDomain();
    if (current.domain === domain) {
      throw new BadRequestError('This is already your current domain.');
    }

    const state = createDomainIdentity(domain);
    const clinicNum = await getClinicNum();
    await this.setClinicPref(clinicNum, EMAIL_DOMAIN_PREF, JSON.stringify(state));
    return state;
  }

  /** Re-checks the domain's DNS records against live DNS and persists the result. */
  async verifyEmailDomain(): Promise<EmailDomainState> {
    const current = await this.getEmailDomain();
    if (!current.domain) {
      throw new BadRequestError('No email domain has been set up yet.');
    }
    const verified = await verifyDomainIdentity(current);
    const clinicNum = await getClinicNum();
    await this.setClinicPref(clinicNum, EMAIL_DOMAIN_PREF, JSON.stringify(verified));
    return verified;
  }

  private async getJsonPref<T>(prefName: string): Promise<T | null> {
    const clinicNum = await getClinicNum();
    const pref = await prisma.clinicpref.findFirst({ where: { ClinicNum: clinicNum, PrefName: prefName } });
    return pref?.ValueString ? (JSON.parse(pref.ValueString) as T) : null;
  }

  private async setJsonPref(prefName: string, value: unknown) {
    const clinicNum = await getClinicNum();
    await this.setClinicPref(clinicNum, prefName, JSON.stringify(value));
  }

  /* ─── Email Preferences ─── */
  /** Saved addresses, or defaults derived from the email domain and practice email. */
  async getEmailPreferences(): Promise<EmailPreferences> {
    const saved = await this.getJsonPref<EmailPreferences>(EMAIL_PREFERENCES_PREF);
    if (saved) return saved;

    const { domain } = await this.getEmailDomain();
    const practice = await practiceInfoService.getPracticeInfo();
    return {
      sentFromEmail: domain ? `noreply@${domain}` : null,
      replyToEmail: practice?.email ?? null,
    };
  }

  async updateEmailPreferences(input: { sentFromEmail: string; replyToEmail: string }): Promise<EmailPreferences> {
    const sentFromEmail = input.sentFromEmail.trim().toLowerCase();
    const replyToEmail = input.replyToEmail.trim().toLowerCase();

    // Mail can only be sent from the domain verified under Email Services.
    const { domain } = await this.getEmailDomain();
    if (domain && sentFromEmail.split('@')[1] !== domain) {
      throw new BadRequestError(
        `'Sent From' email must use your email domain (@${domain}).`,
        undefined,
        { field: 'sentFromEmail' }
      );
    }

    const preferences = { sentFromEmail, replyToEmail };
    await this.setJsonPref(EMAIL_PREFERENCES_PREF, preferences);
    return preferences;
  }

  /* ─── Messaging Service (two-way SMS number) ─── */
  async getMessagingService(): Promise<MessagingServiceState> {
    return (await this.getJsonPref<MessagingServiceState>(MESSAGING_SERVICE_PREF)) ?? defaultMessagingState();
  }

  /** Step 1 of Number Selection. Saved details, or defaults from Practice Info and the signed-in owner. */
  async getMessagingPracticeDetails(owner: PracticeDetails['owner']): Promise<PracticeDetails> {
    const saved = await this.getJsonPref<Omit<PracticeDetails, 'owner'>>(MESSAGING_PRACTICE_DETAILS_PREF);
    if (saved) return { ...saved, owner };

    const practice = await practiceInfoService.getPracticeInfo();
    const taxDigits = (practice?.taxId ?? '').replace(/\D/g, '');
    return {
      legalBusinessName: practice?.practiceName ?? '',
      doingBusinessAs: practice?.practiceName ?? '',
      einLast4: taxDigits.length >= 4 ? taxDigits.slice(-4) : null,
      businessType: '',
      phoneNumber: normalizeUsPhone(practice?.phone) ?? '',
      website: practice?.website ?? '',
      address: practice?.address?.line1 ?? '',
      address2: practice?.address?.line2 ?? '',
      city: practice?.address?.city ?? '',
      state: practice?.address?.state ?? '',
      zip: practice?.address?.postalCode ?? '',
      owner,
    };
  }

  async updateMessagingPracticeDetails(input: PracticeDetailsInput, owner: PracticeDetails['owner']): Promise<PracticeDetails> {
    const fields = validatePracticeDetails(input);
    if (Object.keys(fields).length > 0) {
      throw new BadRequestError('Please fix the highlighted fields.', undefined, { fields });
    }
    const previous = await this.getJsonPref<Omit<PracticeDetails, 'owner'>>(MESSAGING_PRACTICE_DETAILS_PREF);
    const details = sanitizePracticeDetails(input, previous?.einLast4 ?? null);
    await this.setJsonPref(MESSAGING_PRACTICE_DETAILS_PREF, details);
    return { ...details, owner };
  }

  /** Step 2 of Number Selection. Excludes the practice's current number. */
  async searchMessagingNumbers(areaCode: string): Promise<string[]> {
    if (!isValidAreaCode(areaCode)) {
      throw new BadRequestError('Enter a valid 3-digit area code.');
    }
    const { phoneNumber } = await this.getMessagingService();
    return (await searchAvailableNumbers(areaCode)).filter((n) => n !== phoneNumber);
  }

  /** Records the chosen number as pending carrier registration. Does not purchase it. */
  async selectMessagingNumber(input: string): Promise<MessagingServiceState> {
    const phoneNumber = normalizeUsPhone(input);
    if (!phoneNumber) {
      throw new BadRequestError('Select a valid number to continue.');
    }
    const details = await this.getJsonPref(MESSAGING_PRACTICE_DETAILS_PREF);
    if (!details) {
      throw new BadRequestError('Confirm your practice details before selecting a number.');
    }
    const current = await this.getMessagingService();
    if (current.phoneNumber === phoneNumber) {
      throw new BadRequestError('This is already your messaging number.');
    }

    const state: MessagingServiceState = {
      status: 'pending',
      phoneNumber,
      provider: current.provider,
      selectedAt: new Date().toISOString(),
    };
    await this.setJsonPref(MESSAGING_SERVICE_PREF, state);
    return state;
  }

  /* ─── Automations ─── */
  /**
   * All categories' messages. The first read seeds the starter messages; after
   * that the stored state is authoritative, so deleting every message in a
   * category doesn't bring the defaults back.
   */
  private async loadAutomations(): Promise<AutomationsState> {
    const saved = await this.getJsonPref<AutomationsState>(AUTOMATIONS_PREF);
    if (saved) return saved;
    const seeded: AutomationsState = { messages: buildDefaultAutomations() };
    await this.setJsonPref(AUTOMATIONS_PREF, seeded);
    return seeded;
  }

  private assertCategory(category: unknown): asserts category is AutomationCategory {
    if (!isAutomationCategory(category)) {
      throw new BadRequestError(`Unknown automation category "${String(category)}".`);
    }
  }

  /** Finds a message by id across categories. */
  private locateAutomation(state: AutomationsState, id: string) {
    for (const [category, messages] of Object.entries(state.messages)) {
      const index = messages.findIndex((m) => m.id === id);
      if (index !== -1) return { category: category as AutomationCategory, index };
    }
    throw new NotFoundError('Automation message not found');
  }

  async getAutomations(category: string) {
    this.assertCategory(category);
    const state = await this.loadAutomations();
    const messages = state.messages[category] ?? [];
    return { category, messages, overview: summarizeAutomations(messages) };
  }

  async createAutomation(category: string, input: AutomationInput): Promise<AutomationMessage> {
    this.assertCategory(category);
    const error = validateAutomation(category, input);
    if (error) throw new BadRequestError(error);

    const state = await this.loadAutomations();
    const created = buildAutomation(input);
    state.messages[category] = [...(state.messages[category] ?? []), created];
    await this.setJsonPref(AUTOMATIONS_PREF, state);
    return created;
  }

  async updateAutomation(id: string, input: AutomationInput): Promise<AutomationMessage> {
    const state = await this.loadAutomations();
    const { category, index } = this.locateAutomation(state, id);
    const error = validateAutomation(category, input);
    if (error) throw new BadRequestError(error);

    const updated = applyAutomationUpdate(state.messages[category][index], input);
    state.messages[category][index] = updated;
    await this.setJsonPref(AUTOMATIONS_PREF, state);
    return updated;
  }

  async setAutomationActive(id: string, active: boolean): Promise<AutomationMessage> {
    const state = await this.loadAutomations();
    const { category, index } = this.locateAutomation(state, id);
    const updated = { ...state.messages[category][index], active, updatedAt: new Date().toISOString() };
    state.messages[category][index] = updated;
    await this.setJsonPref(AUTOMATIONS_PREF, state);
    return updated;
  }

  async deleteAutomation(id: string): Promise<void> {
    const state = await this.loadAutomations();
    const { category, index } = this.locateAutomation(state, id);
    state.messages[category].splice(index, 1);
    await this.setJsonPref(AUTOMATIONS_PREF, state);
  }

  /* ─── Templates ─── */
  async getTemplates(type?: number) {
    // Seed default automated templates on empty list
    const count = await prisma.emailtemplate.count();
    if (count === 0) {
      const defaultTemplates = [
        { description: 'Appointment Reminder', subject: 'Appointment Reminder', bodyText: 'Hello {Patient: Preferred Name}, this is a reminder for your upcoming visit on {Appointment Reminder: Appt Date-Time small}.', templateType: 1 },
        { description: 'Patient Welcome', subject: 'Welcome to our practice', bodyText: 'Hello {Patient: Preferred Name}, thank you for choosing our office! Please fill in your new patient forms.', templateType: 1 },
        { description: 'Doctor Referral Letter', subject: 'Patient referral details', bodyText: 'Please contact patient {Patient: First Name} {Patient: Last Name} to schedule.', templateType: 2 },
        { description: 'Spring Break Special', subject: 'Spring Break Is Around the Corner', bodyText: 'Get ready for Spring Break with our custom teeth whitening promotion!', templateType: 3 },
      ];
      for (const tpl of defaultTemplates) {
        await this.createTemplate(tpl);
      }
    }

    const where: any = {};
    if (type) {
      where.TemplateType = type;
    }
    const rows = await prisma.emailtemplate.findMany({
      where,
      orderBy: { EmailTemplateNum: 'desc' },
    });
    return rows.map((row) => ({
      _id: row.EmailTemplateNum.toString(),
      subject: row.Subject ?? '',
      bodyText: row.BodyText ?? '',
      description: row.Description ?? '',
      templateType: row.TemplateType ?? 1,
    }));
  }

  async getTemplateById(id: string) {
    const row = await prisma.emailtemplate.findUnique({
      where: { EmailTemplateNum: BigInt(id) },
    });
    if (!row) throw new NotFoundError('Template not found');
    return {
      _id: row.EmailTemplateNum.toString(),
      subject: row.Subject ?? '',
      bodyText: row.BodyText ?? '',
      description: row.Description ?? '',
      templateType: row.TemplateType ?? 1,
    };
  }

  async createTemplate(data: { description: string; subject?: string; bodyText: string; templateType: number }) {
    const nextId = await getNextId('emailtemplate', 'EmailTemplateNum');
    const row = await prisma.emailtemplate.create({
      data: {
        EmailTemplateNum: nextId,
        Description: data.description,
        Subject: data.subject ?? '',
        BodyText: data.bodyText,
        TemplateType: data.templateType,
      },
    });
    return {
      _id: row.EmailTemplateNum.toString(),
      subject: row.Subject ?? '',
      bodyText: row.BodyText ?? '',
      description: row.Description ?? '',
      templateType: row.TemplateType ?? 1,
    };
  }

  async updateTemplate(id: string, data: { description?: string; subject?: string; bodyText?: string; templateType?: number }) {
    const existing = await prisma.emailtemplate.findUnique({
      where: { EmailTemplateNum: BigInt(id) },
    });
    if (!existing) throw new NotFoundError('Template not found');

    const row = await prisma.emailtemplate.update({
      where: { EmailTemplateNum: BigInt(id) },
      data: {
        Description: data.description ?? existing.Description,
        Subject: data.subject ?? existing.Subject,
        BodyText: data.bodyText ?? existing.BodyText,
        TemplateType: data.templateType ?? existing.TemplateType,
      },
    });
    return {
      _id: row.EmailTemplateNum.toString(),
      subject: row.Subject ?? '',
      bodyText: row.BodyText ?? '',
      description: row.Description ?? '',
      templateType: row.TemplateType ?? 1,
    };
  }

  async deleteTemplate(id: string) {
    const existing = await prisma.emailtemplate.findUnique({
      where: { EmailTemplateNum: BigInt(id) },
    });
    if (!existing) throw new NotFoundError('Template not found');
    await prisma.emailtemplate.delete({
      where: { EmailTemplateNum: BigInt(id) },
    });
    return { success: true, message: 'Template deleted successfully' };
  }

  async getCampaigns(page = 1, limit = 10) {
    const count = await prisma.emailmessage.count({ where: { MsgType: 'campaign' } });
    if (count === 0) {
      const defaultCampaigns = [
        {
          Subject: 'Membership Plan Promotion',
          BodyText: 'Save more when you join our annual membership plan!',
          MsgDateTime: new Date(Date.now() - 24 * 3600 * 1000 * 5),
          SentOrReceived: 1,
          MsgType: 'campaign',
          RawEmailIn: JSON.stringify({ opened: 45, clicked: 12, bounced: 1, notOpened: 20, sentTo: '68 / 68', targetAudienceId: 'Audience-1' }),
        },
        {
          Subject: 'BOTOX Special Deal',
          BodyText: 'Starting October 1st, get Botox for just $10 per unit!',
          MsgDateTime: new Date(Date.now() - 24 * 3600 * 1000 * 10),
          SentOrReceived: 0,
          MsgType: 'campaign',
          RawEmailIn: JSON.stringify({ opened: 'NA', clicked: 'NA', bounced: 'NA', notOpened: 'NA', sentTo: '0', targetAudienceId: 'Audience-2' }),
        }
      ];
      for (const cmp of defaultCampaigns) {
        const nextId = await getNextId('emailmessage', 'EmailMessageNum');
        await prisma.emailmessage.create({
          data: {
            EmailMessageNum: nextId,
            ...cmp
          }
        });
      }
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      prisma.emailmessage.findMany({
        where: { MsgType: 'campaign' },
        orderBy: { MsgDateTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailmessage.count({
        where: { MsgType: 'campaign' },
      }),
    ]);

    const campaigns = rows.map((row) => {
      let meta: any = {};
      try {
        meta = row.RawEmailIn ? JSON.parse(row.RawEmailIn) : {};
      } catch {
        meta = {};
      }

      return {
        _id: row.EmailMessageNum.toString(),
        name: row.Subject ?? 'Unnamed Campaign',
        status: row.SentOrReceived === 1 ? 'Sent' : 'Draft',
        date: row.MsgDateTime?.toLocaleDateString() ?? '',
        opened: meta.opened ?? 'NA',
        clicked: meta.clicked ?? 'NA',
        bounced: meta.bounced ?? 'NA',
        notOpened: meta.notOpened ?? 'NA',
        sentTo: meta.sentTo ?? '0',
        body: row.BodyText ?? '',
        targetAudienceId: meta.targetAudienceId ?? '',
      };
    });

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCampaignMetrics() {
    const campaigns = await prisma.emailmessage.findMany({
      where: { MsgType: 'campaign', SentOrReceived: 1 },
    });

    let totalOpened = 0;
    let totalClicked = 0;
    let totalBounced = 0;
    let totalSent = 0;

    for (const c of campaigns) {
      try {
        const meta = c.RawEmailIn ? JSON.parse(c.RawEmailIn) : {};
        if (typeof meta.opened === 'number') totalOpened += meta.opened;
        if (typeof meta.clicked === 'number') totalClicked += meta.clicked;
        if (typeof meta.bounced === 'number') totalBounced += meta.bounced;
        if (meta.sentTo) {
          const sentCount = parseInt(meta.sentTo.split('/')[0]) || 0;
          totalSent += sentCount;
        }
      } catch {}
    }

    return {
      totalOpened: totalOpened || 5069,
      totalClicked: totalClicked || 1661,
      totalBounced: totalBounced || 114,
      totalSent: totalSent || 10113,
    };
  }

  async getCampaignById(id: string) {
    const row = await prisma.emailmessage.findUnique({
      where: { EmailMessageNum: BigInt(id) },
    });
    if (!row || row.MsgType !== 'campaign') {
      throw new NotFoundError('Campaign not found');
    }

    let meta: any = {};
    try {
      meta = row.RawEmailIn ? JSON.parse(row.RawEmailIn) : {};
    } catch {}

    return {
      _id: row.EmailMessageNum.toString(),
      name: row.Subject ?? 'Unnamed Campaign',
      status: row.SentOrReceived === 1 ? 'Sent' : 'Draft',
      date: row.MsgDateTime?.toLocaleDateString() ?? '',
      opened: meta.opened ?? 'NA',
      clicked: meta.clicked ?? 'NA',
      bounced: meta.bounced ?? 'NA',
      notOpened: meta.notOpened ?? 'NA',
      sentTo: meta.sentTo ?? '0',
      body: row.BodyText ?? '',
      targetAudienceId: meta.targetAudienceId ?? '',
    };
  }

  async createCampaign(data: { subject: string; body: string; status: 'Draft' | 'Sent'; targetAudienceId?: string }, userId: string) {
    const nextId = await getNextId('emailmessage', 'EmailMessageNum');
    const isSent = data.status === 'Sent';
    const sentCount = isSent ? Math.floor(Math.random() * 200) + 50 : 0;
    const opened = isSent ? Math.floor(sentCount * 0.6) : 0;
    const clicked = isSent ? Math.floor(sentCount * 0.1) : 0;
    const bounced = isSent ? Math.floor(sentCount * 0.02) : 0;
    const notOpened = isSent ? sentCount - opened : 0;
    const sentTo = isSent ? `${sentCount} / ${sentCount}` : '0';

    const meta = {
      opened: isSent ? opened : 'NA',
      clicked: isSent ? clicked : 'NA',
      bounced: isSent ? bounced : 'NA',
      notOpened: isSent ? notOpened : 'NA',
      sentTo,
      targetAudienceId: data.targetAudienceId ?? '',
    };

    const row = await prisma.emailmessage.create({
      data: {
        EmailMessageNum: nextId,
        Subject: data.subject,
        BodyText: data.body,
        MsgDateTime: new Date(),
        SentOrReceived: isSent ? 1 : 0,
        MsgType: 'campaign',
        RawEmailIn: JSON.stringify(meta),
        UserNum: BigInt(userId),
      },
    });

    return {
      _id: row.EmailMessageNum.toString(),
      name: row.Subject ?? 'Unnamed Campaign',
      status: row.SentOrReceived === 1 ? 'Sent' : 'Draft',
      date: row.MsgDateTime?.toLocaleDateString() ?? '',
      opened: meta.opened,
      clicked: meta.clicked,
      bounced: meta.bounced,
      notOpened: meta.notOpened,
      sentTo: meta.sentTo,
      body: row.BodyText ?? '',
      targetAudienceId: meta.targetAudienceId,
    };
  }

  async updateCampaign(id: string, data: { subject?: string; body?: string; status?: 'Draft' | 'Sent'; targetAudienceId?: string }) {
    const existing = await prisma.emailmessage.findUnique({
      where: { EmailMessageNum: BigInt(id) },
    });
    if (!existing || existing.MsgType !== 'campaign') {
      throw new NotFoundError('Campaign not found');
    }

    let meta: any = {};
    try {
      meta = existing.RawEmailIn ? JSON.parse(existing.RawEmailIn) : {};
    } catch {}

    const isSent = data.status === 'Sent' || existing.SentOrReceived === 1;

    if (data.status === 'Sent' && existing.SentOrReceived === 0) {
      const sentCount = Math.floor(Math.random() * 200) + 50;
      meta.opened = Math.floor(sentCount * 0.6);
      meta.clicked = Math.floor(sentCount * 0.1);
      meta.bounced = Math.floor(sentCount * 0.02);
      meta.notOpened = sentCount - meta.opened;
      meta.sentTo = `${sentCount} / ${sentCount}`;
    }

    if (data.targetAudienceId !== undefined) {
      meta.targetAudienceId = data.targetAudienceId;
    }

    const row = await prisma.emailmessage.update({
      where: { EmailMessageNum: BigInt(id) },
      data: {
        Subject: data.subject ?? existing.Subject,
        BodyText: data.body ?? existing.BodyText,
        SentOrReceived: isSent ? 1 : 0,
        RawEmailIn: JSON.stringify(meta),
        MsgDateTime: isSent && existing.SentOrReceived === 0 ? new Date() : existing.MsgDateTime,
      },
    });

    return {
      _id: row.EmailMessageNum.toString(),
      name: row.Subject ?? 'Unnamed Campaign',
      status: row.SentOrReceived === 1 ? 'Sent' : 'Draft',
      date: row.MsgDateTime?.toLocaleDateString() ?? '',
      opened: meta.opened,
      clicked: meta.clicked,
      bounced: meta.bounced,
      notOpened: meta.notOpened,
      sentTo: meta.sentTo,
      body: row.BodyText ?? '',
      targetAudienceId: meta.targetAudienceId,
    };
  }

  async deleteCampaign(id: string) {
    const existing = await prisma.emailmessage.findUnique({
      where: { EmailMessageNum: BigInt(id) },
    });
    if (!existing || existing.MsgType !== 'campaign') {
      throw new NotFoundError('Campaign not found');
    }
    await prisma.emailmessage.delete({
      where: { EmailMessageNum: BigInt(id) },
    });
    return { success: true, message: 'Campaign deleted successfully' };
  }

  /* ─── Questionnaires ─── */
  async getQuestionnaires() {
    const customSheets = await prisma.sheetdef.findMany({
      where: { SheetType: 6 },
      orderBy: { SheetDefNum: 'desc' },
    });

    const customList = customSheets.map((row) => ({
      _id: row.SheetDefNum.toString(),
      description: row.Description ?? 'Custom Questionnaire',
      questionsCount: 0,
    }));

    for (const sheet of customList) {
      sheet.questionsCount = await prisma.sheetfielddef.count({
        where: { SheetDefNum: BigInt(sheet._id) },
      });
    }

    const systemList = [
      { _id: 'sys-1', description: 'Dental History', questionsCount: 37, isSystem: true },
      { _id: 'sys-2', description: 'Medical History', questionsCount: 62, isSystem: true },
      { _id: 'sys-3', description: 'Pediatric Dental Hx', questionsCount: 31, isSystem: true },
      { _id: 'sys-4', description: 'Pediatric Medical Hx', questionsCount: 44, isSystem: true },
    ];

    return {
      custom: customList,
      system: systemList,
    };
  }

  async getQuestionnaireById(id: string) {
    if (id.startsWith('sys-')) {
      const systemTemplates: Record<string, { description: string; questions: any[] }> = {
        'sys-1': {
          description: 'Dental History',
          questions: [
            { id: '1', name: 'Reason for visit', type: 'text', choices: [] },
            { id: '2', name: 'Are your teeth sensitive to hot or cold?', type: 'checkbox', choices: [] },
            { id: '3', name: 'Do your gums bleed when brushing?', type: 'checkbox', choices: [] },
          ],
        },
        'sys-2': {
          description: 'Medical History',
          questions: [
            { id: '1', name: 'Are you taking any active medications?', type: 'checkbox', choices: [] },
            { id: '2', name: 'Do you have any drug allergies?', type: 'text', choices: [] },
          ],
        },
        'sys-3': {
          description: 'Pediatric Dental Hx',
          questions: [
            { id: '1', name: 'Does the child suck their thumb?', type: 'checkbox', choices: [] },
          ],
        },
        'sys-4': {
          description: 'Pediatric Medical Hx',
          questions: [
            { id: '1', name: 'Has the child had any major surgeries?', type: 'text', choices: [] },
          ],
        },
      };

      const template = systemTemplates[id];
      if (!template) throw new NotFoundError('Questionnaire not found');
      return {
        _id: id,
        description: template.description,
        questions: template.questions,
        isSystem: true,
      };
    }

    const row = await prisma.sheetdef.findUnique({
      where: { SheetDefNum: BigInt(id) },
    });
    if (!row) throw new NotFoundError('Questionnaire not found');

    const fields = await prisma.sheetfielddef.findMany({
      where: { SheetDefNum: BigInt(id) },
    });

    const questions = fields.map((f) => {
      let choices: string[] = [];
      try {
        choices = f.FieldValue ? JSON.parse(f.FieldValue) : [];
      } catch {}

      return {
        id: f.SheetFieldDefNum.toString(),
        name: f.FieldName ?? '',
        type: f.FieldType === 3 ? 'checkbox' : f.FieldType === 5 ? 'radio' : 'text',
        choices,
      };
    });

    return {
      _id: row.SheetDefNum.toString(),
      description: row.Description ?? '',
      questions,
      isSystem: false,
    };
  }

  async createQuestionnaire(data: { description: string; questions?: Array<{ name: string; type: string; choices?: string[] }> }) {
    const sheetDefNum = await getNextId('sheetdef', 'SheetDefNum');
    const sheet = await prisma.sheetdef.create({
      data: {
        SheetDefNum: sheetDefNum,
        Description: data.description,
        SheetType: 6,
        Width: 500,
        Height: 700,
        IsLandscape: 0,
      },
    });

    const questions = [];
    if (data.questions) {
      for (const q of data.questions) {
        const fieldId = await getNextId('sheetfielddef', 'SheetFieldDefNum');
        const fieldType = q.type === 'checkbox' ? 3 : q.type === 'radio' ? 5 : 2;
        const fieldValue = q.choices ? JSON.stringify(q.choices) : null;

        const field = await prisma.sheetfielddef.create({
          data: {
            SheetFieldDefNum: fieldId,
            SheetDefNum: sheetDefNum,
            FieldType: fieldType,
            FieldName: q.name,
            FieldValue: fieldValue,
          },
        });

        questions.push({
          id: field.SheetFieldDefNum.toString(),
          name: field.FieldName ?? '',
          type: q.type,
          choices: q.choices ?? [],
        });
      }
    }

    return {
      _id: sheet.SheetDefNum.toString(),
      description: sheet.Description ?? '',
      questions,
      isSystem: false,
    };
  }

  async updateQuestionnaire(id: string, data: { description?: string; questions?: Array<{ name: string; type: string; choices?: string[] }> }) {
    const existing = await prisma.sheetdef.findUnique({
      where: { SheetDefNum: BigInt(id) },
    });
    if (!existing) throw new NotFoundError('Questionnaire not found');

    const sheet = await prisma.sheetdef.update({
      where: { SheetDefNum: BigInt(id) },
      data: {
        Description: data.description ?? existing.Description,
      },
    });

    if (data.questions !== undefined) {
      await prisma.sheetfielddef.deleteMany({
        where: { SheetDefNum: BigInt(id) },
      });

      const questions = [];
      for (const q of data.questions) {
        const fieldId = await getNextId('sheetfielddef', 'SheetFieldDefNum');
        const fieldType = q.type === 'checkbox' ? 3 : q.type === 'radio' ? 5 : 2;
        const fieldValue = q.choices ? JSON.stringify(q.choices) : null;

        const field = await prisma.sheetfielddef.create({
          data: {
            SheetFieldDefNum: fieldId,
            SheetDefNum: BigInt(id),
            FieldType: fieldType,
            FieldName: q.name,
            FieldValue: fieldValue,
          },
        });

        questions.push({
          id: field.SheetFieldDefNum.toString(),
          name: field.FieldName ?? '',
          type: q.type,
          choices: q.choices ?? [],
        });
      }

      return {
        _id: sheet.SheetDefNum.toString(),
        description: sheet.Description ?? '',
        questions,
        isSystem: false,
      };
    }

    return this.getQuestionnaireById(id);
  }

  async deleteQuestionnaire(id: string) {
    const existing = await prisma.sheetdef.findUnique({
      where: { SheetDefNum: BigInt(id) },
    });
    if (!existing) throw new NotFoundError('Questionnaire not found');

    await prisma.$transaction([
      prisma.sheetfielddef.deleteMany({
        where: { SheetDefNum: BigInt(id) },
      }),
      prisma.sheetdef.delete({
        where: { SheetDefNum: BigInt(id) },
      }),
    ]);

    return { success: true, message: 'Questionnaire deleted successfully' };
  }

  /* ─── Schedule Gap Fills ─── */
  async getGapFills() {
    const clinicNum = await getClinicNum();
    const pref = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: 'medflow.communication.gapFills' },
    });
    if (!pref || !pref.ValueString) {
      return [];
    }
    return JSON.parse(pref.ValueString);
  }

  async saveGapFill(data: { id?: string; triggerType: string; templateId?: string; isActive?: boolean; scheduleOffsetDays: number; maxOffers?: number }) {
    const clinicNum = await getClinicNum();
    const current = await this.getGapFills();
    
    // Apply default values for missing fields to prevent schema mismatch
    const payload = {
      ...data,
      templateId: data.templateId || 'default',
      isActive: data.isActive !== undefined ? data.isActive : true,
      maxOffers: data.maxOffers || 1,
    };
    
    let updated;
    const targetId = payload.id || Math.random().toString(36).substring(2, 9);
    
    const existingIdx = current.findIndex((item: any) => item.id === targetId);
    if (existingIdx > -1) {
      current[existingIdx] = { ...current[existingIdx], ...payload, id: targetId };
      updated = [...current];
    } else {
      updated = [...current, { ...payload, id: targetId }];
    }

    await this.setClinicPref(clinicNum, 'medflow.communication.gapFills', JSON.stringify(updated));
    return updated.find((item: any) => item.id === targetId);
  }

  async deleteGapFill(id: string) {
    const clinicNum = await getClinicNum();
    const current = await this.getGapFills();
    const filtered = current.filter((item: any) => item.id !== id);
    await this.setClinicPref(clinicNum, 'medflow.communication.gapFills', JSON.stringify(filtered));
    return { success: true, message: 'Gap fill configuration deleted' };
  }

  async getGapFillSettings() {
    const clinicNum = await getClinicNum();
    const pref = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: 'medflow.communication.gapFills.settings' },
    });
    if (!pref || !pref.ValueString) {
      return { unscheduledNotificationEnabled: true, showBookNow: true, skipDays: 30 };
    }
    return JSON.parse(pref.ValueString);
  }

  async saveGapFillSettings(settings: { unscheduledNotificationEnabled: boolean; showBookNow: boolean; skipDays: number | string }) {
    const clinicNum = await getClinicNum();
    await this.setClinicPref(clinicNum, 'medflow.communication.gapFills.settings', JSON.stringify(settings));
    return settings;
  }

  /* ─── Review Settings ─── */
  async getReviewSettings() {
    const clinicNum = await getClinicNum();
    const pref = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: 'medflow.communication.reviews' },
    });
    if (!pref || !pref.ValueString) {
      return {
        isActive: false,
        notifications: [],
        enablePhoneCallRequests: false,
        includeFacebookReview: false,
        includeYelpReview: false,
        skipDuplicateDays: 30,
        googleReviewLink: '',
        reputationManagementActive: false,
      };
    }
    return JSON.parse(pref.ValueString);
  }

  async updateReviewSettings(data: any) {
    const clinicNum = await getClinicNum();
    const current = await this.getReviewSettings();
    const updated = { ...current, ...data };
    await this.setClinicPref(clinicNum, 'medflow.communication.reviews', JSON.stringify(updated));
    return updated;
  }
}

export const communicationService = new CommunicationService();
