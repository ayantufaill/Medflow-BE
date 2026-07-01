import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { NotFoundError, UnprocessableEntityError, NotImplementedError} from '../utils/error.util';

const parseJson = (value?: string | null): any => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const buildJson = (value: any) => JSON.stringify(value);

export class ProgressNoteService {
  async getAllProgressNotes(filters: { patientId?: string; category?: string; tab?: string }, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) {
      where.PatNum = BigInt(filters.patientId);
    }
    
    // We only fetch notes that have noteType/category
    where.Note = { contains: '"isProgressNote":true' };

    const [rows, total] = await Promise.all([
      prisma.commlog.findMany({
        where,
        orderBy: { CommDateTime: 'desc' },
      }),
      prisma.commlog.count({ where })
    ]);

    // Fetch providers manually to map names since Commlog doesn't have a direct FK to provider in this schema design.
    // Instead, the provider ID is saved in the Note payload.
    const providerIds = new Set<string>();
    rows.forEach(row => {
      const meta = parseJson(row.Note);
      if (meta.providerId) providerIds.add(meta.providerId);
    });

    const providers = providerIds.size > 0 
      ? await prisma.provider.findMany({ where: { ProvNum: { in: Array.from(providerIds).map(id => BigInt(id)) } } })
      : [];
      
    const providerMap = new Map();
    providers.forEach(p => {
      providerMap.set(p.ProvNum.toString(), `${p.FName} ${p.LName}`.trim());
    });

    let notes = rows.map((row: any) => {
      const meta = parseJson(row.Note);
      const providerName = meta.providerId ? providerMap.get(meta.providerId) || 'Unknown Provider' : 'Unknown Provider';
      
      return {
        id: row.CommlogNum.toString(),
        date: row.CommDateTime,
        procedures: meta.procedures || [],
        description: meta.description || '',
        provider: providerName,
        signedBy: meta.signedBy || providerName,
        signedDate: meta.signedDate || row.CommDateTime,
        category: meta.category || 'General Notes',
        isExpanded: false
      };
    });

    if (filters.category && filters.category !== 'All') {
      notes = notes.filter(n => n.category === filters.category);
    }

    if (filters.tab === 'Archived') {
      notes = notes.filter(n => parseJson(rows.find(r => r.CommlogNum.toString() === n.id)?.Note).isArchived);
    } else {
      notes = notes.filter(n => !parseJson(rows.find(r => r.CommlogNum.toString() === n.id)?.Note).isArchived);
    }

    return {
      notes: notes.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total: notes.length,
        pages: Math.ceil(notes.length / limit)
      }
    };
  }

  async createProgressNote(data: { patientId: string; category: string; description: string; providerId: string }) {
    const commlogNum = await getNextId('commlog', 'CommlogNum');
    
    // Fetch provider name for signature
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(data.providerId) }
    });
    const providerName = provider ? `${provider.FName} ${provider.LName}`.trim() : 'Unknown Provider';

    const meta = {
      isProgressNote: true,
      category: data.category,
      description: data.description,
      providerId: data.providerId,
      procedures: [],
      signedBy: providerName,
      signedDate: new Date().toISOString(),
      isArchived: false
    };

    const row = await prisma.commlog.create({
      data: {
        CommlogNum: commlogNum,
        PatNum: BigInt(data.patientId),
        CommDateTime: new Date(),
        Note: buildJson(meta),
        UserNum: null,
      }
    });

    return {
      id: row.CommlogNum.toString(),
      date: row.CommDateTime,
      procedures: meta.procedures,
      description: meta.description,
      provider: providerName,
      signedBy: meta.signedBy,
      signedDate: meta.signedDate,
      category: meta.category,
      isExpanded: true
    };
  }

  async addProcedureToNote(noteId: string, procedureCode: string) {
    const note = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(noteId) }
    });

    if (!note) {
      throw new NotFoundError('Progress note not found');
    }

    const meta = parseJson(note.Note);

    if (!meta.isProgressNote) {
    throw new Error('This is not a progress note');
  }

  // Sign/lock immutability guard — cannot add procedures to a signed note
  if (meta.status === 'signed') {
    throw new UnprocessableEntityError('Cannot add procedures to a signed progress note');
  }
    
    if (!meta.procedures) {
      meta.procedures = [];
    }
    meta.procedures.push(procedureCode);

    await prisma.commlog.update({
      where: { CommlogNum: BigInt(noteId) },
      data: { Note: buildJson(meta) }
    });

    return { message: 'Procedure added successfully', procedures: meta.procedures };
  }
  
  async updateProgressNote(
  noteId: string, 
  data: { description?: string; category?: string }
) {
  // 1. Check if note exists
  const note = await prisma.commlog.findUnique({
    where: { CommlogNum: BigInt(noteId) }
  });

  if (!note) {
    throw new NotFoundError('Progress note not found');
  }

  // 2. Parse existing meta data
  const meta = parseJson(note.Note);
  
  // 3. Ensure it's a progress note
  if (!meta.isProgressNote) {
    throw new Error('This is not a progress note');
  }
  if (meta.status === 'signed') {
    throw new UnprocessableEntityError('Cannot edit a signed progress note');
  }

  // 4. Update only the fields provided
  if (data.description !== undefined) {
    meta.description = data.description;
  }
  
  if (data.category !== undefined) {
    meta.category = data.category;
  }

  // 5. Update the note
  const updatedNote = await prisma.commlog.update({
    where: { CommlogNum: BigInt(noteId) },
    data: {
      Note: buildJson(meta),
      CommDateTime: new Date() // Update timestamp
    }
  });

  // 6. Get provider name
  const providerName = meta.providerId 
    ? await this.getProviderName(meta.providerId)
    : 'Unknown Provider';

  // 7. Return formatted response
  return {
    id: updatedNote.CommlogNum.toString(),
    date: updatedNote.CommDateTime,
    procedures: meta.procedures || [],
    description: meta.description || '',
    provider: providerName,
    signedBy: meta.signedBy || providerName,
    signedDate: meta.signedDate || updatedNote.CommDateTime,
    category: meta.category || 'General Notes',
    isExpanded: true
  };
}

// Helper method to get provider name
private async getProviderName(providerId: string): Promise<string> {
  try {
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) }
    });
    return provider ? `${provider.FName} ${provider.LName}`.trim() : 'Unknown Provider';
  } catch {
    return 'Unknown Provider';
  }
}
async archiveProgressNote(noteId: string) {
  // 1. Check if note exists
  const note = await prisma.commlog.findUnique({
    where: { CommlogNum: BigInt(noteId) }
  });

  if (!note) {
    throw new NotFoundError('Progress note not found');
  }

  // 2. Parse existing meta data
  const meta = parseJson(note.Note);
  
  // 3. Ensure it's a progress note
  if (!meta.isProgressNote) {
    throw new Error('This is not a progress note');
  }

  // 4. Set isArchived to true
  meta.isArchived = true;

  // 5. Update the note
  const updatedNote = await prisma.commlog.update({
    where: { CommlogNum: BigInt(noteId) },
    data: {
      Note: buildJson(meta),
      CommDateTime: new Date()
    }
  });

  // 6. Get provider name
  const providerName = meta.providerId 
    ? await this.getProviderName(meta.providerId)
    : 'Unknown Provider';

  // 7. Return formatted response
  return {
    id: updatedNote.CommlogNum.toString(),
    date: updatedNote.CommDateTime,
    procedures: meta.procedures || [],
    description: meta.description || '',
    provider: providerName,
    signedBy: meta.signedBy || providerName,
    signedDate: meta.signedDate || updatedNote.CommDateTime,
    category: meta.category || 'General Notes',
    isArchived: meta.isArchived || false,
    isExpanded: true
  };
}

async unarchiveProgressNote(noteId: string) {
  // 1. Check if note exists
  const note = await prisma.commlog.findUnique({
    where: { CommlogNum: BigInt(noteId) }
  });

  if (!note) {
    throw new NotFoundError('Progress note not found');
  }

  // 2. Parse existing meta data
  const meta = parseJson(note.Note);
  
  // 3. Ensure it's a progress note
  if (!meta.isProgressNote) {
    throw new Error('This is not a progress note');
  }

  // 4. Set isArchived to false
  meta.isArchived = false;

  // 5. Update the note
  const updatedNote = await prisma.commlog.update({
    where: { CommlogNum: BigInt(noteId) },
    data: {
      Note: buildJson(meta),
      CommDateTime: new Date()
    }
  });

  // 6. Get provider name
  const providerName = meta.providerId 
    ? await this.getProviderName(meta.providerId)
    : 'Unknown Provider';

  // 7. Return formatted response
  return {
    id: updatedNote.CommlogNum.toString(),
    date: updatedNote.CommDateTime,
    procedures: meta.procedures || [],
    description: meta.description || '',
    provider: providerName,
    signedBy: meta.signedBy || providerName,
    signedDate: meta.signedDate || updatedNote.CommDateTime,
    category: meta.category || 'General Notes',
    isArchived: meta.isArchived || false,
    isExpanded: true
  };
}
async signProgressNote(
  noteId: string, 
  data: { signedBy: string; signedDate: string }
) {
  // 1. Check if note exists
  const note = await prisma.commlog.findUnique({
    where: { CommlogNum: BigInt(noteId) }
  });

  if (!note) {
    throw new NotFoundError('Progress note not found');
  }

  // 2. Parse existing meta data
  const meta = parseJson(note.Note);
  
  // 3. Ensure it's a progress note
  if (!meta.isProgressNote) {
    throw new Error('This is not a progress note');
  }

  // 4. Update signedBy and signedDate
  meta.signedBy = data.signedBy;
  meta.signedDate = data.signedDate;
  
  // Optionally update status to 'signed' if you have a status field
  meta.status = 'signed';

  // 5. Update the note
  const updatedNote = await prisma.commlog.update({
    where: { CommlogNum: BigInt(noteId) },
    data: {
      Note: buildJson(meta),
      CommDateTime: new Date()
    }
  });

  // 6. Get provider name
  const providerName = meta.providerId 
    ? await this.getProviderName(meta.providerId)
    : 'Unknown Provider';

  // 7. Return formatted response
  return {
    id: updatedNote.CommlogNum.toString(),
    date: updatedNote.CommDateTime,
    procedures: meta.procedures || [],
    description: meta.description || '',
    provider: providerName,
    signedBy: meta.signedBy || providerName,
    signedDate: meta.signedDate || updatedNote.CommDateTime,
    category: meta.category || 'General Notes',
    isArchived: meta.isArchived || false,
    status: meta.status || 'signed',
    isExpanded: true
  };
}

async exportProgressNoteToPdf(noteId: string): Promise<Buffer> {
  const note = await prisma.commlog.findUnique({
    where: { CommlogNum: BigInt(noteId) }
  });

  if (!note) {
    throw new NotFoundError('Progress note not found');
  }

  const meta = parseJson(note.Note);

  if (!meta.isProgressNote) {
    throw new Error('This is not a progress note');
  }

  // Guard: only attempt generation if pdf-lib actually loads
  let pdfLibModule: typeof import('pdf-lib');
  try {
    pdfLibModule = await import('pdf-lib');
  } catch {
    throw new NotImplementedError(
      'PDF export is currently unavailable: PDF generation library failed to load'
    );
  }

  const { PDFDocument, StandardFonts, rgb } = pdfLibModule;

  const providerName = meta.providerId
    ? await this.getProviderName(meta.providerId)
    : 'Unknown Provider';

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 740;
  const drawLine = (text: string, opts: { bold?: boolean; size?: number } = {}) => {
    const size = opts.size || 11;
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: opts.bold ? boldFont : font,
      color: rgb(0, 0, 0)
    });
    y -= size + 10;
  };

  drawLine('Progress Note', { bold: true, size: 18 });
  drawLine(`Note ID: ${noteId}`);
  drawLine(`Date: ${note.CommDateTime ? new Date(note.CommDateTime).toLocaleString() : 'Unknown'}`);
  drawLine(`Category: ${meta.category || 'General Notes'}`);
  drawLine(`Provider: ${providerName}`);
  drawLine('Description:', { bold: true });
  drawLine(meta.description || '(no description)');

  if (meta.procedures?.length) {
    drawLine(`Procedures: ${meta.procedures.join(', ')}`);
  }

  drawLine(`Status: ${meta.status === 'signed' ? 'Signed' : 'Unsigned'}`, { bold: true });
  if (meta.status === 'signed') {
    drawLine(`Signed By: ${meta.signedBy || providerName}`);
    drawLine(`Signed Date: ${meta.signedDate ? new Date(meta.signedDate).toLocaleString() : ''}`);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

}

export const progressNoteService = new ProgressNoteService();
