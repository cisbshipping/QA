export type UserRole = 'admin' | 'manager' | 'qa' | 'viewer';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  qa: 'QA',
  viewer: 'Viewer',
};
export type ComplaintStatus = 'open' | 'accepted' | 'rejected' | 'closed';
export type InspectionStatus = 'pending' | 'accepted' | 'rejected' | 'passed' | 'failed' | 'rescheduled';
export type InspectorType = 'in-house' | 'pic' | 'third-party';
export type AqlLevel = 'G1/AQL 1.5' | 'G1/AQL 2.5' | 'G1/AQL 4.0' | 'other';

export const YL_COMPANIES = [
  'Cranberry (M) Sdn. Bhd.',
  'Multisafe Sdn. Bhd.',
  'ASAP International Sdn. Bhd.',
  'Cranberry International Sdn. Bhd.',
  'EcoBee Sdn. Bhd.',
] as const;
export type YLCompany = typeof YL_COMPANIES[number];

export const COMPLAINT_NATURES = [
  'Holes', 'Tears', 'Lumps', 'Dirt / Stain', 'Appearance',
  'Powder', 'Beading', 'Tacky / Sticky', 'Labeling', 'Packaging',
] as const;
export type ComplaintNature = typeof COMPLAINT_NATURES[number];

export const INSPECTION_FOCUS_AREAS = [
  'Water Tight Test', 'Packaging', 'Dispensing',
] as const;

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  createdAt: Date;
}

export interface Invite {
  email: string;
  role: UserRole;
  name?: string;
  invitedBy: string;
  invitedAt: Date;
}

export interface Complaint {
  id: string;
  complaintNo: string;
  recordedBy: string;
  recordedByUid: string;
  dateRecorded: Date;
  // Customer
  consignee: string;
  contactPerson?: string;
  phoneNo?: string;
  faxNo?: string;
  emailAddress?: string;
  // Product
  factory: string;
  brandName: string;
  productName: string;
  piNo: string;
  poNo?: string;
  lotNo?: string;
  size?: string;
  quantityInvolved: string;
  // Defective samples
  hasDefectiveSamplePhoto: boolean;
  hasDefectiveSampleReturn: boolean;
  returnSampleQty?: string;
  // Complaint details
  natures: ComplaintNature[];
  othersDescription?: string;
  description: string;
  // Workflow
  status: ComplaintStatus;
  dateIssuedToFactory?: Date;
  forwardedBy?: string;
  supplierResponseUrl?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Inspection {
  id: string;
  picName: string;
  picUid: string;
  department: string;
  dateRequested: Date;
  // Order info
  company: YLCompany;
  customer: string;
  customerCountry?: string;
  customerPiNo: string;
  supplierPoNo: string;
  factory: string;
  factoryCommitDate: Date;
  totalQtyCartons: number;
  product: string;
  productStandard?: string;
  productGrade?: string;
  containerSize?: string;
  // Criteria acknowledgements
  criteriaNotIndustrial: boolean;
  criteriaUnderstandOutsideKV: boolean;
  criteriaCostBelow020: boolean;
  // Inspection details
  reasonForRequest: string;
  focusAreas: string[];
  focusOthers?: string;
  aqlLevel: AqlLevel;
  aqlOther?: string;
  inspectorTypes: InspectorType[];
  remarks?: string;
  needsPsiReport: boolean;
  // Approvals
  requestedByName: string;
  requestedByDate: Date;
  hodName: string;
  hodDate?: Date;
  // Workflow
  status: InspectionStatus;
  inspectionDate?: Date;
  inspectionResult?: 'pass' | 'fail';
  resultNotes?: string;
  rescheduledDate?: Date;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicSubmissionType = 'complaint' | 'inspection';
export type PublicSubmissionStatus = 'new' | 'processed' | 'dismissed';

export interface SubmissionPhoto {
  name: string;
  storagePath: string;
  downloadUrl: string;
  size: number;
  contentType: string;
  syncedToOneDrive?: boolean;
  oneDriveUrl?: string;
}

export interface PublicSubmission {
  id: string;
  type: PublicSubmissionType;
  referenceNo: string;
  // Submitter contact
  submitterName: string;
  submitterEmail: string;
  submitterPhone?: string;
  submitterCompany?: string;
  // Common
  description: string;
  // Inspection-specific (free-text product description)
  productInfo?: string;
  // Complaint-specific structured product info
  factorySupplier?: string;
  brandName?: string;
  productName?: string;
  piNo?: string;
  poNo?: string;
  lotNo?: string;
  size?: string;
  quantityInvolved?: string;
  hasDefectiveSamplePhoto?: boolean;
  hasDefectiveSampleReturn?: boolean;
  returnSampleQty?: string;
  photos?: SubmissionPhoto[];
  natures?: ComplaintNature[];
  othersDescription?: string;
  // Inspection-specific
  factoryLocation?: string;
  factoryCommitDate?: Date;
  totalQtyCartons?: number;
  customerPiNo?: string;
  // Workflow
  status: PublicSubmissionStatus;
  processedBy?: string;
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  targetType: 'complaint' | 'inspection' | 'user';
  targetId: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: Date;
  details?: string;
}
