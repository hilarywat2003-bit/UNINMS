# Journal Subscription Billing — How to Apply

## What this adds

- 3 subscription plans: Starter (₦50K/yr), Standard (₦150K/yr), Premium (₦350K/yr)
- IT Admin creates journal → picks plan → pays via Paystack
- Super Admin sees payment in approval queue → reviews journal → approves or rejects
- Journal activates only after super admin approval
- Full revenue dashboard for super admin

---

## Step 1 — Run migration

```
Copy: migrations/013_journal_billing.sql
To:   uninms-backend/migrations/013_journal_billing.sql
```

```bash
cd uninms-backend && npm run migrate
```

---

## Step 2 — Copy backend route

```
Copy: backend/routes/journal-billing.js
To:   uninms-backend/src/routes/journal-billing.js
```

Add to `uninms-backend/src/server.js`:

```javascript
const journalBillingRouter = require('./routes/journal-billing');
app.use(`${API}/journal-billing`, journalBillingRouter);
```

---

## Step 3 — Copy frontend pages

| File | Destination |
|------|-------------|
| `frontend/create-journal-page.tsx`       | `uninms-web/src/app/admin/journals/create/page.tsx` |
| `frontend/admin-journals-page.tsx`       | `uninms-web/src/app/admin/journals/page.tsx` |
| `frontend/billing-success-page.tsx`      | `uninms-web/src/app/admin/journals/billing/success/page.tsx` |
| `frontend/superadmin-journals-page.tsx`  | `uninms-web/src/app/superadmin/journals/page.tsx` |

Create all necessary layout.tsx files:
```tsx
export { default } from '@/app/dashboard/layout';
```

---

## Step 4 — Sidebar links

IT Admin sidebar:
```tsx
{ href: '/admin/journals',        icon: BookOpen, label: 'My journals' },
{ href: '/admin/journals/create', icon: Plus,     label: 'Create journal' },
```

Super Admin sidebar:
```tsx
{ href: '/superadmin/journals', icon: Shield, label: 'Journal approvals' },
```

---

## Full flow

```
IT Admin
  → /admin/journals/create
  → Fills in journal details (Step 1)
  → Selects plan: Starter/Standard/Premium (Step 2)
  → Clicks "Create & Pay" → redirected to Paystack
  → Completes payment → returns to /admin/journals/billing/success
  → Payment verified → journal status = "payment_received"

Super Admin
  → /superadmin/journals → "Pending" tab
  → Sees journal + payment proof + amount paid
  → Clicks "Review" → approval modal
  → Approves: journal status = "active" → IT admin can manage it
  → Rejects: journal status = "rejected" → IT admin sees reason

IT Admin
  → /admin/journals → sees all their journals with status
  → Active journals have "View journal" button
  → Rejected journals show rejection reason
  → Expiring journals show renewal warning
```

---

## API endpoints added

| Method | Endpoint | Access |
|--------|----------|--------|
| GET    | /journal-billing/plans | Public |
| PATCH  | /journal-billing/plans/:id | super_admin |
| POST   | /journal-billing/journals | admin, super_admin |
| GET    | /journal-billing/verify/:ref | authenticated |
| POST   | /journal-billing/webhook | public (Paystack) |
| GET    | /journal-billing/pending | super_admin |
| GET    | /journal-billing/all | super_admin |
| POST   | /journal-billing/:id/approve | super_admin |
| POST   | /journal-billing/:id/reject | super_admin |
| POST   | /journal-billing/:id/suspend | super_admin |
| GET    | /journal-billing/my | admin |
| GET    | /journal-billing/stats | super_admin |

---

## Plans (editable by super admin)

| Plan     | Price/yr   | Articles/yr | Issues/yr | DOI |
|----------|------------|-------------|-----------|-----|
| Starter  | ₦50,000    | 24          | 2         | No  |
| Standard | ₦150,000   | 100         | 4         | Yes |
| Premium  | ₦350,000   | 500         | 12        | Yes |

Super admin can edit any plan via PATCH /journal-billing/plans/:id
