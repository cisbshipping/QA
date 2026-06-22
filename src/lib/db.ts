import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp,
  Timestamp, type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Complaint, Inspection, AppUser, AuditLog, Invite, UserRole, PublicSubmission, PublicSubmissionStatus } from '@/types';

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

function mapComplaint(id: string, data: Record<string, unknown>): Complaint {
  return {
    ...(data as Omit<Complaint, 'id' | 'dateRecorded' | 'dateIssuedToFactory' | 'reviewedAt' | 'closedAt' | 'createdAt' | 'updatedAt'>),
    id,
    dateRecorded: toDate(data.dateRecorded),
    dateIssuedToFactory: data.dateIssuedToFactory ? toDate(data.dateIssuedToFactory) : undefined,
    reviewedAt: data.reviewedAt ? toDate(data.reviewedAt) : undefined,
    closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapInspection(id: string, data: Record<string, unknown>): Inspection {
  return {
    ...(data as Omit<Inspection, 'id' | 'dateRequested' | 'factoryCommitDate' | 'requestedByDate' | 'hodDate' | 'inspectionDate' | 'rescheduledDate' | 'reviewedAt' | 'closedAt' | 'createdAt' | 'updatedAt'>),
    id,
    dateRequested: toDate(data.dateRequested),
    factoryCommitDate: toDate(data.factoryCommitDate),
    requestedByDate: toDate(data.requestedByDate),
    hodDate: data.hodDate ? toDate(data.hodDate) : undefined,
    inspectionDate: data.inspectionDate ? toDate(data.inspectionDate) : undefined,
    rescheduledDate: data.rescheduledDate ? toDate(data.rescheduledDate) : undefined,
    reviewedAt: data.reviewedAt ? toDate(data.reviewedAt) : undefined,
    closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

// Auto-number helpers
export async function generateComplaintNo(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `CR${yy}-${mm}-`;
  const q = query(collection(db, 'complaints'), where('complaintNo', '>=', prefix), where('complaintNo', '<', prefix + 'z'));
  const snap = await getDocs(q);
  const seq = snap.size + 1;
  return `${prefix}${String(seq).padStart(2, '0')}`;
}

export async function generateInspectionNo(piNo: string): Promise<string> {
  return piNo.startsWith('PIN') ? piNo : piNo;
}

// Complaints CRUD
export async function getComplaints(constraints: QueryConstraint[] = []): Promise<Complaint[]> {
  const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => mapComplaint(d.id, d.data() as Record<string, unknown>));
}

export async function getComplaint(id: string): Promise<Complaint | null> {
  const snap = await getDoc(doc(db, 'complaints', id));
  if (!snap.exists()) return null;
  return mapComplaint(snap.id, snap.data() as Record<string, unknown>);
}

export async function createComplaint(data: Omit<Complaint, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'complaints'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({ targetType: 'complaint', targetId: ref.id, action: 'created', userId: data.recordedByUid, userName: data.recordedBy });
  return ref.id;
}

export async function updateComplaint(id: string, data: Partial<Complaint>, userId: string, userName: string, action = 'updated'): Promise<void> {
  await updateDoc(doc(db, 'complaints', id), { ...data, updatedAt: serverTimestamp() });
  await logAudit({ targetType: 'complaint', targetId: id, action, userId, userName, details: JSON.stringify(Object.keys(data)) });
}

export async function deleteComplaint(id: string, userId: string, userName: string): Promise<void> {
  await deleteDoc(doc(db, 'complaints', id));
  await logAudit({ targetType: 'complaint', targetId: id, action: 'deleted', userId, userName });
}

// Inspections CRUD
export async function getInspections(constraints: QueryConstraint[] = []): Promise<Inspection[]> {
  const q = query(collection(db, 'inspections'), orderBy('createdAt', 'desc'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => mapInspection(d.id, d.data() as Record<string, unknown>));
}

export async function getInspection(id: string): Promise<Inspection | null> {
  const snap = await getDoc(doc(db, 'inspections', id));
  if (!snap.exists()) return null;
  return mapInspection(snap.id, snap.data() as Record<string, unknown>);
}

export async function createInspection(data: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'inspections'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({ targetType: 'inspection', targetId: ref.id, action: 'created', userId: data.picUid, userName: data.picName });
  return ref.id;
}

export async function updateInspection(id: string, data: Partial<Inspection>, userId: string, userName: string, action = 'updated'): Promise<void> {
  await updateDoc(doc(db, 'inspections', id), { ...data, updatedAt: serverTimestamp() });
  await logAudit({ targetType: 'inspection', targetId: id, action, userId, userName, details: JSON.stringify(Object.keys(data)) });
}

// Users
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return { ...d as Omit<AppUser, 'createdAt'>, uid: snap.id, createdAt: toDate(d.createdAt) };
}

export async function createUser(uid: string, data: Omit<AppUser, 'uid' | 'createdAt'>): Promise<void> {
  await setDoc(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() }, { merge: true });
}

export async function getUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    return { ...data as Omit<AppUser, 'uid' | 'createdAt'>, uid: d.id, createdAt: toDate(data.createdAt) };
  });
}

// Invites (allowlist for sign-in)
export async function getInvite(email: string): Promise<Invite | null> {
  const snap = await getDoc(doc(db, 'invites', email.toLowerCase()));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return { ...d as Omit<Invite, 'invitedAt'>, email: snap.id, invitedAt: toDate(d.invitedAt) };
}

export async function listInvites(): Promise<Invite[]> {
  const snap = await getDocs(collection(db, 'invites'));
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    return { ...data as Omit<Invite, 'email' | 'invitedAt'>, email: d.id, invitedAt: toDate(data.invitedAt) };
  });
}

export async function createInvite(email: string, role: UserRole, name: string | undefined, invitedBy: string): Promise<void> {
  await setDoc(doc(db, 'invites', email.toLowerCase()), {
    role, name: name ?? '', invitedBy, invitedAt: serverTimestamp(),
  });
}

export async function deleteInvite(email: string): Promise<void> {
  await deleteDoc(doc(db, 'invites', email.toLowerCase()));
}

// Public submissions
function mapSubmission(id: string, data: Record<string, unknown>): PublicSubmission {
  return {
    ...(data as Omit<PublicSubmission, 'id' | 'createdAt' | 'processedAt' | 'factoryCommitDate'>),
    id,
    factoryCommitDate: data.factoryCommitDate ? toDate(data.factoryCommitDate) : undefined,
    processedAt: data.processedAt ? toDate(data.processedAt) : undefined,
    createdAt: toDate(data.createdAt),
  };
}

export async function generateSubmissionRef(type: 'complaint' | 'inspection'): Promise<string> {
  // Client-side generated so unauthenticated public submitters don't need list permission.
  // Format: PC|PI + YYMM + 6-char base36 timestamp suffix (collision-safe).
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = type === 'complaint' ? `PC${yy}${mm}-` : `PI${yy}${mm}-`;
  const suffix = (Date.now() % 0x7fffffff).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return `${prefix}${suffix}`;
}

export async function createPublicSubmission(data: Omit<PublicSubmission, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const ref = await addDoc(collection(db, 'publicSubmissions'), {
    ...data,
    status: 'new',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listPublicSubmissions(): Promise<PublicSubmission[]> {
  const q = query(collection(db, 'publicSubmissions'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => mapSubmission(d.id, d.data() as Record<string, unknown>));
}

export async function getPublicSubmission(id: string): Promise<PublicSubmission | null> {
  const snap = await getDoc(doc(db, 'publicSubmissions', id));
  if (!snap.exists()) return null;
  return mapSubmission(snap.id, snap.data() as Record<string, unknown>);
}

export async function updatePublicSubmission(id: string, status: PublicSubmissionStatus, processedBy: string, notes?: string): Promise<void> {
  await updateDoc(doc(db, 'publicSubmissions', id), {
    status, processedBy, notes: notes ?? '', processedAt: serverTimestamp(),
  });
}

// Audit logs
async function logAudit(data: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), { ...data, timestamp: serverTimestamp() });
}

export async function getAuditLogs(targetType?: string, targetId?: string): Promise<AuditLog[]> {
  const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc')];
  if (targetType) constraints.push(where('targetType', '==', targetType));
  if (targetId) constraints.push(where('targetId', '==', targetId));
  const q = query(collection(db, 'auditLogs'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    return { ...data as Omit<AuditLog, 'id' | 'timestamp'>, id: d.id, timestamp: toDate(data.timestamp) };
  });
}
