---

### 2. `README.en.md` (Anglais mis à jour)

```markdown
<div align="center">

# 🏢 ResidenceMS — Residence Management System

👉 **[Passer à la version française 🇫🇷](README.md)**

---

</div>

## 📌 Table of Contents
- [1. Project Overview & Architecture](#1-project-overview--architecture)
- [2. Role of Each Tech Stack Component](#2-role-of-each-tech-stack-component)
- [3. Functional Description & Business Logic](#3-functional-description--business-logic)
- [4. Local Setup on a New Machine (Dev)](#4-local-setup-on-a-new-machine-dev)
- [5. Production Deployment Guide](#5-production-deployment-guide)
- [6. Roadmap & Future Improvements](#6-roadmap--future-improvements)

---

### 📌 1. Project Overview & Architecture

**ResidenceMS** is an enterprise software solution designed for centralized management of residential complexes, furnished apartments, and hospitality bookings. It prevents double-booking, automates night and discount calculations, tracks payments (deposits and balances), supports audit-safe residence deactivation (`isActive`), generates PDF receipts and reports, and provides a dynamic financial performance dashboard.

---

### 🛠️ 2. Role of Each Tech Stack Component

#### **Backend (`residence-api`)**
- **NestJS (Node.js Framework)**:
  * Organizes the application into modular components (Modules, Controllers, Services, DTOs), including `ResidencesModule`, `BookingsModule`, `TenantsModule`, `UsersModule`, and `FinancesModule`.
  * Handles dependency injection, strict TypeScript typing, and centralized exception handling (`HttpExceptionFilter`).
- **Prisma ORM (Data Layer)**:
  * Provides a type-safe data access layer with TypeScript autocompletion.
  * Manages schema modeling (`Residence` with audit `isActive`, `Booking` with `BookingStatus`, `Tenant`, `User`, `Role`, `Permission`, `UserPermission`), database migrations (`prisma migrate`), and seeding.
- **PDFKit & Report Exports**:
  * Dynamically generates payment receipts in memory (Buffer binary stream) as PDFs without writing temporary files to disk.
  * Offers fine-grained vector layout control, currency formatting, and conditional legal notes.
- **JWT & Guards (Security & RBAC)**:
  * `JwtAuthGuard`: Validates bearer access tokens passed in the `Authorization` header.
  * `PermissionsGuard` & `@RequirePermissions()`: Checks explicit permissions stored in the database (e.g., `booking:create`, `booking:edit`, `residence:delete`, `finance:view`).

#### **Frontend (`residence-ui`)**
- **Next.js (App Router)**:
  * React framework delivering responsive client-side views and dynamic routes (`/dashboard`, `/residences`, `/bookings`, `/bookings/new`, `/bookings/[id]/edit`, `/finances`, `/users`).
- **Tailwind CSS**:
  * Utility-first CSS framework used to build high-contrast interfaces (`text-gray-900`, `font-bold`, solid white surfaces), interactive modals (booking creation modal on `/bookings`), and responsive tables.
- **TypeScript**:
  * Prevents runtime mismatches by aligning data interfaces (`Booking`, `Residence`, `Tenant`, `FinanceReportResponse`) across the API and UI.

#### **Database**
- **PostgreSQL**:
  * Stores relational records with referential integrity, uniqueness constraints, and high-precision decimal types for monetary values.

---

### 🔄 3. Functional Description & Business Logic

#### **A. Booking Lifecycle & Statuses**
1. **`PENDING` (Pending)**:
   * Initial status when a booking is created (including via the modal on `/bookings` calling `POST /bookings`).
   * **Automatic calculations**:
     $$\text{Nights} = \lceil \frac{\text{checkOut} - \text{checkIn}}{24\text{h}} \rceil$$
     $$\text{Gross Amount} = \text{Nights} \times \text{Price per night}$$
     $$\text{Net Amount} = \max(0, \text{Gross Amount} - \text{Discount})$$
   * **PDF Receipt**: Shows a notice stating the booking will be automatically cancelled 48 hours before check-in if unpaid.
   * **Editability**: Fully editable (dates, residence, tenant).

2. **`CONFIRMED` (Confirmed)**:
   * Triggered via the frontend status selector opening a **modal dialog**.
   * Requires entering a paid amount (`paidAmount`):
     * **Partial Deposit (`paidAmount < totalAmount`)**: The PDF receipt records the deposit received, shows the remaining balance due at check-in, and keeps date editing available.
     * **Full Payment (`paidAmount >= totalAmount`)**: The PDF receipt confirms full settlement. **Subsequent edits are automatically locked (Edit button disabled/locked)**.

3. **`COMPLETED` (Completed)**:
   * Marks the end of the stay.
   * Paid amount aligns with the full amount due ($100\%$).
   * The receipt serves as a **final settled invoice**, and further edits are blocked by the backend service.

4. **`CANCELLED` (Cancelled) & `REFUNDED` (Refunded)**:
   * Permanently locks the booking and excludes it from active financial totals (actual and projected revenue).
   * **PDF Receipt distinction**:
     * *Cancelled without deposit (`paidAmount = 0`)*: States that no payment was collected.
     * *Cancelled with deposit (`paidAmount > 0`)*: Records cancellation while noting the deposit previously collected.

#### **B. Anti-Overlapping Date Algorithm**
Before creating or updating booking dates, NestJS queries Prisma with interval intersection logic:
$$\text{ExistingCheckIn} < \text{NewCheckOut} \quad \text{AND} \quad \text{ExistingCheckOut} > \text{NewCheckIn}$$
Bookings with `CANCELLED` or `REFUNDED` status are excluded. Conflicts return a `409 ConflictException`.

#### **C. Residence Management (`isActive` for Audit)**
- Residences use `isActive` for audit-safe activation/deactivation (`PATCH /residences/:id/status`), preserving historical data and linked bookings instead of hard deletion.

#### **D. Financial Report & Performance (`/finances` & `GET /finances/report`)**
Restricted to users with `finance:view` permission (or `SUPER_ADMIN`):
- **Actual vs. Projected Revenue**: `CANCELLED` and `REFUNDED` bookings are excluded. **Actual revenue** sums collected payments/deposits (`paidAmount`); **Projected revenue** sums expected totals (`totalAmount`) across active bookings.
- **Dynamic Combined Chart with Legend**: Combines actual and projected revenue bars with booking count (dotted track with point marker), filterable by start date, end date, residence (`ALL` or a single residence), and grouping (`by residence` or `by day`).
- **Residence Comparator (Up to 3)**: Select up to 3 residences at once to compare booking count, actual revenue, projected revenue, and remaining balance side by side.
- **Detailed Report & CSV / PDF Exports**: Displays chronological booking details (booking date, tenant, stay dates, status, paid deposit, remaining balance, total) grouped by residence or filtered to one residence, with **CSV** download and **PDF** export.

---

### 🚀 4. Local Setup on a New Machine (Dev)

#### **Step 1: Clone the Repository**
```bash
git clone <REPOSITORY_URL>
cd ResidenceMS
Step 2: Backend Setup (residence-api)
Bash
cd residence-api

# 1. Install dependencies
npm install

# 2. Environment file
cp .env.example .env
# Update DATABASE_URL and JWT_SECRET in .env

# 3. Sync Database & Generate Prisma Client
npx prisma migrate dev
npx prisma generate

# 4. Seed sample data (Optional)
npm run seed

# 5. Start development server
npm run start:dev
Step 3: Frontend Setup (residence-ui)
Bash
cd ../residence-ui

# 1. Install dependencies
npm install

# 2. Local environment file
cp .env.example .env.local
# Verify: NEXT_PUBLIC_API_URL="http://localhost:3000"

# 3. Start development server
npm run dev
📦 5. Production Deployment Guide (VPS / Cloud Server)
A. Database
Apply migrations without altering the dev schema:

Bash
npx prisma migrate deploy
npx prisma generate
B. NestJS API Deployment (PM2)
Bash
cd residence-api
npm ci --only=production
npm run build
pm2 start dist/main.js --name "residence-api"
pm2 save
C. Next.js UI Deployment (PM2)
Bash
cd ../residence-ui
npm ci
npm run build
pm2 start npm --name "residence-ui" -- start
pm2 save
🔄 6. Roadmap & Future Improvements
[x] Database schema & Prisma migrations (including isActive on Residence for audit)

[x] Full booking lifecycle & status lock rules + creation modal on /bookings

[x] Custom PDF receipt generation with timestamps and currency formatting

[x] Finances module (/finances & GET /finances/report): combined chart with legend, comparator (up to 3 residences), chronological detail & CSV / PDF exports

[ ] Multi-currency support (EUR, USD, XOF)

[ ] Docker containerization (docker-compose.yml)

[ ] Automated CI/CD deployment pipeline (GitHub Actions)