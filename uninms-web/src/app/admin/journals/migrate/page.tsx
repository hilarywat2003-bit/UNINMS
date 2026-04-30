'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Globe, ArrowLeft, CheckCircle2, Loader2, Info,
  BookOpen, Mail, Hash, FileText, Link2,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const PLATFORMS = [
  { value: 'OJS',       label: 'Open Journal Systems (OJS)' },
  { value: 'DSpace',    label: 'DSpace' },
  { value: 'Bepress',   label: 'Bepress / Digital Commons' },
  { value: 'WordPress', label: 'WordPress / Custom site' },
  { value: 'AJOL',      label: 'AJOL (African Journals Online)' },
  { value: 'Custom',    label: 'Other / Custom platform' },
];

type Status = 'form' | 'submitting' | 'done';

export default function MigrateJournalPage() {
  const [status, setStatus] = useState<Status>('form');
  const [submitted, setSubmitted] = useState<any>(null);
  const [form, setForm] = useState({
    journalTitle:  '',
    existingUrl:   '',
    oaiPmhUrl:     '',
    platform:      '',
    contactName:   '',
    contactEmail:  '',
    issnPrint:     '',
    issnOnline:    '',
    scope:         '',
    notes:         '',
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.journalTitle.trim()) { toast.error('Journal title is required'); return; }
    if (!form.existingUrl.trim())  { toast.error('Existing journal URL is required'); return; }

    setStatus('submitting');
    try {
      const res = await api.post('/journal-migration', form);
      setSubmitted(res.data.data);
      setStatus('done');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to submit request');
      setStatus('form');
    }
  };

  if (status === 'done') return (
    <div className="max-w-lg mx-auto">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary-700" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-stone-900 mb-2">Request submitted!</h2>
        <p className="text-stone-500 text-sm mb-6 leading-relaxed">
          The UniNMS team will probe <strong className="text-stone-800">{submitted?.existing_url}</strong> for an OAI-PMH endpoint and contact you at <strong className="text-stone-800">{submitted?.contact_email || 'your email'}</strong> within 2 business days.
        </p>
        <div className="bg-stone-50 rounded-xl p-4 text-left space-y-2 mb-6">
          <p className="text-xs font-medium text-stone-700">What happens next</p>
          <ol className="text-xs text-stone-500 space-y-1.5 list-decimal list-inside">
            <li>UniNMS probes your journal URL for OAI-PMH support</li>
            <li>If detected, metadata &amp; articles are harvested automatically</li>
            <li>You review the imported content before it goes live</li>
            <li>Your journal is activated on the platform</li>
          </ol>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/admin/journals" className="btn-primary w-full">Back to journals</Link>
          <button onClick={() => { setStatus('form'); setForm({ journalTitle:'',existingUrl:'',oaiPmhUrl:'',platform:'',contactName:'',contactEmail:'',issnPrint:'',issnOnline:'',scope:'',notes:'' }); }}
            className="btn-secondary w-full">Submit another journal</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/journals" className="btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">Migrate existing journal</h1>
          <p className="text-stone-500 text-sm">Transfer your journal's archive to the UniNMS platform</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl mb-6">
        <Info size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-relaxed">
          <span className="font-semibold">How it works:</span> If your journal runs on OJS, DSpace, or any OAI-PMH-compatible platform, we can automatically harvest all existing articles and metadata. For other platforms, our team will coordinate a manual import. Submission is free — journal subscription applies only to new articles published on the platform.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Journal identity */}
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-900 flex items-center gap-2">
            <BookOpen size={16} className="text-primary-700" /> Journal details
          </h2>

          <div>
            <label className="label">Journal title *</label>
            <input value={form.journalTitle} onChange={set('journalTitle')}
              placeholder="e.g. Nigerian Journal of Computer Science"
              className="input" required />
          </div>

          <div>
            <label className="label">Current journal URL *</label>
            <div className="relative">
              <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={form.existingUrl} onChange={set('existingUrl')}
                placeholder="https://yourjournal.university.edu.ng"
                className="input pl-8" type="url" required />
            </div>
            <p className="text-xs text-stone-400 mt-1">The homepage URL of your journal as it exists today</p>
          </div>

          <div>
            <label className="label">
              OAI-PMH endpoint <span className="text-stone-400 font-normal">(optional — we can auto-detect)</span>
            </label>
            <div className="relative">
              <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={form.oaiPmhUrl} onChange={set('oaiPmhUrl')}
                placeholder="https://yourjournal.edu.ng/oai  or  leave blank to auto-detect"
                className="input pl-8" type="url" />
            </div>
            <p className="text-xs text-stone-400 mt-1">
              For OJS journals this is usually <code className="bg-stone-100 px-1 rounded">yoursite.com/index.php/index/oai</code>
            </p>
          </div>

          <div>
            <label className="label">Platform / Software</label>
            <select value={form.platform} onChange={set('platform')} className="input">
              <option value="">Select platform…</option>
              {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Print ISSN</label>
              <div className="relative">
                <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={form.issnPrint} onChange={set('issnPrint')}
                  placeholder="XXXX-XXXX" className="input pl-8" />
              </div>
            </div>
            <div>
              <label className="label">Online ISSN</label>
              <div className="relative">
                <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={form.issnOnline} onChange={set('issnOnline')}
                  placeholder="XXXX-XXXX" className="input pl-8" />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Aims &amp; scope <span className="text-stone-400 font-normal">(optional)</span></label>
            <textarea value={form.scope} onChange={set('scope')} rows={3}
              placeholder="Brief description of the journal's subject coverage…"
              className="input resize-none" />
          </div>
        </div>

        {/* Contact */}
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-900 flex items-center gap-2">
            <Mail size={16} className="text-primary-700" /> Migration contact
          </h2>
          <p className="text-xs text-stone-500">Who should UniNMS coordinate with for this migration?</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact name</label>
              <input value={form.contactName} onChange={set('contactName')}
                placeholder="Dr. Firstname Lastname" className="input" />
            </div>
            <div>
              <label className="label">Contact email</label>
              <input value={form.contactEmail} onChange={set('contactEmail')}
                placeholder="editor@university.edu.ng" className="input" type="email" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-900 flex items-center gap-2">
            <FileText size={16} className="text-primary-700" /> Additional notes
          </h2>
          <textarea value={form.notes} onChange={set('notes')} rows={3}
            placeholder="Any special instructions, access credentials needed, or notes about your journal's content…"
            className="input resize-none" />
        </div>

        <div className="flex justify-between items-center">
          <p className="text-xs text-stone-400">Migration requests are reviewed within 2 business days.</p>
          <button type="submit" disabled={status === 'submitting'} className="btn-primary">
            {status === 'submitting'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              : <><Globe size={14} /> Submit migration request</>}
          </button>
        </div>
      </form>
    </div>
  );
}
