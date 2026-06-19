import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const procedureCodesList = [
  // === DIAGNOSTIC ===
  { code: 'D0120', desc: 'Periodic oral evaluation – established patient', abbr: 'Periodic exam', cat: 'Oral evaluation' },
  { code: 'D0140', desc: 'Limited oral evaluation – problem focused', abbr: 'Limited exam', cat: 'Oral evaluation' },
  { code: 'D0150', desc: 'Comprehensive oral evaluation – new or established patient', abbr: 'Comp exam', cat: 'Oral evaluation' },
  { code: 'D0160', desc: 'Detailed and extensive oral evaluation – problem focused, by report', abbr: 'Detailed exam', cat: 'Oral evaluation' },
  { code: 'D0210', desc: 'Intraoral – complete series of radiographic images (FMX)', abbr: 'FMX', cat: 'Diagnostic Imaging' },
  { code: 'D0220', desc: 'Intraoral – periapical first radiographic image', abbr: 'PA first', cat: 'Diagnostic Imaging' },
  { code: 'D0230', desc: 'Intraoral – periapical each additional image', abbr: 'PA addl', cat: 'Diagnostic Imaging' },
  { code: 'D0270', desc: 'Bitewing – single radiographic image', abbr: 'BW single', cat: 'Diagnostic Imaging' },
  { code: 'D0274', desc: 'Bitewings – four radiographic images', abbr: 'BW 4', cat: 'Diagnostic Imaging' },
  { code: 'D0330', desc: 'Panoramic radiographic image', abbr: 'Panoramic', cat: 'Diagnostic Imaging' },
  { code: 'D0460', desc: 'Pulp vitality tests', abbr: 'Pulp vitality', cat: 'Diagnostic Tests' },
  { code: 'D0364', desc: 'Cone beam CT (CBCT) – various field of view options', abbr: 'CBCT 1', cat: 'CBCT' },
  { code: 'D0365', desc: 'Cone beam CT (CBCT) – various field of view options', abbr: 'CBCT 2', cat: 'CBCT' },
  { code: 'D0366', desc: 'Cone beam CT (CBCT) – various field of view options', abbr: 'CBCT 3', cat: 'CBCT' },
  { code: 'D0367', desc: 'Cone beam CT (CBCT) – various field of view options', abbr: 'CBCT 4', cat: 'CBCT' },
  { code: 'D0368', desc: 'Cone beam CT (CBCT) – various field of view options', abbr: 'CBCT 5', cat: 'CBCT' },

  // === PREVENTATIVE ===
  { code: 'D1110', desc: 'Prophylaxis – adult (cleaning, scaling & polish)', abbr: 'Adult cleaning', cat: 'Prophy' },
  { code: 'D1120', desc: 'Prophylaxis – child', abbr: 'Child cleaning', cat: 'Prophy' },
  { code: 'D1206', desc: 'Topical application of fluoride varnish', abbr: 'Fluoride varnish', cat: 'Fluoride' },
  { code: 'D1208', desc: 'Topical application of fluoride – excluding varnish', abbr: 'Fluoride', cat: 'Fluoride' },
  { code: 'D1351', desc: 'Sealant – per tooth', abbr: 'Sealant', cat: 'Preventative services' },
  { code: 'D1352', desc: 'Preventive resin restoration in a moderate to high caries risk patient', abbr: 'Preventive resin', cat: 'Preventative services' },
  { code: 'D1353', desc: 'Sealant repair – per tooth', abbr: 'Sealant repair', cat: 'Preventative services' },
  { code: 'D1354', desc: 'Interim caries arresting medicament application – per tooth', abbr: 'Caries arrest', cat: 'Preventative services' },
  { code: 'D4910', desc: 'Periodontal maintenance (for patients post-SRP)', abbr: 'Perio maintenance', cat: 'Periodontal maintenance' },

  // === RESTORATIVE ===
  { code: 'D2140', desc: 'Amalgam – one surface, primary or permanent', abbr: 'Amalgam 1surf', cat: 'Direct' },
  { code: 'D2150', desc: 'Amalgam – two surfaces, primary or permanent', abbr: 'Amalgam 2surf', cat: 'Direct' },
  { code: 'D2160', desc: 'Amalgam – three surfaces, primary or permanent', abbr: 'Amalgam 3surf', cat: 'Direct' },
  { code: 'D2161', desc: 'Amalgam – four or more surfaces', abbr: 'Amalgam 4+surf', cat: 'Direct' },
  { code: 'D2330', desc: 'Resin-based composite – one surface, anterior', abbr: 'Composite 1surf ant', cat: 'Direct' },
  { code: 'D2391', desc: 'Resin-based composite – one surface, posterior', abbr: 'Composite 1surf post', cat: 'Direct' },
  { code: 'D2392', desc: 'Resin-based composite – two surfaces, posterior', abbr: 'Composite 2surf post', cat: 'Direct' },
  { code: 'D2393', desc: 'Resin-based composite – three surfaces, posterior', abbr: 'Composite 3surf post', cat: 'Direct' },
  { code: 'D2394', desc: 'Resin-based composite – four or more surfaces, posterior', abbr: 'Composite 4+surf post', cat: 'Direct' },
  { code: 'D2710', desc: 'Crown – resin-based composite (indirect)', abbr: 'Crown composite indirect', cat: 'Indirect' },
  { code: 'D2740', desc: 'Crown – porcelain/ceramic', abbr: 'Crown porcelain', cat: 'Indirect' },
  { code: 'D2750', desc: 'Crown – porcelain fused to high noble metal', abbr: 'Crown PFM HN', cat: 'Indirect' },
  { code: 'D2751', desc: 'Crown – porcelain fused to predominantly base metal', abbr: 'Crown PFM base', cat: 'Indirect' },
  { code: 'D2930', desc: 'Prefabricated stainless steel crown – primary tooth', abbr: 'SS crown primary', cat: 'Pediatric' },
  { code: 'D2931', desc: 'Prefabricated stainless steel crown – permanent tooth', abbr: 'SS crown permanent', cat: 'Pediatric' },
  { code: 'D2950', desc: 'Core buildup, including any pins', abbr: 'Core buildup', cat: 'BU/P&C' },
  { code: 'D2510', desc: 'Inlay – metallic – one surface', abbr: 'Inlay metal 1surf', cat: 'Indirect' },
  { code: 'D2610', desc: 'Onlay – porcelain/ceramic – two surfaces', abbr: 'Onlay porcelain 2surf', cat: 'Indirect' },

  // === ENDODONTICS ===
  { code: 'D3110', desc: 'Pulp cap – direct', abbr: 'Pulp cap direct', cat: 'Pulp capping' },
  { code: 'D3120', desc: 'Pulp cap – indirect', abbr: 'Pulp cap indirect', cat: 'Pulp capping' },
  { code: 'D3220', desc: 'Therapeutic pulpotomy', abbr: 'Pulpotomy', cat: 'Pulpotomy' },
  { code: 'D3310', desc: 'Endodontic therapy – anterior tooth (root canal)', abbr: 'RCT anterior', cat: 'Root Canal' },
  { code: 'D3320', desc: 'Endodontic therapy – premolar tooth', abbr: 'RCT premolar', cat: 'Root Canal' },
  { code: 'D3330', desc: 'Endodontic therapy – molar tooth', abbr: 'RCT molar', cat: 'Root Canal' },
  { code: 'D3346', desc: 'Retreatment of previous root canal – anterior', abbr: 'Retreat RCT ant', cat: 'Additional endo' },
  { code: 'D3347', desc: 'Retreatment of previous root canal – premolar', abbr: 'Retreat RCT premolar', cat: 'Additional endo' },
  { code: 'D3348', desc: 'Retreatment of previous root canal – molar', abbr: 'Retreat RCT molar', cat: 'Additional endo' },
  { code: 'D3410', desc: 'Apicoectomy – anterior', abbr: 'Apicoectomy ant', cat: 'Apicoectomy/Periradicular' },
  { code: 'D3421', desc: 'Apicoectomy – premolar (first root)', abbr: 'Apicoectomy premolar', cat: 'Apicoectomy/Periradicular' },
  { code: 'D3425', desc: 'Apicoectomy – molar (first root)', abbr: 'Apicoectomy molar', cat: 'Apicoectomy/Periradicular' },

  // === PERIODONTICS ===
  { code: 'D4210', desc: 'Gingivectomy or gingivoplasty – four or more contiguous teeth per quadrant', abbr: 'Gingivectomy 4+', cat: 'Periodontics' },
  { code: 'D4211', desc: 'Gingivectomy or gingivoplasty – one to three contiguous teeth per quadrant', abbr: 'Gingivectomy 1-3', cat: 'Periodontics' },
  { code: 'D4240', desc: 'Gingival flap procedure – four or more contiguous teeth per quadrant', abbr: 'Gingival flap 4+', cat: 'Periodontics' },
  { code: 'D4260', desc: 'Osseous surgery – four or more contiguous teeth per quadrant', abbr: 'Osseous surgery 4+', cat: 'Periodontics' },
  { code: 'D4341', desc: 'Periodontal scaling and root planing – four or more teeth per quadrant', abbr: 'Perio SRP 4+', cat: 'Periodontics' },
  { code: 'D4342', desc: 'Periodontal scaling and root planing – one to three teeth per quadrant', abbr: 'Perio SRP 1-3', cat: 'Periodontics' },
  { code: 'D4355', desc: 'Full mouth debridement to enable comprehensive evaluation', abbr: 'FM debridement', cat: 'Periodontics' },
  { code: 'D4381', desc: 'Localized delivery of antimicrobial agents into periodontal pockets', abbr: 'Antimicrobial delivery', cat: 'Periodontics' },

  // === IMPLANT SERVICES ===
  { code: 'D6010', desc: 'Surgical placement of implant body: endosteal implant', abbr: 'Implant placement', cat: 'Surgical Placement' },
  { code: 'D6011', desc: 'Second stage implant surgery', abbr: 'Implant second stage', cat: 'Surgical Placement' },
  { code: 'D6040', desc: 'Surgical placement – eposteal implant', abbr: 'Implant eposteal', cat: 'Surgical Placement' },
  { code: 'D6056', desc: 'Prefabricated abutment – includes placement', abbr: 'Prefab abutment', cat: 'Abutment' },
  { code: 'D6057', desc: 'Custom fabricated abutment – includes placement', abbr: 'Custom abutment', cat: 'Abutment' },
  { code: 'D6058', desc: 'Implant-supported crown – ceramic/porcelain', abbr: 'Implant crown ceramic', cat: 'Implant-Restorative' },
  { code: 'D6059', desc: 'Implant-supported crown – porcelain fused to metal', abbr: 'Implant crown PFM', cat: 'Implant-Restorative' },
  { code: 'D6065', desc: 'Implant-supported metal crown', abbr: 'Implant crown metal', cat: 'Implant-Restorative' },
  { code: 'D6100', desc: 'Implant removal, by report', abbr: 'Implant removal', cat: 'Implant-Restorative' },
  { code: 'D6104', desc: 'Bone graft at time of implant placement', abbr: 'Bone graft implant', cat: 'Implant-Restorative' },

  // === ORAL SURGERY ===
  { code: 'D7140', desc: 'Extraction – erupted tooth or exposed root (simple)', abbr: 'Extraction simple', cat: 'Oral Surgery' },
  { code: 'D7210', desc: 'Extraction – erupted tooth requiring bone removal / sectioning (surgical)', abbr: 'Extraction surgical', cat: 'Oral Surgery' },
  { code: 'D7250', desc: 'Removal of residual tooth roots (cutting procedure)', abbr: 'Remove residual roots', cat: 'Oral Surgery' },
  { code: 'D7220', desc: 'Removal of impacted tooth – soft tissue', abbr: 'Impacted soft tissue', cat: 'Oral Surgery' },
  { code: 'D7230', desc: 'Removal of impacted tooth – partially bony', abbr: 'Impacted part bony', cat: 'Oral Surgery' },
  { code: 'D7240', desc: 'Removal of impacted tooth – completely bony', abbr: 'Impacted full bony', cat: 'Oral Surgery' },
  { code: 'D7270', desc: 'Tooth reimplantation / stabilization of avulsed tooth', abbr: 'Tooth reimplantation', cat: 'Oral Surgery' },
  { code: 'D7310', desc: 'Alveoloplasty in conjunction with extractions – per quadrant', abbr: 'Alveoloplasty per quad', cat: 'Oral Surgery' },
  { code: 'D7460', desc: 'Removal of benign nonodontogenic cyst or tumor', abbr: 'Remove cyst/tumor', cat: 'Oral Surgery' },
  { code: 'D7510', desc: 'Incision and drainage of abscess – intraoral', abbr: 'I&D abscess', cat: 'Oral Surgery' },
  { code: 'D7910', desc: 'Suture of recent small wounds – up to 5cm', abbr: 'Suture wounds', cat: 'Oral Surgery' },

  // === PROSTHODONTICS, FIXED ===
  { code: 'D6210', desc: 'Pontic – cast high noble metal', abbr: 'Pontic HN', cat: 'Prosthodontics, Fixed' },
  { code: 'D6214', desc: 'Pontic – titanium and titanium alloys', abbr: 'Pontic titanium', cat: 'Prosthodontics, Fixed' },
  { code: 'D6240', desc: 'Pontic – porcelain fused to high noble metal', abbr: 'Pontic PFM HN', cat: 'Prosthodontics, Fixed' },
  { code: 'D6245', desc: 'Pontic – porcelain/ceramic', abbr: 'Pontic porcelain', cat: 'Prosthodontics, Fixed' },
  { code: 'D6710', desc: 'Retainer crown – indirect resin-based composite', abbr: 'Retainer crown composite', cat: 'Prosthodontics, Fixed' },
  { code: 'D6720', desc: 'Retainer crown – resin with high noble metal', abbr: 'Retainer crown resin HN', cat: 'Prosthodontics, Fixed' },
  { code: 'D6740', desc: 'Retainer crown – porcelain/ceramic', abbr: 'Retainer crown ceramic', cat: 'Prosthodontics, Fixed' },
  { code: 'D6750', desc: 'Retainer crown – porcelain fused to high noble metal', abbr: 'Retainer crown PFM HN', cat: 'Prosthodontics, Fixed' },

  // === PROSTHODONTICS, REMOVABLE ===
  { code: 'D5110', desc: 'Complete denture – maxillary (upper)', abbr: 'CD maxillary', cat: 'Prosthodontics, Removable' },
  { code: 'D5120', desc: 'Complete denture – mandibular (lower)', abbr: 'CD mandibular', cat: 'Prosthodontics, Removable' },
  { code: 'D5130', desc: 'Immediate denture – maxillary', abbr: 'Immediate denture max', cat: 'Prosthodontics, Removable' },
  { code: 'D5140', desc: 'Immediate denture – mandibular', abbr: 'Immediate denture mand', cat: 'Prosthodontics, Removable' },
  { code: 'D5211', desc: 'Maxillary partial denture – resin base', abbr: 'Partial resin max', cat: 'Prosthodontics, Removable' },
  { code: 'D5212', desc: 'Mandibular partial denture – resin base', abbr: 'Partial resin mand', cat: 'Prosthodontics, Removable' },
  { code: 'D5213', desc: 'Maxillary partial denture – cast metal framework', abbr: 'Partial cast max', cat: 'Prosthodontics, Removable' },
  { code: 'D5214', desc: 'Mandibular partial denture – cast metal framework', abbr: 'Partial cast mand', cat: 'Prosthodontics, Removable' },
  { code: 'D5410', desc: 'Adjust complete denture – maxillary', abbr: 'Adjust CD max', cat: 'Prosthodontics, Removable' },
  { code: 'D5730', desc: 'Reline complete maxillary denture – chairside', abbr: 'Reline CD max chairside', cat: 'Prosthodontics, Removable' },

  // === ADJUNCT GENERAL SERVICES ===
  { code: 'D9110', desc: 'Palliative (emergency) treatment of dental pain', abbr: 'Palliative tx', cat: 'Adjunctive General Services' },
  { code: 'D9210', desc: 'Local anesthesia not in conjunction with operative/surgical procedures', abbr: 'Local anesthesia', cat: 'Adjunctive General Services' },
  { code: 'D9230', desc: 'Inhalation of nitrous oxide / analgesia, anxiolysis', abbr: 'Nitrous oxide', cat: 'Adjunctive General Services' },
  { code: 'D9248', desc: 'Non-intravenous conscious sedation', abbr: 'Non-IV sedation', cat: 'Adjunctive General Services' },
  { code: 'D9310', desc: 'Consultation – diagnostic service by another dentist', abbr: 'Consultation', cat: 'Adjunctive General Services' },
  { code: 'D9430', desc: 'Office visit for observation – no other services performed', abbr: 'Office visit observation', cat: 'Adjunctive General Services' },
  { code: 'D9440', desc: 'Office visit – after regularly scheduled hours', abbr: 'Office visit after hours', cat: 'Adjunctive General Services' },
  { code: 'D9910', desc: 'Application of desensitizing medicament', abbr: 'Desensitizing application', cat: 'Adjunctive General Services' },
  { code: 'D9944', desc: 'Occlusal guard – hard appliance, full arch', abbr: 'Night guard hard', cat: 'Adjunctive General Services' },
  { code: 'D9945', desc: 'Occlusal guard – soft appliance, full arch', abbr: 'Night guard soft', cat: 'Adjunctive General Services' },

  // === ORTHODONTICS ===
  { code: 'D8010', desc: 'Limited orthodontic treatment – primary dentition', abbr: 'Ortho ltd primary', cat: 'Orthodontics' },
  { code: 'D8020', desc: 'Limited orthodontic treatment – transitional dentition', abbr: 'Ortho ltd transitional', cat: 'Orthodontics' },
  { code: 'D8030', desc: 'Limited orthodontic treatment – adolescent dentition', abbr: 'Ortho ltd adolescent', cat: 'Orthodontics' },
  { code: 'D8040', desc: 'Limited orthodontic treatment – adult dentition', abbr: 'Ortho ltd adult', cat: 'Orthodontics' },
  { code: 'D8070', desc: 'Comprehensive orthodontic treatment – transitional dentition', abbr: 'Ortho comp transitional', cat: 'Orthodontics' },
  { code: 'D8080', desc: 'Comprehensive orthodontic treatment – adolescent dentition', abbr: 'Ortho comp adolescent', cat: 'Orthodontics' },
  { code: 'D8090', desc: 'Comprehensive orthodontic treatment – adult dentition', abbr: 'Ortho comp adult', cat: 'Orthodontics' },
  { code: 'D8210', desc: 'Removable appliance therapy', abbr: 'Removable appliance', cat: 'Orthodontics' },
  { code: 'D8220', desc: 'Fixed appliance therapy', abbr: 'Fixed appliance', cat: 'Orthodontics' },
  { code: 'D8660', desc: 'Pre-orthodontic examination', abbr: 'Pre-ortho exam', cat: 'Orthodontics' },
  { code: 'D8670', desc: 'Periodic orthodontic treatment visit', abbr: 'Ortho periodic visit', cat: 'Orthodontics' },
  { code: 'D8680', desc: 'Orthodontic retention (inclusive of retainers)', abbr: 'Ortho retention', cat: 'Orthodontics' },

  // === MAXILLOFACIAL PROSTHETICS ===
  { code: 'D5911', desc: 'Facial moulage – sectional', abbr: 'Facial moulage sectional', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5912', desc: 'Facial moulage – complete', abbr: 'Facial moulage complete', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5913', desc: 'Nasal prosthesis', abbr: 'Nasal prosthesis', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5914', desc: 'Auricular prosthesis', abbr: 'Auricular prosthesis', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5915', desc: 'Orbital prosthesis', abbr: 'Orbital prosthesis', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5919', desc: 'Facial prosthesis', abbr: 'Facial prosthesis', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5922', desc: 'Nasal septal prosthesis', abbr: 'Nasal septal prosthesis', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5923', desc: 'Ocular prosthesis – stock', abbr: 'Ocular prosthesis stock', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5924', desc: 'Cranial prosthesis', abbr: 'Cranial prosthesis', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5925', desc: 'Facial augmentation implant prosthesis', abbr: 'Facial augmentation implant', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5931', desc: 'Obturator prosthesis – surgical', abbr: 'Obturator surgical', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5932', desc: 'Obturator prosthesis – definitive', abbr: 'Obturator definitive', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5933', desc: 'Obturator prosthesis – modification', abbr: 'Obturator modification', cat: 'Maxillofacial Prosthetics' },
  { code: 'D5954', desc: 'Radiation shield', abbr: 'Radiation shield', cat: 'Maxillofacial Prosthetics' },
];

async function seedStructuredCodes() {
  console.log('Starting structured CDT procedure codes seeding...');

  // 1. Delete existing fee entries to prevent foreign key issues
  console.log('Cleaning up existing fees...');
  await prisma.fee.deleteMany({});

  // 2. Delete existing procedure codes
  console.log('Cleaning up existing procedure codes...');
  await prisma.procedurecode.deleteMany({});

  // 3. Clear existing category definitions (Category = 1)
  console.log('Cleaning up old Category=1 definitions...');
  await prisma.definition.deleteMany({
    where: { Category: 1 },
  });

  // 4. Get unique category/subcategory names
  const categoryNames = Array.from(new Set(procedureCodesList.map((item) => item.cat)));
  const categoryDefs: { [name: string]: bigint } = {};

  console.log(`Creating ${categoryNames.length} Category=1 definitions...`);
  for (const name of categoryNames) {
    const defNum = await getNextId('definition', 'DefNum');
    await prisma.definition.create({
      data: {
        DefNum: defNum,
        Category: 1,
        ItemOrder: 0,
        ItemName: name,
        ItemValue: '',
        ItemColor: 0,
        IsHidden: 0,
      },
    });
    categoryDefs[name] = defNum;
  }

  // 5. Seed the procedure codes from PDF
  console.log(`Seeding ${procedureCodesList.length} structured procedure codes...`);
  let createdCount = 0;

  for (const proc of procedureCodesList) {
    const defNum = categoryDefs[proc.cat];
    if (!defNum) continue;

    const codeNum = await getNextId('procedurecode', 'CodeNum');
    await prisma.procedurecode.create({
      data: {
        CodeNum: codeNum,
        ProcCode: proc.code,
        Descript: proc.desc,
        AbbrDesc: proc.abbr,
        ProcCat: defNum,
        ProcTime: '0',
        TreatArea: 0,
        NoBillIns: 0,
        IsProsth: 0,
        IsHygiene: 0,
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

    // Seed default fee of $90 under default fee schedule (FeeSchedNum = 1n)
    const feeNum = await getNextId('fee', 'FeeNum');
    await prisma.fee.create({
      data: {
        FeeNum: feeNum,
        CodeNum: codeNum,
        FeeSched: 1n,
        Amount: 90,
        UseDefaultFee: 0,
        UseDefaultCov: 0,
      },
    });

    createdCount++;
  }

  console.log(`Structured CDT procedure codes and fees seeding complete. Created: ${createdCount} codes and fees.`);
}

seedStructuredCodes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding structured codes:', err);
    process.exit(1);
  });
