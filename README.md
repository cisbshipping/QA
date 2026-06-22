# QA Inspection & Complaint System

Internal quality assurance system for Cranberry International Sdn Bhd / ASAP International Sdn Bhd. Tracks customer complaints and inspection requisitions across all five group entities (Cranberry, Multisafe, ASAP, Cranberry International, EcoBee).

## Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Routing**: react-router-dom
- **Forms**: react-hook-form + zod
- **Backend**: Firebase (Auth + Firestore + Storage)
- **Icons**: lucide-react

## Setup

1. Install deps:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Firebase web app credentials.
3. Start dev server:
   ```
   npm run dev
   ```
4. Build production bundle:
   ```
   npm run build
   ```

## Firebase setup

Create a Firebase project, then in the console:
- Enable **Authentication** → Email/Password provider.
- Create a **Firestore** database in production mode.
- Apply the rules from `firestore.rules` (see below).
- Optional: enable **Storage** for supplier file uploads.

First user becomes `viewer` by default. Promote yourself to `admin` directly in the Firestore `users` collection, then manage other roles via the in-app Users page.

## Roles

- `admin` — full access, can manage users and settings
- `manager` — submit, edit, and review complaints / inspection requisitions; access inbox
- `qa` — submit, edit, and review complaints / inspection requisitions; record inspection results
- `viewer` — read-only

## Workflows

### Complaint
1. BD / QA submits → status `open`
2. QA reviews → `accepted` or `rejected` (with notes)
3. Once supplier responds → mark `closed`

### Inspection Requisition
1. PIC submits → status `pending`
2. QA reviews → `accepted` (with scheduled date) or `rejected`
3. After inspection → record `passed` (case closed) or `failed` (with rescheduled date)

## Project structure

```
src/
  components/
    auth/       # LoginCard
    forms/      # ComplaintForm, InspectionForm
    layout/     # Layout, Sidebar
    ui/         # Button, Input, Card, Modal, Badge
  hooks/        # useAuth (context)
  lib/          # firebase.ts, db.ts, utils.ts
  pages/        # Dashboard, Complaints, Inspections, Users + detail pages
  types/        # shared TypeScript interfaces
```

## Firestore collections

| Collection   | Purpose                                       |
|--------------|-----------------------------------------------|
| `users`      | App user profiles (uid → name, email, role)   |
| `complaints` | Complaint registration records                |
| `inspections`| Inspection requisition records                |
| `auditLogs`  | Append-only audit trail                       |
| `settings`   | (reserved) email templates, config            |

## Backend automation (next phase)

The data model is designed to plug into a Node/Express backend for:
- Triggered email notifications (complaint review, inspection result)
- OneDrive integration via Microsoft Graph API for supplier file uploads
- Scheduled reminders for upcoming factory commit dates

See the development blueprint in the project brief for details.
