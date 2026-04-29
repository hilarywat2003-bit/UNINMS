'use client';
import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { api } from '@/lib/api';
import { ArrowLeft, Plus, Trash2, Send, Loader2, CheckCircle2, UploadCloud, X, FileText } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type CoAuthor = { fullName: string; email: string; affiliation: string; orcidId: string; isCorresponding: boolean };
type Form = {
  title: string; abstract: string; keywords: string;
  coverLetter: string;
  coAuthors: CoAuthor[];
  agreeToReview: boolean; declarationOfInterest: boolean;
};

export default function SubmitManuscriptPage() {
  const { slug } = useParams<{ slug: string }>();
  const [done, setDone] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    defaultValues: { coAuthors: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'coAuthors' });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.post(`/journals/${slug}/submit/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedFile(res.data.data);
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: Form) => {
    try {
      const payload = {
        ...values,
        keywords: values.keywords.split(',').map(k => k.trim()).filter(Boolean),
        coAuthors: values.coAuthors.filter(a => a.fullName),
        manuscriptFileUrl: uploadedFile?.url ?? null,
      };
      const res = await api.post(`/journals/${slug}/submit`, payload);
      setDone(res.data.data?.submission_no);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Submission failed');
    }
  };

  if (done) return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8 text-primary-700" />
      </div>
      <h2 className="font-display text-2xl font-semibold text-stone-900 mb-2">Manuscript submitted!</h2>
      <p className="text-stone-500 mb-2">Your reference number is:</p>
      <p className="font-mono text-xl font-bold text-primary-800 mb-6 bg-primary-50 rounded-xl py-3 px-6">{done}</p>
      <p className="text-stone-500 text-sm mb-8">The editor will review your submission and assign reviewers. You will receive updates by email and in your notifications.</p>
      <div className="flex gap-3 justify-center">
        <Link href={`/journals/${slug}`} className="btn-secondary">Back to journal</Link>
        <Link href="/journals/my/submissions" className="btn-primary">My submissions</Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Link href={`/journals/${slug}`}
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to journal
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-stone-900">Submit manuscript</h1>
        <p className="text-stone-500 mt-1 text-sm">All submissions go through double-blind peer review. You will receive a reference number upon submission.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Manuscript details */}
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-900">Manuscript details</h2>

          <div>
            <label className="label">Title *</label>
            <input {...register('title', { required: 'Title is required' })}
              placeholder="Full manuscript title"
              className={`input ${errors.title ? 'input-error' : ''}`} />
            {errors.title && <p className="field-error">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Abstract * <span className="text-stone-400 font-normal">(150–300 words)</span></label>
            <textarea {...register('abstract', { required: 'Abstract is required', minLength: { value: 100, message: 'Abstract must be at least 100 characters' } })}
              rows={6} placeholder="Concise summary of the manuscript…"
              className={`input resize-none ${errors.abstract ? 'input-error' : ''}`} />
            {errors.abstract && <p className="field-error">{errors.abstract.message}</p>}
          </div>

          <div>
            <label className="label">Keywords <span className="text-stone-400 font-normal">(comma-separated, 4–8 keywords)</span></label>
            <input {...register('keywords')}
              placeholder="e.g. machine learning, agriculture, Nigeria, remote sensing"
              className="input" />
          </div>

          {/* File upload */}
          <div>
            <label className="label">Manuscript file <span className="text-stone-400 font-normal">(PDF or Word, max 50 MB)</span></label>
            {uploadedFile ? (
              <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl">
                <FileText className="w-5 h-5 text-primary-700 flex-shrink-0" />
                <span className="text-sm text-primary-800 font-medium flex-1 truncate">{uploadedFile.filename}</span>
                <button type="button" onClick={() => { setUploadedFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-stone-400 hover:text-red-500 flex-shrink-0">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center gap-2 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-primary-300 bg-primary-50' : 'border-stone-200 hover:border-primary-300 hover:bg-primary-50/40'}`}>
                {uploading
                  ? <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                  : <UploadCloud className="w-6 h-6 text-stone-400" />}
                <span className="text-sm text-stone-500">
                  {uploading ? 'Uploading…' : 'Click to select file or drag & drop'}
                </span>
                <span className="text-xs text-stone-400">PDF, DOC, DOCX · max 50 MB</span>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={handleFileChange} disabled={uploading} />
              </label>
            )}
          </div>

          <div>
            <label className="label">Cover letter <span className="text-stone-400 font-normal">(optional)</span></label>
            <textarea {...register('coverLetter')} rows={4}
              placeholder="Briefly describe the significance of your work and why it suits this journal…"
              className="input resize-none" />
          </div>
        </div>

        {/* Co-authors */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-stone-900">Co-authors</h2>
            <button type="button" onClick={() => append({ fullName: '', email: '', affiliation: '', orcidId: '', isCorresponding: false })}
              className="btn-ghost btn-sm">
              <Plus size={13} /> Add co-author
            </button>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">No co-authors added. Click "Add co-author" if there are additional authors.</p>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-stone-700">Co-author {index + 1}</p>
                    <button type="button" onClick={() => remove(index)} className="text-stone-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Full name *</label>
                      <input {...register(`coAuthors.${index}.fullName`, { required: true })}
                        placeholder="Dr. Jane Doe" className="input" />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input {...register(`coAuthors.${index}.email`)} type="email"
                        placeholder="jane@university.edu.ng" className="input" />
                    </div>
                    <div>
                      <label className="label">Affiliation</label>
                      <input {...register(`coAuthors.${index}.affiliation`)}
                        placeholder="University, Department" className="input" />
                    </div>
                    <div>
                      <label className="label">ORCID iD</label>
                      <input {...register(`coAuthors.${index}.orcidId`)}
                        placeholder="0000-0000-0000-0000" className="input" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input {...register(`coAuthors.${index}.isCorresponding`)} type="checkbox"
                      className="w-4 h-4 rounded accent-primary-700" />
                    <span className="text-sm text-stone-600">Corresponding author</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Declarations */}
        <div className="card p-6 space-y-3">
          <h2 className="font-display font-semibold text-stone-900">Declarations</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input {...register('agreeToReview', { required: 'Required' })} type="checkbox"
              className="mt-0.5 w-4 h-4 rounded accent-primary-700 flex-shrink-0" />
            <span className="text-sm text-stone-600">I confirm this manuscript has not been previously published and is not under consideration elsewhere. I agree to the journal's peer review process.</span>
          </label>
          {errors.agreeToReview && <p className="field-error">{errors.agreeToReview.message}</p>}

          <label className="flex items-start gap-3 cursor-pointer">
            <input {...register('declarationOfInterest', { required: 'Required' })} type="checkbox"
              className="mt-0.5 w-4 h-4 rounded accent-primary-700 flex-shrink-0" />
            <span className="text-sm text-stone-600">I declare no competing financial interests. All authors have approved this submission. All data in the manuscript is accurate and verifiable.</span>
          </label>
          {errors.declarationOfInterest && <p className="field-error">{errors.declarationOfInterest.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
            : <><Send size={16} />Submit manuscript</>}
        </button>
      </form>
    </div>
  );
}
