'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { forumsApi } from '@/lib/api';
import { MessageSquare, Plus, Pin, ArrowUpRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

function NewThreadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ title: string; content: string; category: string }>();
  const mutation = useMutation({
    mutationFn: (d: any) => forumsApi.createThread(d),
    onSuccess: () => { toast.success('Thread created!'); qc.invalidateQueries({ queryKey: ['forums'] }); onClose(); },
    onError: () => toast.error('Failed to create thread'),
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg">
        <div className="p-6">
          <h3 className="font-display text-xl font-semibold text-stone-900 mb-5">New discussion</h3>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input {...register('title',{required:true})} placeholder="What would you like to discuss?" className="input" />
            </div>
            <div>
              <label className="label">Category</label>
              <select {...register('category')} className="input">
                <option value="">Select a category</option>
                {['research','teaching','industry','policy','general'].map(c => (
                  <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Opening post</label>
              <textarea {...register('content',{required:true})} rows={4}
                placeholder="Share your thoughts, question, or resource…" className="input resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post thread'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ForumsPage() {
  const [showNew, setShowNew] = useState(false);
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['forums','threads', category],
    queryFn: () => forumsApi.threads({ category: category || undefined }),
  });
  const threads = (data?.data as any)?.threads ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">Forums</h1>
          <p className="text-stone-500 text-sm mt-0.5">Academic discussions and knowledge sharing</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus size={15} /> New thread
        </button>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['','research','teaching','industry','policy','general'].map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all
              ${category === c ? 'bg-primary-800 text-white border-primary-800' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
            {c === '' ? 'All' : c.charAt(0).toUpperCase()+c.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-20 skeleton rounded-2xl" />)}</div>
      ) : threads.length === 0 ? (
        <div className="card p-16 text-center">
          <MessageSquare size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No discussions yet</h3>
          <p className="text-stone-400 text-sm mb-4">Be the first to start a conversation.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary">Start a thread</button>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t: any) => (
            <Link key={t.id} href={`/forums/${t.id}`} className="card-hover flex items-start gap-4 p-5 group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                ${t.is_pinned ? 'bg-gold-50 text-gold-600' : 'bg-stone-100 text-stone-500 group-hover:bg-primary-50 group-hover:text-primary-600'}`}>
                {t.is_pinned ? <Pin size={16} /> : <MessageSquare size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-stone-900 text-sm group-hover:text-primary-700 line-clamp-1">{t.title}</h3>
                {t.last_post_preview && <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{t.last_post_preview}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                  <span className="font-medium text-stone-600">{t.author_name}</span>
                  {t.category && <span className="badge-stone badge">{t.category}</span>}
                  <span className="flex items-center gap-1"><MessageSquare size={10} />{t.reply_count}</span>
                  <span className="ml-auto">{formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</span>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
      {showNew && <NewThreadModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
