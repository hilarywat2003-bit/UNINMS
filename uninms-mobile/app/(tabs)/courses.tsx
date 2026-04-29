import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, TextInput, KeyboardAvoidingView, ScrollView,
  Platform, Alert, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuthStore } from '../../src/stores/authStore';
import { useToast } from '../../src/components/Toast';
import { ClayCard } from '../../src/components/ClayCard';
import { coursesApi, assignmentsApi, documentsApi } from '../../src/lib/api';

type CourseTab = 'assignments' | 'materials';

const MATERIAL_TYPES = [
  { key: 'lecture_notes',  label: 'Lecture Notes',   emoji: '📖' },
  { key: 'tutorial',       label: 'Tutorial Sheet',  emoji: '📋' },
  { key: 'past_exam',      label: 'Past Exam',       emoji: '📄' },
  { key: 'assignment',     label: 'Assignment Brief', emoji: '📝' },
  { key: 'reading',        label: 'Reading Material', emoji: '📚' },
  { key: 'slides',         label: 'Slides',           emoji: '🖼️' },
  { key: 'other',          label: 'Other',            emoji: '📎' },
];

// ── Course card ───────────────────────────────────────────────────────────────
function CourseCard({ course, onPress }: { course: any; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <ClayCard onPress={onPress} style={{ marginBottom: 10, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{
          width: 46, height: 46, borderRadius: 12,
          backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 22 }}>📘</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={2}>
            {course.title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
            {course.course_code ?? ''}{course.course_code ? ' · ' : ''}{course.lecturer_name ?? 'No lecturer'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {course.department_name && (
              <View style={{ backgroundColor: colors.primaryLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: colors.primary }}>{course.department_name}</Text>
              </View>
            )}
            {course.semester && (
              <View style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>{course.semester} Sem</Text>
              </View>
            )}
            <View style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {course.enrolled_count ?? course.enrollment_count ?? 0} students · {course.material_count ?? 0} materials
              </Text>
            </View>
          </View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </View>
    </ClayCard>
  );
}

// ── Assignment item ───────────────────────────────────────────────────────────
function AssignmentItem({
  item, isLecturer, onSubmit, onViewSubmissions,
}: { item: any; isLecturer: boolean; onSubmit?: (assignment: any) => void; onViewSubmissions?: (assignment: any) => void }) {
  const { colors } = useTheme();
  const due = item.due_date ? new Date(item.due_date) : null;
  const isOverdue = due && due < new Date();
  const submitted = !!item.my_submission_id;
  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: 10, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 8,
      borderLeftWidth: 3, borderLeftColor: submitted ? colors.success : isOverdue ? colors.error : colors.primary,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.title}</Text>
      {item.description ? (
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {due ? (
          <Text style={{ fontSize: 12, color: isOverdue ? colors.error : colors.success, fontWeight: '600', flex: 1 }}>
            {isOverdue ? '⚠️ Overdue · ' : '📅 Due '}
            {due.toLocaleDateString()} at {due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : <View style={{ flex: 1 }} />}

        {isLecturer ? (
          <TouchableOpacity
            onPress={() => onViewSubmissions?.(item)}
            style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
          >
            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
              {item.submission_count ?? 0} submission{(item.submission_count ?? 0) !== 1 ? 's' : ''} →
            </Text>
          </TouchableOpacity>
        ) : submitted ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>✓ Submitted</Text>
            {item.my_grade && (
              <Text style={{ fontSize: 11, color: colors.textMuted }}> · Grade: {item.my_grade}</Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => onSubmit?.(item)}
            style={{
              backgroundColor: colors.primary, borderRadius: 8,
              paddingHorizontal: 14, paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>Submit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Material item ─────────────────────────────────────────────────────────────
function MaterialItem({ item, isLecturer, onRemove }: { item: any; isLecturer: boolean; onRemove: () => void }) {
  const { colors } = useTheme();
  const ext = item.file_name?.split('.').pop()?.toUpperCase() ?? 'FILE';

  const handleOpen = async () => {
    try {
      const res = await documentsApi.download(item.document_id ?? item.id);
      const url = res?.data?.url ?? res?.url ?? res?.downloadUrl;
      if (url) await Linking.openURL(url);
      else Alert.alert('Error', 'No download link available');
    } catch {
      Alert.alert('Error', 'Could not open file');
    }
  };

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: 10, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 8,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      <View style={{
        width: 42, height: 42, borderRadius: 10,
        backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>{ext}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
          {item.title ?? item.file_name ?? 'Untitled'}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
          {item.document_type ?? item.type ?? 'document'}
          {item.assigned_by_name ? ` · ${item.assigned_by_name}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={handleOpen} style={{
        backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
      }}>
        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Open</Text>
      </TouchableOpacity>
      {isLecturer && (
        <TouchableOpacity onPress={onRemove} style={{ paddingHorizontal: 6 }}>
          <Text style={{ fontSize: 16, color: colors.error }}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CoursesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const toast = useToast();
  const isLecturer = user?.role === 'lecturer';

  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [activeTab, setActiveTab]           = useState<CourseTab>('assignments');
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc]   = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignDueTime, setAssignDueTime] = useState('23:59');

  // Upload material form state
  const [showUploadForm, setShowUploadForm]   = useState(false);
  const [matTitle, setMatTitle]               = useState('');
  const [matDescription, setMatDescription]   = useState('');
  const [matType, setMatType]                 = useState('lecture_notes');
  const [matWeek, setMatWeek]                 = useState('');
  const [pickedFile, setPickedFile]           = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading]             = useState(false);

  // Student submission form state
  const [showSubmitModal, setShowSubmitModal]   = useState(false);
  const [submitTarget, setSubmitTarget]         = useState<any>(null);
  const [submitNote, setSubmitNote]             = useState('');
  const [submitFile, setSubmitFile]             = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting]             = useState(false);

  // Lecturer submissions viewer state
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [submissionsTarget, setSubmissionsTarget]       = useState<any>(null);
  const [gradingId, setGradingId]                       = useState<string | null>(null);
  const [gradeValue, setGradeValue]                     = useState('');
  const [gradeFeedback, setGradeFeedback]               = useState('');

  const resetUploadForm = () => {
    setMatTitle(''); setMatDescription(''); setMatType('lecture_notes');
    setMatWeek(''); setPickedFile(null);
  };

  const openSubmitModal = (assignment: any) => {
    setSubmitTarget(assignment);
    setSubmitNote('');
    setSubmitFile(null);
    setShowSubmitModal(true);
  };

  const handlePickSubmitFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSubmitFile(result.assets[0]);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!submitNote.trim() && !submitFile) {
      toast.show('Add a note or attach a file', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (submitNote.trim()) fd.append('note', submitNote.trim());
      if (submitFile) {
        fd.append('file', {
          uri: submitFile.uri, name: submitFile.name,
          type: submitFile.mimeType ?? 'application/octet-stream',
        } as any);
      }
      await assignmentsApi.submit(submitTarget.id, fd);
      qc.invalidateQueries({ queryKey: ['assignments', selectedCourse?.id] });
      setShowSubmitModal(false);
      toast.show('Assignment submitted!');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Submission failed';
      toast.show(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: coursesRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['courses'],
    queryFn: coursesApi.list,
  });

  const { data: assignmentsRes, isLoading: loadingAssignments } = useQuery({
    queryKey: ['assignments', selectedCourse?.id],
    queryFn: () => coursesApi.assignments(selectedCourse.id),
    enabled: !!selectedCourse && activeTab === 'assignments',
  });

  const { data: materialsRes, isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials', selectedCourse?.id],
    queryFn: () => coursesApi.materials(selectedCourse.id),
    enabled: !!selectedCourse && activeTab === 'materials',
  });

  const { data: submissionsRes, isLoading: loadingSubmissions } = useQuery({
    queryKey: ['submissions', submissionsTarget?.id],
    queryFn: () => assignmentsApi.submissions(submissionsTarget.id),
    enabled: !!submissionsTarget && showSubmissionsModal,
  });
  const submissions: any[] = submissionsRes?.data?.submissions ?? submissionsRes?.data ?? [];

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createAssignment = useMutation({
    mutationFn: () => {
      const due = assignDueDate.trim()
        ? `${assignDueDate.trim()}T${assignDueTime.trim() || '23:59'}:00`
        : undefined;
      return assignmentsApi.create(selectedCourse.id, {
        title: assignTitle, description: assignDesc, due_date: due,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments', selectedCourse?.id] });
      setShowCreateAssignment(false);
      setAssignTitle(''); setAssignDesc(''); setAssignDueDate(''); setAssignDueTime('23:59');
    },
    onError: () => Alert.alert('Error', 'Could not create assignment'),
  });

  const removeMaterial = useMutation({
    mutationFn: (materialId: string) => coursesApi.removeMaterial(selectedCourse.id, materialId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials', selectedCourse?.id] }),
    onError: () => Alert.alert('Error', 'Could not remove material'),
  });

  const gradeSubmission = useMutation({
    mutationFn: ({ submissionId, grade, feedback }: { submissionId: string; grade: string; feedback: string }) =>
      assignmentsApi.grade(submissionId, { grade, feedback }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions', submissionsTarget?.id] });
      setGradingId(null); setGradeValue(''); setGradeFeedback('');
      toast.show('Grade saved');
    },
    onError: () => toast.show('Could not save grade', 'error'),
  });

  const openSubmissionsModal = (assignment: any) => {
    setSubmissionsTarget(assignment);
    setGradingId(null); setGradeValue(''); setGradeFeedback('');
    setShowSubmissionsModal(true);
  };

  // ── Pick file ─────────────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/vnd.ms-powerpoint',
             'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setPickedFile(asset);
      // Auto-fill title from filename if blank
      if (!matTitle.trim()) {
        setMatTitle(asset.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  // ── Submit upload form ────────────────────────────────────────────────────────
  const handleSubmitUpload = async () => {
    if (!pickedFile) { Alert.alert('No file', 'Please pick a file first.'); return; }
    if (!matTitle.trim()) { Alert.alert('Required', 'Please enter a title for this material.'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: pickedFile.uri, name: pickedFile.name,
        type: pickedFile.mimeType ?? 'application/octet-stream',
      } as any);
      formData.append('title', matTitle.trim());
      formData.append('type', matType);
      if (matDescription.trim()) formData.append('abstract', matDescription.trim());
      if (matWeek.trim()) formData.append('tags', `Week ${matWeek.trim()}`);

      // Step 1: upload to repository
      const uploadRes = await documentsApi.upload(formData);
      const documentId = uploadRes?.data?.id ?? uploadRes?.id;
      if (!documentId) throw new Error('Upload failed — no document ID returned');

      // Step 2: link to course
      await coursesApi.addMaterial(selectedCourse.id, documentId);
      qc.invalidateQueries({ queryKey: ['materials', selectedCourse?.id] });
      qc.invalidateQueries({ queryKey: ['courses'] });

      setShowUploadForm(false);
      resetUploadForm();
      Alert.alert('Uploaded!', `"${matTitle}" has been added to this course.`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.response?.data?.message ?? err?.message ?? 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const courses: any[]   = coursesRes?.data?.courses ?? [];
  const assignments: any[] = assignmentsRes?.data?.assignments ?? [];
  const materials: any[]   = materialsRes?.data?.materials ?? [];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.primary,
        paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        {selectedCourse && (
          <TouchableOpacity onPress={() => { setSelectedCourse(null); setActiveTab('assignments'); }}>
            <Text style={{ color: '#fff', fontSize: 20 }}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {selectedCourse ? selectedCourse.title : isLecturer ? 'My Courses' : 'Enrolled Courses'}
        </Text>

        {/* Action button */}
        {isLecturer && selectedCourse && activeTab === 'assignments' && (
          <TouchableOpacity
            onPress={() => setShowCreateAssignment(true)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>+ Add</Text>
          </TouchableOpacity>
        )}
        {isLecturer && selectedCourse && activeTab === 'materials' && (
          <TouchableOpacity
            onPress={() => setShowUploadForm(true)}
            disabled={uploading}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>⬆ Upload</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Course list */}
      {!selectedCourse && (
        isLoading
          ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          : (
            <FlatList
              data={courses}
              keyExtractor={c => c.id}
              contentContainerStyle={{ padding: 16 }}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
              renderItem={({ item }) => (
                <CourseCard course={item} onPress={() => setSelectedCourse(item)} />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 60 }}>
                  <Text style={{ fontSize: 48 }}>📚</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 16 }}>
                    {isLecturer ? 'No courses yet' : 'Not enrolled in any courses'}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
                    {isLecturer
                      ? 'Contact your admin to create courses for you.'
                      : 'Ask your lecturer to enroll you in a course.'}
                  </Text>
                </View>
              }
            />
          )
      )}

      {/* Course detail */}
      {selectedCourse && (
        <View style={{ flex: 1 }}>
          {/* Course meta */}
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {selectedCourse.lecturer_name} · {selectedCourse.department_name}
              {selectedCourse.semester ? ` · ${selectedCourse.semester} Semester` : ''}
            </Text>
          </View>

          {/* Tabs */}
          <View style={{
            flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
            backgroundColor: colors.surface, borderRadius: 10, padding: 4,
            borderWidth: 1, borderColor: colors.border,
          }}>
            {(['assignments', 'materials'] as CourseTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                  backgroundColor: activeTab === tab ? colors.primary : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: activeTab === tab ? '#fff' : colors.textMuted,
                  textTransform: 'capitalize',
                }}>
                  {tab === 'assignments' ? '📝 Assignments' : '📎 Materials'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Assignments tab */}
          {activeTab === 'assignments' && (
            loadingAssignments
              ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
              : (
                <FlatList
                  data={assignments}
                  keyExtractor={a => a.id}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                  renderItem={({ item }) => (
                    <AssignmentItem
                      item={item}
                      isLecturer={isLecturer}
                      onSubmit={openSubmitModal}
                      onViewSubmissions={openSubmissionsModal}
                    />
                  )}
                  ListHeaderComponent={
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
                      {assignments.length} Assignment{assignments.length !== 1 ? 's' : ''}
                    </Text>
                  }
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Text style={{ fontSize: 36 }}>📝</Text>
                      <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 12 }}>No assignments yet</Text>
                      {isLecturer && (
                        <TouchableOpacity
                          onPress={() => setShowCreateAssignment(true)}
                          style={{
                            marginTop: 16, backgroundColor: colors.primary,
                            borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Create First Assignment</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  }
                />
              )
          )}

          {/* Materials tab */}
          {activeTab === 'materials' && (
            loadingMaterials
              ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
              : (
                <FlatList
                  data={materials}
                  keyExtractor={m => m.material_id ?? m.id}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                  renderItem={({ item }) => (
                    <MaterialItem
                      item={item}
                      isLecturer={isLecturer}
                      onRemove={() =>
                        Alert.alert('Remove Material', `Remove "${item.title ?? item.file_name}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeMaterial.mutate(item.material_id ?? item.id) },
                        ])
                      }
                    />
                  )}
                  ListHeaderComponent={
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {materials.length} Material{materials.length !== 1 ? 's' : ''}
                      </Text>
                      {isLecturer && (
                        <TouchableOpacity
                          onPress={() => setShowUploadForm(true)}
                          disabled={uploading}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          {uploading
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>⬆ Upload Material</Text>
                          }
                        </TouchableOpacity>
                      )}
                    </View>
                  }
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Text style={{ fontSize: 36 }}>📎</Text>
                      <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 12 }}>No materials yet</Text>
                      {isLecturer && (
                        <TouchableOpacity
                          onPress={() => setShowUploadForm(true)}
                          disabled={uploading}
                          style={{
                            marginTop: 16, backgroundColor: colors.primary,
                            borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Upload First Material</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  }
                />
              )
          )}
        </View>
      )}

      {/* ── Upload Material Form Modal ─────────────────────────────────── */}
      <Modal visible={showUploadForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={{
            paddingTop: 20, paddingHorizontal: 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <TouchableOpacity onPress={() => { setShowUploadForm(false); resetUploadForm(); }}>
              <Text style={{ fontSize: 15, color: colors.error }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Upload Material</Text>
            <TouchableOpacity
              onPress={handleSubmitUpload}
              disabled={uploading || !pickedFile || !matTitle.trim()}
            >
              {uploading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700', opacity: (!pickedFile || !matTitle.trim()) ? 0.4 : 1 }}>
                    Upload
                  </Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">

            {/* Title */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Title *
              </Text>
              <TextInput
                value={matTitle} onChangeText={setMatTitle}
                placeholder="e.g. Week 3 Lecture Notes"
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: colors.text }}
              />
            </View>

            {/* Description */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                What is this for?
              </Text>
              <TextInput
                value={matDescription} onChangeText={setMatDescription}
                placeholder="e.g. Covers topics on binary trees and graph traversal. Required reading for the mid-term."
                placeholderTextColor={colors.textMuted}
                multiline numberOfLines={4} textAlignVertical="top"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, fontSize: 14, color: colors.text, minHeight: 100 }}
              />
            </View>

            {/* Type selector */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Material Type *
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MATERIAL_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setMatType(t.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: matType === t.key ? colors.primary : colors.border,
                      backgroundColor: matType === t.key ? colors.primaryLight : colors.surface,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
                    <Text style={{ fontSize: 13, fontWeight: matType === t.key ? '700' : '400', color: matType === t.key ? colors.primary : colors.text }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Week number */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Week / Topic (optional)
              </Text>
              <TextInput
                value={matWeek} onChangeText={setMatWeek}
                placeholder="e.g. 3  or  Recursion & Sorting"
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: colors.text }}
              />
            </View>

            {/* File picker */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                File *
              </Text>
              <TouchableOpacity
                onPress={handlePickFile}
                style={{
                  borderWidth: 2, borderColor: pickedFile ? colors.primary : colors.border,
                  borderStyle: 'dashed', borderRadius: 12, padding: 20,
                  alignItems: 'center', gap: 8,
                  backgroundColor: pickedFile ? colors.primaryLight : colors.surface,
                }}
              >
                <Text style={{ fontSize: 32 }}>{pickedFile ? '📄' : '📁'}</Text>
                {pickedFile ? (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'center' }} numberOfLines={2}>
                      {pickedFile.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {pickedFile.size ? `${(pickedFile.size / 1024).toFixed(0)} KB` : ''} · Tap to change
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Tap to pick a file</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>PDF, Word, PowerPoint</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Upload button (bottom) */}
            {pickedFile && matTitle.trim() && (
              <TouchableOpacity
                onPress={handleSubmitUpload}
                disabled={uploading}
                style={{
                  backgroundColor: colors.primary, borderRadius: 12,
                  paddingVertical: 16, alignItems: 'center',
                  opacity: uploading ? 0.7 : 1, marginTop: 8,
                }}
              >
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>⬆  Upload Material</Text>
                }
              </TouchableOpacity>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Assignment Modal */}
      <Modal visible={showCreateAssignment} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{
            paddingTop: 20, paddingHorizontal: 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <TouchableOpacity onPress={() => setShowCreateAssignment(false)}>
              <Text style={{ fontSize: 15, color: colors.error }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>New Assignment</Text>
            <TouchableOpacity
              onPress={() => createAssignment.mutate()}
              disabled={!assignTitle.trim() || createAssignment.isPending}
            >
              <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700', opacity: !assignTitle.trim() ? 0.4 : 1 }}>
                {createAssignment.isPending ? 'Saving...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Title *</Text>
              <TextInput
                value={assignTitle} onChangeText={setAssignTitle}
                placeholder="e.g. Assignment 1 — Data Structures"
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: colors.text }}
              />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Description</Text>
              <TextInput
                value={assignDesc} onChangeText={setAssignDesc}
                placeholder="Instructions for students..."
                placeholderTextColor={colors.textMuted}
                multiline numberOfLines={4} textAlignVertical="top"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, fontSize: 14, color: colors.text, minHeight: 100 }}
              />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Due Date & Time (optional)
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 3 }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    value={assignDueDate}
                    onChangeText={setAssignDueDate}
                    placeholder="e.g. 2026-05-30"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    style={{
                      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                      borderRadius: 10, padding: 14, fontSize: 15, color: colors.text,
                    }}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Time (HH:MM)</Text>
                  <TextInput
                    value={assignDueTime}
                    onChangeText={setAssignDueTime}
                    placeholder="23:59"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    style={{
                      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                      borderRadius: 10, padding: 14, fontSize: 15, color: colors.text,
                    }}
                  />
                </View>
              </View>
              {assignDueDate.trim() && assignDueTime.trim() && (
                <Text style={{ fontSize: 12, color: colors.primary, marginTop: 6, fontWeight: '500' }}>
                  📅 Due: {assignDueDate} at {assignDueTime}
                </Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Submissions Viewer Modal (lecturer) ──────────────────────── */}
      <Modal visible={showSubmissionsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            paddingTop: 20, paddingHorizontal: 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <TouchableOpacity onPress={() => { setShowSubmissionsModal(false); setGradingId(null); }}>
              <Text style={{ fontSize: 15, color: colors.primary }}>Done</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }} numberOfLines={1}>
              {submissionsTarget?.title}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {loadingSubmissions ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : submissions.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 40 }}>📭</Text>
              <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 16 }}>No submissions yet</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </Text>
              {submissions.map((s: any) => (
                <View key={s.id} style={{
                  backgroundColor: colors.card, borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{s.student_name ?? s.full_name ?? 'Student'}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ''}
                      </Text>
                    </View>
                    {s.grade ? (
                      <View style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Grade: {s.grade}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => { setGradingId(s.id); setGradeValue(''); setGradeFeedback(s.feedback ?? ''); }}
                        style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
                      >
                        <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>Grade</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {s.note ? (
                    <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: 8 }}>{s.note}</Text>
                  ) : null}

                  {s.file_url || s.submission_url ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(s.file_url ?? s.submission_url)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: colors.primary }}>📎 View attachment</Text>
                    </TouchableOpacity>
                  ) : null}

                  {s.feedback ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>Feedback: {s.feedback}</Text>
                  ) : null}

                  {/* Inline grade form */}
                  {gradingId === s.id && (
                    <View style={{ marginTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                      <TextInput
                        value={gradeValue}
                        onChangeText={setGradeValue}
                        placeholder="Grade (e.g. A, 85, Pass)"
                        placeholderTextColor={colors.textMuted}
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, color: colors.text }}
                      />
                      <TextInput
                        value={gradeFeedback}
                        onChangeText={setGradeFeedback}
                        placeholder="Feedback (optional)"
                        placeholderTextColor={colors.textMuted}
                        multiline numberOfLines={3} textAlignVertical="top"
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, color: colors.text, minHeight: 70 }}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setGradingId(null)}
                          style={{ flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text style={{ fontSize: 14, color: colors.textMuted }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => gradeSubmission.mutate({ submissionId: s.id, grade: gradeValue.trim(), feedback: gradeFeedback.trim() })}
                          disabled={!gradeValue.trim() || gradeSubmission.isPending}
                          style={{ flex: 2, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', opacity: !gradeValue.trim() ? 0.5 : 1 }}
                        >
                          {gradeSubmission.isPending
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={{ fontSize: 14, color: '#fff', fontWeight: '700' }}>Save Grade</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Submit Assignment Modal (student) ─────────────────────────── */}
      <Modal visible={showSubmitModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{
            paddingTop: 20, paddingHorizontal: 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <TouchableOpacity onPress={() => setShowSubmitModal(false)}>
              <Text style={{ fontSize: 15, color: colors.error }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Submit Assignment</Text>
            <TouchableOpacity
              onPress={handleSubmitAssignment}
              disabled={submitting || (!submitNote.trim() && !submitFile)}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700', opacity: (!submitNote.trim() && !submitFile) ? 0.4 : 1 }}>
                    Submit
                  </Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* Assignment title */}
            <View style={{
              backgroundColor: colors.primaryLight, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: colors.primary + '30',
            }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>Submitting for:</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                {submitTarget?.title}
              </Text>
            </View>

            {/* Text note */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Answer / Notes
              </Text>
              <TextInput
                value={submitNote} onChangeText={setSubmitNote}
                placeholder="Write your answer or notes here..."
                placeholderTextColor={colors.textMuted}
                multiline numberOfLines={6} textAlignVertical="top"
                style={{
                  backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                  borderRadius: 10, padding: 14, fontSize: 14, color: colors.text, minHeight: 140,
                }}
              />
            </View>

            {/* File attachment */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Attach File (optional)
              </Text>
              <TouchableOpacity
                onPress={handlePickSubmitFile}
                style={{
                  borderWidth: 2, borderColor: submitFile ? colors.primary : colors.border,
                  borderStyle: 'dashed', borderRadius: 12, padding: 20,
                  alignItems: 'center', gap: 8,
                  backgroundColor: submitFile ? colors.primaryLight : colors.surface,
                }}
              >
                <Text style={{ fontSize: 28 }}>{submitFile ? '📄' : '📎'}</Text>
                {submitFile ? (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'center' }} numberOfLines={2}>
                      {submitFile.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Tap to change</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Tap to attach a file</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Submit button */}
            {(submitNote.trim() || submitFile) && (
              <TouchableOpacity
                onPress={handleSubmitAssignment}
                disabled={submitting}
                style={{
                  backgroundColor: colors.primary, borderRadius: 12,
                  paddingVertical: 16, alignItems: 'center',
                  opacity: submitting ? 0.7 : 1, marginTop: 8,
                }}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Submit Assignment</Text>
                }
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
