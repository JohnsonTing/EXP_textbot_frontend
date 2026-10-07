# Workspace

## Overview

Estate Agent CRM — a full-stack web app for managing bot-driven property conversations, contacts, and performance analytics.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, Recharts

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (contacts, conversations, messages, dashboard)
│   └── estate-agent/       # React + Vite frontend CRM app
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

### Conversations (/)
- WhatsApp/Messenger-style chat interface
- Left panel: list of all conversations with contact name, phone, channel icon, last message, unread count
- Right panel: full message thread (inbound left, outbound right with color)
- Bottom input to type and send messages directly to customers
- Filter by channel (WhatsApp, SMS, Email) and status (Active)

### Contacts (/contacts)
- CRM table: Name, Phone, Email, Tags, Lead Intent, Property, Bedrooms, Budget, Created On
- Filter by intent (Buyers, Renters, Vendors) + search bar
- Add/Edit/Delete contact dialog
- Tags shown as colored badges

### Dashboard (/dashboard)
- Metric cards: Cost Savings (£), Time Saved, Viewings Booked, Hot Leads
- Lead stats: Engaged, Instant Reply, Reactivated, Referrals, Buyers, Renters
- Line chart: New conversations last 7 days
- Bar/pie chart: Messages by channel
- Funnel: New Leads → Engaged → Qualified → Viewings → Offers

## Database Schema

- `contacts` — CRM contacts with lead intent, budget, tags etc.
- `conversations` — Conversations linked to contacts, with channel and status
- `messages` — Individual messages within conversations (inbound/outbound)

## API Routes

All routes under `/api`:
- `GET/POST /contacts`
- `GET/PUT/DELETE /contacts/:id`
- `GET/POST /conversations`
- `GET /conversations/:id`
- `GET/POST /conversations/:id/messages`
- `GET /dashboard/metrics`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server. Routes in `src/routes/`, validated with `@workspace/api-zod`, persisted via `@workspace/db`.

### `artifacts/estate-agent` (`@workspace/estate-agent`)
React + Vite frontend CRM. Uses `@workspace/api-client-react` generated hooks. Pages in `src/pages/`.

### `lib/db` (`@workspace/db`)
Drizzle ORM with PostgreSQL. Schema in `src/schema/`.
- `pnpm --filter @workspace/db run push` — sync schema to DB

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec + Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
