import { useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeContext';
import { documentsApi } from '../../../src/lib/api';
import { saveRecentDoc } from '../../../src/utils/viewHistory';

const DOC_ICONS: Record<string, string> = {
  thesis:           '📜',
  journal_article:  '📰',
  research_paper:   '🔬',
  conference_paper: '🎤',
  report:           '📋',
  dataset:          '🗂️',
  other:            '📄',
};

const STATUS_COLORS: Record<string, string> = {
  approved:  '#10B981',
  pending:   '#F59E0B',
  rejected:  '#EF4444',
  flagged:   '#EF4444',
};

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: res, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
  });

  const doc = res?.data ?? res;

  useEffect(() => {
    if (doc?.id) {
      saveRecentDoc({
        id: doc.id,
        title: doc.title,
        doc_type: doc.doc_type ?? 'other',
        uploader_name: doc.uploader_name,
      });
    }
  }, [doc?.id]);

  const handleDownload = async () => {
    try {
      const result = await documentsApi.download(id);
      const url = result?.data?.downloadUrl ?? result?.downloadUrl ?? result?.data?.url ?? result?.url;
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Not available', 'No download link found for this document.');
      }
    } catch {
      Alert.alert('Error', 'Could not retrieve download link');
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted }}>Document not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const icon = DOC_ICONS[doc.doc_type] ?? '📄';
  const year = doc.published_at
    ? new Date(doc.published_at).getFullYear()
    : doc.created_at
    ? new Date(doc.created_at).getFullYear()
    : null;
  const statusColor = STATUS_COLORS[doc.moderation_status] ?? colors.textMuted;
  const tags: { id: string; name: string }[] = doc.tags ?? [];

  const infoRows = [
    { label: 'Author',     value: doc.uploader_name },
    { label: 'Department', value: doc.department_name },
    { label: 'Type',       value: doc.doc_type?.replace(/_/g, ' ') },
    { label: 'Year',       value: year },
    { label: 'DOI',        value: doc.doi },
    { label: 'Downloads',  value: doc.download_count },
    { label: 'Views',      value: doc.view_count },
    { label: 'Citations',  value: doc.citation_count },
    { label: 'Rating',     value: doc.average_peer_rating ? `${Number(doc.average_peer_rating).toFixed(1)} / 5` : null },
  ].filter(r => r.value != null && r.value !== '' && r.value !== 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {doc.title ?? 'Document'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        {/* Icon */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 40 }}>{icon}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 12, lineHeight: 28 }}>
          {doc.title}
        </Text>

        {/* Badges */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {doc.doc_type && (
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: colors.primary, textTransform: 'capitalize' }}>{doc.doc_type.replace(/_/g, ' ')}</Text>
            </View>
          )}
          {doc.moderation_status && (
            <View style={{ backgroundColor: statusColor + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: statusColor, textTransform: 'capitalize' }}>{doc.moderation_status}</Text>
            </View>
          )}
          {doc.visibility && doc.visibility !== 'public' && (
            <View style={{ backgroundColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' }}>{doc.visibility}</Text>
            </View>
          )}
        </View>

        {/* Info rows */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 20, overflow: 'hidden' }}>
          {infoRows.map((row, i) => (
            <View key={row.label} style={{ flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < infoRows.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
              <Text style={{ width: 96, fontSize: 13, color: colors.textMuted }}>{row.label}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontWeight: '500' }}>{String(row.value)}</Text>
            </View>
          ))}
        </View>

        {/* Abstract */}
        {doc.abstract ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Abstract</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22 }}>{doc.abstract}</Text>
          </View>
        ) : null}

        {/* Tags */}
        {tags.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Tags</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tags.map(t => (
                <View key={t.id} style={{ backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>{t.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Plagiarism info */}
        {doc.plagiarism_score != null && (
          <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Originality Check</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 4 }}>
                <View style={{ height: 6, borderRadius: 4, width: `${Math.round(doc.plagiarism_score * 100)}%`, backgroundColor: doc.plagiarism_score > 0.3 ? '#EF4444' : '#10B981' }} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: doc.plagiarism_score > 0.3 ? '#EF4444' : '#10B981' }}>
                {Math.round(doc.plagiarism_score * 100)}% similarity
              </Text>
            </View>
          </View>
        )}

        {/* Download button */}
        <TouchableOpacity
          onPress={handleDownload}
          style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>⬇️  Download</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
