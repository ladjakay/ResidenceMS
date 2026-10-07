<div align="center">

# 🏢 ResidenceMS — Residence Management System

👉 **[Passer à la version française 🇫🇷](README.md)**

---

</div>

## 📌 Table of Contents
* [1. Project Overview & Architecture](#1-project-overview--architecture)
* [2. Tech Stack Role Breakdown](#2-tech-stack-role-breakdown)
* [3. Detailed Business Logic & Workflow](#3-detailed-business-logic--workflow)
* [4. New Machine Setup (Development)](#4-new-machine-setup-development)
* [5. Production Deployment Guide](#5-production-deployment-guide)
* [6. Roadmap & Future Evolutions](#6-roadmap--future-evolutions)

---

### 📌 1. Project Overview & Architecture

**ResidenceMS** is an enterprise-grade software solution designed for managing residential complexes, furnished apartments, and hotel bookings. The platform eliminates double-booking issues, automates stay duration and discount calculations, tracks payments (deposits and balances), and generates official PDF receipts in real time.

---

### 🛠️ 2. Tech Stack Role Breakdown

#### **Backend (`residence-api`)**
* **NestJS (Node.js Framework)**: 
  * Enforces modular architecture (Modules, Controllers, Services, DTOs).
  * Provides dependency injection, strict TypeScript typing, and centralized exception handling (`HttpExceptionFilter`).
* **Prisma ORM (Data Layer)**:
  * Delivers type-safe database access with TypeScript autocompletion.
  * Manages schema migrations (`prisma migrate`) and database seeding for roles and permissions.
* **PDFKit (Document Generation Engine)**:
  * Generates PDF payment receipts in-memory as binary buffer streams without creating temporary files on disk.
  * Provides precise vector layout control, monetary formatting, and dynamic legal notice boxes.
* **JWT & Guards (Security & RBAC)**:
  * `JwtAuthGuard`: Validates incoming access tokens via `Bearer Authorization` headers.
  * `PermissionsGuard` & `@RequirePermissions()` Decorator: Intercepts requests to check DB-assigned user permissions (e.g., `booking:create`, `booking:edit`).

#### **Frontend (`residence-ui`)**
* **Next.js (App Router)**:
  * React framework handling client-side view rendering (CSR) and application routing (`/bookings`, `/bookings/new`, `/bookings/[id]/edit`).
* **Tailwind CSS**:
  * Utility-first CSS framework for building management dashboards, interactive modals, and data tables.
* **TypeScript**:
  * Prevents runtime errors by sharing type interfaces (`Booking`, `Residence`, `Tenant`) between API and UI.

#### **Database**
* **PostgreSQL / MySQL**:
  * Relational storage with relational integrity constraints and high-precision decimals for currency tracking.

---

### 🔄 3. Detailed Business Logic & Workflow

#### **A. Booking Lifecycle & Status Rules**
1. **`PENDING`**:
   * Initial state upon creation.
   * **Calculations**:
     $$\text{Nights} = \lceil \frac{\text{checkOut} - \text{checkIn}}{24 \text{h}} \rceil$$
     $$\text{Gross Total} = \text{Nights} \times \text{Price per night}$$
     $$\text{Net Total} = \max(0, \text{Gross Total} - \text{Discount})$$
   * **PDF Receipt**: Displays a warning box stating that the reservation will be automatically cancelled 48 hours prior to check-in if unpaid.
   * **Editability**: Fully editable.

2. **`CONFIRMED`**:
   * Triggered via the UI status selector which opens a **modal dialog**.
   * Requires inputting a paid amount (`paidAmount`):
     * **Partial Deposit (`paidAmount < totalAmount`)**: Receipt shows deposit received and remaining balance. The Edit button remains active.
     * **Full Payment (`paidAmount >= totalAmount`)**: Receipt confirms full payment. **The system automatically locks editing capabilities (Edit button disabled)**.

3. **`COMPLETED`**:
   * Marks the end of the stay.
   * Sets paid amount equal to total amount ($100\%$).
   * Receipt acts as a **final paid invoice**. All further modifications are rejected by the backend.

4. **`CANCELLED`**:
   * Permanently locks the booking.
   * **PDF Receipt Distinction**:
     * *Cancelled without deposit (`paidAmount = 0`)*: Mentions no payment was received.
     * *Cancelled with deposit (`paidAmount > 0`)*: Notes cancellation while acknowledging the previously received deposit.

#### **B. Date Overlap Prevention Algorithm**
Before creating or updating stay dates, NestJS executes an intersection query:
$$\text{ExistingCheckIn} < \text{NewCheckOut} \quad \text{AND} \quad \text{ExistingCheckOut} > \text{NewCheckIn}$$
Bookings marked as `CANCELLED` or `REFUNDED` are excluded. Conflicting dates return a `409 ConflictException`.

---

### 🚀 4. New Machine Setup (Development)

#### **Step 1: Clone Repository**
```bash
git clone <GIT_REPOSITORY_URL>
cd ResidenceMS

Step 2: Backend Setup (residence-api)
cd residence-api
npm install
cp .env.example .env
# Configure DATABASE_URL and JWT_SECRET in .env

npx prisma migrate dev
npx prisma generate
npm run seed # Optional
npm run start:dev

Step 3: Frontend Setup (residence-ui)

cd ../residence-ui
npm install
cp .env.example .env.local
# Ensure NEXT_PUBLIC_API_URL="http://localhost:3000"

npm run dev

📦 5. Production Deployment Guide
A. Database
npx prisma migrate deploy
B. Deploy NestJS API (PM2)
cd residence-api
npm ci --only=production
npm run build
pm2 start dist/main.js --name "residence-api"
pm2 save
C. Deploy Next.js UI (PM2)
cd ../residence-ui
npm ci
npm run build
pm2 start npm --name "residence-ui" -- start
pm2 save

🔄 6. Roadmap & Future Evolutions
[x] Database Schema & Prisma Migrations

[x] Advanced Booking Lifecycle & Status Locking Rules

[x] PDF Receipt Generation with custom rules & timestamps

[ ] Multi-currency support (EUR, USD, XOF)

[ ] Dockerization (docker-compose.yml)

[ ] Automated CI/CD Pipelines (GitHub Actions)
