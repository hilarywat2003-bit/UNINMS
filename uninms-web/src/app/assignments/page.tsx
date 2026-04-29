'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assignmentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  ClipboardList, Calendar, CheckCircle2, AlertCircle, Clock,
  BookMarked, ChevronRight, Loader2, Star,
} from 'lucide-react';
import Link from 'next/link';

type Filter = 'all' | 'pending' | 'submitted' | 'overdue';

function statusBadge(a: any, isStaff: boolean) {
  if (isStaff) {
    const count = Number(a.submission_count ?? 0);
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
        {count} submission{count !== 1 ? 's' : ''}
      </span>
    );
  }
  if (a.my_grade) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
        <Star size={10} /> Grade: {a.my_grade}
      </span>
    );
  }
  if (a.my_submission_id) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
        <CheckCircle2 size={10} /> Submitted
      </span>
    );
  }
  const due = a.due_date ? new Date(a.due_date) : null;
  if (due && due < new Date()) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
        <AlertCircle size={10} /> Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
      <Clock size={10} /> Pending
    </span>
  );
}

function dueDateLabel(due: string | null) {
  if (!due) return null;
  const d    = new Date(due);
  const now  = new Date();
  const past = d < now;
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);

  const formatted = d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const time      = d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

  if (past) return <span className="text-red-600 font-medium">{formatted} {time}</span>;
  if (diff <= 3) return <span className="text-amber-600 font-medium">{formatted} {time} — {diff}d left</span>;
  return <span className="text-stone-500">{formatted} {time}</span>;
}

export default function AssignmentsPage() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<Filter>('all');

  const isStaff = ['lecturer', 'admin', 'super_admin', 'management'].includes(user?.role ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['assignments-all'],
    queryFn: () => assignmentsApi.all(),
  });

  const all: any[] = (data?.data as any)?.assignments ?? [];

  const filtered = all.filter(a => {
    if (filter === 'all') return true;
    if (isStaff) return true;
    const due = a.due_date ? new Date(a.due_date) : null;
    if (filter === 'submitted') return !!a.my_submission_id;
    if (filter === 'overdue')   return !a.my_submission_id && due && due < new Date();
    if (filter === 'pending')   return !a.my_submission_id && (!due || due >= new Date());
    return true;
  });

  const counts = {
    all:       all.length,
    pending:   all.filter(a => !a.my_submission_id && (!a.due_date || new Date(a.due_date) >= new Date())).length,
    submitted: all.filter(a => !!a.my_submission_id).length,
    overdue:   all.filter(a => !a.my_submission_id && a.due_date && new Date(a.due_date) < new Date()).length,
  };

  const FILTERS: { key: Filter; label: string; color: string }[] = [
    { key: 'all',       label: `All (${counts.all})`,           color: 'stone'   },
    { key: 'pending',   label: `Pending (${counts.pending})`,   color: 'amber'   },
    { key: 'submitted', label: `Submitted (${counts.submitted})`, color: 'emerald' },
    { key: 'overdue',   label: `Overdue (${counts.overdue})`,   color: 'red'     },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <ClipboardList size={20} className="text-primary-700" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-stone-900">Assignments</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {isStaff ? 'All assignments on your courses' : 'Assignments from your enrolled courses'}
            </p>
          </div>
        </div>
        <Link
          href="/courses"
          className="text-sm text-primary-700 hover:text-primary-800 font-medium flex items-center gap-1"
        >
          <BookMarked size={14} /> Courses
        </Link>
      </div>

      {/* Filters (students only — staff see all) */}
      {!isStaff && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-primary-700 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList size={40} className="text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500 font-medium">No assignments found</p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-sm text-primary-600 mt-2 hover:underline">
              Show all
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: any) => {
            const due = a.due_date ? new Date(a.due_date) : null;
            const isOverdue = due && due < new Date() && !a.my_submission_id;

            return (
              <Link
                key={a.id}
                href={`/courses/${a.course_id}`}
                className={`block rounded-xl border bg-white p-4 hover:shadow-sm transition-all group ${
                  isOverdue ? 'border-red-200 bg-red-50/30' : 'border-stone-200 hover:border-primary-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Course badge */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <BookMarked size={11} className="text-stone-400" />
                      <span className="text-xs text-stone-500 font-medium truncate">
                        {a.course_code ? `${a.course_code} — ` : ''}{a.course_title ?? 'Course'}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold text-stone-900 group-hover:text-primary-700 truncate">
                      {a.title}
                    </p>

                    {/* Instructions preview */}
                    {a.instructions && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-1">{a.instructions}</p>
                    )}

                    {/* Due date */}
                    {due && (
                      <div className="flex items-center gap-1 mt-2 text-xs">
                        <Calendar size={11} className="text-stone-400" />
                        {dueDateLabel(a.due_date)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {statusBadge(a, isStaff)}
                    <ChevronRight size={14} className="text-stone-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
