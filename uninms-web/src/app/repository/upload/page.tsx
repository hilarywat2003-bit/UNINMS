'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Upload, FileText, X, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentsApi } from '@/lib/api';
import Link from 'next/link';

const DOC_TYPES = [
  { value: 'thesis',          label: 'Thesis' },
  { value: 'dissertation',    label: 'Dissertation' },
  { value: 'research_paper',  label: 'Research Paper' },
  { value: 'lecture_note',    label: 'Lecture Note' },
  { value: 'past_question',   label: 'Past Question' },
  { value: 'dataset',         label: 'Dataset' },
  { value: 'seminar_recording', label: 'Seminar Recording' },
  { value: 'other',           label: 'Other' },
];

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile]    = useState<File | null>(null);
  const [done, setDone]    = useState(false);
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<{
    title: string; abstract: string; docType: string; visibility: string;
  }>({ defaultValues: { docType: 'research_paper', visibility: 'public' } });

  const onSubmit = async (values: any) => {
    if (!file) { toast.error('Please select a file'); return; }
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(values).forEach(([k, v]) => fd.append(k, v as string));
      await documentsApi.upload(fd);
      toast.success('Document uploaded successfully!');
      setDone(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Upload failed');
    }
  };

  if (done) return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8 text-primary-700" />
      </div>
      <h2 className="font-display text-2xl font-semibold text-stone-900 mb-2">Uploaded!</h2>
      <p className="text-stone-500 mb-6">Your document is being processed. Embeddings and tags will be generated shortly.</p>
      <div className="flex gap-3 justify-center">
        <Link href="/repository" className="btn-secondary">View repository</Link>
        <button onClick={() => { setDone(false); setFile(null); }} className="btn-primary">Upload another</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* File drop zone */}
        <div className="card p-6">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Select file</h3>
          {file ? (
            <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl border border-primary-200">
              <FileText size={20} className="text-primary-700 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900 text-sm truncate">{file.name}</p>
                <p className="text-xs text-stone-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="text-stone-400 hover:text-stone-600">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-3 p-10 rounded-xl border-2 border-dashed border-stone-300 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all">
              <Upload size={28} className="text-stone-400" />
              <div className="text-center">
                <p className="font-medium text-stone-700 text-sm">Click to select or drag & drop</p>
                <p className="text-xs text-stone-400 mt-1">PDF, DOCX, MP4, ZIP — max 50 MB</p>
              </div>
              <input type="file" className="hidden"
                accept=".pdf,.doc,.docx,.mp4,.mp3,.zip"
                onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Metadata */}
        <div className="card p-6 space-y-4">
          <h3 className="font-display font-semibold text-stone-900">Document details</h3>
          <div>
            <label className="label">Title *</label>
            <input {...register('title', { required: 'Title is required' })}
              placeholder="Full document title"
              className={`input ${errors.title ? 'input-error' : ''}`} />
            {errors.title && <p className="field-error">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Abstract / Description</label>
            <textarea {...register('abstract')} rows={4} placeholder="Brief description of the document content"
              className="input resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Document type</label>
              <select {...register('docType')} className="input">
                {DOC_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Visibility</label>
              <select {...register('visibility')} className="input">
                <option value="public">Public — anyone can find it</option>
                <option value="department">Department only</option>
                <option value="draft">Draft — not published yet</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/repository" className="btn-secondary flex-1 justify-center">Cancel</Link>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : <><Upload size={15} />Upload document</>}
          </button>
        </div>
      </form>
    </div>
  );
}
