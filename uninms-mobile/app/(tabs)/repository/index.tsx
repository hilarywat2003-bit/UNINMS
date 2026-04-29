import { useState } from 'react';
import {
  FlatList, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
  ScrollView, StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../src/stores/authStore';
import { useToast } from '../../../src/components/Toast';
import { SkeletonDocCard } from '../../../src/components/Skeleton';
import { timeAgo } from '../../../src/utils/timeAgo';
import { documentsApi, searchApi } from '../../../src/lib/api';

// ─── Types & constants ────────────────────────────────────────────────────────
const DOC_TYPE_ICONS: Record<string, string> = {
  thesis:            '📜',
  journal_article:   '📰',
  research_paper:    '🔬',
  conference_paper:  '🎤',
  report:            '📋',
  dataset:           '🗂️',
  other:             '📄',
};
const DOC_TYPE_LABELS: Record<string, string> = {
  thesis:           'Thesis',
  journal_article:  'Journal',
  research_paper:   'Research',
  conference_paper: 'Conference',
  report:           'Report',
  dataset:          'Dataset',
  other:            'Other',
};
const SORT_OPTIONS = [
  { key: 'published_at',   label: 'Newest'    },
  { key: 'download_count', label: 'Downloads' },
  { key: 'view_count',     label: 'Views'     },
  { key: 'citation_count', label: 'Citations' },
];
const UPLOAD_DOC_TYPES = ['research_paper','thesis','conference_paper','journal_article','report','dataset','other'] as const;
type UploadDocType = typeof UPLOAD_DOC_TYPES[number];

// ─── Doc Card ─────────────────────────────────────────────────────────────────
function DocCard({ item }: { item: any }) {
  const { colors } = useTheme();
  const router = useRouter();
  const icon = DOC_TYPE_ICONS[item.doc_type] ?? '📄';
  const when = timeAgo(item.published_at ?? item.created_at);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/repository/${item.id}`)}
      style={{ backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}
      activeOpacity={0.85}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
            {item.uploader_name ?? 'Unknown'}{when ? ` · ${when}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {item.doc_type && (
              <View style={{ backgroundColor: colors.primaryLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: colors.primary }}>{DOC_TYPE_LABELS[item.doc_type] ?? item.doc_type}</Text>
              </View>
            )}
            {item.department_name && (
              <View style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{item.department_name}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>⬇️ {item.download_count ?? 0}</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>👁 {item.view_count ?? 0}</Text>
            {(item.citation_count ?? 0) > 0 && (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>🔗 {item.citation_count}</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle]       = useState('');
  const [abstract, setAbstract] = useState('');
  const [docType, setDocType]   = useState<UploadDocType>('research_paper');
  const [visibility, setVis]    = useState<'public'|'university'|'private'>('public');
  const [file, setFile]         = useState<any>(null);

  const reset = () => { setTitle(''); setAbstract(''); setDocType('research_paper'); setVis('public'); setFile(null); };

  const pickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (!r.canceled && r.assets?.[0]) setFile(r.assets[0]);
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      const fd = new FormData();
      fd.append('title', title.trim());
      if (abstract.trim()) fd.append('abstract', abstract.trim());
      fd.append('docType', docType);
      fd.append('visibility', visibility);
      if (file) fd.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as any);
      return documentsApi.upload(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.show('Document uploaded — pending review');
      reset(); onClose();
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? e?.message ?? 'Upload failed', 'error'),
  });

  const s = sheetStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { reset(); onClose(); }} transparent>
      <View style={s.overlay}>
        <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.title}>Upload Document</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>

          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Document title" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Abstract</Text>
          <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={abstract} onChangeText={setAbstract} multiline placeholder="Brief summary..." placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Document Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {UPLOAD_DOC_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setDocType(t)}
                style={{ borderWidth: 1, borderColor: docType === t ? colors.primary : colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: docType === t ? colors.primary : 'transparent' }}>
                <Text style={{ fontSize: 12, color: docType === t ? '#fff' : colors.textMuted }}>{t.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Visibility</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['public','university','private'] as const).map(v => (
              <TouchableOpacity key={v} onPress={() => setVis(v)}
                style={{ borderWidth: 1, borderColor: visibility === v ? colors.primary : colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: visibility === v ? colors.primary : 'transparent' }}>
                <Text style={{ fontSize: 12, color: visibility === v ? '#fff' : colors.textMuted }}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>File (PDF or Word)</Text>
          <TouchableOpacity onPress={pickFile} style={{ borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 10, padding: 18, alignItems: 'center', marginTop: 4 }}>
            {file ? (
              <>
                <Text style={{ fontSize: 26 }}>📎</Text>
                <Text style={{ color: colors.text, fontWeight: '600', marginTop: 4, textAlign: 'center' }} numberOfLines={2}>{file.name}</Text>
                {file.size ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{(file.size / 1024).toFixed(0)} KB</Text> : null}
              </>
            ) : (
              <>
                <Text style={{ fontSize: 26 }}>📂</Text>
                <Text style={{ color: colors.primary, fontWeight: '600', marginTop: 4 }}>Choose File</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>PDF or Word document</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, upload.isPending && { opacity: 0.6 }]} onPress={() => upload.mutate()} disabled={upload.isPending}>
            {upload.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Upload Document</Text>}
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RepositoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isStudent = (user?.role ?? 'student') === 'student';

  const [search, setSearch]         = useState('');
  const [debSearch, setDebSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy]         = useState('published_at');
  const [showUpload, setShowUpload] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['documents', debSearch, typeFilter, sortBy],
    queryFn: () =>
      debSearch
        ? searchApi.fullText(debSearch)
        : documentsApi.list({ limit: 30, sortBy, ...(typeFilter ? { docType: typeFilter } : {}) }),
  });

  // Normalise list vs search responses
  const docs: any[] = debSearch
    ? (data?.data?.results ?? data?.data ?? [])
    : (data?.data?.documents ?? []);

  const handleSearch = (text: string) => {
    setSearch(text);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebSearch(text), 400);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>Repository</Text>
          {!isStudent && (
            <TouchableOpacity onPress={() => setShowUpload(true)} style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Upload</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Search bar */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search} onChangeText={handleSearch}
            placeholder="Search documents..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={{ flex: 1, color: '#fff', fontSize: 14 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setDebSearch(''); }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters row */}
      {!debSearch && (
        <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
            {/* Type filters */}
            {[{ key: '', label: 'All' }, ...Object.entries(DOC_TYPE_LABELS).map(([k, v]) => ({ key: k, label: v }))].map(f => (
              <TouchableOpacity key={f.key} onPress={() => setTypeFilter(f.key)}
                style={{ borderWidth: 1, borderColor: typeFilter === f.key ? colors.primary : colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: typeFilter === f.key ? colors.primary : 'transparent' }}>
                <Text style={{ fontSize: 12, color: typeFilter === f.key ? '#fff' : colors.textMuted }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Sort row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10, gap: 8 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, alignSelf: 'center', marginRight: 4 }}>Sort:</Text>
            {SORT_OPTIONS.map(o => (
              <TouchableOpacity key={o.key} onPress={() => setSortBy(o.key)}
                style={{ borderWidth: 1, borderColor: sortBy === o.key ? colors.primary : colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: sortBy === o.key ? colors.primaryLight : 'transparent' }}>
                <Text style={{ fontSize: 12, color: sortBy === o.key ? colors.primary : colors.textMuted, fontWeight: sortBy === o.key ? '700' : '400' }}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {isLoading ? (
        <View style={{ paddingTop: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonDocCard key={i} />)}
        </View>
      ) : (
          <FlatList
            data={docs}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <DocCard item={item} />}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Text style={{ fontSize: 40 }}>📂</Text>
                <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 12 }}>
                  {debSearch ? 'No results found' : 'No documents yet'}
                </Text>
              </View>
            }
          />
        )
      }

      <UploadModal visible={showUpload} onClose={() => setShowUpload(false)} />
    </View>
  );
}

function sheetStyles(colors: any) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:   { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    title:   { fontSize: 17, fontWeight: '700', color: colors.text },
    label:   { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
    input:   { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, fontSize: 14 },
    btn:     { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
