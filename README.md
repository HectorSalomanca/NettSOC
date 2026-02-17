# NettSOC

A multi-tenant Security Operations Center (SOC) platform for tracking, triaging, and managing cybersecurity incidents. Built for teams that need a centralized place to coordinate incident response with role-based access control, evidence management, and real-time collaboration.

## Tech Stack

- **Next.js 16** (App Router) — React framework with TypeScript
- **Supabase** — Auth, Postgres database, Row-Level Security (RLS), Storage, RPC functions
- **Tailwind CSS** — Dark-themed professional UI

## Features

### Authentication & Authorization
- Email/password sign up and sign in
- Role-based access control: **Admin**, **Analyst**, **Viewer**
- Row-Level Security enforced at the database level
- Viewers are read-only; analysts can create/update; admins have full control

### Organizations (Multi-Tenant)
- Create and manage multiple organizations
- Switch between organizations seamlessly
- All data is scoped to the active organization
- Invite members via shareable join codes

### Member Management
- View all organization members with display names
- Admins can change member roles and remove members
- Last-admin protection prevents accidental lockout
- Invite system with configurable role, max uses, and expiration

### Incident Management
- Full CRUD for security incidents (title, summary, severity, status)
- Severity levels: Low, Medium, High, Critical
- Status workflow: Open → Investigating → Contained → Eradicated → Closed
- Advanced search and filtering (text search, severity, status, owner, sort)

### Dashboard
- KPI cards: Total, Open, Critical, Investigating, Closed counts
- Severity breakdown visualization
- Top 5 Critical & Open incidents
- Top 5 Recently Updated incidents

### Timeline & Evidence
- Chronological timeline entries per incident (notes, triage, containment, etc.)
- File evidence uploads with signed URL access
- All entries attributed to user display names

### User Profiles
- Set a display name visible across the platform
- Names appear on member lists, timeline entries, and incident attribution

## Architecture

```
src/
├── lib/
│   └── supabaseClient.ts          # Supabase client singleton
├── services/                       # ALL Supabase calls go here (never in UI)
│   ├── auth.ts                     # signUp, signIn, signOut, getSession
│   ├── incidents.ts                # CRUD + advanced search + dashboard stats
│   ├── timeline.ts                 # Timeline entries per incident
│   ├── evidence.ts                 # File upload + signed URLs
│   ├── org.ts                      # Organization CRUD + active org
│   ├── members.ts                  # Member list, role changes, removal
│   ├── invites.ts                  # Invite creation, join by code
│   └── profiles.ts                 # User display name management
└── app/
    ├── login/page.tsx              # Auth page
    ├── dashboard/page.tsx          # KPI dashboard
    ├── incidents/page.tsx          # Incident list + filters
    ├── incidents/[id]/page.tsx     # Incident detail + timeline + evidence
    ├── incidents/new/page.tsx      # Create incident
    ├── org/page.tsx                # Organization management
    ├── org/members/page.tsx        # Member + invite management
    ├── join/page.tsx               # Join org via invite code
    └── profile/page.tsx            # Edit display name
```

> **Critical rule:** No UI component ever calls Supabase directly. All data access goes through `src/services/*`.

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/HectorSalomanca/NettSOC.git
cd NettSOC
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in `LAYER_6_SQL.sql` (and earlier layer schemas) via the SQL Editor
3. Enable email auth in **Authentication → Providers**
4. Create a storage bucket called `evidence` (private)

### 3. Configure environment variables

Create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant org container |
| `org_members` | User ↔ Org membership with role |
| `org_invites` | Invite codes for joining orgs |
| `incidents` | Security incidents scoped to org |
| `incident_timeline` | Chronological entries per incident |
| `incident_evidence` | File metadata for uploaded evidence |
| `profiles` | User display names |

### RPC Functions
| Function | Purpose |
|----------|---------|
| `update_member_role` | Admin-only role change with last-admin protection |
| `remove_org_member` | Admin-only member removal with last-admin protection |
| `join_org_by_invite` | Atomic invite consumption + member creation |
| `get_my_org_ids` | Non-recursive helper for RLS policies |
| `get_my_role_in_org` | Role check helper for write-permission RLS |

## Layers Built

| Layer | Description | Status |
|-------|-------------|--------|
| 1 | Incidents CRUD + Auth + RLS | Done |
| 2 | Timeline entries per incident | Done |
| 3 | Evidence file uploads | Done |
| 4 | Organizations + membership + role-based RLS | Done |
| 5 | Dashboard + filters + search | Done |
| 6 | Member management + invite flow + profiles | Done |


## License

MIT
