import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const procedureCodes = [
  { code: 'D0120', desc: 'Periodic oral evaluation', abbr: 'Periodic exam', cat: 'Diagnostic' },
  { code: 'D0140', desc: 'Limited oral evaluation', abbr: 'Limited exam', cat: 'Diagnostic' },
  { code: 'D0150', desc: 'Comprehensive oral evaluation', abbr: 'Comp exam', cat: 'Diagnostic' },
  { code: 'D0160', desc: 'Detailed and extensive oral evaluation', abbr: 'Detailed exam', cat: 'Diagnostic' },
  { code: 'D0170', desc: 'Re-evaluation, limited problem focused', abbr: 'Re-eval', cat: 'Diagnostic' },
  { code: 'D0180', desc: 'Comprehensive periodontal evaluation', abbr: 'Perio eval', cat: 'Diagnostic' },
  { code: 'D0190', desc: 'Screening of a patient', abbr: 'Screening', cat: 'Diagnostic' },
  { code: 'D0210', desc: 'Intraoral - complete series of radiographic images', abbr: 'FMX', cat: 'Diagnostic' },
  { code: 'D0220', desc: 'Intraoral - periapical first radiographic image', abbr: 'PA first', cat: 'Diagnostic' },
  { code: 'D0230', desc: 'Intraoral - periapical each additional image', abbr: 'PA addl', cat: 'Diagnostic' },
  { code: 'D0240', desc: 'Intraoral - occlusal radiographic image', abbr: 'Occlusal', cat: 'Diagnostic' },
  { code: 'D0250', desc: 'Extra-oral - 2D projection radiographic image', abbr: 'Extraoral 2D', cat: 'Diagnostic' },
  { code: 'D0270', desc: 'Bitewing - single radiographic image', abbr: 'BW single', cat: 'Diagnostic' },
  { code: 'D0272', desc: 'Bitewings - two radiographic images', abbr: 'BW 2', cat: 'Diagnostic' },
  { code: 'D0273', desc: 'Bitewings - three radiographic images', abbr: 'BW 3', cat: 'Diagnostic' },
  { code: 'D0274', desc: 'Bitewings - four radiographic images', abbr: 'BW 4', cat: 'Diagnostic' },
  { code: 'D0277', desc: 'Vertical bitewings - 7 to 8 radiographic images', abbr: 'Vert BW', cat: 'Diagnostic' },
  { code: 'D0330', desc: 'Panoramic radiographic image', abbr: 'Panoramic', cat: 'Diagnostic' },
  { code: 'D0340', desc: 'Cephalometric radiographic image', abbr: 'Cephalometric', cat: 'Diagnostic' },
  { code: 'D0350', desc: 'Oral/facial photographic images', abbr: 'Photo images', cat: 'Diagnostic' },
  { code: 'D0364', desc: 'Cone beam CT capture', abbr: 'CBCT capture', cat: 'Diagnostic' },
  { code: 'D0470', desc: 'Diagnostic casts', abbr: 'Diagnostic casts', cat: 'Diagnostic' },
  { code: 'D1110', desc: 'Prophylaxis - adult', abbr: 'Adult cleaning', cat: 'Preventive' },
  { code: 'D1120', desc: 'Prophylaxis - child', abbr: 'Child cleaning', cat: 'Preventive' },
  { code: 'D1206', desc: 'Topical application of fluoride varnish', abbr: 'Fluoride varnish', cat: 'Preventive' },
  { code: 'D1208', desc: 'Topical application of fluoride', abbr: 'Fluoride', cat: 'Preventive' },
  { code: 'D1310', desc: 'Nutritional counseling', abbr: 'Nutrition counsel', cat: 'Preventive' },
  { code: 'D1320', desc: 'Tobacco counseling', abbr: 'Tobacco counsel', cat: 'Preventive' },
  { code: 'D1330', desc: 'Oral hygiene instructions', abbr: 'OHI', cat: 'Preventive' },
  { code: 'D1351', desc: 'Sealant - per tooth', abbr: 'Sealant', cat: 'Preventive' },
  { code: 'D1352', desc: 'Preventive resin restoration', abbr: 'Preventive resin', cat: 'Preventive' },
  { code: 'D1353', desc: 'Sealant repair - per tooth', abbr: 'Sealant repair', cat: 'Preventive' },
  { code: 'D1354', desc: 'Interim caries arresting medicament', abbr: 'Caries arrest', cat: 'Preventive' },
  { code: 'D1510', desc: 'Space maintainer - fixed, unilateral', abbr: 'Space maint fixed', cat: 'Preventive' },
  { code: 'D1516', desc: 'Space maintainer - fixed, bilateral', abbr: 'Space maint bilateral', cat: 'Preventive' },
  { code: 'D1550', desc: 'Re-cement or re-bond space maintainer', abbr: 'Re-cement space maint', cat: 'Preventive' },
  { code: 'D1555', desc: 'Removal of fixed space maintainer', abbr: 'Remove space maint', cat: 'Preventive' },
  { code: 'D2140', desc: 'Amalgam - one surface, primary or permanent', abbr: 'Amalgam 1surf', cat: 'Restorative' },
  { code: 'D2150', desc: 'Amalgam - two surfaces, primary or permanent', abbr: 'Amalgam 2surf', cat: 'Restorative' },
  { code: 'D2160', desc: 'Amalgam - three surfaces, primary or permanent', abbr: 'Amalgam 3surf', cat: 'Restorative' },
  { code: 'D2161', desc: 'Amalgam - four or more surfaces', abbr: 'Amalgam 4+surf', cat: 'Restorative' },
  { code: 'D2330', desc: 'Resin-based composite - one surface, anterior', abbr: 'Composite 1surf ant', cat: 'Restorative' },
  { code: 'D2331', desc: 'Resin-based composite - two surfaces, anterior', abbr: 'Composite 2surf ant', cat: 'Restorative' },
  { code: 'D2332', desc: 'Resin-based composite - three surfaces, anterior', abbr: 'Composite 3surf ant', cat: 'Restorative' },
  { code: 'D2335', desc: 'Resin-based composite - four+ surfaces, anterior', abbr: 'Composite 4+surf ant', cat: 'Restorative' },
  { code: 'D2391', desc: 'Resin-based composite - one surface, posterior', abbr: 'Composite 1surf post', cat: 'Restorative' },
  { code: 'D2392', desc: 'Resin-based composite - two surfaces, posterior', abbr: 'Composite 2surf post', cat: 'Restorative' },
  { code: 'D2393', desc: 'Resin-based composite - three surfaces, posterior', abbr: 'Composite 3surf post', cat: 'Restorative' },
  { code: 'D2394', desc: 'Resin-based composite - four+ surfaces, posterior', abbr: 'Composite 4+surf post', cat: 'Restorative' },
  { code: 'D2510', desc: 'Inlay - metallic - one surface', abbr: 'Inlay metal 1surf', cat: 'Restorative' },
  { code: 'D2520', desc: 'Inlay - metallic - two surfaces', abbr: 'Inlay metal 2surf', cat: 'Restorative' },
  { code: 'D2530', desc: 'Inlay - metallic - three+ surfaces', abbr: 'Inlay metal 3+surf', cat: 'Restorative' },
  { code: 'D2542', desc: 'Onlay - metallic - two surfaces', abbr: 'Onlay metal 2surf', cat: 'Restorative' },
  { code: 'D2543', desc: 'Onlay - metallic - three surfaces', abbr: 'Onlay metal 3surf', cat: 'Restorative' },
  { code: 'D2544', desc: 'Onlay - metallic - four+ surfaces', abbr: 'Onlay metal 4+surf', cat: 'Restorative' },
  { code: 'D2740', desc: 'Crown - porcelain/ceramic', abbr: 'Crown porcelain', cat: 'Restorative' },
  { code: 'D2750', desc: 'Crown - porcelain fused to high noble metal', abbr: 'Crown PFM high noble', cat: 'Restorative' },
  { code: 'D2751', desc: 'Crown - porcelain fused to predominantly base metal', abbr: 'Crown PFM base', cat: 'Restorative' },
  { code: 'D2752', desc: 'Crown - porcelain fused to noble metal', abbr: 'Crown PFM noble', cat: 'Restorative' },
  { code: 'D2790', desc: 'Crown - full cast high noble metal', abbr: 'Crown full cast HN', cat: 'Restorative' },
  { code: 'D2791', desc: 'Crown - full cast predominantly base metal', abbr: 'Crown full cast base', cat: 'Restorative' },
  { code: 'D2792', desc: 'Crown - full cast noble metal', abbr: 'Crown full cast noble', cat: 'Restorative' },
  { code: 'D2910', desc: 'Recement or re-bond inlay, onlay, veneer or partial coverage restoration', abbr: 'Recement inlay', cat: 'Restorative' },
  { code: 'D2915', desc: 'Recement or re-bond indirectly fabricated or prefabricated post and core', abbr: 'Recement post', cat: 'Restorative' },
  { code: 'D2920', desc: 'Recement or re-bond crown', abbr: 'Recement crown', cat: 'Restorative' },
  { code: 'D2930', desc: 'Prefabricated stainless steel crown - primary tooth', abbr: 'SS crown primary', cat: 'Restorative' },
  { code: 'D2931', desc: 'Prefabricated stainless steel crown - permanent tooth', abbr: 'SS crown permanent', cat: 'Restorative' },
  { code: 'D2950', desc: 'Core buildup, including any pins when required', abbr: 'Core buildup', cat: 'Restorative' },
  { code: 'D2954', desc: 'Prefabricated post and core in addition to crown', abbr: 'Post and core', cat: 'Restorative' },
  { code: 'D2980', desc: 'Crown repair, by report', abbr: 'Crown repair', cat: 'Restorative' },
  { code: 'D3110', desc: 'Pulp cap - direct', abbr: 'Pulp cap direct', cat: 'Endodontics' },
  { code: 'D3120', desc: 'Pulp cap - indirect', abbr: 'Pulp cap indirect', cat: 'Endodontics' },
  { code: 'D3220', desc: 'Therapeutic pulpotomy', abbr: 'Pulpotomy', cat: 'Endodontics' },
  { code: 'D3310', desc: 'Endodontic therapy, anterior tooth', abbr: 'RCT anterior', cat: 'Endodontics' },
  { code: 'D3320', desc: 'Endodontic therapy, premolar tooth', abbr: 'RCT premolar', cat: 'Endodontics' },
  { code: 'D3330', desc: 'Endodontic therapy, molar tooth', abbr: 'RCT molar', cat: 'Endodontics' },
  { code: 'D3346', desc: 'Retreatment of previous root canal therapy - anterior', abbr: 'Retreat RCT ant', cat: 'Endodontics' },
  { code: 'D3347', desc: 'Retreatment of previous root canal therapy - premolar', abbr: 'Retreat RCT premolar', cat: 'Endodontics' },
  { code: 'D3348', desc: 'Retreatment of previous root canal therapy - molar', abbr: 'Retreat RCT molar', cat: 'Endodontics' },
  { code: 'D3410', desc: 'Apicoectomy - anterior', abbr: 'Apicoectomy ant', cat: 'Endodontics' },
  { code: 'D4210', desc: 'Gingivectomy or gingivoplasty - four+ teeth per quadrant', abbr: 'Gingivectomy 4+', cat: 'Periodontics' },
  { code: 'D4240', desc: 'Gingival flap procedure, four+ teeth per quadrant', abbr: 'Gingival flap 4+', cat: 'Periodontics' },
  { code: 'D4260', desc: 'Osseous surgery - four+ teeth per quadrant', abbr: 'Osseous surgery 4+', cat: 'Periodontics' },
  { code: 'D4341', desc: 'Periodontal scaling and root planing - four+ teeth per quadrant', abbr: 'Perio SRP 4+', cat: 'Periodontics' },
  { code: 'D4342', desc: 'Periodontal scaling and root planing - one to three teeth per quadrant', abbr: 'Perio SRP 1-3', cat: 'Periodontics' },
  { code: 'D4346', desc: 'Scaling in presence of generalized moderate or severe gingival inflammation', abbr: 'Full mouth debridement scaling', cat: 'Periodontics' },
  { code: 'D4355', desc: 'Full mouth debridement', abbr: 'FM debridement', cat: 'Periodontics' },
  { code: 'D4910', desc: 'Periodontal maintenance', abbr: 'Perio maintenance', cat: 'Periodontics' },
  { code: 'D5110', desc: 'Complete denture - maxillary', abbr: 'CD maxillary', cat: 'Prosthodontics' },
  { code: 'D5120', desc: 'Complete denture - mandibular', abbr: 'CD mandibular', cat: 'Prosthodontics' },
  { code: 'D5130', desc: 'Immediate denture - maxillary', abbr: 'Immediate denture max', cat: 'Prosthodontics' },
  { code: 'D5140', desc: 'Immediate denture - mandibular', abbr: 'Immediate denture mand', cat: 'Prosthodontics' },
  { code: 'D5211', desc: 'Maxillary partial denture - resin base', abbr: 'Partial resin max', cat: 'Prosthodontics' },
  { code: 'D5212', desc: 'Mandibular partial denture - resin base', abbr: 'Partial resin mand', cat: 'Prosthodontics' },
  { code: 'D5213', desc: 'Maxillary partial denture - cast metal framework', abbr: 'Partial cast max', cat: 'Prosthodontics' },
  { code: 'D5214', desc: 'Mandibular partial denture - cast metal framework', abbr: 'Partial cast mand', cat: 'Prosthodontics' },
  { code: 'D5410', desc: 'Adjust complete denture - maxillary', abbr: 'Adjust CD max', cat: 'Prosthodontics' },
  { code: 'D5411', desc: 'Adjust complete denture - mandibular', abbr: 'Adjust CD mand', cat: 'Prosthodontics' },
  { code: 'D5510', desc: 'Repair broken complete denture base', abbr: 'Repair CD base', cat: 'Prosthodontics' },
  { code: 'D5520', desc: 'Replace missing or broken teeth - complete denture', abbr: 'Replace tooth CD', cat: 'Prosthodontics' },
  { code: 'D6010', desc: 'Surgical placement of implant body: endosteal implant', abbr: 'Implant placement', cat: 'Implants' },
  { code: 'D6056', desc: 'Prefabricated abutment', abbr: 'Prefab abutment', cat: 'Implants' },
  { code: 'D6058', desc: 'Abutment supported porcelain/ceramic crown', abbr: 'Implant crown ceramic', cat: 'Implants' },
  { code: 'D6065', desc: 'Implant supported porcelain/ceramic crown', abbr: 'Implant crown supported', cat: 'Implants' },
  { code: 'D6066', desc: 'Implant supported porcelain fused to metal crown', abbr: 'Implant crown PFM', cat: 'Implants' },
  { code: 'D7140', desc: 'Extraction, erupted tooth or exposed root', abbr: 'Extraction simple', cat: 'Oral Surgery' },
  { code: 'D7210', desc: 'Extraction, erupted tooth requiring elevation', abbr: 'Extraction surgical', cat: 'Oral Surgery' },
  { code: 'D7220', desc: 'Removal of impacted tooth - soft tissue', abbr: 'Impacted soft tissue', cat: 'Oral Surgery' },
  { code: 'D7230', desc: 'Removal of impacted tooth - partially bony', abbr: 'Impacted part bony', cat: 'Oral Surgery' },
  { code: 'D7240', desc: 'Removal of impacted tooth - completely bony', abbr: 'Impacted full bony', cat: 'Oral Surgery' },
  { code: 'D7250', desc: 'Removal of residual tooth roots', abbr: 'Remove residual roots', cat: 'Oral Surgery' },
  { code: 'D7280', desc: 'Surgical access of an unerupted tooth', abbr: 'Surgical access unerupted', cat: 'Oral Surgery' },
  { code: 'D7310', desc: 'Alveoloplasty in conjunction with extractions - four+ teeth per quadrant', abbr: 'Alveoloplasty w/ext', cat: 'Oral Surgery' },
  { code: 'D7510', desc: 'Incision and drainage of abscess - intraoral soft tissue', abbr: 'I&D abscess', cat: 'Oral Surgery' },
  { code: 'D7953', desc: 'Bone replacement graft for ridge preservation - per site', abbr: 'Ridge preservation graft', cat: 'Oral Surgery' },
  { code: 'D8010', desc: 'Limited orthodontic treatment of the primary dentition', abbr: 'Ortho limited primary', cat: 'Orthodontics' },
  { code: 'D8070', desc: 'Comprehensive orthodontic treatment of the transitional dentition', abbr: 'Ortho comp transitional', cat: 'Orthodontics' },
  { code: 'D8080', desc: 'Comprehensive orthodontic treatment of the adolescent dentition', abbr: 'Ortho comp adolescent', cat: 'Orthodontics' },
  { code: 'D8090', desc: 'Comprehensive orthodontic treatment of the adult dentition', abbr: 'Ortho comp adult', cat: 'Orthodontics' },
  { code: 'D8660', desc: 'Pre-orthodontic treatment examination', abbr: 'Pre-ortho exam', cat: 'Orthodontics' },
  { code: 'D8670', desc: 'Periodic orthodontic treatment visit', abbr: 'Ortho periodic visit', cat: 'Orthodontics' },
  { code: 'D8680', desc: 'Orthodontic retention', abbr: 'Ortho retention', cat: 'Orthodontics' },
  { code: 'D9110', desc: 'Palliative (emergency) treatment of dental pain', abbr: 'Emergency treatment', cat: 'Adjunctive' },
  { code: 'D9211', desc: 'Regional block anesthesia', abbr: 'Regional block', cat: 'Adjunctive' },
  { code: 'D9212', desc: 'Trigeminal division block anesthesia', abbr: 'Trigeminal block', cat: 'Adjunctive' },
  { code: 'D9215', desc: 'Local anesthesia in addition to other procedures', abbr: 'Local anesthesia', cat: 'Adjunctive' },
  { code: 'D9222', desc: 'Deep sedation/general anesthesia - first 15 minutes', abbr: 'Deep sedation first', cat: 'Adjunctive' },
  { code: 'D9223', desc: 'Deep sedation/general anesthesia - each subsequent 15 min', abbr: 'Deep sedation addl', cat: 'Adjunctive' },
  { code: 'D9230', desc: 'Inhalation of nitrous oxide/analgesia, anxiolysis', abbr: 'Nitrous oxide', cat: 'Adjunctive' },
  { code: 'D9239', desc: 'Intravenous moderate sedation - first 15 minutes', abbr: 'IV sedation first', cat: 'Adjunctive' },
  { code: 'D9243', desc: 'Intravenous moderate sedation - each subsequent 15 min', abbr: 'IV sedation addl', cat: 'Adjunctive' },
  { code: 'D9248', desc: 'Non-intravenous conscious sedation', abbr: 'Non-IV sedation', cat: 'Adjunctive' },
  { code: 'D9310', desc: 'Consultation - diagnostic service by a practitioner other than treating dentist', abbr: 'Consultation', cat: 'Adjunctive' },
  { code: 'D9440', desc: 'Office visit - after regularly scheduled hours', abbr: 'After hours visit', cat: 'Adjunctive' },
  { code: 'D9910', desc: 'Application of desensitizing medicament', abbr: 'Desensitizing medicament', cat: 'Adjunctive' },
  { code: 'D9930', desc: 'Treatment of complications - post-surgical', abbr: 'Post-surgical complications', cat: 'Adjunctive' },
  { code: 'D9944', desc: 'Occlusal guard - hard appliance, full arch', abbr: 'Night guard hard', cat: 'Adjunctive' },
  { code: 'D9972', desc: 'External bleaching - per arch', abbr: 'Bleaching per arch', cat: 'Adjunctive' },
];
async function ensureProcCategory(): Promise<bigint> {
  const existing = await prisma.definition.findFirst({
    where: { Category: 1 },
  });
  if (existing) return existing.DefNum;

  const defNum = await getNextId('definition', 'DefNum');
  await prisma.definition.create({
    data: {
      DefNum: defNum,
      Category: 1,
      ItemOrder: 0,
      ItemName: 'General',
      ItemValue: '',
      ItemColor: 0,
      IsHidden: 0,
    },
  });
  return defNum;
}

async function seedProcedureCodes() {
  console.log(`Seeding ${procedureCodes.length} dental procedure codes...`);

  const procCatDefNum = await ensureProcCategory();

  let created = 0;
  let skipped = 0;

  for (const proc of procedureCodes) {
    const existing = await prisma.procedurecode.findFirst({
      where: { ProcCode: proc.code },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const codeNum = await getNextId('procedurecode', 'CodeNum');
    await prisma.procedurecode.create({
      data: {
        CodeNum: codeNum,
        ProcCode: proc.code,
        Descript: proc.desc,
        AbbrDesc: proc.abbr,
        ProcCat: procCatDefNum,
        ProcTime: '0',
        TreatArea: 'MOUTH',
        NoBillIns: 0,
        IsProsth: 0,
        IsHygiene: false,
        IsTaxed: 0,
        PaintType: 0,
        IsCanadianLab: 0,
        PreExisting: 0,
        BaseUnits: 0,
        SubstOnlyIf: 0,
        IsMultiVisit: 0,
        CanadaTimeUnits: 0,
        IsRadiology: 0,
        BypassGlobalLock: 0,
        AreaAlsoToothRange: 0,
        LaymanTerm: proc.desc,
      },
    });
    created++;
  }

  console.log(`Procedure code seeding complete. Created: ${created}, Skipped: ${skipped}`);
}

seedProcedureCodes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding procedure codes:', err);
    process.exit(1);
  });