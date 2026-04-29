import { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, Modal, Switch,
  Alert, TextInput, ActivityIndicator, StyleSheet, Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuthStore } from '../../src/stores/authStore';
import { useToast } from '../../src/components/Toast';
import { PRESETS, ThemePreset } from '../../src/theme/colors';
import { usersApi } from '../../src/lib/api';

const PRESET_OPTIONS: { key: ThemePreset; label: string }[] = [
  { key: 'blue',   label: 'Ocean Blue'    },
  { key: 'green',  label: 'Forest Green'  },
  { key: 'purple', label: 'Royal Purple'  },
  { key: 'orange', label: 'Sunset Orange' },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, paddingHorizontal: 16, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        {children}
      </View>
    </View>
  );
}

function Row({ label, value, onPress, last, danger }: { label: string; value?: string; onPress?: () => void; last?: boolean; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress} disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}
    >
      <Text style={{ flex: 1, fontSize: 15, color: danger ? colors.error : colors.text }}>{label}</Text>
      {value ? <Text style={{ fontSize: 14, color: colors.textMuted, marginRight: 4 }}>{value}</Text> : null}
      {onPress ? <Text style={{ fontSize: 16, color: colors.textMuted }}>›</Text> : null}
    </TouchableOpacity>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────
function EditProfileModal({ visible, onClose, current }: { visible: boolean; onClose: () => void; current: any }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [fullName, setFullName] = useState(current?.full_name ?? '');
  const [bio, setBio]           = useState(current?.bio ?? '');
  const [orcidId, setOrcidId]   = useState(current?.orcid_id ?? '');

  const mut = useMutation({
    mutationFn: () => usersApi.updateMe({
      ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
      bio: bio.trim(),
      ...(orcidId.trim() ? { orcidId: orcidId.trim() } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', 'me'] });
      toast.show('Profile updated');
      onClose();
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? 'Failed to update profile', 'error'),
  });

  const s = sheetStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.overlay}>
        <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>

          <Text style={s.label}>Full Name</Text>
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={colors.textMuted} />

          <Text style={s.label}>Biography</Text>
          <TextInput
            style={[s.input, { height: 100, textAlignVertical: 'top' }]}
            value={bio} onChangeText={setBio} multiline
            placeholder="Tell others about yourself, your research interests, expertise..."
            placeholderTextColor={colors.textMuted}
          />

          <Text style={s.label}>ORCID iD</Text>
          <TextInput
            style={s.input} value={orcidId} onChangeText={setOrcidId}
            placeholder="0000-0000-0000-0000" placeholderTextColor={colors.textMuted}
            autoCapitalize="none" autoCorrect={false}
          />

          <TouchableOpacity style={[s.btn, mut.isPending && { opacity: 0.6 }]} onPress={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save Changes</Text>}
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showCur, setShowCur]   = useState(false);
  const [showNew, setShowNew]   = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); };

  const mut = useMutation({
    mutationFn: () => {
      if (next !== confirm) throw new Error('Passwords do not match');
      return usersApi.changePassword({ currentPassword: current, newPassword: next });
    },
    onSuccess: () => {
      toast.show('Password changed successfully');
      reset(); onClose();
    },
    onError: (e: any) => toast.show(e?.response?.data?.message ?? e?.message ?? 'Failed to change password', 'error'),
  });

  const rules = [
    { ok: next.length >= 8,            text: 'At least 8 characters' },
    { ok: /[A-Z]/.test(next),          text: 'One uppercase letter'  },
    { ok: /[0-9]/.test(next),          text: 'One number'            },
    { ok: next === confirm && !!next,  text: 'Passwords match'       },
  ];

  const s = sheetStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { reset(); onClose(); }} transparent>
      <View style={s.overlay}>
        <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.title}>Change Password</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={{ color: colors.error, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>

          <Text style={s.label}>Current Password</Text>
          <View style={[s.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
            <TextInput
              style={{ flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10 }}
              value={current} onChangeText={setCurrent}
              secureTextEntry={!showCur} placeholder="Enter current password"
              placeholderTextColor={colors.textMuted} autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowCur(v => !v)} style={{ padding: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{showCur ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>New Password</Text>
          <View style={[s.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
            <TextInput
              style={{ flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10 }}
              value={next} onChangeText={setNext}
              secureTextEntry={!showNew} placeholder="Enter new password"
              placeholderTextColor={colors.textMuted} autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNew(v => !v)} style={{ padding: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{showNew ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Confirm New Password</Text>
          <TextInput
            style={s.input} value={confirm} onChangeText={setConfirm}
            secureTextEntry placeholder="Re-enter new password"
            placeholderTextColor={colors.textMuted} autoCapitalize="none"
          />

          {/* Strength rules */}
          <View style={{ marginTop: 12, gap: 6 }}>
            {rules.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, color: r.ok ? (colors.success ?? '#10B981') : colors.textMuted }}>
                  {r.ok ? '✓' : '○'}
                </Text>
                <Text style={{ fontSize: 12, color: r.ok ? (colors.success ?? '#10B981') : colors.textMuted }}>{r.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.btn, { marginTop: 20 }, (mut.isPending || rules.some(r => !r.ok)) && { opacity: 0.5 }]}
            onPress={() => mut.mutate()}
            disabled={mut.isPending || rules.some(r => !r.ok)}
          >
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Update Password</Text>}
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Theme Picker Modal ────────────────────────────────────────────────────────
function ThemeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, preset, mode, setPreset, setMode, isDark } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Appearance</Text>

            {PRESET_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.key} onPress={() => { setPreset(opt.key); onClose(); }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8, backgroundColor: preset === opt.key ? colors.primaryLight : colors.background, borderWidth: 1, borderColor: preset === opt.key ? colors.primary : colors.border }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (PRESETS as any)[opt.key]?.primary ?? '#1a56db', marginRight: 12 }} />
                <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: preset === opt.key ? '700' : '400' }}>{opt.label}</Text>
                {preset === opt.key && <Text style={{ color: colors.primary }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 15, color: colors.text }}>Dark Mode</Text>
              <Switch value={mode === 'dark' || (mode === 'system' && isDark)} onValueChange={v => setMode(v ? 'dark' : 'light')} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
            <TouchableOpacity onPress={() => setMode('system')} style={{ marginTop: 12, paddingHorizontal: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 13 }}>Follow system theme {mode === 'system' ? '✓' : ''}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Profile Screen ───────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { colors, preset } = useTheme();
  const { user, logout }   = useAuthStore();
  const safeInsets         = useSafeAreaInsets();
  const qc                 = useQueryClient();
  const toast              = useToast();

  const [showEdit, setShowEdit]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTheme, setShowTheme]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: profileRes } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: usersApi.me,
  });

  const raw = profileRes?.data ?? profileRes;
  const p = raw ? {
    id:           raw.id,
    full_name:    raw.full_name ?? raw.fullName ?? user?.name ?? '',
    email:        raw.email ?? user?.email ?? '',
    role:         (Array.isArray(raw.roles) ? raw.roles[0] : raw.role) ?? user?.role ?? 'student',
    bio:          raw.bio ?? '',
    orcid_id:     raw.orcid_id ?? '',
    photo:        raw.profile_photo_url ?? null,
    points:       raw.total_points ?? raw.points ?? user?.points ?? 0,
    level:        raw.current_level ?? raw.level ?? user?.level ?? '',
    university:   raw.university_name ?? raw.university ?? user?.university ?? '—',
    department:   raw.department_name ?? raw.department ?? user?.department ?? '',
    faculty:      raw.faculty_name ?? '',
    matric:       raw.matric_number ?? '',
    staff_id:     raw.staff_id ?? '',
  } : null;

  const initial = (p?.full_name ?? user?.name ?? 'U')[0].toUpperCase();

  const pickAndUploadPhoto = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 3 * 1024 * 1024) {
      toast.show('Please choose an image under 3 MB', 'warning');
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'image/jpeg' } as any);
      await usersApi.uploadPhoto(fd);
      qc.invalidateQueries({ queryKey: ['profile', 'me'] });
      toast.show('Profile photo updated');
    } catch (e: any) {
      toast.show(e?.response?.data?.message ?? 'Could not upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = () =>
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* ── Avatar header ── */}
      <View style={{ backgroundColor: colors.primary, paddingTop: safeInsets.top + 16, paddingBottom: 32, paddingHorizontal: 16, alignItems: 'center' }}>
        {/* Avatar */}
        <TouchableOpacity onPress={pickAndUploadPhoto} disabled={uploadingPhoto} style={{ marginBottom: 12 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            {p?.photo
              ? <Image source={{ uri: p.photo }} style={{ width: 88, height: 88 }} />
              : <Text style={{ fontSize: 38, color: '#fff', fontWeight: '700' }}>{initial}</Text>
            }
            {uploadingPhoto && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
          {/* Camera badge */}
          <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12 }}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{p?.full_name ?? '—'}</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{p?.email}</Text>
        <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: '#fff', fontSize: 12, textTransform: 'capitalize' }}>{p?.role ?? 'student'}</Text>
          </View>
          {p?.level ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>⭐ {p.level}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Stats bar ── */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border }}>
        {[
          { label: 'Points',     value: p?.points ?? 0 },
          { label: 'University', value: p?.university ?? '—' },
        ].map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: i === 0 ? 1 : 0, borderRightColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{s.value}</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 20 }} />

      {/* ── Biography ── */}
      {p?.bio ? (
        <Section title="About">
          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{p.bio}</Text>
          </View>
        </Section>
      ) : null}

      {/* ── Account info ── */}
      <Section title="Account">
        <Row label="Full Name"   value={p?.full_name}   />
        <Row label="Email"       value={p?.email}       />
        <Row label="Department"  value={p?.department}  />
        {p?.faculty    ? <Row label="Faculty"    value={p.faculty}    /> : null}
        {p?.matric     ? <Row label="Matric No." value={p.matric}     /> : null}
        {p?.staff_id   ? <Row label="Staff ID"   value={p.staff_id}   /> : null}
        {p?.orcid_id   ? <Row label="ORCID iD"   value={p.orcid_id}   /> : null}
        <Row label="Edit Profile" onPress={() => setShowEdit(true)} last />
      </Section>

      {/* ── Security ── */}
      <Section title="Security">
        <Row label="Change Password" onPress={() => setShowPassword(true)} last />
      </Section>

      {/* ── Appearance ── */}
      <Section title="Appearance">
        <Row label="Color Theme & Dark Mode"
          value={PRESET_OPTIONS.find(o => o.key === preset)?.label}
          onPress={() => setShowTheme(true)} last />
      </Section>

      {/* ── Sign out ── */}
      <View style={{ paddingHorizontal: 16 }}>
        <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: colors.error + '15', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '30' }}>
          <Text style={{ color: colors.error, fontSize: 15, fontWeight: '700' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Modals ── */}
      <EditProfileModal    visible={showEdit}     onClose={() => setShowEdit(false)}     current={p} />
      <ChangePasswordModal visible={showPassword} onClose={() => setShowPassword(false)} />
      <ThemeModal          visible={showTheme}    onClose={() => setShowTheme(false)}    />
    </ScrollView>
  );
}

// ── Shared sheet styles ───────────────────────────────────────────────────────
function sheetStyles(colors: any) {
  return StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:    { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    title:    { fontSize: 17, fontWeight: '700', color: colors.text },
    label:    { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
    input:    { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, fontSize: 14 },
    btn:      { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
    btnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
