export type ExamType = 
  | 'radiographic'
  | 'tmj'
  | 'head-neck'
  | 'tooth-structure'
  | 'teeth-structure'
  | 'morphological'
  | 'periodontal'
  | 'dentofacial'
  | 'airway'
  | 'biomechanical'
  | 'functional'
  | 'dentofacial-opinion'
  | 'periodontal-opinion';

export interface UpsertExamInput {
  patientId: string;
  providerId: string;
  examData: any;
}
