import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'uninms_access_token';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      // auth store will detect missing token on next mount
    }
    return Promise.reject(error);
  }
);

export const tokenStorage = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

const get  = (url: string, params?: object) => api.get(url, { params }).then(r => r.data);
const post = (url: string, data?: unknown) => api.post(url, data).then(r => r.data);
const patch = (url: string, data?: unknown) => api.patch(url, data).then(r => r.data);

export const authApi = {
  login: (d: { email: string; password: string }) => post('/auth/login', d),
  logout: () => post('/auth/logout'),
  me: () => get('/auth/me'),
};

export const documentsApi = {
  list:     (p?: object) => get('/documents', p),
  get:      (id: string) => get(`/documents/${id}`),
  download: (id: string) => get(`/documents/${id}/download`),
  upload:   (fd: FormData) =>
    api.post('/documents', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }).then(r => r.data),
};

export const searchApi = {
  fullText: (q: string, p?: object) => get('/search', { q, ...p }),
  semantic: (text: string, limit = 10) => post('/search/semantic', { text, limit }),
};

export const usersApi = {
  me:             () => get('/users/me'),
  updateMe:       (d: unknown) => patch('/users/me', d),
  changePassword: (d: { currentPassword: string; newPassword: string }) =>
    patch('/users/me/password', d),
  uploadPhoto:    (fd: FormData) =>
    api.post('/users/me/photo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }).then(r => r.data),
  profile:  (id: string) => get(`/users/${id}/profile`),
  points:   (id: string) => get(`/users/${id}/points`),
};

export const analyticsApi = {
  me: () => get('/analytics/me'),
};

export const notificationsApi = {
  list:              (p?: object) => get('/notifications', p),
  markRead:          (id: string) => patch(`/notifications/${id}/read`),
  readAll:           () => post('/notifications/read-all'),
  registerPushToken: (token: string, platform = 'expo') =>
    post('/notifications/push-token', { token, platform }),
  removePushToken:   (token: string) =>
    api.delete('/notifications/push-token', { data: { token } }).then(r => r.data),
};

export const forumsApi = {
  threads:      (p?: object) => get('/forums/threads', p),
  thread:       (id: string) => get(`/forums/threads/${id}`),
  createThread: (d: unknown) => post('/forums/threads', d),
  reply:        (id: string, d: unknown) => post(`/forums/threads/${id}/posts`, d),
  upvote:       (id: string) => post(`/forums/posts/${id}/upvote`),
};

export const intelligenceApi = {
  leaderboard:     (period?: string) => get('/intelligence/leaderboard', period ? { period } : {}),
  recommendations: (p?: object) => get('/intelligence/recommendations', p),
};

export const coursesApi = {
  list:           (p?: object)                  => get('/courses', p),
  get:            (id: string)                  => get(`/courses/${id}`),
  assignments:    (courseId: string)            => get(`/courses/${courseId}/assignments`),
  materials:      (courseId: string)            => get(`/courses/${courseId}/materials`),
  addMaterial:    (courseId: string, documentId: string) =>
                    post(`/courses/${courseId}/materials`, { documentId }),
  removeMaterial: (courseId: string, materialId: string) =>
                    api.delete(`/courses/${courseId}/materials/${materialId}`).then(r => r.data),
};

export const assignmentsApi = {
  create: (courseId: string, d: object) => post(`/courses/${courseId}/assignments`, d),
  update: (id: string, d: object)       => patch(`/assignments/${id}`, d),
  remove: (id: string)                  => api.delete(`/assignments/${id}`).then(r => r.data),
  submissions: (id: string)             => get(`/assignments/${id}/submissions`),
  grade: (submissionId: string, d: object) => patch(`/submissions/${submissionId}/grade`, d),
  submit: (id: string, fd: FormData) =>
    api.post(`/assignments/${id}/submit`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(r => r.data),
};

export const researchApi = {
  // Projects
  projects:         (p?: object)                    => get('/research/projects', p),
  project:          (id: string)                    => get(`/research/projects/${id}`),
  createProject:    (d: object)                     => post('/research/projects', d),
  updateProject:    (id: string, d: object)         => patch(`/research/projects/${id}`, d),
  // Members
  addMember:        (id: string, d: object)         => post(`/research/projects/${id}/members`, d),
  removeMember:     (id: string, userId: string)    =>
    api.delete(`/research/projects/${id}/members/${userId}`).then(r => r.data),
  // Milestones
  addMilestone:     (id: string, d: object)         => post(`/research/projects/${id}/milestones`, d),
  updateMilestone:  (id: string, mId: string, d: object) =>
    patch(`/research/projects/${id}/milestones/${mId}`, d),
  // Outputs
  addOutput:        (id: string, d: object)         => post(`/research/projects/${id}/outputs`, d),
  // Intelligence
  projectIntel:     (id: string)                    => get(`/research/projects/${id}/intelligence`),
  // Gaps
  gaps:             (p?: object)                    => get('/intelligence/gaps', p),
  submitGap:        (d: object)                     => post('/intelligence/gaps', d),
  // Leaderboard
  leaderboard:      (period?: string)               => get('/intelligence/leaderboard', period ? { period } : {}),
  // Collaborators
  collaborators:    (limit = 10)                    => get('/intelligence/collaborators', { limit }),
};
