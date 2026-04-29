'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  BookMarked, BookOpen, Plus, X, Loader2,
  GraduationCap, ArrowUpRight, FileText,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

function EnrollModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const mutation = useMutation({
    mutationFn: () => coursesApi.enroll(courseId.trim()),
    onSuccess: () => {
      toast.success('Enrolled successfully!');
      qc.invalidateQueries({ queryKey: ['courses'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Enrolment failed'),
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">Join a course</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <p className="text-sm text-stone-500 mb-4">Paste the course ID shared by your lecturer to enrol.</p>
        <input
          value={courseId}
          onChange={e => setCourseId(e.target.value)}
          placeholder="Course ID (e.g. 550e8400-e29b-41d4-…)"
          className="input mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!courseId.trim() || mutation.isPending}
            className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={14} />}
            Enrol
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateCourseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', courseCode: '', semester: '', level: '', description: '' });
  const mutation = useMutation({
    mutationFn: () => coursesApi.create(form),
    onSuccess: () => {
      toast.success('Course created!');
      qc.invalidateQueries({ queryKey: ['courses'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to create course'),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">Create course</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={form.title} onChange={set('title')} placeholder="Course title *" className="input" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.courseCode} onChange={set('courseCode')} placeholder="Course code (e.g. CSC301)" className="input" />
            <select value={form.level} onChange={set('level')} className="input">
              <option value="">Level</option>
              {['100','200','300','400','500','600'].map(l => <option key={l} value={l}>{l} level</option>)}
            </select>
          </div>
          <select value={form.semester} onChange={set('semester')} className="input">
            <option value="">Semester</option>
            <option value="First">First semester</option>
            <option value="Second">Second semester</option>
          </select>
          <textarea value={form.description} onChange={set('description')} placeholder="Description (optional)" className="input" rows={3} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.title.trim() || mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: any }) {
  const levelColor: Record<string, string> = {
    '100': 'badge-green', '200': 'badge-blue', '300': 'badge-purple',
    '400': 'badge-gold',  '500': 'badge-stone', '600': 'badge-stone',
  };
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <BookMarked size={18} className="text-primary-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {course.course_code && (
              <span className="badge-stone badge text-xs font-mono">{course.course_code}</span>
            )}
            {course.level && (
              <span className={`badge text-xs ${levelColor[course.level] ?? 'badge-stone'}`}>
                {course.level} level
              </span>
            )}
            {course.semester && (
              <span className="badge-stone badge text-xs">{course.semester}</span>
            )}
          </div>
          <h3 className="font-medium text-stone-900 text-sm leading-snug">{course.title}</h3>
          {course.department_name && (
            <p className="text-xs text-stone-400 mt-0.5">{course.department_name}</p>
          )}
        </div>
      </div>

      {course.description && (
        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{course.description}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
        <div className="flex items-center gap-3 text-xs text-stone-400">
          {course.lecturer_name && (
            <span className="flex items-center gap-1">
              <GraduationCap size={11} />
              {course.lecturer_name}
            </span>
          )}
          {course.material_count != null && (
            <span className="flex items-center gap-1">
              <FileText size={11} />
              {course.material_count} material{course.material_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Link href={`/courses/${course.id}`}
          className="text-xs text-primary-700 hover:text-primary-900 flex items-center gap-1 font-medium">
          Open <ArrowUpRight size={11} />
        </Link>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const { user } = useAuthStore();
  const isStudent  = !user?.roles?.some(r => ['lecturer','admin','management','super_admin'].includes(r));
  const isLecturer = user?.roles?.some(r => ['lecturer','admin','management','super_admin'].includes(r));
  const [showEnroll, setShowEnroll]   = useState(false);
  const [showCreate, setShowCreate]   = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn:  () => coursesApi.list(),
  });

  const courses = (data?.data as any)?.courses ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">My courses</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {courses.length} course{courses.length !== 1 ? 's' : ''}
            {isStudent ? ' enrolled' : ''}
          </p>
        </div>
        {isStudent && (
          <button onClick={() => setShowEnroll(true)} className="btn-primary">
            <Plus size={15} /> Join a course
          </button>
        )}
        {isLecturer && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={15} /> Create course
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 skeleton rounded-2xl" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">
            {isStudent ? 'No courses yet' : 'No courses created'}
          </h3>
          <p className="text-stone-400 text-sm mb-4">
            {isStudent
              ? 'Ask your lecturer for a course ID to join.'
              : 'Create your first course to get started.'}
          </p>
          {isStudent && (
            <button onClick={() => setShowEnroll(true)} className="btn-primary">
              <Plus size={14} /> Join a course
            </button>
          )}
          {isLecturer && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={14} /> Create course
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c: any) => <CourseCard key={c.id} course={c} />)}
        </div>
      )}

      {showEnroll && <EnrollModal onClose={() => setShowEnroll(false)} />}
      {showCreate && <CreateCourseModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
