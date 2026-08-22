import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

// ─────────────────────────────────────────────────────────────────────────────
// Official ADA 12-category taxonomy
// https://www.ada.org/publications/cdt/ada-dental-claim-form-cdtcodes
// ─────────────────────────────────────────────────────────────────────────────
const ADA_CATEGORIES = [
  { id: 'I',    name: 'Diagnostic',                    codeRange: 'D0100–D0999', itemOrder: 0 },
  { id: 'II',   name: 'Preventive',                    codeRange: 'D1000–D1999', itemOrder: 1 },
  { id: 'III',  name: 'Restorative',                   codeRange: 'D2000–D2999', itemOrder: 2 },
  { id: 'IV',   name: 'Endodontics',                   codeRange: 'D3000–D3999', itemOrder: 3 },
  { id: 'V',    name: 'Periodontics',                  codeRange: 'D4000–D4999', itemOrder: 4 },
  { id: 'VI',   name: 'Prosthodontics, removable',     codeRange: 'D5000–D5899', itemOrder: 5 },
  { id: 'VII',  name: 'Maxillofacial Prosthetics',     codeRange: 'D5900–D5999', itemOrder: 6 },
  { id: 'VIII', name: 'Implant Services',              codeRange: 'D6000–D6199', itemOrder: 7 },
  { id: 'IX',   name: 'Prosthodontics, fixed',         codeRange: 'D6200–D6999', itemOrder: 8 },
  { id: 'X',    name: 'Oral & Maxillofacial Surgery',  codeRange: 'D7000–D7999', itemOrder: 9 },
  { id: 'XI',   name: 'Orthodontics',                  codeRange: 'D8000–D8999', itemOrder: 10 },
  { id: 'XII',  name: 'Adjunctive General Services',   codeRange: 'D9000–D9999', itemOrder: 11 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Procedure codes — cat values use the official ADA category names above
// ─────────────────────────────────────────────────────────────────────────────
const procedureCodes = [
  // ── I. Diagnostic (D0100–D0999) ──────────────────────────────────────────
  { code: 'D0120', desc: 'Periodic oral evaluation',                                           abbr: 'Periodic exam',         coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0140', desc: 'Limited oral evaluation',                                            abbr: 'Limited exam',          coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0150', desc: 'Comprehensive oral evaluation',                                      abbr: 'Comp exam',             coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0160', desc: 'Detailed and extensive oral evaluation',                             abbr: 'Detailed exam',         coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0170', desc: 'Re-evaluation, limited problem focused',                             abbr: 'Re-eval',               coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0180', desc: 'Comprehensive periodontal evaluation',                               abbr: 'Perio eval',            coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0190', desc: 'Screening of a patient',                                             abbr: 'Screening',             cat: 'Diagnostic' },
  { code: 'D0210', desc: 'Intraoral - complete series of radiographic images',                 abbr: 'FMX',                   coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0220', desc: 'Intraoral - periapical first radiographic image',                    abbr: 'PA first',              coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0230', desc: 'Intraoral - periapical each additional image',                       abbr: 'PA addl',               coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0240', desc: 'Intraoral - occlusal radiographic image',                            abbr: 'Occlusal',              coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0250', desc: 'Extra-oral - 2D projection radiographic image',                      abbr: 'Extraoral 2D',          coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0270', desc: 'Bitewing - single radiographic image',                               abbr: 'BW single',             coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0272', desc: 'Bitewings - two radiographic images',                                abbr: 'BW 2',                  coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0273', desc: 'Bitewings - three radiographic images',                              abbr: 'BW 3',                  coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0274', desc: 'Bitewings - four radiographic images',                               abbr: 'BW 4',                  coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0277', desc: 'Vertical bitewings - 7 to 8 radiographic images',                    abbr: 'Vert BW',               coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0330', desc: 'Panoramic radiographic image',                                       abbr: 'Panoramic',             coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0340', desc: 'Cephalometric radiographic image',                                   abbr: 'Cephalometric',         coverage: 'Preventive Services', cat: 'Diagnostic' },
  { code: 'D0350', desc: 'Oral/facial photographic images',                                    abbr: 'Photo images',          cat: 'Diagnostic' },
  { code: 'D0364', desc: 'Cone beam CT capture',                                               abbr: 'CBCT capture',          cat: 'Diagnostic' },
  { code: 'D0470', desc: 'Diagnostic casts',                                                   abbr: 'Diagnostic casts',      cat: 'Diagnostic' },

  // ── II. Preventive (D1000–D1999) ─────────────────────────────────────────
  { code: 'D1110', desc: 'Prophylaxis - adult',                                                abbr: 'Adult cleaning',        coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1120', desc: 'Prophylaxis - child',                                                abbr: 'Child cleaning',        coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1206', desc: 'Topical application of fluoride varnish',                            abbr: 'Fluoride varnish',      coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1208', desc: 'Topical application of fluoride',                                    abbr: 'Fluoride',              coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1310', desc: 'Nutritional counseling',                                             abbr: 'Nutrition counsel',     coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1320', desc: 'Tobacco counseling',                                                 abbr: 'Tobacco counsel',       coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1330', desc: 'Oral hygiene instructions',                                          abbr: 'OHI',                   coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1351', desc: 'Sealant - per tooth',                                                abbr: 'Sealant',               coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1352', desc: 'Preventive resin restoration',                                       abbr: 'Preventive resin',      coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1353', desc: 'Sealant repair - per tooth',                                         abbr: 'Sealant repair',        cat: 'Preventive' },
  { code: 'D1354', desc: 'Interim caries arresting medicament',                                abbr: 'Caries arrest',         cat: 'Preventive' },
  { code: 'D1510', desc: 'Space maintainer - fixed, unilateral',                               abbr: 'Space maint fixed',     coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1516', desc: 'Space maintainer - fixed, bilateral',                                abbr: 'Space maint bilateral', coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1550', desc: 'Re-cement or re-bond space maintainer',                              abbr: 'Re-cement space maint', coverage: 'Preventive Services', cat: 'Preventive' },
  { code: 'D1555', desc: 'Removal of fixed space maintainer',                                  abbr: 'Remove space maint',    coverage: 'Preventive Services', cat: 'Preventive' },

  // ── III. Restorative (D2000–D2999) ───────────────────────────────────────
  { code: 'D2140', desc: 'Amalgam - one surface, primary or permanent',                        abbr: 'Amalgam 1surf',         coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2150', desc: 'Amalgam - two surfaces, primary or permanent',                       abbr: 'Amalgam 2surf',         coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2160', desc: 'Amalgam - three surfaces, primary or permanent',                     abbr: 'Amalgam 3surf',         coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2161', desc: 'Amalgam - four or more surfaces',                                    abbr: 'Amalgam 4+surf',        coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2330', desc: 'Resin-based composite - one surface, anterior',                      abbr: 'Composite 1surf ant',   coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2331', desc: 'Resin-based composite - two surfaces, anterior',                     abbr: 'Composite 2surf ant',   coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2332', desc: 'Resin-based composite - three surfaces, anterior',                   abbr: 'Composite 3surf ant',   coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2335', desc: 'Resin-based composite - four+ surfaces, anterior',                   abbr: 'Composite 4+surf ant',  coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2391', desc: 'Resin-based composite - one surface, posterior',                     abbr: 'Composite 1surf post',  coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2392', desc: 'Resin-based composite - two surfaces, posterior',                    abbr: 'Composite 2surf post',  coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2393', desc: 'Resin-based composite - three surfaces, posterior',                  abbr: 'Composite 3surf post',  coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2394', desc: 'Resin-based composite - four+ surfaces, posterior',                  abbr: 'Composite 4+surf post', coverage: 'Basic Services', cat: 'Restorative' },
  { code: 'D2510', desc: 'Inlay - metallic - one surface',                                     abbr: 'Inlay metal 1surf',     cat: 'Restorative' },
  { code: 'D2520', desc: 'Inlay - metallic - two surfaces',                                    abbr: 'Inlay metal 2surf',     cat: 'Restorative' },
  { code: 'D2530', desc: 'Inlay - metallic - three+ surfaces',                                 abbr: 'Inlay metal 3+surf',    cat: 'Restorative' },
  { code: 'D2542', desc: 'Onlay - metallic - two surfaces',                                    abbr: 'Onlay metal 2surf',     cat: 'Restorative' },
  { code: 'D2543', desc: 'Onlay - metallic - three surfaces',                                  abbr: 'Onlay metal 3surf',     cat: 'Restorative' },
  { code: 'D2544', desc: 'Onlay - metallic - four+ surfaces',                                  abbr: 'Onlay metal 4+surf',    cat: 'Restorative' },
  { code: 'D2740', desc: 'Crown - porcelain/ceramic',                                          abbr: 'Crown porcelain',       coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2750', desc: 'Crown - porcelain fused to high noble metal',                        abbr: 'Crown PFM high noble',  coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2751', desc: 'Crown - porcelain fused to predominantly base metal',                abbr: 'Crown PFM base',        coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2752', desc: 'Crown - porcelain fused to noble metal',                             abbr: 'Crown PFM noble',       coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2790', desc: 'Crown - full cast high noble metal',                                 abbr: 'Crown full cast HN',    coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2791', desc: 'Crown - full cast predominantly base metal',                         abbr: 'Crown full cast base',  coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2792', desc: 'Crown - full cast noble metal',                                      abbr: 'Crown full cast noble', coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2910', desc: 'Recement or re-bond inlay, onlay, veneer or partial coverage restoration', abbr: 'Recement inlay',  cat: 'Restorative' },
  { code: 'D2915', desc: 'Recement or re-bond indirectly fabricated or prefabricated post and core', abbr: 'Recement post',  cat: 'Restorative' },
  { code: 'D2920', desc: 'Recement or re-bond crown',                                          abbr: 'Recement crown',        cat: 'Restorative' },
  { code: 'D2930', desc: 'Prefabricated stainless steel crown - primary tooth',                abbr: 'SS crown primary',      cat: 'Restorative' },
  { code: 'D2931', desc: 'Prefabricated stainless steel crown - permanent tooth',              abbr: 'SS crown permanent',    cat: 'Restorative' },
  { code: 'D2950', desc: 'Core buildup, including any pins when required',                     abbr: 'Core buildup',          coverage: 'Major Services', cat: 'Restorative' },
  { code: 'D2954', desc: 'Prefabricated post and core in addition to crown',                   abbr: 'Post and core',         cat: 'Restorative' },
  { code: 'D2980', desc: 'Crown repair, by report',                                            abbr: 'Crown repair',          cat: 'Restorative' },

  // ── IV. Endodontics (D3000–D3999) ────────────────────────────────────────
  { code: 'D3110', desc: 'Pulp cap - direct',                                                  abbr: 'Pulp cap direct',       cat: 'Endodontics' },
  { code: 'D3120', desc: 'Pulp cap - indirect',                                                abbr: 'Pulp cap indirect',     cat: 'Endodontics' },
  { code: 'D3220', desc: 'Therapeutic pulpotomy',                                              abbr: 'Pulpotomy',             cat: 'Endodontics' },
  { code: 'D3310', desc: 'Endodontic therapy, anterior tooth',                                 abbr: 'RCT anterior',          cat: 'Endodontics' },
  { code: 'D3320', desc: 'Endodontic therapy, premolar tooth',                                 abbr: 'RCT premolar',          cat: 'Endodontics' },
  { code: 'D3330', desc: 'Endodontic therapy, molar tooth',                                    abbr: 'RCT molar',             coverage: 'Major Services', cat: 'Endodontics' },
  { code: 'D3346', desc: 'Retreatment of previous root canal therapy - anterior',              abbr: 'Retreat RCT ant',       cat: 'Endodontics' },
  { code: 'D3347', desc: 'Retreatment of previous root canal therapy - premolar',              abbr: 'Retreat RCT premolar',  cat: 'Endodontics' },
  { code: 'D3348', desc: 'Retreatment of previous root canal therapy - molar',                 abbr: 'Retreat RCT molar',     cat: 'Endodontics' },
  { code: 'D3410', desc: 'Apicoectomy - anterior',                                             abbr: 'Apicoectomy ant',       cat: 'Endodontics' },

  // ── V. Periodontics (D4000–D4999) ────────────────────────────────────────
  { code: 'D4210', desc: 'Gingivectomy or gingivoplasty - four+ teeth per quadrant',           abbr: 'Gingivectomy 4+',       cat: 'Periodontics' },
  { code: 'D4240', desc: 'Gingival flap procedure, four+ teeth per quadrant',                  abbr: 'Gingival flap 4+',      cat: 'Periodontics' },
  { code: 'D4260', desc: 'Osseous surgery - four+ teeth per quadrant',                         abbr: 'Osseous surgery 4+',    cat: 'Periodontics' },
  { code: 'D4341', desc: 'Periodontal scaling and root planing - four+ teeth per quadrant',    abbr: 'Perio SRP 4+',          coverage: 'Basic Services', cat: 'Periodontics' },
  { code: 'D4342', desc: 'Periodontal scaling and root planing - one to three teeth per quadrant', abbr: 'Perio SRP 1-3',     coverage: 'Basic Services', cat: 'Periodontics' },
  { code: 'D4346', desc: 'Scaling in presence of generalized moderate or severe gingival inflammation', abbr: 'Full mouth debridement scaling', coverage: 'Preventive Services', cat: 'Periodontics' },
  { code: 'D4355', desc: 'Full mouth debridement',                                             abbr: 'FM debridement',        coverage: 'Basic Services', cat: 'Periodontics' },
  { code: 'D4910', desc: 'Periodontal maintenance',                                            abbr: 'Perio maintenance',     coverage: 'Basic Services', cat: 'Periodontics' },

  // ── VI. Prosthodontics, removable (D5000–D5899) ──────────────────────────
  { code: 'D5110', desc: 'Complete denture - maxillary',                                       abbr: 'CD maxillary',          coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5120', desc: 'Complete denture - mandibular',                                      abbr: 'CD mandibular',         coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5130', desc: 'Immediate denture - maxillary',                                      abbr: 'Immediate denture max', coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5140', desc: 'Immediate denture - mandibular',                                     abbr: 'Immediate denture mand',coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5211', desc: 'Maxillary partial denture - resin base',                             abbr: 'Partial resin max',     coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5212', desc: 'Mandibular partial denture - resin base',                            abbr: 'Partial resin mand',    coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5213', desc: 'Maxillary partial denture - cast metal framework',                   abbr: 'Partial cast max',      coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5214', desc: 'Mandibular partial denture - cast metal framework',                  abbr: 'Partial cast mand',     coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5410', desc: 'Adjust complete denture - maxillary',                                abbr: 'Adjust CD max',         coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5411', desc: 'Adjust complete denture - mandibular',                               abbr: 'Adjust CD mand',        coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5510', desc: 'Repair broken complete denture base',                                abbr: 'Repair CD base',        coverage: 'Major Services', cat: 'Prosthodontics, removable' },
  { code: 'D5520', desc: 'Replace missing or broken teeth - complete denture',                 abbr: 'Replace tooth CD',      coverage: 'Major Services', cat: 'Prosthodontics, removable' },

  // ── VII. Maxillofacial Prosthetics (D5900–D5999) ─────────────────────────
  // (placeholder — add specific codes here as needed)

  // ── VIII. Implant Services (D6000–D6199) ─────────────────────────────────
  { code: 'D6010', desc: 'Surgical placement of implant body: endosteal implant',              abbr: 'Implant placement',     coverage: 'Major Services', cat: 'Implant Services' },
  { code: 'D6056', desc: 'Prefabricated abutment',                                             abbr: 'Prefab abutment',       coverage: 'Major Services', cat: 'Implant Services' },
  { code: 'D6058', desc: 'Abutment supported porcelain/ceramic crown',                         abbr: 'Implant crown ceramic', coverage: 'Major Services', cat: 'Implant Services' },
  { code: 'D6065', desc: 'Implant supported porcelain/ceramic crown',                          abbr: 'Implant crown supported',coverage: 'Major Services', cat: 'Implant Services' },
  { code: 'D6066', desc: 'Implant supported porcelain fused to metal crown',                   abbr: 'Implant crown PFM',     coverage: 'Major Services', cat: 'Implant Services' },

  // ── IX. Prosthodontics, fixed (D6200–D6999) ──────────────────────────────
  // (placeholder — add specific codes here as needed)

  // ── X. Oral & Maxillofacial Surgery (D7000–D7999) ────────────────────────
  { code: 'D7140', desc: 'Extraction, erupted tooth or exposed root',                          abbr: 'Extraction simple',     coverage: 'Basic Services', cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7210', desc: 'Extraction, erupted tooth requiring elevation',                      abbr: 'Extraction surgical',   coverage: 'Major Services', cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7220', desc: 'Removal of impacted tooth - soft tissue',                            abbr: 'Impacted soft tissue',  cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7230', desc: 'Removal of impacted tooth - partially bony',                         abbr: 'Impacted part bony',    cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7240', desc: 'Removal of impacted tooth - completely bony',                        abbr: 'Impacted full bony',    cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7250', desc: 'Removal of residual tooth roots',                                    abbr: 'Remove residual roots', cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7280', desc: 'Surgical access of an unerupted tooth',                              abbr: 'Surgical access unerupted', cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7310', desc: 'Alveoloplasty in conjunction with extractions - four+ teeth per quadrant', abbr: 'Alveoloplasty w/ext', cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7510', desc: 'Incision and drainage of abscess - intraoral soft tissue',           abbr: 'I&D abscess',           cat: 'Oral & Maxillofacial Surgery' },
  { code: 'D7953', desc: 'Bone replacement graft for ridge preservation - per site',           abbr: 'Ridge preservation graft', cat: 'Oral & Maxillofacial Surgery' },

  // ── XI. Orthodontics (D8000–D8999) ───────────────────────────────────────
  { code: 'D8010', desc: 'Limited orthodontic treatment of the primary dentition',             abbr: 'Ortho limited primary', coverage: 'Orthodontic Services', cat: 'Orthodontics' },
  { code: 'D8070', desc: 'Comprehensive orthodontic treatment of the transitional dentition',  abbr: 'Ortho comp transitional',coverage: 'Orthodontic Services', cat: 'Orthodontics' },
  { code: 'D8080', desc: 'Comprehensive orthodontic treatment of the adolescent dentition',    abbr: 'Ortho comp adolescent', coverage: 'Orthodontic Services', cat: 'Orthodontics' },
  { code: 'D8090', desc: 'Comprehensive orthodontic treatment of the adult dentition',         abbr: 'Ortho comp adult',      coverage: 'Orthodontic Services', cat: 'Orthodontics' },
  { code: 'D8660', desc: 'Pre-orthodontic treatment examination',                              abbr: 'Pre-ortho exam',        coverage: 'Orthodontic Services', cat: 'Orthodontics' },
  { code: 'D8670', desc: 'Periodic orthodontic treatment visit',                               abbr: 'Ortho periodic visit',  coverage: 'Orthodontic Services', cat: 'Orthodontics' },
  { code: 'D8680', desc: 'Orthodontic retention',                                              abbr: 'Ortho retention',       coverage: 'Orthodontic Services', cat: 'Orthodontics' },

  // ── XII. Adjunctive General Services (D9000–D9999) ───────────────────────
  { code: 'D9110', desc: 'Palliative (emergency) treatment of dental pain',                    abbr: 'Emergency treatment',   cat: 'Adjunctive General Services' },
  { code: 'D9211', desc: 'Regional block anesthesia',                                          abbr: 'Regional block',        cat: 'Adjunctive General Services' },
  { code: 'D9212', desc: 'Trigeminal division block anesthesia',                               abbr: 'Trigeminal block',      cat: 'Adjunctive General Services' },
  { code: 'D9215', desc: 'Local anesthesia in addition to other procedures',                   abbr: 'Local anesthesia',      cat: 'Adjunctive General Services' },
  { code: 'D9222', desc: 'Deep sedation/general anesthesia - first 15 minutes',                abbr: 'Deep sedation first',   cat: 'Adjunctive General Services' },
  { code: 'D9223', desc: 'Deep sedation/general anesthesia - each subsequent 15 min',          abbr: 'Deep sedation addl',    cat: 'Adjunctive General Services' },
  { code: 'D9230', desc: 'Inhalation of nitrous oxide/analgesia, anxiolysis',                  abbr: 'Nitrous oxide',         cat: 'Adjunctive General Services' },
  { code: 'D9239', desc: 'Intravenous moderate sedation - first 15 minutes',                   abbr: 'IV sedation first',     cat: 'Adjunctive General Services' },
  { code: 'D9243', desc: 'Intravenous moderate sedation - each subsequent 15 min',             abbr: 'IV sedation addl',      cat: 'Adjunctive General Services' },
  { code: 'D9248', desc: 'Non-intravenous conscious sedation',                                 abbr: 'Non-IV sedation',       cat: 'Adjunctive General Services' },
  { code: 'D9310', desc: 'Consultation - diagnostic service by a practitioner other than treating dentist', abbr: 'Consultation', cat: 'Adjunctive General Services' },
  { code: 'D9440', desc: 'Office visit - after regularly scheduled hours',                     abbr: 'After hours visit',     cat: 'Adjunctive General Services' },
  { code: 'D9910', desc: 'Application of desensitizing medicament',                            abbr: 'Desensitizing medicament', cat: 'Adjunctive General Services' },
  { code: 'D9930', desc: 'Treatment of complications - post-surgical',                         abbr: 'Post-surgical complications', cat: 'Adjunctive General Services' },
  { code: 'D9944', desc: 'Occlusal guard - hard appliance, full arch',                         abbr: 'Night guard hard',      cat: 'Adjunctive General Services' },
  { code: 'D9972', desc: 'External bleaching - per arch',                                      abbr: 'Bleaching per arch',    cat: 'Adjunctive General Services' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getRequirements(code: string) {
  const req = {
    RequiresXRay: false,
    RequiresNarrative: false,
    RequiresPerioChart: false,
    RequiresConsent: false,
    RequiresMedicalNecessity: false,
    RequiresToothImage: false,
  };

  if (['D0140', 'D0160'].includes(code)) req.RequiresNarrative = true;
  if (['D0180'].includes(code)) req.RequiresPerioChart = true;

  if (['D0210', 'D0220', 'D0230', 'D0240', 'D0250', 'D0270', 'D0272', 'D0273', 'D0274', 'D0277', 'D0330', 'D0340', 'D1351', 'D1352', 'D4346'].includes(code)) {
    req.RequiresXRay = true;
  }
  if (['D4346'].includes(code)) {
    req.RequiresNarrative = true;
  }

  const isAmalgam = code >= 'D2140' && code <= 'D2161';
  const isComposite = code >= 'D2330' && code <= 'D2394';
  if (isAmalgam || isComposite || ['D4341', 'D4342', 'D7140'].includes(code)) {
    req.RequiresXRay = true;
  }
  if (['D4341', 'D4342'].includes(code)) {
    req.RequiresPerioChart = true;
  }

  const isCrown = code >= 'D2740' && code <= 'D2799';
  const isImplantAbutment = code >= 'D6056' && code <= 'D6068';
  const isDenture = ['D5110', 'D5120', 'D5211', 'D5212', 'D5213', 'D5214'].includes(code);

  if (isCrown || isImplantAbutment || isDenture || ['D2950', 'D3330', 'D7210', 'D6010'].includes(code)) {
    req.RequiresXRay = true;
  }
  if (isCrown || isImplantAbutment || ['D2950', 'D6010'].includes(code)) {
    req.RequiresNarrative = true;
  }

  if (['D8070', 'D8080', 'D8090', 'D8670', 'D8680'].includes(code)) {
    req.RequiresXRay = true;
    req.RequiresNarrative = true;
  }

  return req;
}

/** Ensure a `definition` row exists for a given ADA category name (Category=1).
 *  Returns the DefNum of the found or newly created row. */
async function ensureCategoryDef(
  categoryName: string,
  itemOrder: number,
  defNumCache: Map<string, bigint>
): Promise<bigint> {
  if (defNumCache.has(categoryName)) return defNumCache.get(categoryName)!;

  const existing = await prisma.definition.findFirst({
    where: { Category: 1, ItemName: categoryName },
  });

  if (existing) {
    defNumCache.set(categoryName, existing.DefNum);
    return existing.DefNum;
  }

  const defNum = await getNextId('definition', 'DefNum');
  await prisma.definition.create({
    data: {
      DefNum: defNum,
      Category: 1,
      ItemOrder: itemOrder,
      ItemName: categoryName,
      ItemValue: '',
      ItemColor: 0,
      IsHidden: 0,
    },
  });

  console.log(`  ✔ Created category definition: "${categoryName}" (DefNum=${defNum})`);
  defNumCache.set(categoryName, defNum);
  return defNum;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function seedProcedureCodes() {
  console.log('='.repeat(60));
  console.log('Seeding ADA procedure code categories & codes...');
  console.log('='.repeat(60));

  // 1. Ensure ALL 12 official ADA categories exist in definition table
  //    (even if no procedure codes exist for that category yet)
  const defNumCache = new Map<string, bigint>();
  console.log(`\nStep 1: Ensuring all ${ADA_CATEGORIES.length} ADA categories exist in definition table...`);
  for (const cat of ADA_CATEGORIES) {
    await ensureCategoryDef(cat.name, cat.itemOrder, defNumCache);
  }

  // 2. Seed / update procedure codes
  console.log(`\nStep 2: Seeding ${procedureCodes.length} procedure codes...`);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const proc of procedureCodes) {
    const catDefNum = defNumCache.get(proc.cat);
    if (!catDefNum) {
      console.warn(`  ⚠ Unknown category "${proc.cat}" for code ${proc.code} — skipping`);
      skipped++;
      continue;
    }

    const reqs = getRequirements(proc.code);

    const existing = await prisma.procedurecode.findFirst({
      where: { ProcCode: proc.code },
    });

    if (existing) {
      // Update if category changed (fixes previously-wrong ProcCat values)
      if (
        existing.ProcCat !== catDefNum ||
        existing.CoverageCategory !== (proc.coverage || null) || 
        existing.RequiresXRay !== reqs.RequiresXRay ||
        existing.RequiresNarrative !== reqs.RequiresNarrative ||
        existing.RequiresPerioChart !== reqs.RequiresPerioChart ||
        existing.RequiresConsent !== reqs.RequiresConsent ||
        existing.RequiresMedicalNecessity !== reqs.RequiresMedicalNecessity ||
        existing.RequiresToothImage !== reqs.RequiresToothImage
      ) {
        await prisma.procedurecode.update({
          where: { ProcCode: proc.code },
          data: { 
            ProcCat: catDefNum,
            CoverageCategory: proc.coverage || null,
            ...reqs
          },
        });
        updated++;
        console.log(`  ↻ Updated ${proc.code} → "${proc.cat}" (DefNum=${catDefNum})`);
      } else {
        skipped++;
      }
      continue;
    }

    const codeNum = await getNextId('procedurecode', 'CodeNum');
    await prisma.procedurecode.create({
      data: {
        CodeNum: codeNum,
        ProcCode: proc.code,
        Descript: proc.desc,
        AbbrDesc: proc.abbr,
        ProcCat: catDefNum,
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
        ...reqs,
      },
    });
    created++;
    console.log(`  ✔ Created ${proc.code} — "${proc.desc}" [${proc.cat}]`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done. Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);
  console.log('='.repeat(60));
}

seedProcedureCodes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding procedure codes:', err);
    process.exit(1);
  });