'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { forumsApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  MessageSquare, ArrowLeft, Pin, ThumbsUp, Loader2,
  Send, CheckCircle2, User,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const CATEGORY_BADGE: Record<string, string> = {
  research: 'badge-blue', teaching: 'badge-green', industry: 'badge-purple',
  policy: 'badge-gold', general: 'badge-stone',
};

export default function ForumThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['forum-thread', id],
    queryFn:  () => forumsApi.thread(id),
    enabled:  !!id,
  });

  const thread = data?.data as any;
  const posts: any[] = thread?.posts ?? [];

  const replyMutation = useMutation({
    mutationFn: () => forumsApi.reply(id, { content: reply.trim() }),
    onSuccess: () => {
      toast.success('Reply posted');
      setReply('');
      qc.invalidateQueries({ queryKey: ['forum-thread', id] });
      qc.invalidateQueries({ queryKey: ['forums'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to post reply'),
  });

  const upvoteMutation = useMutation({
    mutationFn: (postId: string) => forumsApi.upvote(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-thread', id] }),
    onError: () => toast.error('Could not upvote'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
    </div>
  );

  if (!thread) return (
    <div className="max-w-3xl mx-auto py-20 text-center">
      <MessageSquare size={48} className="mx-auto mb-4 text-stone-300" />
      <h2 className="font-display text-2xl font-semibold text-stone-700 mb-2">Thread not found</h2>
      <Link href="/forums" className="btn-primary">Back to forums</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/forums"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to forums
      </Link>

      {/* Thread header */}
      <div className="card p-6 mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {thread.is_pinned && (
            <span className="flex items-center gap-1 badge badge-gold text-xs">
              <Pin size={10} /> Pinned
            </span>
          )}
          {thread.category && (
            <span className={`badge text-xs ${CATEGORY_BADGE[thread.category] ?? 'badge-stone'}`}>
              {thread.category.charAt(0).toUpperCase() + thread.category.slice(1)}
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl font-semibold text-stone-900 leading-tight mb-3">
          {thread.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <span className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <User size={12} className="text-primary-700" />
            </div>
            {thread.author_name}
          </span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MessageSquare size={13} /> {thread.reply_count} replies
          </span>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-3 mb-6">
        {posts.map((post, idx) => (
          <div key={post.id}
            className={`card p-5 ${post.is_answer ? 'border-2 border-primary-200 bg-primary-50/20' : ''}`}>
            {post.is_answer && (
              <div className="flex items-center gap-1.5 text-primary-700 text-xs font-semibold mb-3">
                <CheckCircle2 size={13} /> Accepted answer
              </div>
            )}
            <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <div className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center">
                  <User size={10} className="text-stone-500" />
                </div>
                <span className="font-medium text-stone-600">{post.author_name}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                {idx === 0 && <span className="badge-stone badge ml-1">OP</span>}
              </div>
              <button
                onClick={() => upvoteMutation.mutate(post.id)}
                disabled={upvoteMutation.isPending}
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-primary-700 transition-colors px-2 py-1 rounded-lg hover:bg-primary-50">
                <ThumbsUp size={12} />
                <span className="font-medium">{post.upvote_count}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reply form */}
      {user ? (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-stone-900 mb-3 text-sm">Post a reply</h3>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={4}
            placeholder="Share your thoughts or answer…"
            className="input resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={() => replyMutation.mutate()}
              disabled={reply.trim().length < 3 || replyMutation.isPending}
              className="btn-primary">
              {replyMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send size={14} />}
              Post reply
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <p className="text-stone-500 text-sm mb-3">Sign in to reply to this thread.</p>
          <Link href="/auth/login" className="btn-primary">Sign in</Link>
        </div>
      )}
    </div>
  );
}
