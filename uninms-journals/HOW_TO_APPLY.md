# UniNMS Journal Hosting — How to Apply

## What is included

### Backend
- `migrations/012_journals.sql` — all database tables
- `backend/routes/journals.js` — complete REST API + OAI-PMH endpoint

### Frontend pages
- `frontend/journals/page.tsx`                       → /journals
- `frontend/journals/[slug]/page.tsx`                → /journals/[slug]
- `frontend/journals/[slug]/submit/page.tsx`         → /journals/[slug]/submit
- `frontend/journals/my/submissions/page.tsx`        → /journals/my/submissions
- `frontend/editor/[slug]/page.tsx`                  → /editor/[slug]
- `frontend/reviewer/page.tsx`                       → /reviewer

---

## Step 1 — Run migration

```
cd uninms-backend
```

Copy `migrations/012_journals.sql` to `uninms-backend/migrations/` then:

```
npm run migrate
```

This adds:
- 10 new tables (journals, volumes, issues, manuscripts, reviews, decisions, etc.)
- 2 new roles: `journal_editor` and `reviewer`

---

## Step 2 — Copy backend route

```
Copy: backend/routes/journals.js
To:   uninms-backend/src/routes/journals.js
```

Add to `uninms-backend/src/server.js`:

```javascript
const journalsRouter = require('./routes/journals');
app.use(`${API}/journals`, journalsRouter);
```

---

## Step 3 — Copy frontend pages

Create the following folder structure in uninms-web/src/app/:

```
app/
├── journals/
│   ├── page.tsx                    ← copy journals/page.tsx
│   ├── layout.tsx                  ← export { default } from '@/app/dashboard/layout'
│   ├── [slug]/
│   │   ├── page.tsx                ← copy journals/[slug]/page.tsx
│   │   ├── layout.tsx              ← same layout export
│   │   └── submit/
│   │       ├── page.tsx            ← copy journals/[slug]/submit/page.tsx
│   │       └── layout.tsx
│   └── my/
│       └── submissions/
│           ├── page.tsx            ← copy journals/my/submissions/page.tsx
│           └── layout.tsx
├── editor/
│   └── [slug]/
│       ├── page.tsx                ← copy editor/[slug]/page.tsx
│       └── layout.tsx
└── reviewer/
    ├── page.tsx                    ← copy reviewer/page.tsx
    └── layout.tsx
```

All layout.tsx files contain:
```tsx
export { default } from '@/app/dashboard/layout';
```

---

## Step 4 — Add sidebar links

Open `uninms-web/src/components/layout/Sidebar.tsx` and add to the NAV array:

```tsx
{ href: '/journals',             icon: BookOpen, label: 'Journals',          section: 'Research' },
{ href: '/journals/my/submissions', icon: FileText, label: 'My submissions' },
{ href: '/reviewer',             icon: Star,     label: 'Review assignments' },
{ href: '/editor/[slug]',        icon: Edit,     label: 'Editor panel',      section: 'Editor' },
```

Import any missing icons from lucide-react.

---

## Step 5 — Add to api.ts

```typescript
export const journalsApi = {
  list:         (p?: object) => api.get('/journals', { params: p }).then(r => r.data),
  get:          (slug: string) => api.get(`/journals/${slug}`).then(r => r.data),
  submit:       (slug: string, data: unknown) => api.post(`/journals/${slug}/submit`, data).then(r => r.data),
  mySubmissions:() => api.get('/journals/my/submissions').then(r => r.data),
  editorList:   (slug: string, p?: object) => api.get(`/journals/${slug}/editor/manuscripts`, { params: p }).then(r => r.data),
  assign:       (slug: string, id: string, data: unknown) => api.post(`/journals/${slug}/editor/manuscripts/${id}/assign`, data).then(r => r.data),
  decide:       (slug: string, id: string, data: unknown) => api.post(`/journals/${slug}/editor/manuscripts/${id}/decide`, data).then(r => r.data),
  publish:      (slug: string, id: string, data: unknown) => api.post(`/journals/${slug}/editor/manuscripts/${id}/publish`, data).then(r => r.data),
  myReviews:    () => api.get('/journals/reviews/assigned').then(r => r.data),
  respondReview:(id: string, response: string) => api.patch(`/journals/reviews/${id}/respond`, { response }).then(r => r.data),
  submitReport: (id: string, data: unknown) => api.post(`/journals/reviews/${id}/report`, data).then(r => r.data),
};
```

---

## How to create a journal (admin)

After logging in as admin, call:

```
POST /api/v1/journals
{
  "title": "Journal of Computer Science Education",
  "departmentId": "UUID",
  "editorId": "UUID",
  "issn_online": "2756-XXXX",
  "scope": "Peer-reviewed research in CS education...",
  "frequency": "biannual",
  "reviewType": "double_blind",
  "isOpenAccess": true,
  "subjects": ["Computer Science", "Education", "Technology"]
}
```

Then activate it:

```
PATCH /api/v1/journals/journal-of-computer-science-education
{ "status": "active" }
```

---

## OAI-PMH endpoint

All published articles are harvestable at:

```
GET /api/v1/journals/oai?verb=Identify
GET /api/v1/journals/oai?verb=ListSets
GET /api/v1/journals/oai?verb=ListRecords&metadataPrefix=oai_dc
GET /api/v1/journals/oai?verb=ListRecords&metadataPrefix=oai_dc&set=journal-slug
```

Register this URL with AJOL, Google Scholar, and BASE to get indexed.

---

## Workflow summary

1. IT Admin creates journal → activates it
2. Author goes to /journals → finds journal → submits manuscript
3. Editor gets notification → assigns 2+ reviewers
4. Reviewers accept/decline → submit reports with scores + recommendation
5. Editor makes decision (accept/revision/reject) → sends letter to author
6. On accept → editor clicks Publish → article auto-added to main repository
7. Article gets DOI and appears under /journals/[slug] and /repository
