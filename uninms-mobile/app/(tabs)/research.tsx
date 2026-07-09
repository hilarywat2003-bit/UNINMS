import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, StyleSheet, Switch, FlatList,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/theme/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { researchApi, usersApi } from '../../src/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = 'idea' | 'proposal' | 'active' | 'review' | 'published';
type ResearchType = 'basic' | 'applied' | 'action' | 'policy' | 'development';
type OutputType = 'paper' | 'dataset' | 'patent' | 'report' | 'presentation' | 'software';
type MemberRole = 'lead' | 'co-lead' | 'collaborator' | 'advisor' | 'student';

const STAGE_COLORS: Record<Stage, string> = {
  idea: '#8B5CF6', proposal: '#3B82F6', active: '#10B981',
  review: '#F59E0B', published: '#EC4899',
};
const STAGE_LABELS: Record<Stage, string> = {
  idea: 'Idea', proposal: 'Proposal', active: 'Active',
  review: 'Review', published: 'Published',
};
const RESEARCH_TYPES: ResearchType[] = ['basic', 'applied', 'action', 'policy', 'development'];
const OUTPUT_TYPES: OutputType[] = ['paper', 'dataset', 'patent', 'report', 'presentation', 'software'];
const MEMBER_ROLES: MemberRole[] = ['lead', 'co-lead', 'collaborator', 'advisor', 'student'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function unwrap(res: any) { return res?.data ?? res; }

function StageBadge({ stage, colors }: { stage: Stage; colors: any }) {
  const bg = STAGE_COLORS[stage] ?? '#6B7280';
  return (
    <View style={{ backgroundColor: bg + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: bg, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
        {STAGE_LABELS[stage] ?? stage}
      </Text>
    </View>
  );
}

function Section({ title, onAdd, children, colors }: any) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{title}</Text>
        {onAdd && (
          <TouchableOpacity onPress={onAdd} style={{ backgroundColor: colors.primary + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────
function CreateProjectModal({ visible, onClose, colors }: any) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [type, setType] = useState<ResearchType>('applied');
  const [stage, setStage] = useState<Stage>('idea');
  const [funding, setFunding] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const mut = useMutation({
    mutationFn: () => researchApi.createProject({
      title: title.trim(),
      abstract: abstract.trim() || undefined,
      researchType: type,
      stage,
      fundingSource: funding.trim() || undefined,
      fundingAmount: amount ? Number(amount) : undefined,
      startDate: startDate || undefined,
      targetEndDate: endDate || undefined,
      keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
      isPublic,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-projects'] });
      onClose();
      setTitle(''); setAbstract(''); setType('applied'); setStage('idea');
      setFunding(''); setAmount(''); setStartDate(''); setEndDate('');
      setKeywords(''); setIsPublic(true);
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? 'Failed to create project', 'error'),
  });

  const s = styles(colors);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.modalContainer]}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>New Research Project</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Min. 5 characters" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Abstract</Text>
          <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={abstract} onChangeText={setAbstract} multiline placeholder="Brief description..." placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Research Type</Text>
          <View style={s.pillRow}>
            {RESEARCH_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setType(t)}
                style={[s.pill, type === t && { backgroundColor: colors.primary }]}>
                <Text style={[s.pillText, type === t && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Stage</Text>
          <View style={s.pillRow}>
            {(Object.keys(STAGE_LABELS) as Stage[]).map(st => (
              <TouchableOpacity key={st} onPress={() => setStage(st)}
                style={[s.pill, stage === st && { backgroundColor: STAGE_COLORS[st] }]}>
                <Text style={[s.pillText, stage === st && { color: '#fff' }]}>{STAGE_LABELS[st]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Keywords (comma-separated)</Text>
          <TextInput style={s.input} value={keywords} onChangeText={setKeywords} placeholder="e.g. AI, climate, health" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Funding Source</Text>
          <TextInput style={s.input} value={funding} onChangeText={setFunding} placeholder="e.g. TETFund, World Bank" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Funding Amount (₦)</Text>
          <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Start Date</Text>
              <TextInput style={s.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Target End Date</Text>
              <TextInput style={s.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
            <Text style={[s.label, { marginBottom: 0 }]}>Public Project</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary }} />
          </View>

          <TouchableOpacity style={[s.btn, mut.isPending && { opacity: 0.6 }]} onPress={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Project</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({ visible, onClose, projectId, colors }: any) {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; full_name: string } | null>(null);
  const [role, setRole] = useState<MemberRole>('collaborator');

  const { data: searchRaw, isFetching: searching } = useQuery({
    queryKey: ['user-search', search],
    queryFn: () => usersApi.search(search),
    enabled: search.trim().length >= 2 && !selected,
    staleTime: 10_000,
  });
  const searchResults: any[] = (searchRaw?.data ?? searchRaw ?? []);

  const mut = useMutation({
    mutationFn: () => researchApi.addMember(projectId, { userId: selected!.id, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-project', projectId] });
      onClose();
      setSearch(''); setSelected(null); setRole('collaborator');
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? 'Failed to add member', 'error'),
  });

  const s = styles(colors);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.overlay}>
        <View style={[s.sheet]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Member</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>

          <Text style={s.label}>Search by name or email</Text>
          {selected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primary + '18', borderRadius: 8, padding: 10 }}>
              <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>{selected.full_name}</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setSearch(''); }}>
                <Text style={{ color: colors.error }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={s.input} value={search} onChangeText={setSearch}
                placeholder="Type at least 2 characters…" placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator color={colors.primary} style={{ marginTop: 6 }} />}
              {!searching && search.trim().length >= 2 && searchResults.length === 0 && (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>No users found</Text>
              )}
              {searchResults.map((u: any) => (
                <TouchableOpacity key={u.id} onPress={() => { setSelected({ id: u.id, full_name: u.full_name }); setSearch(''); }}
                  style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>{u.full_name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{u.email}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Text style={s.label}>Role</Text>
          <View style={s.pillRow}>
            {MEMBER_ROLES.map(r => (
              <TouchableOpacity key={r} onPress={() => setRole(r)}
                style={[s.pill, role === r && { backgroundColor: colors.primary }]}>
                <Text style={[s.pillText, role === r && { color: '#fff' }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.btn, (!selected || mut.isPending) && { opacity: 0.5 }]}
            onPress={() => mut.mutate()}
            disabled={!selected || mut.isPending}
          >
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Add Member</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Milestone Modal ──────────────────────────────────────────────────────
function AddMilestoneModal({ visible, onClose, projectId, colors }: any) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');

  const mut = useMutation({
    mutationFn: () => researchApi.addMilestone(projectId, {
      title: title.trim(), description: desc.trim() || undefined,
      dueDate: dueDate || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-project', projectId] });
      onClose(); setTitle(''); setDesc(''); setDueDate('');
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? 'Failed to add milestone', 'error'),
  });

  const s = styles(colors);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Milestone</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Milestone title" placeholderTextColor={colors.textMuted} />
          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline placeholder="Optional details" placeholderTextColor={colors.textMuted} />
          <Text style={s.label}>Due Date</Text>
          <TextInput style={s.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={[s.btn, mut.isPending && { opacity: 0.6 }]} onPress={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Add Milestone</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Output Modal ─────────────────────────────────────────────────────────
function AddOutputModal({ visible, onClose, projectId, colors }: any) {
  const qc = useQueryClient();
  const toast = useToast();
  const [outputType, setOutputType] = useState<OutputType>('paper');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [publishedAt, setPublishedAt] = useState('');

  const mut = useMutation({
    mutationFn: () => researchApi.addOutput(projectId, {
      outputType, title: title.trim() || undefined,
      externalUrl: url.trim() || undefined,
      publishedAt: publishedAt || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-project', projectId] });
      onClose(); setOutputType('paper'); setTitle(''); setUrl(''); setPublishedAt('');
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? 'Failed to add output', 'error'),
  });

  const s = styles(colors);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Output</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={s.label}>Type</Text>
          <View style={s.pillRow}>
            {OUTPUT_TYPES.map(ot => (
              <TouchableOpacity key={ot} onPress={() => setOutputType(ot)}
                style={[s.pill, outputType === ot && { backgroundColor: colors.primary }]}>
                <Text style={[s.pillText, outputType === ot && { color: '#fff' }]}>{ot}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>Title</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Output title" placeholderTextColor={colors.textMuted} />
          <Text style={s.label}>URL / DOI</Text>
          <TextInput style={s.input} value={url} onChangeText={setUrl} placeholder="https://..." placeholderTextColor={colors.textMuted} autoCapitalize="none" />
          <Text style={s.label}>Published Date</Text>
          <TextInput style={s.input} value={publishedAt} onChangeText={setPublishedAt} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={[s.btn, mut.isPending && { opacity: 0.6 }]} onPress={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Add Output</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Submit Gap Modal ─────────────────────────────────────────────────────────
function SubmitGapModal({ visible, onClose, colors }: any) {
  const qc = useQueryClient();
  const toast = useToast();
  const [desc, setDesc] = useState('');
  const [area, setArea] = useState('');
  const [priority, setPriority] = useState('5');

  const mut = useMutation({
    mutationFn: () => researchApi.submitGap({
      description: desc.trim(),
      researchArea: area.trim() || undefined,
      priorityScore: priority ? Number(priority) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-gaps'] });
      onClose(); setDesc(''); setArea(''); setPriority('5');
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? 'Failed to submit gap', 'error'),
  });

  const s = styles(colors);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Submit Research Gap</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={s.label}>Description * (min 20 chars)</Text>
          <TextInput style={[s.input, { height: 90, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline placeholder="Describe the research gap in detail..." placeholderTextColor={colors.textMuted} />
          <Text style={s.label}>Research Area</Text>
          <TextInput style={s.input} value={area} onChangeText={setArea} placeholder="e.g. Machine Learning, Public Health" placeholderTextColor={colors.textMuted} />
          <Text style={s.label}>Priority Score (1–10)</Text>
          <TextInput style={s.input} value={priority} onChangeText={setPriority} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={[s.btn, mut.isPending && { opacity: 0.6 }]} onPress={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Submit Gap</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Project Detail Screen ────────────────────────────────────────────────────
function ProjectDetail({ projectId, onBack, colors }: { projectId: string; onBack: () => void; colors: any }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'members' | 'milestones' | 'outputs' | 'intel'>('milestones');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddOutput, setShowAddOutput] = useState(false);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['research-project', projectId],
    queryFn: () => researchApi.project(projectId),
  });
  const project = unwrap(raw);

  const { data: intelRaw } = useQuery({
    queryKey: ['research-project-intel', projectId],
    queryFn: () => researchApi.projectIntel(projectId),
    enabled: tab === 'intel',
  });
  const intel = unwrap(intelRaw);

  const toggleMilestone = useMutation({
    mutationFn: ({ mId, isDone }: { mId: string; isDone: boolean }) =>
      researchApi.updateMilestone(projectId, mId, { isDone }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-project', projectId] }),
  });

  const s = styles(colors);

  if (isLoading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  if (!project) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.textMuted }}>Project not found</Text>
      <TouchableOpacity onPress={onBack} style={{ marginTop: 12 }}>
        <Text style={{ color: colors.primary }}>← Back</Text>
      </TouchableOpacity>
    </View>
  );

  const milestones = project.milestones ?? [];
  const members    = project.members ?? [];
  const outputs    = project.outputs ?? [];
  const done       = milestones.filter((m: any) => m.is_done).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 8 }}>
          <Text style={{ color: colors.primary, fontSize: 13 }}>← All Projects</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 }}>{project.title}</Text>
          <StageBadge stage={project.stage} colors={colors} />
        </View>
        {project.abstract ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }} numberOfLines={3}>{project.abstract}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>👤 {project.lead_name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>🏢 {project.department_name ?? 'No dept'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>🔬 {project.research_type}</Text>
        </View>
        {/* Milestone progress bar */}
        {milestones.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>Milestones</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{done}/{milestones.length}</Text>
            </View>
            <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 4 }}>
              <View style={{ height: 4, backgroundColor: colors.primary, borderRadius: 4, width: `${milestones.length > 0 ? (done / milestones.length) * 100 : 0}%` }} />
            </View>
          </View>
        )}
      </View>

      {/* Sub-tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {(['milestones', 'members', 'outputs', 'intel'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }}>
            <Text style={{ fontSize: 12, fontWeight: tab === t ? '700' : '500', color: tab === t ? colors.primary : colors.textMuted }}>
              {t === 'intel' ? '💡 Intel' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* ── MILESTONES ── */}
        {tab === 'milestones' && (
          <Section title={`Milestones (${done}/${milestones.length} done)`} onAdd={() => setShowAddMilestone(true)} colors={colors}>
            {milestones.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>No milestones yet</Text>
            ) : milestones.map((m: any) => (
              <View key={m.id} style={[s.card, { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }]}>
                <TouchableOpacity
                  onPress={() => toggleMilestone.mutate({ mId: m.id, isDone: !m.is_done })}
                  style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: m.is_done ? colors.success : colors.border, backgroundColor: m.is_done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
                >
                  {m.is_done && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, textDecorationLine: m.is_done ? 'line-through' : 'none' }}>{m.title}</Text>
                  {m.description ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{m.description}</Text> : null}
                  {m.due_date ? <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>📅 Due: {m.due_date.slice(0, 10)}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* ── MEMBERS ── */}
        {tab === 'members' && (
          <Section title={`Members (${members.length})`} onAdd={() => setShowAddMember(true)} colors={colors}>
            {members.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>No members yet</Text>
            ) : members.map((m: any) => (
              <View key={m.user_id} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{m.full_name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.department_name ?? 'No dept'}</Text>
                </View>
                <View style={{ backgroundColor: colors.primary + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{m.role}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* ── OUTPUTS ── */}
        {tab === 'outputs' && (
          <Section title={`Outputs (${outputs.length})`} onAdd={() => setShowAddOutput(true)} colors={colors}>
            {outputs.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>No outputs yet</Text>
            ) : outputs.map((o: any) => (
              <View key={o.id} style={s.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: colors.primary + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{o.output_type}</Text>
                  </View>
                  {o.published_at && (
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>📅 {o.published_at?.slice(0, 10)}</Text>
                  )}
                </View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginTop: 6 }}>{o.title ?? o.doc_title ?? '(Untitled)'}</Text>
                {o.external_url ? (
                  <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }} numberOfLines={1}>{o.external_url}</Text>
                ) : null}
              </View>
            ))}
          </Section>
        )}

        {/* ── INTELLIGENCE ── */}
        {tab === 'intel' && (
          <>
            <Section title="Research Gaps" colors={colors}>
              {!intel ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
              ) : (intel?.gaps ?? []).length === 0 ? (
                <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>No matching gaps found</Text>
              ) : (intel?.gaps ?? []).map((g: any) => (
                <View key={g.id} style={s.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{g.research_area ?? 'General'}</Text>
                    <Text style={{ color: colors.warning ?? '#F59E0B', fontSize: 11, fontWeight: '700' }}>Priority {g.priority_score}/10</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>{g.gap_description}</Text>
                </View>
              ))}
            </Section>
            <Section title="Suggested Collaborators" colors={colors}>
              {!intel ? null : (intel?.collaborators ?? []).length === 0 ? (
                <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>No suggestions found</Text>
              ) : (intel?.collaborators ?? []).map((c: any) => (
                <View key={c.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14 }}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{c.full_name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.department_name ?? ''}</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{c.match_count} match{c.match_count !== 1 ? 'es' : ''}</Text>
                </View>
              ))}
            </Section>
          </>
        )}
      </ScrollView>

      <AddMemberModal    visible={showAddMember}    onClose={() => setShowAddMember(false)}    projectId={projectId} colors={colors} />
      <AddMilestoneModal visible={showAddMilestone} onClose={() => setShowAddMilestone(false)} projectId={projectId} colors={colors} />
      <AddOutputModal    visible={showAddOutput}    onClose={() => setShowAddOutput(false)}    projectId={projectId} colors={colors} />
    </View>
  );
}

// ─── Projects List ────────────────────────────────────────────────────────────
function ProjectsList({ onOpen, colors }: { onOpen: (id: string) => void; colors: any }) {
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const { data: raw, isLoading, refetch } = useQuery({
    queryKey: ['research-projects', stageFilter, mineOnly],
    queryFn: () => researchApi.projects({
      ...(stageFilter !== 'all' ? { stage: stageFilter } : {}),
      ...(mineOnly ? { mine: 'true' } : {}),
    }),
  });
  const projects = (unwrap(raw) ?? []) as any[];

  const s = styles(colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Toolbar */}
      <View style={{ backgroundColor: colors.surface, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Research Projects</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ New</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['all', 'idea', 'proposal', 'active', 'review', 'published'] as const).map(st => (
              <TouchableOpacity key={st} onPress={() => setStageFilter(st)}
                style={[s.pill, stageFilter === st && { backgroundColor: st === 'all' ? colors.primary : STAGE_COLORS[st as Stage] }]}>
                <Text style={[s.pillText, stageFilter === st && { color: '#fff' }]}>
                  {st === 'all' ? 'All' : STAGE_LABELS[st as Stage]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Switch value={mineOnly} onValueChange={setMineOnly} trackColor={{ true: colors.primary }} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>My projects only</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : projects.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🔬</Text>
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>No projects found</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Create First Project</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item: p }) => {
            const milestoneCount = Number(p.milestone_count ?? 0);
            const doneCount      = Number(p.done_count ?? 0);
            return (
              <TouchableOpacity onPress={() => onOpen(p.id)} style={s.card} activeOpacity={0.85}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={2}>{p.title}</Text>
                  <StageBadge stage={p.stage} colors={colors} />
                </View>
                {p.abstract ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{p.abstract}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>👤 {p.lead_name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>🔬 {p.research_type}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>👥 {p.member_count ?? 0} members</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>📄 {p.output_count ?? 0} outputs</Text>
                </View>
                {milestoneCount > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>Progress</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{doneCount}/{milestoneCount}</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 4 }}>
                      <View style={{ height: 4, backgroundColor: colors.primary, borderRadius: 4, width: `${(doneCount / milestoneCount) * 100}%` }} />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <CreateProjectModal visible={showCreate} onClose={() => setShowCreate(false)} colors={colors} />
    </View>
  );
}

// ─── Gaps & Leaderboard ───────────────────────────────────────────────────────
function GapsScreen({ colors }: { colors: any }) {
  const [showSubmit, setShowSubmit] = useState(false);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['research-gaps'],
    queryFn: () => researchApi.gaps({ status: 'unaddressed', limit: 20 }),
  });
  const gaps = (unwrap(raw) ?? []) as any[];

  const s = styles(colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Research Gaps</Text>
        <TouchableOpacity onPress={() => setShowSubmit(true)} style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Submit</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : gaps.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>No gaps reported yet</Text>
        </View>
      ) : (
        <FlatList
          data={gaps}
          keyExtractor={g => g.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item: g }) => (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{g.research_area ?? 'General'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {Array.from({ length: Math.min(Number(g.priority_score ?? 5), 10) }).map((_, i) => (
                    <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning ?? '#F59E0B' }} />
                  ))}
                  <Text style={{ color: colors.textMuted, fontSize: 10, marginLeft: 4 }}>{g.priority_score}/10</Text>
                </View>
              </View>
              <Text style={{ color: colors.text, fontSize: 13 }}>{g.gap_description}</Text>
            </View>
          )}
        />
      )}
      <SubmitGapModal visible={showSubmit} onClose={() => setShowSubmit(false)} colors={colors} />
    </View>
  );
}

function LeaderboardScreen({ colors }: { colors: any }) {
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');

  const { data: raw, isLoading } = useQuery({
    queryKey: ['research-leaderboard', period],
    queryFn: () => researchApi.leaderboard(period),
  });
  const rows = (unwrap(raw)?.universities ?? unwrap(raw) ?? []) as any[];

  const s = styles(colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.surface, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Leaderboard</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['monthly', 'quarterly', 'annual'] as const).map(p => (
            <TouchableOpacity key={p} onPress={() => setPeriod(p)}
              style={[s.pill, period === p && { backgroundColor: colors.primary }]}>
              <Text style={[s.pillText, period === p && { color: '#fff' }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>No leaderboard data yet</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item: r, index }) => (
            <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: index < 3 ? colors.primary : colors.textMuted, width: 28, textAlign: 'center' }}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{r.university_name ?? r.name ?? 'Unknown'}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.state ?? r.country ?? ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>{r.total_score ?? r.score ?? 0}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>pts</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── Main Research Screen ─────────────────────────────────────────────────────
export default function ResearchScreen() {
  const { colors } = useTheme();
  const [mainTab, setMainTab] = useState<'projects' | 'gaps' | 'leaderboard'>('projects');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  if (openProjectId) {
    return (
      <ProjectDetail
        projectId={openProjectId}
        onBack={() => setOpenProjectId(null)}
        colors={colors}
      />
    );
  }

  const s = styles(colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Tab Bar */}
      <View style={[s.topTabBar]}>
        {(['projects', 'gaps', 'leaderboard'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setMainTab(t)} style={[s.topTab, mainTab === t && s.topTabActive]}>
            <Text style={[s.topTabText, mainTab === t && { color: colors.primary, fontWeight: '700' }]}>
              {t === 'projects' ? '🔬 Projects' : t === 'gaps' ? '🕳️ Gaps' : '🏆 Leaderboard'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mainTab === 'projects'    && <ProjectsList onOpen={setOpenProjectId} colors={colors} />}
      {mainTab === 'gaps'        && <GapsScreen colors={colors} />}
      {mainTab === 'leaderboard' && <LeaderboardScreen colors={colors} />}
    </View>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
function styles(colors: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      color: colors.text,
      fontSize: 14,
    },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    pillText: { color: colors.textMuted, fontSize: 12 },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '80%',
    },
    topTabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topTab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
    },
    topTabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    topTabText: { fontSize: 13, color: colors.textMuted },
  });
}
