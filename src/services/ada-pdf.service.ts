import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export class AdaPdfService {
  /**
   * Generates a filled ADA 2024 claim form PDF programmatically
   */
  async generateAdaPdf(claimData: any): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    
    // Page dimensions for standard Letter size: 612 x 792 points
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const form = pdfDoc.getForm();

    // 1. Draw Mock ADA Layout Grid & Borders
    // Main boundary box
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 572,
      height: 752,
      borderWidth: 1.5,
      borderColor: rgb(0, 0, 0),
    });

    // Form Title Header
    page.drawText('ADA Dental Claim Form', { x: 30, y: 750, size: 14, font: boldFont });
    page.drawText('HEADER / GENERAL INFORMATION', { x: 30, y: 730, size: 9, font: boldFont });

    // Section Dividers
    const drawDivider = (y: number, label: string) => {
      page.drawLine({ start: { x: 20, y }, end: { x: 592, y }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawText(label, { x: 30, y: y - 12, size: 9, font: boldFont });
    };

    // Divider lines
    drawDivider(720, 'INSURANCE COMPANY & POLICY HOLDER (SUBSCRIBER) DETAILS');
    drawDivider(600, 'PATIENT & RELATIONSHIP DETAILS');
    drawDivider(480, 'RECORD OF SERVICES PROVIDED (PROCEDURES)');
    drawDivider(220, 'BILLING PROVIDER & TREATMENT DENTIST');

    // 2. Helper to add fillable form text fields with descriptive labels
    const addField = (fieldName: string, x: number, y: number, width: number, height: number, labelText: string, defaultValue = '') => {
      // Draw small label text above/inside the field box
      page.drawText(labelText, {
        x: x + 2,
        y: y + height - 8,
        size: 6,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      const textField = form.createTextField(fieldName);
      textField.setText(defaultValue);
      textField.addToPage(page, {
        x: x + 2,
        y: y + 2,
        width: width - 4,
        height: height - 12,
        font,
        borderWidth: 0.5,
        borderColor: rgb(0.7, 0.7, 0.7),
      });
      return textField;
    };

    // 3. Map Patient / Subscriber / Carrier data into boxes
    const patient = claimData.patient || {};
    const carrier = claimData.carrier || {};
    const subscriber = claimData.subscriber || {};
    const insPlan = claimData.insPlan || {};
    const provider = claimData.provider || {};

    // Subscriber Details (Y: 610-705)
    const subName = `${subscriber.FName || ''} ${subscriber.LName || ''}`.trim() || `${patient.FName || ''} ${patient.LName || ''}`.trim();
    addField('SubscriberName_Box12', 30, 660, 200, 25, '12. SUBSCRIBER NAME', subName);
    addField('SubscriberID_Box15', 240, 660, 150, 25, '15. SUBSCRIBER ID', claimData.insSubNum || 'N/A');
    addField('CarrierName_Box2', 400, 660, 180, 25, '2. PRIMARY CARRIER NAME', carrier.CarrierName || 'N/A');

    // Patient Details (Y: 490-585)
    const patName = `${patient.FName || ''} ${patient.LName || ''}`.trim();
    addField('PatientName_Box20', 30, 540, 200, 25, '20. PATIENT NAME', patName);
    addField('PatientDOB_Box21', 240, 540, 150, 25, '21. PATIENT DATE OF BIRTH', patient.Birthdate ? new Date(patient.Birthdate).toLocaleDateString() : 'N/A');
    addField('PatientGender_Box22', 400, 540, 180, 25, '22. GENDER', patient.Gender === 1 ? 'Male' : patient.Gender === 2 ? 'Female' : 'Unknown');

    // 4. Record of Services / Procedures Grid
    // Table Headers
    page.drawText('Date of Service', { x: 32, y: 462, size: 7, font: boldFont });
    page.drawText('Tooth', { x: 142, y: 462, size: 7, font: boldFont });
    page.drawText('Surf', { x: 192, y: 462, size: 7, font: boldFont });
    page.drawText('CDT Code', { x: 232, y: 462, size: 7, font: boldFont });
    page.drawText('Description', { x: 302, y: 462, size: 7, font: boldFont });
    page.drawText('Fee', { x: 502, y: 462, size: 7, font: boldFont });

    const procList = claimData.procedures || [];
    for (let i = 0; i < 5; i += 1) {
      const yOffset = 430 - i * 35;
      const proc = procList[i] || {};

      // Draw rows
      addField(`ProcDate_Line${i + 1}`, 30, yOffset, 100, 25, `Date (Line ${i + 1})`, proc.date || '');
      addField(`ProcTooth_Line${i + 1}`, 140, yOffset, 40, 25, `Tooth`, proc.tooth || '');
      addField(`ProcSurf_Line${i + 1}`, 190, yOffset, 30, 25, `Surf`, proc.surface || '');
      addField(`ProcCode_Line${i + 1}`, 230, yOffset, 60, 25, `CDT Code`, proc.code || '');
      addField(`ProcDesc_Line${i + 1}`, 300, yOffset, 190, 25, `Description`, proc.description || '');
      addField(`ProcFee_Line${i + 1}`, 500, yOffset, 80, 25, `Fee`, proc.fee ? `$${proc.fee.toFixed(2)}` : '');
    }

    // Total Fee
    addField('TotalFee_Box32', 500, 230, 80, 25, '32. TOTAL FEE', claimData.claimFee ? `$${claimData.claimFee.toFixed(2)}` : '$0.00');

    // 5. Billing Provider & Treatment Dentist Details
    const provName = `${provider.FName || ''} ${provider.LName || ''}`.trim() || 'SeedBiller';
    addField('BillingProvider_Box33', 30, 160, 250, 45, '33. BILLING PROVIDER INFO', `${provName}\nMedFlow Clinic\nDallas, TX`);
    addField('TreatingDentist_Box48', 310, 160, 270, 45, '48. TREATING DENTIST SIGNATURE', `${provName}\nNPI: ${provider.ProvNum ? provider.ProvNum.toString() : 'N/A'}`);

    // Footer info
    page.drawText('ADA 2024 Dental Claim Form - Programmatic PDF Generation via pdf-lib', {
      x: 30,
      y: 35,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Flatten form or keep interactive - keeping interactive so clinic can type modifications
    return pdfDoc.save();
  }
}

export const adaPdfService = new AdaPdfService();
