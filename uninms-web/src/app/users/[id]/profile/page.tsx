'use client';
import { useQuery } from '@tanstack/react-query';
import { usersApi, documentsApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import { BookOpen, Quote, ExternalLink, MapPin, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn:  () => usersApi.profile(id),
    enabled:  !!id,
  });

  const { data: docsData } = useQuery({
    queryKey: ['user-docs', id],
    queryFn:  () => documentsApi.list({ uploaderId: id, limit: 10 }),
    enabled:  !!id,
  });

  const profile = profileData?.data as any;
  const docs    = (docsData?.data as any)?.documents ?? [];

  if (isLoading) return (
    <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
  );
  if (!profile) return (
    <div className="text-center py-20"><p className="text-stone-400">User not found.</p></div>
  );

  const initials = profile.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase();
  const levelColor: Record<string, string> = {
    'Research Pioneer': 'bg-gold-50 text-gold-700 border-gold-200',
    'Innovator':        'bg-purple-50 text-purple-700 border-purple-200',
    'Scholar':          'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <div className="card p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary-100 border-4 border-primary-200 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-700 text-2xl font-bold">{initials}</span>
            </div>
            <h1 className="font-display text-xl font-semibold text-stone-900 mb-2">{profile.full_name}</h1>
            {profile.current_level && (
              <span className={`badge border text-xs font-medium ${levelColor[profile.current_level] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                {profile.current_level} · {(profile.total_points ?? 0).toLocaleString()} pts
              </span>
            )}
            <div className="space-y-1.5 text-sm text-stone-500 mt-3">
              {profile.department_name && (
                <p className="flex items-center justify-center gap-1.5"><MapPin size={12} />{profile.department_name}</p>
              )}
              {profile.university_name && <p className="text-stone-600 font-medium">{profile.university_name}</p>}
              {profile.orcid_id && (
                <a href={`https://orcid.org/${profile.orcid_id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-primary-700 hover:underline text-xs">
                  <ExternalLink size={11} />ORCID: {profile.orcid_id}
                </a>
              )}
            </div>
          </div>

          <div className="card p-4 grid grid-cols-2 gap-3 text-center">
            <div>
              <BookOpen size={16} className="mx-auto mb-1 text-stone-400" />
              <p className="text-xl font-display font-semibold text-stone-900">{profile.document_count ?? 0}</p>
              <p className="text-xs text-stone-500">Publications</p>
            </div>
            <div>
              <Quote size={16} className="mx-auto mb-1 text-stone-400" />
              <p className="text-xl font-display font-semibold text-stone-900">{profile.total_citations ?? 0}</p>
              <p className="text-xs text-stone-500">Citations</p>
            </div>
          </div>

          {profile.bio && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">About</h3>
              <p className="text-sm text-stone-600 leading-relaxed">{profile.bio}</p>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-stone-900 mb-4">Publications</h2>
          {docs.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen size={32} className="mx-auto mb-2 text-stone-300" />
              <p className="text-stone-400 text-sm">No publications yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc: any) => (
                <Link key={doc.id} href={`/repository/${doc.id}`} className="card-hover block p-4 group">
                  <p className="font-medium text-stone-900 text-sm group-hover:text-primary-700 line-clamp-2">{doc.title}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                    <span className="badge-stone badge">{doc.doc_type?.replace('_',' ')}</span>
                    <span>{doc.view_count} views</span>
                    <span>{doc.citation_count} citations</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
