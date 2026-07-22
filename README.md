# Organization Expense Manager

Production-ready MVP for a multi-tenant accounting and expense management system built with Next.js 15, Auth.js v5, MongoDB, Mongoose, Tailwind CSS, Shadcn-style UI primitives, Recharts, CSV/PDF exports, and GridFS receipt storage.

## Setup

```bash
npm install
cp .env.example .env.local
npm run seed
npm run dev
```

To create only the Super Admin account without sample data:

```bash
npm run create-super-admin
```

Optional overrides:

```bash
SUPER_ADMIN_EMAIL=admin@example.com SUPER_ADMIN_PASSWORD='StrongPassword123!' npm run create-super-admin
```

Default seed credentials:

- Super Admin: `super@expense.test` / `Password123!`
- Owner: `owner@acme.test` / `Password123!`
- Admin: `admin@acme.test` / `Password123!`
- Staff: `staff@acme.test` / `Password123!`

## Security Model

- JWT sessions include `userId`, `organizationId`, `role`, `name`, and `email`.
- All tenant-owned models include `organizationId`.
- Server helpers require an active session and scope all tenant queries to `session.user.organizationId`.
- Super Admin access is explicitly separated and can manage organizations.

## Organization Onboarding

Super Admin creates an organization with an initial admin name, login email, and password. The login email is stored as the organization email and an `owner` user is created automatically for that organization. The Super Admin can then manually share those credentials with the organization admin.

## Email Notifications

The app uses Brevo transactional email when these environment variables are configured:

```bash
BREVO_API_KEY=
BREVO_SMTP_KEY=
BREVO_SENDER_NAME=HisabKitab
BREVO_SENDER_EMAIL=support@example.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Current email events:

- New user account created
- Task assigned or reassigned
- Expense approval status updated
- Project payment added

Email failures are logged but do not block accounting actions.
