import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

const get  = (url: string, params?: object) => api.get(url, { params }).then(r => r.data);
const post = (url: string, data?: unknown) => api.post(url, data).then(r => r.data);
const patch= (url: string, data?: unknown) => api.patch(url, data).then(r => r.data);
const del  = (url: string) => api.delete(url).then(r => r.data);

export const authApi = {
  login:   (d: unknown) => post('/auth/login', d),
  logout:  ()           => post('/auth/logout'),
  me:      ()           => get('/auth/me'),
};

export const documentsApi = {
  list:     (p?: object) => get('/documents', p),
  get:      (id: string) => get(`/documents/${id}`),
  download: (id: string) => get(`/documents/${id}/download`),
  upload:   (fd: FormData) => api.post('/documents', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
  }).then(r => r.data),
};

export const searchApi = {
  fullText: (q: string, p?: object) => get('/search', { q, ...p }),
  semantic: (text: string, limit = 10) => post('/search/semantic', { text, limit }),
};

export const usersApi = {
  me:      ()              => get('/users/me'),
  updateMe:(d: unknown)    => patch('/users/me', d),
  profile: (id: string)    => get(`/users/${id}/profile`),
  points:  (id: string)    => get(`/users/${id}/points`),
  search:  (q: string)     => get('/users/search', { q }),
};

export const analyticsApi = {
  me:         () => get('/analytics/me'),
  university: () => get('/analytics/university'),
};

export const notificationsApi = {
  list:    (p?: object)    => get('/notifications', p),
  markRead:(id: string)    => patch(`/notifications/${id}/read`),
  readAll: ()              => post('/notifications/read-all'),
};

export const forumsApi = {
  threads:      (p?: object)            => get('/forums/threads', p),
  thread:       (id: string)            => get(`/forums/threads/${id}`),
  createThread: (d: unknown)            => post('/forums/threads', d),
  reply:        (id: string, d: unknown)=> post(`/forums/threads/${id}/posts`, d),
  upvote:       (id: string)            => post(`/forums/posts/${id}/upvote`),
};

export const handoverApi = {
  list:        (p?: object)                             => get('/handover', p),
  get:         (id: string)                             => get(`/handover/${id}`),
  create:      (d: unknown)                             => post('/handover', d),
  update:      (id: string, d: unknown)                 => patch(`/handover/${id}`, d),
  send:        (id: string)                             => patch(`/handover/${id}/send`),
  complete:    (id: string)                             => patch(`/handover/${id}/complete`),
  acknowledge: (id: string)                             => patch(`/handover/${id}`, { status: 'acknowledged' }),
  addItem:     (id: string, d: unknown)                 => post(`/handover/${id}/items`, d),
  updateItem:  (id: string, itemId: string, d: unknown) => patch(`/handover/${id}/items/${itemId}`, d),
  deleteItem:  (id: string, itemId: string)             => del(`/handover/${id}/items/${itemId}`),
};

export const claimsApi = {
  list:     (p?: object)                          => get('/claims', p),
  get:      (id: string)                          => get(`/claims/${id}`),
  create:   (d: unknown)                          => post('/claims', d),
  update:   (id: string, d: unknown)              => patch(`/claims/${id}`, d),
  review:   (id: string, d: unknown)              => patch(`/claims/${id}/review`, d),
  endorse:  (id: string, d?: unknown)             => post(`/claims/${id}/endorse`, d ?? {}),
  unendorse:(id: string)                          => del(`/claims/${id}/endorse`),
};

export const mentorshipApi = {
  profiles:    (p?: object)                            => get('/mentorship/profiles', p),
  myProfile:   ()                                      => get('/mentorship/profiles/me'),
  saveProfile: (d: unknown)                            => post('/mentorship/profiles', d),
  myRelations: ()                                      => get('/mentorship/relationships'),
  request:     (mentorId: string, d: unknown)          => post(`/mentorship/request/${mentorId}`, d),
  accept:      (id: string)                            => patch(`/mentorship/${id}/accept`),
  decline:     (id: string)                            => patch(`/mentorship/${id}/decline`),
  stage:       (id: string, stage: string)             => patch(`/mentorship/${id}/stage`, { stage }),
  close:       (id: string)                            => patch(`/mentorship/${id}/close`),
  sessions:    (id: string)                            => get(`/mentorship/${id}/sessions`),
  logSession:  (id: string, d: unknown)                => post(`/mentorship/${id}/sessions`, d),
  goals:       (id: string)                            => get(`/mentorship/${id}/goals`),
  addGoal:     (id: string, d: unknown)                => post(`/mentorship/${id}/goals`, d),
  updateGoal:  (id: string, goalId: string, d: unknown)=> patch(`/mentorship/${id}/goals/${goalId}`, d),
};

export const groupsApi = {
  list:          (p?: object)           => get('/groups', p),
  get:           (id: string)           => get(`/groups/${id}`),
  create:        (d: unknown)           => post('/groups', d),
  join:          (id: string)           => post(`/groups/${id}/join`),
  leave:         (id: string)           => del(`/groups/${id}/leave`),
  delete:        (id: string)           => del(`/groups/${id}`),
  invite:        (id: string, userId: string) => post(`/groups/${id}/invite`, { userId }),
  groupInvites:  (id: string)           => get(`/groups/${id}/invites`),
  myInvites:     ()                     => get('/groups/my-invites'),
  acceptInvite:  (inviteId: string)     => post(`/groups/invites/${inviteId}/accept`),
  declineInvite: (inviteId: string)     => del(`/groups/invites/${inviteId}`),
};


export const researchApi = {
  projects:        (p?: object)                            => get('/research/projects', p),
  project:         (id: string)                            => get(`/research/projects/${id}`),
  create:          (d: unknown)                            => post('/research/projects', d),
  update:          (id: string, d: unknown)                => patch(`/research/projects/${id}`, d),
  addMember:       (id: string, d: unknown)                => post(`/research/projects/${id}/members`, d),
  removeMember:    (id: string, userId: string)            => del(`/research/projects/${id}/members/${userId}`),
  addMilestone:    (id: string, d: unknown)                => post(`/research/projects/${id}/milestones`, d),
  updateMilestone: (id: string, mId: string, d: unknown)   => patch(`/research/projects/${id}/milestones/${mId}`, d),
  addOutput:       (id: string, d: unknown)                => post(`/research/projects/${id}/outputs`, d),
  intelligence:    (id: string)                            => get(`/research/projects/${id}/intelligence`),
};

export const coursesApi = {
  list:          (p?: object)                     => get('/courses', p),
  get:           (id: string)                     => get(`/courses/${id}`),
  create:        (d: object)                      => post('/courses', d),
  materials:     (id: string)                     => get(`/courses/${id}/materials`),
  addMaterial:   (id: string, documentId: string, orderIndex?: number) => post(`/courses/${id}/materials`, { documentId, orderIndex }),
  removeMaterial:(id: string, materialId: string) => del(`/courses/${id}/materials/${materialId}`),
  students:      (id: string)                     => get(`/courses/${id}/students`),
  enroll:        (id: string, studentId?: string) => post(`/courses/${id}/enroll`, studentId ? { studentId } : {}),
  unenroll:      (id: string)                     => del(`/courses/${id}/enroll`),
};

export const platformApi = {
  // Universities
  universities:      (p?: object)                      => get('/platform/universities', p),
  university:        (id: string)                      => get(`/platform/universities/${id}`),
  updateUniStatus:   (id: string, status: string)      => patch(`/platform/universities/${id}/status`, { status }),
  updateSubscription:(id: string, d: object)           => patch(`/platform/universities/${id}/subscription`, d),
  // Analytics
  analytics:         ()                                => get('/platform/analytics'),
  // Audit log
  auditLog:          (p?: object)                      => get('/platform/audit-log', p),
  // Announcements
  announcements:     ()                                => get('/platform/announcements'),
  createAnnouncement:(d: object)                       => post('/platform/announcements', d),
  deleteAnnouncement:(id: string)                      => del(`/platform/announcements/${id}`),
  // Plagiarism
  batchPlagiarismCheck: (universityId?: string)        => post(`/platform/plagiarism/batch-check${universityId ? `?universityId=${universityId}` : ''}`),
  // Settings
  settings:          ()                                => get('/platform/settings'),
};

export const assignmentsApi = {
  all:        (p?: object)                              => get('/assignments', p),
  list:       (courseId: string)                        => get(`/courses/${courseId}/assignments`),
  create:     (courseId: string, d: object)             => post(`/courses/${courseId}/assignments`, d),
  update:     (id: string, d: object)                   => patch(`/assignments/${id}`, d),
  remove:     (id: string)                              => del(`/assignments/${id}`),
  submissions:(id: string)                              => get(`/assignments/${id}/submissions`),
  submit:     (id: string, fd: FormData)                => api.post(`/assignments/${id}/submit`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
  }).then(r => r.data),
  grade:      (submissionId: string, d: object)         => patch(`/submissions/${submissionId}/grade`, d),
};

export const plagiarismApi = {
  check:  (documentId: string)              => post(`/plagiarism/${documentId}/check`),
  report: (documentId: string)              => get(`/plagiarism/${documentId}/report`),
  flagged:(p?: object)                      => get('/plagiarism', p),
};

export const intelligenceApi = {
  // Gaps
  gaps:            (p?: object)                      => get('/intelligence/gaps', p),
  submitGap:       (d: unknown)                      => post('/intelligence/gaps', d),
  detectGaps:      (universityId?: string)           => post(`/intelligence/gaps/detect${universityId ? `?universityId=${universityId}` : ''}`),
  updateGap:       (id: string, status: string)      => patch(`/intelligence/gaps/${id}`, { status }),
  // Leaderboard
  leaderboard:     (period?: string)                 => get('/intelligence/leaderboard', period ? { period } : {}),
  computeLeaderboard: (period?: string)              => post('/intelligence/leaderboard/compute', { period: period ?? 'quarterly' }),
  // Collaborators & researchers
  collaborators:   (limit = 6)                       => get('/intelligence/collaborators', { limit }),
  topResearchers:  (p?: object)                      => get('/intelligence/top-researchers', p),
  // Knowledge graph
  graph:           (p?: object)                      => get('/intelligence/graph', p),
  // Recommendations
  recommendations: (p?: object)                      => get('/intelligence/recommendations', p),
  generateRecommendations: (universityId: string)    => post('/intelligence/recommendations/generate', { universityId }),
  updateRecommendation: (id: string, status: string) => patch(`/intelligence/recommendations/${id}`, { status }),
};

export const tetfundApi = {
  report:   (p?: object)                  => get('/tetfund/report', p),
  generate: (d?: object)                  => post('/tetfund/report/generate', d ?? {}),
  history:  (p?: object)                  => get('/tetfund/report/history', p),
  exportUrl:(format: 'json'|'csv', p?: Record<string,string>) => {
    const base = `${BASE_URL}/tetfund/report/export?format=${format}`;
    if (!p) return base;
    const qs = new URLSearchParams(p).toString();
    return qs ? `${base}&${qs}` : base;
  },
};

export const communityApi = {
  // Rep management
  registerRep:     (d: unknown)                    => post('/community/reps/register', d),
  myRep:           ()                              => get('/community/reps/me'),
  addCoRep:        (d: unknown)                    => post('/community/reps/co-rep', d),
  verifyRep:       (userId: string)                => post(`/community/reps/${userId}/verify`),
  // IK Assets
  assets:          (p?: object)                    => get('/community/assets', p),
  asset:           (id: string)                    => get(`/community/assets/${id}`),
  createAsset:     (d: unknown)                    => post('/community/assets', d),
  updateAsset:     (id: string, d: unknown)        => patch(`/community/assets/${id}`, d),
  markSacred:      (id: string)                    => post(`/community/assets/${id}/mark-sacred`),
  // FPIC
  requestAccess:   (assetId: string, d: unknown)   => post(`/community/assets/${assetId}/requests`, d),
  assetRequests:   (assetId: string)               => get(`/community/assets/${assetId}/requests`),
  approveRequest:  (id: string, d?: unknown)       => post(`/community/requests/${id}/approve`, d ?? {}),
  rejectRequest:   (id: string, reason: string)    => post(`/community/requests/${id}/reject`, { reason }),
  revokeRequest:   (id: string, reason: string)    => post(`/community/requests/${id}/revoke`, { reason }),
  // Tokens
  tokenLedger:     (assetId: string)               => get(`/community/assets/${assetId}/tokens`),
  confirmToken:    (tokenId: string)               => post(`/community/tokens/${tokenId}/confirm`),
  exportTokens:    (assetId: string)               => `${BASE_URL}/community/assets/${assetId}/tokens/export`,
};

export const journalMigrationApi = {
  submit:   (d: object)              => post('/journal-migration', d),
  list:     ()                       => get('/journal-migration'),
  get:      (id: string)             => get(`/journal-migration/${id}`),
  probe:    (id: string)             => post(`/journal-migration/${id}/probe`),
  import:   (id: string)             => post(`/journal-migration/${id}/import`),
  reject:   (id: string, note?: string) => post(`/journal-migration/${id}/reject`, { note }),
  articles: (id: string, p?: object) => get(`/journal-migration/${id}/articles`, p),
};

export const journalBillingApi = {
  plans:    ()                          => get('/journal-billing/plans'),
  updatePlan:(id: string, d: object)    => api.patch(`/journal-billing/plans/${id}`, d).then(r => r.data),
  createJournal:(d: object)             => post('/journal-billing/journals', d),
  verify:   (ref: string)              => get(`/journal-billing/verify/${ref}`),
  myJournals: ()                        => get('/journal-billing/my'),
  pending:  ()                          => get('/journal-billing/pending'),
  all:      (p?: object)               => get('/journal-billing/all', p),
  approve:  (journalId: string, d?: object) => post(`/journal-billing/${journalId}/approve`, d ?? {}),
  reject:   (journalId: string, reason: string) => post(`/journal-billing/${journalId}/reject`, { reason }),
  suspend:  (journalId: string, reason?: string) => post(`/journal-billing/${journalId}/suspend`, { reason }),
  stats:    ()                          => get('/journal-billing/stats'),
};

export const billingApi = {
  plans:      ()                      => get('/billing/plans'),
  current:    ()                      => get('/billing/current'),
  initialize: (plan: string)          => post('/billing/initialize', { plan }),
  verify:     (reference: string)     => get(`/billing/verify/${reference}`),
};

export const plansApi = {
  list:   ()                          => get('/platform/plans'),
  update: (key: string, d: object)    => patch(`/platform/plans/${key}`, d),
};

export const platformUsersApi = {
  list:             (p?: object)                       => get('/platform/users', p),
  create:           (d: object)                        => post('/platform/users', d),
  updateStatus:     (id: string, status: string)       => patch(`/platform/users/${id}/status`, { status }),
  updateRole:       (id: string, role: string, action: 'assign'|'revoke') => patch(`/platform/users/${id}/role`, { role, action }),
  updateUniversity: (id: string, universityId: string) => patch(`/platform/users/${id}/university`, { universityId }),
};

export const journalsApi = {
  list:          (p?: object)                        => get('/journals', p),
  get:           (slug: string)                      => get(`/journals/${slug}`),
  submit:        (slug: string, data: object)        => post(`/journals/${slug}/submit`, data),
  mySubmissions: ()                                  => get('/journals/my/submissions'),
  editorList:    (slug: string, p?: object)          => get(`/journals/${slug}/editor/manuscripts`, p),
  assign:        (slug: string, id: string, data: object) => post(`/journals/${slug}/editor/manuscripts/${id}/assign`, data),
  decide:        (slug: string, id: string, data: object) => post(`/journals/${slug}/editor/manuscripts/${id}/decide`, data),
  publish:       (slug: string, id: string, data: object) => post(`/journals/${slug}/editor/manuscripts/${id}/publish`, data),
  myReviews:     ()                                  => get('/journals/reviews/assigned'),
  respondReview: (id: string, response: string)      => patch(`/journals/reviews/${id}/respond`, { response }),
  submitReport:  (id: string, data: object)          => post(`/journals/reviews/${id}/report`, data),
};

export const adminApi = {
  // Users
  listUsers:       (p?: object)                      => get('/admin/users', p),
  register:        (d: object)                       => post('/admin/users/register', d),
  bulkRegister:    (d: object[])                     => post('/admin/users/bulk-register', { users: d }),
  updateUserRole:  (id: string, role: string, action: 'assign'|'revoke') => patch(`/admin/users/${id}/role`, { role, action }),
  updateUserStatus:(id: string, status: string)      => patch(`/admin/users/${id}/status`, { status }),
  departments:     ()                                => get('/admin/departments'),
  // Moderation
  moderation:      (p?: object)                      => get('/admin/moderation', p),
  approveDoc:      (docId: string)                   => post(`/admin/moderation/${docId}/approve`),
  rejectDoc:       (docId: string, reason: string)   => post(`/admin/moderation/${docId}/reject`, { reason }),
  // Analytics
  analytics:       ()                                => get('/admin/analytics'),
  exportCsv:       ()                                => `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/analytics/export`,
  // Announcements
  announcements:   ()                                => get('/admin/announcements'),
  createAnnouncement:(d: object)                     => post('/admin/announcements', d),
  deleteAnnouncement:(id: string)                    => del(`/admin/announcements/${id}`),
  // Audit log
  auditLog:        (p?: object)                      => get('/admin/audit-log', p),
  // Settings
  settings:        ()                                => get('/admin/settings'),
  saveSettings:    (d: object)                       => patch('/admin/settings', d),
  setPlagiarismThreshold: (threshold: number)        => patch('/admin/plagiarism/threshold', { threshold }),
  batchPlagiarismCheck:   ()                         => post('/admin/plagiarism/batch-check'),
};
