'use client';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BookOpen, TrendingUp, Award, BarChart3, Loader2 } from 'lucide-react';

const COLORS = ['#0a5235', '#d09b10', '#1d4ed8', '#7c3aed', '#ef4444'];

function StatCard({ label, value, icon: Icon, color = 'green' }: any) {
  const cls: Record<string, string> = {
    green: 'bg-primary-50 text-primary-700', gold: 'bg-gold-50 text-gold-700',
    blue: 'bg-blue-50 text-blue-700', purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{label}</p>
          <p className="text-3xl font-display font-semibold text-stone-900 mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { isAdmin } = useAuthStore();

  const { data: meData, isLoading } = useQuery({ queryKey: ['analytics','me'], queryFn: () => analyticsApi.me() });
  const { data: uniData }           = useQuery({ queryKey: ['analytics','university'], queryFn: () => analyticsApi.university(), enabled: isAdmin() });

  const me  = meData?.data as any;
  const uni = uniData?.data as any;

  const docs        = me?.documents ?? [];
  const totalDocs   = docs.reduce((a: number, d: any) => a + parseInt(d.count ?? 0), 0);
  const totalViews  = docs.reduce((a: number, d: any) => a + parseInt(d.total_views ?? 0), 0);
  const totalDls    = docs.reduce((a: number, d: any) => a + parseInt(d.total_downloads ?? 0), 0);
  const totalCites  = me?.totalCitations ?? 0;

  const DOC_LABELS: Record<string,string> = {
    thesis:'Thesis', research_paper:'Research', lecture_note:'Lecture',
    dataset:'Dataset', past_question:'Past Q', other:'Other',
  };
  const pieData = docs.filter((d: any) => parseInt(d.count) > 0)
    .map((d: any) => ({ name: DOC_LABELS[d.doc_type] ?? d.doc_type, value: parseInt(d.count) }));

  if (isLoading) return (
    <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-stone-900 mb-4">My research output</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Publications"   value={totalDocs}  icon={BookOpen}  color="green"  />
          <StatCard label="Total views"    value={totalViews} icon={TrendingUp} color="blue"  />
          <StatCard label="Downloads"      value={totalDls}   icon={BarChart3}  color="purple" />
          <StatCard label="Citations"      value={totalCites} icon={Award}      color="gold"  />
        </div>
      </div>

      {pieData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-4">Publications by type</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {uni && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-stone-900 mb-4">University overview</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Total users',    value: uni.users?.total_users ?? 0 },
                  { label: 'Documents',      value: uni.documents?.total_documents ?? 0 },
                  { label: 'Citations',      value: parseInt(uni.documents?.total_citations ?? 0) },
                  { label: 'Submissions',    value: uni.submissions?.total_submissions ?? 0 },
                ].map(s => (
                  <div key={s.label} className="bg-stone-50 rounded-xl p-4">
                    <p className="text-2xl font-display font-semibold text-stone-900">{s.value.toLocaleString()}</p>
                    <p className="text-xs text-stone-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
