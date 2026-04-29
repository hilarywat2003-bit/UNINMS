import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl,
  Modal, TextInput, StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../src/components/Toast';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuthStore } from '../../src/stores/authStore';
import { analyticsApi, notificationsApi, usersApi, coursesApi, documentsApi } from '../../src/lib/api';
import { ClayCard } from '../../src/components/ClayCard';
import { getRecentDocs, RecentDoc } from '../../src/utils/viewHistory';

// ── Shared components ─────────────────────────────────────────────────────────
function StatCard({ label, value, emoji, color }: { label: string; value: string | number; emoji: string; color: string }) {
  const { colors } = useTheme();
  return (
    <ClayCard style={{ flex: 1, padding: 14, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </ClayCard>
  );
}

function QuickAction({ emoji, label, onPress, accent }: { emoji: string; label: string; onPress: () => void; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <ClayCard
      onPress={onPress}
      backgroundColor={accent ? colors.primaryLight : colors.card}
      style={{ flex: 1, padding: 14, alignItems: 'center', gap: 6 }}
    >
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={{ fontSize: 12, color: accent ? colors.primary : colors.text, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </ClayCard>
  );
}

function NotifItem({ n }: { n: any }) {
  const { colors } = useTheme();
  return (
    <ClayCard style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: n.read ? colors.border : colors.primary }} />
      <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 }}>{n.message}</Text>
    </ClayCard>
  );
}

// ── Student Home ───────────────────────────────────────────────────────────────
function StudentHome({ profile, analytics, notifs, isLoading, isRefetching, refetch }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

  useEffect(() => { getRecentDocs().then(setRecentDocs); }, []);

  const { data: docsRes } = useQuery({
    queryKey: ['documents', 'mine', profile?.id],
    queryFn: () =>
      profile?.id
        ? documentsApi.list({ uploaderId: profile.id, limit: 5, sortBy: 'published_at' })
        : documentsApi.list({ limit: 5, sortBy: 'published_at' }),
  });
  const myDocs: any[] = docsRes?.data?.documents ?? [];

  const docCount = analytics?.documents?.length ?? 0;
  const points   = analytics?.level?.total_points ?? profile?.total_points ?? 0;
  const level    = analytics?.level?.current_level ?? profile?.current_level ?? 'Contributor';
  const nextLevel = profile?.next_level ?? 'Scholar';
  const toNext    = profile?.points_to_next ?? 500;
  const levelNum  = analytics?.level?.level_number ?? 1;

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 16, paddingBottom: 40, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{greet()}</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 }}>
              {profile?.full_name ?? 'Student'}
            </Text>
            {profile?.department_name ? (
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>{profile.department_name}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {(profile?.full_name ?? 'S').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -24 }}>
        {/* Points card */}
        <ClayCard style={{ marginBottom: 16 }}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 32, marginRight: 12 }}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primary }}>{points} pts</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>{level} · {toNext} pts to {nextLevel}</Text>
            </View>
          </View>
          <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{
              height: 6, borderRadius: 3, backgroundColor: colors.primary,
              width: `${Math.min(100, toNext > 0 ? Math.round(((500 - toNext) / 500) * 100) : 100)}%`,
            }} />
          </View>
        </View>
        </ClayCard>

        {isLoading
          ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <StatCard label="Documents" value={docCount} emoji="📄" color={colors.primary} />
              <StatCard label="Level"     value={levelNum} emoji="🏅" color={colors.success} />
              <StatCard label="Points"    value={points}   emoji="⭐" color={colors.accent} />
            </View>
          )
        }

        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Quick Access</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <QuickAction emoji="📚" label="Courses"    onPress={() => router.push('/(tabs)/courses')} accent />
          <QuickAction emoji="📂" label="Repository" onPress={() => router.push('/(tabs)/repository')} />
          <QuickAction emoji="💬" label="Forums"     onPress={() => router.push('/(tabs)/forums')} />
          <QuickAction emoji="🔔" label="Alerts"     onPress={() => router.push('/(tabs)/notifications')} />
        </View>

        {recentDocs.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Recently Viewed</Text>
            {recentDocs.slice(0, 5).map((d) => (
              <ClayCard
                key={d.id}
                onPress={() => router.push(`/repository/${d.id}` as any)}
                style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>🕐</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{d.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {(d.doc_type ?? 'document').replace(/_/g, ' ')}
                    {d.uploader_name ? ` · ${d.uploader_name}` : ''}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
              </ClayCard>
            ))}
          </View>
        )}

        {myDocs.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>My Documents</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/repository')}>
                <Text style={{ fontSize: 13, color: colors.primary }}>See all</Text>
              </TouchableOpacity>
            </View>
            {myDocs.slice(0, 3).map((d: any) => (
              <ClayCard
                key={d.id}
                onPress={() => router.push(`/repository/${d.id}` as any)}
                style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 10,
                  backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 20 }}>📄</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{d.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                    {(d.doc_type ?? 'document').replace(/_/g, ' ')}
                    {' · '}{d.download_count ?? 0} downloads
                  </Text>
                </View>
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: d.is_published ? colors.success : colors.warning,
                }} />
              </ClayCard>
            ))}
          </View>
        )}

        {notifs.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')}>
                <Text style={{ fontSize: 13, color: colors.primary }}>See all</Text>
              </TouchableOpacity>
            </View>
            {notifs.map((n: any) => <NotifItem key={n.id} n={n} />)}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Lecturer Home ─────────────────────────────────────────────────────────────
function LecturerHome({ profile, analytics, notifs, isLoading, isRefetching, refetch }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

  useEffect(() => { getRecentDocs().then(setRecentDocs); }, []);

  const { data: coursesRes } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list(),
  });

  const { data: docsRes } = useQuery({
    queryKey: ['documents', 'mine', profile?.id],
    queryFn: () =>
      profile?.id
        ? documentsApi.list({ uploaderId: profile.id, limit: 5, sortBy: 'published_at' })
        : documentsApi.list({ limit: 5, sortBy: 'published_at' }),
  });
  const myDocs: any[] = docsRes?.data?.documents ?? [];

  const courses: any[] = coursesRes?.data?.courses ?? [];
  const docCount = analytics?.documents?.length ?? 0;
  const points   = analytics?.level?.total_points ?? profile?.total_points ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 16, paddingBottom: 40, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Welcome back,</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 }}>
              {profile?.full_name ?? 'Lecturer'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
              {profile?.department_name ?? 'Faculty'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {(profile?.full_name ?? 'L').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -24 }}>
        {/* Stats */}
        {isLoading
          ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <StatCard label="Courses"   value={courses.length} emoji="📘" color={colors.primary} />
              <StatCard label="Documents" value={docCount}       emoji="📄" color={colors.success} />
              <StatCard label="Points"    value={points}         emoji="⭐" color={colors.accent} />
            </View>
          )
        }

        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Quick Access</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <QuickAction emoji="📚" label="Courses"    onPress={() => router.push('/(tabs)/courses')} accent />
          <QuickAction emoji="📂" label="Repository" onPress={() => router.push('/(tabs)/repository')} />
          <QuickAction emoji="💬" label="Forums"     onPress={() => router.push('/(tabs)/forums')} />
          <QuickAction emoji="🔔" label="Alerts"     onPress={() => router.push('/(tabs)/notifications')} />
        </View>

        {recentDocs.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Recently Viewed</Text>
            {recentDocs.slice(0, 5).map((d) => (
              <ClayCard
                key={d.id}
                onPress={() => router.push(`/repository/${d.id}` as any)}
                style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>🕐</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{d.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {(d.doc_type ?? 'document').replace(/_/g, ' ')}
                    {d.uploader_name ? ` · ${d.uploader_name}` : ''}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
              </ClayCard>
            ))}
          </View>
        )}

        {/* Course overview */}
        {courses.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>My Courses</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/courses')}>
                <Text style={{ fontSize: 13, color: colors.primary }}>Manage</Text>
              </TouchableOpacity>
            </View>
            {courses.slice(0, 3).map((c: any) => (
              <ClayCard
                key={c.id}
                onPress={() => router.push('/(tabs)/courses')}
                style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Text style={{ fontSize: 24 }}>📘</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>{c.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {c.course_code ?? ''} · {c.enrolled_count ?? 0} students
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted }}>›</Text>
              </ClayCard>
            ))}
          </View>
        )}

        {myDocs.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>My Documents</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/repository')}>
                <Text style={{ fontSize: 13, color: colors.primary }}>See all</Text>
              </TouchableOpacity>
            </View>
            {myDocs.slice(0, 3).map((d: any) => (
              <ClayCard
                key={d.id}
                onPress={() => router.push(`/repository/${d.id}` as any)}
                style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 10,
                  backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 20 }}>📄</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{d.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                    {(d.doc_type ?? 'document').replace(/_/g, ' ')}
                    {' · '}{d.download_count ?? 0} downloads
                  </Text>
                </View>
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: d.is_published ? colors.success : colors.warning,
                }} />
              </ClayCard>
            ))}
          </View>
        )}

        {notifs.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')}>
                <Text style={{ fontSize: 13, color: colors.primary }}>See all</Text>
              </TouchableOpacity>
            </View>
            {notifs.map((n: any) => <NotifItem key={n.id} n={n} />)}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Upload Modal (Researcher) ─────────────────────────────────────────────────
const DOC_TYPES = ['research_paper', 'thesis', 'conference_paper', 'journal_article', 'report', 'dataset', 'other'] as const;
type DocType = typeof DOC_TYPES[number];

function UploadModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle]         = useState('');
  const [abstract, setAbstract]   = useState('');
  const [docType, setDocType]     = useState<DocType>('research_paper');
  const [visibility, setVisibility] = useState<'public' | 'university' | 'private'>('public');
  const [file, setFile]           = useState<any>(null);

  const reset = () => {
    setTitle(''); setAbstract(''); setDocType('research_paper');
    setVisibility('public'); setFile(null);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setFile(result.assets[0]);
    }
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      const fd = new FormData();
      fd.append('title', title.trim());
      if (abstract.trim()) fd.append('abstract', abstract.trim());
      fd.append('docType', docType);
      fd.append('visibility', visibility);
      if (file) {
        fd.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType ?? 'application/octet-stream',
        } as any);
      }
      return documentsApi.upload(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast.show('Document uploaded — pending review');
      reset(); onClose();
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? e?.message ?? 'Upload failed', 'error'),
  });

  const s = StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:    { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    title_:   { fontSize: 17, fontWeight: '700', color: colors.text },
    label:    { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
    input:    { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, fontSize: 14 },
    pillRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill:     { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    pillText: { color: colors.textMuted, fontSize: 12 },
    btn:      { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    btnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.overlay}>
        <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.title_}>Upload Research Document</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Text style={{ color: colors.error, fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Document title" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Abstract</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: 'top' }]}
            value={abstract} onChangeText={setAbstract}
            multiline placeholder="Brief summary of the document..."
            placeholderTextColor={colors.textMuted}
          />

          <Text style={s.label}>Document Type</Text>
          <View style={s.pillRow}>
            {DOC_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setDocType(t)}
                style={[s.pill, docType === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[s.pillText, docType === t && { color: '#fff' }]}>
                  {t.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Visibility</Text>
          <View style={s.pillRow}>
            {(['public', 'university', 'private'] as const).map(v => (
              <TouchableOpacity key={v} onPress={() => setVisibility(v)}
                style={[s.pill, visibility === v && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[s.pillText, visibility === v && { color: '#fff' }]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>File (PDF or Word)</Text>
          <TouchableOpacity onPress={pickFile} style={{
            borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
            borderRadius: 10, padding: 18, alignItems: 'center', marginTop: 4,
          }}>
            {file ? (
              <>
                <Text style={{ fontSize: 28 }}>📎</Text>
                <Text style={{ color: colors.text, fontWeight: '600', marginTop: 4, textAlign: 'center' }} numberOfLines={2}>{file.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {file.size ? `${(file.size / 1024).toFixed(0)} KB` : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 28 }}>📂</Text>
                <Text style={{ color: colors.primary, fontWeight: '600', marginTop: 4 }}>Choose File</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>PDF or Word document</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, upload.isPending && { opacity: 0.6 }]} onPress={() => upload.mutate()} disabled={upload.isPending}>
            {upload.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Upload Document</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Researcher Home ───────────────────────────────────────────────────────────
function ResearcherHome({ profile, analytics, notifs, isLoading, isRefetching, refetch }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

  useEffect(() => { getRecentDocs().then(setRecentDocs); }, []);

  const { data: docsRes } = useQuery({
    queryKey: ['documents', 'mine', profile?.id],
    queryFn: () =>
      profile?.id
        ? documentsApi.list({ uploaderId: profile.id, limit: 5, sortBy: 'published_at' })
        : documentsApi.list({ limit: 5, sortBy: 'published_at' }),
  });

  const myDocs: any[] = docsRes?.data?.documents ?? [];
  const docCount   = analytics?.documents?.length ?? 0;
  const points     = analytics?.level?.total_points ?? profile?.total_points ?? 0;
  const citations  = analytics?.totalCitations ?? 0;
  const level      = analytics?.level?.current_level ?? profile?.current_level ?? 'Contributor';

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 16, paddingBottom: 40, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Research Dashboard</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 }}>
              {profile?.full_name ?? 'Researcher'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
              {profile?.department_name ?? 'Research'} · {level}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {(profile?.full_name ?? 'R').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -24 }}>
        {isLoading
          ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <StatCard label="Documents" value={docCount}  emoji="📄" color={colors.primary} />
              <StatCard label="Citations" value={citations} emoji="🔗" color={colors.accent} />
              <StatCard label="Points"    value={points}    emoji="⭐" color={colors.success} />
            </View>
          )
        }

        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Quick Access</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <QuickAction emoji="⬆️"  label="Upload"     onPress={() => setShowUpload(true)} accent />
          <QuickAction emoji="🔬"  label="Research"   onPress={() => router.push('/(tabs)/research')} />
          <QuickAction emoji="📂"  label="Repository" onPress={() => router.push('/(tabs)/repository')} />
          <QuickAction emoji="💬"  label="Forums"     onPress={() => router.push('/(tabs)/forums')} />
        </View>

        {recentDocs.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Recently Viewed</Text>
            {recentDocs.slice(0, 5).map((d) => (
              <ClayCard
                key={d.id}
                onPress={() => router.push(`/repository/${d.id}` as any)}
                style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>🕐</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{d.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {(d.doc_type ?? 'document').replace(/_/g, ' ')}
                    {d.uploader_name ? ` · ${d.uploader_name}` : ''}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
              </ClayCard>
            ))}
          </View>
        )}

        {/* Recent docs */}
        {myDocs.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>My Documents</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/repository')}>
                <Text style={{ fontSize: 13, color: colors.primary }}>See all</Text>
              </TouchableOpacity>
            </View>
            {myDocs.slice(0, 3).map((d: any) => (
              <ClayCard
                key={d.id}
                onPress={() => router.push(`/repository/${d.id}` as any)}
                style={{ marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 10,
                  backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 20 }}>📄</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                    {(d.doc_type ?? 'document').replace(/_/g, ' ')}
                    {' · '}{d.download_count ?? 0} downloads · {d.citation_count ?? 0} citations
                  </Text>
                </View>
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: d.is_published ? colors.success : colors.warning,
                }} />
              </ClayCard>
            ))}
          </View>
        )}

        {notifs.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')}>
                <Text style={{ fontSize: 13, color: colors.primary }}>See all</Text>
              </TouchableOpacity>
            </View>
            {notifs.map((n: any) => <NotifItem key={n.id} n={n} />)}
          </View>
        )}
      </View>
    </ScrollView>
    <UploadModal visible={showUpload} onClose={() => setShowUpload(false)} />
    </>
  );
}

// ── Root: picks the right home based on role ──────────────────────────────────
export default function HomeScreen() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'student';

  const { data: analyticsRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['analytics', 'me'],
    queryFn: analyticsApi.me,
  });
  const { data: profileRes } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: usersApi.me,
  });
  const { data: notifRes } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notificationsApi.list({ limit: 3 }),
  });

  const analytics = analyticsRes?.data ?? analyticsRes;
  const profile   = profileRes?.data ?? profileRes;
  const notifs    = notifRes?.data?.notifications ?? [];

  const shared = { profile, analytics, notifs, isLoading, isRefetching, refetch };

  if (role === 'lecturer')   return <LecturerHome   {...shared} />;
  if (role === 'researcher') return <ResearcherHome {...shared} />;
  return <StudentHome {...shared} />;
}
