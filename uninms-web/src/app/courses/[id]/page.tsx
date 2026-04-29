'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi, documentsApi, assignmentsApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  BookMarked, ArrowLeft, FileText, Users, Download, Eye,
  Plus, Trash2, Loader2, GraduationCap, X, Copy, Check, Upload, CloudUpload,
  ClipboardList, Calendar, AlertCircle, CheckCircle2, Clock, Star,
  ChevronDown, ChevronUp, Send,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const DOC_TYPES = [
  { value: 'lecture_note',   label: 'Lecture notes' },
  { value: 'past_question',  label: 'Past questions' },
  { value: 'research_paper', label: 'Research paper' },
  { value: 'dataset',        label: 'Dataset' },
  { value: 'other',          label: 'Other' },
];

// ── Add Material Modal ─────────────────────────────────────────────────────────
function AddMaterialModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile]       = useState<File | null>(null);
  const [title, setTitle]     = useState('');
  const [docType, setDocType] = useState('lecture_note');
  const [uploading, setUploading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      fd.append('docType', docType);
      fd.append('visibility', 'public');
      const uploadRes = await documentsApi.upload(fd) as any;
      const docId = uploadRes?.data?.id;
      if (!docId) throw new Error('Upload failed — no document ID returned');
      await coursesApi.addMaterial(courseId, docId);
      toast.success('Material uploaded and added to course');
      qc.invalidateQueries({ queryKey: ['course-materials', courseId] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">Upload course material</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <label className={`flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed cursor-pointer transition-colors mb-4
          ${file ? 'border-primary-400 bg-primary-50' : 'border-stone-200 bg-stone-50 hover:border-primary-300 hover:bg-primary-50/40'}`}>
          <input type="file" className="hidden" onChange={handleFile}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip" />
          {file ? (
            <>
              <FileText size={24} className="text-primary-600" />
              <p className="text-sm font-medium text-primary-700">{file.name}</p>
              <p className="text-xs text-stone-400">{(file.size / 1024 / 1024).toFixed(2)} MB — click to change</p>
            </>
          ) : (
            <>
              <CloudUpload size={24} className="text-stone-400" />
              <p className="text-sm text-stone-500">Click to select a file</p>
              <p className="text-xs text-stone-400">PDF, Word, PowerPoint, Excel, CSV — max 50 MB</p>
            </>
          )}
        </label>
        <div className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Week 3 — Introduction to Algorithms" className="input" />
          </div>
          <div>
            <label className="label">Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="input">
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={!file || !title.trim() || uploading} className="btn-primary flex-1">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Assignment Modal ────────────────────────────────────────────────────
function CreateAssignmentModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle]           = useState('');
  const [instructions, setInstructions] = useState('');
  const [type, setType]             = useState<'individual' | 'group'>('individual');
  const [maxMarks, setMaxMarks]     = useState(100);
  const [dueDate, setDueDate]       = useState('');
  const [allowLate, setAllowLate]   = useState(false);
  const [saving, setSaving]         = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await assignmentsApi.create(courseId, {
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        type,
        maxMarks,
        dueDate: dueDate || undefined,
        allowLate,
      });
      toast.success('Assignment created');
      qc.invalidateQueries({ queryKey: ['assignments', courseId] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">Create assignment</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Assignment 1 — Data Structures" className="input" />
          </div>
          <div>
            <label className="label">Instructions</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
              placeholder="Describe what students should do…"
              rows={4} className="input resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select value={type} onChange={e => setType(e.target.value as 'individual' | 'group')} className="input">
                <option value="individual">Individual</option>
                <option value="group">Group</option>
              </select>
            </div>
            <div>
              <label className="label">Max marks</label>
              <input type="number" value={maxMarks} onChange={e => setMaxMarks(Number(e.target.value))}
                min={1} max={1000} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Due date (optional)</label>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={allowLate} onChange={e => setAllowLate(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300 accent-primary-600" />
            <span className="text-sm text-stone-700">Allow late submissions</span>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || saving} className="btn-primary flex-1">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Plus size={14} /> Create</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Submit Assignment Modal (student) ─────────────────────────────────────────
function SubmitModal({ assignment, onClose }: { assignment: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile]   = useState<File | null>(null);
  const [note, setNote]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (note.trim()) fd.append('note', note.trim());
      await assignmentsApi.submit(assignment.id, fd);
      toast.success('Assignment submitted!');
      qc.invalidateQueries({ queryKey: ['assignments', assignment.course_id] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-xl font-semibold text-stone-900">Submit assignment</h3>
            <p className="text-sm text-stone-500 mt-0.5">{assignment.title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Attach file (optional)</label>
            <label className={`flex flex-col items-center justify-center gap-2 w-full h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors
              ${file ? 'border-primary-400 bg-primary-50' : 'border-stone-200 bg-stone-50 hover:border-primary-300 hover:bg-primary-50/40'}`}>
              <input type="file" className="hidden" onChange={handleFile}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip" />
              {file ? (
                <>
                  <FileText size={20} className="text-primary-600" />
                  <p className="text-xs font-medium text-primary-700">{file.name}</p>
                </>
              ) : (
                <>
                  <CloudUpload size={20} className="text-stone-400" />
                  <p className="text-xs text-stone-500">Click to attach a file</p>
                </>
              )}
            </label>
          </div>
          <div>
            <label className="label">Note / comments</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Any comments for your lecturer…" rows={3} className="input resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={(!file && !note.trim()) || submitting} className="btn-primary flex-1">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send size={14} /> Submit</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grade Modal (lecturer) ────────────────────────────────────────────────────
function GradeModal({ submission, maxMarks, onClose }: { submission: any; maxMarks: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [marks, setMarks]       = useState(submission.marks ?? '');
  const [grade, setGrade]       = useState(submission.grade ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await assignmentsApi.grade(submission.id, {
        marks: marks !== '' ? Number(marks) : undefined,
        grade: grade.trim() || undefined,
        feedback: feedback.trim() || undefined,
        status: 'graded',
      });
      toast.success('Submission graded');
      qc.invalidateQueries({ queryKey: ['submissions'] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-xl font-semibold text-stone-900">Grade submission</h3>
            <p className="text-sm text-stone-500 mt-0.5">{submission.student_name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>

        {/* Student note */}
        {submission.note && (
          <div className="bg-stone-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-1">Student note</p>
            <p className="text-sm text-stone-700">{submission.note}</p>
          </div>
        )}
        {/* File */}
        {submission.file_name && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-stone-50 rounded-xl">
            <FileText size={14} className="text-stone-400" />
            <span className="text-sm text-stone-700 flex-1 truncate">{submission.file_name}</span>
            {submission.is_late && <span className="badge badge-gold text-xs">Late</span>}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Marks (out of {maxMarks})</label>
              <input type="number" value={marks} onChange={e => setMarks(e.target.value)}
                min={0} max={maxMarks} className="input" placeholder="e.g. 85" />
            </div>
            <div>
              <label className="label">Grade (optional)</label>
              <input value={grade} onChange={e => setGrade(e.target.value)}
                className="input" placeholder="e.g. A, B+, Pass" />
            </div>
          </div>
          <div>
            <label className="label">Feedback</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="Write feedback for the student…" rows={4} className="input resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Star size={14} /> Save grade</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assignment Row (lecturer) ─────────────────────────────────────────────────
function AssignmentRowLecturer({ a, courseId }: { a: any; courseId: string }) {
  const qc = useQueryClient();
  const [open, setOpen]   = useState(false);
  const [grading, setGrading] = useState<any>(null);

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['submissions', a.id],
    queryFn: () => assignmentsApi.submissions(a.id),
    enabled: open,
  });
  const submissions = (subData as any)?.data?.submissions ?? [];

  const deleteAssignment = useMutation({
    mutationFn: () => assignmentsApi.remove(a.id),
    onSuccess: () => {
      toast.success('Assignment deleted');
      qc.invalidateQueries({ queryKey: ['assignments', courseId] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const isOverdue = a.due_date && new Date() > new Date(a.due_date);

  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50 transition-colors">
        <ClipboardList size={16} className="text-primary-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900 truncate">{a.title}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-stone-400">{a.type} · {a.max_marks} marks</span>
            {a.due_date && (
              <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
                <Calendar size={10} /> {new Date(a.due_date).toLocaleDateString('en-NG', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
              </span>
            )}
            <span className="text-xs text-stone-500 font-medium">{a.submission_count} submission{a.submission_count !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); deleteAssignment.mutate(); }}
            disabled={deleteAssignment.isPending}
            className="p-1.5 text-stone-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
          {open ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100 bg-stone-50/50 p-4">
          {a.instructions && (
            <p className="text-sm text-stone-600 mb-4 whitespace-pre-wrap">{a.instructions}</p>
          )}
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Submissions</h4>
          {subLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton" />)}</div>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-stone-400 py-4 text-center">No submissions yet</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-stone-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{s.student_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-stone-400">{s.matric_number}</span>
                      {s.is_late && <span className="badge badge-gold text-xs">Late</span>}
                      {s.status === 'graded' && <span className="badge badge-green text-xs">Graded</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.marks != null && (
                      <span className="text-sm font-semibold text-stone-700">{s.marks}/{a.max_marks}</span>
                    )}
                    <button onClick={() => setGrading(s)}
                      className="btn-secondary btn-sm text-xs">
                      {s.status === 'graded' ? 'Edit grade' : 'Grade'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {grading && (
        <GradeModal submission={grading} maxMarks={a.max_marks} onClose={() => setGrading(null)} />
      )}
    </div>
  );
}

// ── Status badge helper ───────────────────────────────────────────────────────
function SubmissionBadge({ status }: { status?: string }) {
  if (!status) return <span className="badge badge-stone text-xs">Not submitted</span>;
  if (status === 'graded') return <span className="badge badge-green text-xs flex items-center gap-1"><CheckCircle2 size={10} /> Graded</span>;
  return <span className="badge badge-blue text-xs flex items-center gap-1"><Clock size={10} /> Submitted</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'materials' | 'assignments' | 'students'>('materials');
  const [showAddMaterial, setShowAddMaterial]       = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [submitTarget, setSubmitTarget]             = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const copyCourseId = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success('Course ID copied — share with students');
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: courseData, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.get(id),
    enabled: !!id,
  });

  const { data: matData, isLoading: matLoading } = useQuery({
    queryKey: ['course-materials', id],
    queryFn: () => coursesApi.materials(id),
    enabled: !!id && tab === 'materials',
  });

  const { data: assignData, isLoading: assignLoading } = useQuery({
    queryKey: ['assignments', id],
    queryFn: () => assignmentsApi.list(id),
    enabled: !!id && tab === 'assignments',
  });

  const { data: stuData, isLoading: stuLoading } = useQuery({
    queryKey: ['course-students', id],
    queryFn: () => coursesApi.students(id),
    enabled: !!id && tab === 'students',
  });

  const removeMaterial = useMutation({
    mutationFn: (materialId: string) => coursesApi.removeMaterial(id, materialId),
    onSuccess: () => {
      toast.success('Material removed');
      qc.invalidateQueries({ queryKey: ['course-materials', id] });
    },
    onError: () => toast.error('Failed to remove material'),
  });

  const course      = courseData?.data as any;
  const materials   = (matData?.data as any)?.materials ?? [];
  const assignments = (assignData as any)?.data?.assignments ?? [];
  const students    = (stuData?.data as any)?.students ?? [];

  const isOwner    = course?.lecturer_id === user?.id;
  const isAdmin    = user?.roles?.some((r: string) => ['admin', 'super_admin', 'management'].includes(r));
  const isLecturer = user?.roles?.some((r: string) => ['lecturer'].includes(r));
  const canManage  = isOwner || isAdmin;
  const isStudent  = !isLecturer && !isAdmin;

  if (isLoading) return (
    <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
  );
  if (!course) return (
    <div className="max-w-3xl mx-auto py-20 text-center">
      <BookMarked size={48} className="mx-auto mb-4 text-stone-300" />
      <h2 className="font-display text-2xl font-semibold text-stone-700 mb-2">Course not found</h2>
      <Link href="/courses" className="btn-primary">Back to courses</Link>
    </div>
  );

  const levelColor: Record<string, string> = {
    '100': 'badge-green', '200': 'badge-blue', '300': 'badge-purple',
    '400': 'badge-gold',  '500': 'badge-stone', '600': 'badge-stone',
  };

  const tabs = [
    { key: 'materials',   label: 'Materials',    Icon: FileText },
    { key: 'assignments', label: 'Assignments',  Icon: ClipboardList },
    ...(canManage ? [{ key: 'students', label: 'Students', Icon: Users }] : []),
  ] as const;

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/courses" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to courses
      </Link>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {course.course_code && <span className="badge-stone badge font-mono">{course.course_code}</span>}
          {course.level && <span className={`badge ${levelColor[course.level] ?? 'badge-stone'}`}>{course.level} level</span>}
          {course.semester && <span className="badge-stone badge">{course.semester}</span>}
        </div>
        <h1 className="font-display text-2xl font-semibold text-stone-900 mb-2">{course.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500">
          {course.lecturer_name && (
            <span className="flex items-center gap-1.5">
              <GraduationCap size={14} className="text-stone-400" /> {course.lecturer_name}
            </span>
          )}
          {course.department_name && <span>{course.department_name}</span>}
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-stone-400" />
            {course.enrolled_count ?? 0} student{course.enrolled_count !== 1 ? 's' : ''}
          </span>
        </div>
        {course.description && (
          <p className="text-stone-500 text-sm mt-3 leading-relaxed">{course.description}</p>
        )}

        {/* Share course ID — lecturers / admin only */}
        {canManage && (
          <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-0.5">Course ID — share with students to enrol</p>
              <p className="text-xs font-mono text-stone-600 truncate">{id}</p>
            </div>
            <button onClick={copyCourseId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 hover:bg-primary-50 hover:text-primary-700 text-stone-600 transition-colors flex-shrink-0">
              {copied ? <><Check size={12} className="text-green-600" /> Copied!</> : <><Copy size={12} /> Copy ID</>}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-stone-100 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Materials tab ── */}
      {tab === 'materials' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-stone-900">
              {materials.length} material{materials.length !== 1 ? 's' : ''}
            </h2>
            {canManage && (
              <button onClick={() => setShowAddMaterial(true)} className="btn-primary btn-sm">
                <Plus size={13} /> Add material
              </button>
            )}
          </div>
          {matLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton" />)}</div>
          ) : materials.length === 0 ? (
            <div className="py-10 text-center text-stone-400">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No materials yet</p>
              {canManage && (
                <button onClick={() => setShowAddMaterial(true)} className="btn-primary mt-3">
                  <Plus size={14} /> Add first material
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {materials.map((m: any) => (
                <div key={m.material_id}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-stone-50 transition-colors group">
                  <FileText size={14} className="text-stone-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link href={`/repository/${m.id}`}
                      className="text-sm text-stone-700 truncate group-hover:text-primary-700 hover:underline block">
                      {m.title}
                    </Link>
                    <p className="text-xs text-stone-400">{m.doc_type?.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-400 flex-shrink-0">
                    <span className="flex items-center gap-1"><Eye size={10} />{m.view_count}</span>
                    <span className="flex items-center gap-1"><Download size={10} />{m.download_count}</span>
                  </div>
                  {canManage && (
                    <button onClick={() => removeMaterial.mutate(m.material_id)}
                      disabled={removeMaterial.isPending}
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-300 hover:text-red-500 transition-all">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Assignments tab ── */}
      {tab === 'assignments' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-stone-900">
              {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
            </h2>
            {canManage && (
              <button onClick={() => setShowCreateAssignment(true)} className="btn-primary btn-sm">
                <Plus size={13} /> Create assignment
              </button>
            )}
          </div>

          {assignLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton" />)}</div>
          ) : assignments.length === 0 ? (
            <div className="py-10 text-center text-stone-400">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No assignments yet</p>
              {canManage && (
                <button onClick={() => setShowCreateAssignment(true)} className="btn-primary mt-3">
                  <Plus size={14} /> Create first assignment
                </button>
              )}
            </div>
          ) : canManage ? (
            /* Lecturer view */
            <div className="space-y-3">
              {assignments.map((a: any) => (
                <AssignmentRowLecturer key={a.id} a={a} courseId={id} />
              ))}
            </div>
          ) : (
            /* Student view */
            <div className="space-y-3">
              {assignments.map((a: any) => {
                const isOverdue = a.due_date && new Date() > new Date(a.due_date);
                const canSubmit = !a.my_submission_id && (!isOverdue || a.allow_late);
                return (
                  <div key={a.id} className="border border-stone-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <ClipboardList size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium text-stone-900">{a.title}</p>
                          <SubmissionBadge status={a.my_status} />
                        </div>
                        {a.instructions && (
                          <p className="text-xs text-stone-500 mt-1 line-clamp-2">{a.instructions}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-stone-400">{a.type} · {a.max_marks} marks</span>
                          {a.due_date && (
                            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
                              <Calendar size={10} />
                              Due {new Date(a.due_date).toLocaleDateString('en-NG', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                              {isOverdue && ' (overdue)'}
                            </span>
                          )}
                          {a.my_marks != null && (
                            <span className="text-xs font-semibold text-green-700">
                              Score: {a.my_marks}/{a.max_marks}
                              {a.my_grade && ` · ${a.my_grade}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canSubmit && (
                      <div className="mt-3 pt-3 border-t border-stone-100">
                        <button onClick={() => setSubmitTarget(a)} className="btn-primary btn-sm">
                          <Send size={12} /> Submit
                        </button>
                      </div>
                    )}
                    {isOverdue && !a.allow_late && !a.my_submission_id && (
                      <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-1.5 text-xs text-red-500">
                        <AlertCircle size={12} /> Submissions closed
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Students tab (lecturer/admin only) ── */}
      {tab === 'students' && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-stone-900 mb-4">
            {students.length} enrolled student{students.length !== 1 ? 's' : ''}
          </h2>
          {stuLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 skeleton" />)}</div>
          ) : students.length === 0 ? (
            <div className="py-10 text-center text-stone-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No students enrolled yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {students.map((s: any) => (
                <Link key={s.id} href={`/users/${s.id}/profile`}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-stone-50 transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 text-xs font-semibold">
                      {s.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 group-hover:text-primary-700">{s.full_name}</p>
                    {s.department_name && <p className="text-xs text-stone-400">{s.department_name}</p>}
                  </div>
                  <span className="text-xs text-stone-400 flex-shrink-0">
                    {new Date(s.enrolled_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showAddMaterial && <AddMaterialModal courseId={id} onClose={() => setShowAddMaterial(false)} />}
      {showCreateAssignment && <CreateAssignmentModal courseId={id} onClose={() => setShowCreateAssignment(false)} />}
      {submitTarget && <SubmitModal assignment={submitTarget} onClose={() => setSubmitTarget(null)} />}
    </div>
  );
}
