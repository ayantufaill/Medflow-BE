export type ExamType = 
  | 'radiographic'
  | 'tmj'
  | 'head-neck'
  | 'tooth-structure'
  | 'morphological'
  | 'periodontal'
  | 'dentofacial'
  | 'airway';

export interface UpsertExamInput {
  patientId: string;
  providerId: string;
  examData: any;
}
