# Sta. Rosa Elementary School - QR Code Attendance System
### Grade 6 - Section: Great Geniuses

A full-stack, real-time QR Code Attendance System with DepEd SF2 (School Form 2) monthly report generation, GPS geofencing (Onsite vs Flipped Classroom modes), SMS alerts, custom theme switcher, and enrollment verification.

---

## 🔑 Default Login Credentials

| Role | Username | Password | Access / Purpose |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full system control, user accounts, system configuration |
| **Teacher** | `teacher` | `teacher123` | QR scanning, roster management, SF2 reports, attendance history |
| **Learner** | `student` | `student123` | Student self check-in portal, personal attendance logs |

---

## 💻 Part 1: How to Run Locally (Offline / Development)

The project includes an automatic single-command startup that launches both the Express backend and Vite frontend concurrently.

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

### 2. Install Dependencies (First time only)
Open PowerShell or your terminal in this directory:
```bash
npm run install:all
```

### 3. Start the Application
Run:
```bash
npm run dev
```

Both servers will start together:
- **Frontend App:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000](http://localhost:3000)

> [!NOTE]
> **Automatic Offline Mode:** When running locally without a `DATABASE_URL` configured, the system automatically uses the local SQLite database (`attendance.db`). You do not need an internet connection or any cloud database to test and develop locally!

---

## ☁️ Part 2: How to Set Up Supabase (Cloud Database)

Supabase replaces the local SQLite file with a permanent, cloud-hosted PostgreSQL database so your data is saved forever in the cloud.

### Step 1: Create a Free Supabase Project
1. Go to **[supabase.com](https://supabase.com)** and sign in (or click **Start your project**).
2. Click **"New Project"**.
3. Fill in the details:
   - **Name:** `qr-attendance-grade6` (or any name you choose)
   - **Database Password:** Enter a strong password and **copy/save it** (you will need it for the connection string).
   - **Region:** Select `Southeast Asia (Singapore)` (fastest response time for the Philippines).
4. Click **"Create new project"** and wait ~1 minute for Supabase to set up.

---

### Step 2: Run the Database Schema (1 Click)
1. On the left sidebar of your Supabase dashboard, click the **SQL Editor** icon (`>_`).
2. Click **"New query"** (green button or plus sign).
3. Open [`supabase_schema.sql`](supabase_schema.sql) in your code editor.
4. Copy the entire content of `supabase_schema.sql`, paste it into the Supabase SQL editor box.
5. Click **"Run"** (bottom right of the query window).

> [!TIP]
> **What this script sets up automatically:**
> - All 8 database tables (`users`, `students`, `attendance`, `app_settings`, `sf2_progress`, `sms_logs`, `notification_events`, `student_absence_days`).
> - The default `admin`, `teacher`, and `student` accounts with secure bcrypt passwords.
> - The official class roster of 25 Grade 6 Great Geniuses students with unique QR codes.
> - Default classroom settings (Room 101, Onsite mode, Rose theme, geofencing).
> - Sample attendance history across past school days.

---

### Step 3: Copy Your Supabase Connection String
1. In the Supabase dashboard, click the **Project Settings** gear icon (bottom left) ➔ click **Database**.
2. Scroll down to the **Connection String** section and select the **URI** tab.
3. Choose the **Transaction** mode (recommended for serverless pooler on port `6543`) or **Session**:
   ```text
   postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the actual database password you created in Step 1.
5. Keep this URI copied for Vercel deployment!

---

## 🚀 Part 3: How to Deploy on Vercel (Frontend + Backend)

You can deploy the entire fullstack application (Vite React frontend + Express Serverless API) on **Vercel** with zero extra backend servers.

### Step 1: Push Your Code to GitHub
Open your terminal in this repository:
```bash
git add .
git commit -m "Configure fullstack Vercel serverless and Supabase PostgreSQL"
git push origin main
```

---

### Step 2: Import Project in Vercel
1. Go to **[vercel.com](https://vercel.com)** and log in with your GitHub account.
2. On your dashboard, click **"Add New..." ➔ "Project"**.
3. Under **Import Git Repository**, find your repository:
   `cathrinajaneballesteros/qr-attendance-system`
   and click **"Import"**.

---

### Step 3: Configure Project Settings on Vercel
Vercel will show the project configuration page. Ensure these values are set:

- **Framework Preset:** `Vite`
- **Root Directory:** `./`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

---

### Step 4: Add Environment Variables in Vercel
Expand the **Environment Variables** section and add the following 3 variables:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` | Your Supabase connection string from Part 2, Step 3 |
| `JWT_SECRET` | `qr-attendance-secret-key-grade6-2026` | Secret key used to encrypt login tokens |
| `SMS_PROVIDER` | `mock` | SMS provider (`mock` for free simulation, or `semaphore`) |

*(Optional: If you have a Semaphore SMS API key, you can also add `SEMAPHORE_API_KEY`)*

---

### Step 5: Click Deploy!
1. Click the blue **"Deploy"** button.
2. Vercel will install dependencies, build the frontend, package the serverless API routes, and deploy.
3. In ~1–2 minutes, you will get your live production URL (e.g., `https://your-qr-attendance.vercel.app`)!

---

## 🔄 Optional: Connect Local Development to Supabase
If you want your local `npm run dev` to share the same cloud database as your live Vercel site:
1. Open `backend/.env`.
2. Paste your Supabase connection string:
   ```env
   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
3. Run `npm run dev`. The console will display:
   ```text
   Initializing database connection using Supabase/PostgreSQL...
   Connected to Supabase PostgreSQL database
   ```
*(To return to offline mode, simply clear or comment out `DATABASE_URL`)*

---

## 📁 Project Structure

```text
qr-attendance-system/
├── api/
│   └── index.js              # Vercel Serverless Function entry point
├── backend/
│   ├── database/
│   │   └── db.js             # Dual-mode database driver (Supabase PG + Local SQLite)
│   ├── routes/
│   │   ├── attendance.js     # QR scan, GPS verification, history, export
│   │   ├── auth.js           # Login, registration, token generation
│   │   ├── settings.js       # Classroom policy, GPS, room, theme settings
│   │   ├── sf2.js            # DepEd SF2 report and progress tracker
│   │   ├── sms.js            # SMS alerts and logs
│   │   ├── student-account.js# Learner self-service portal
│   │   └── students.js       # Roster management & enrollment verification
│   ├── services/
│   │   └── notifications.js  # Automated absence/drop risk alerts
│   ├── app.js                # Modular Express application
│   ├── server.js             # Local development server (port 3000)
│   └── .env.example          # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/       # Login portals, Navbar, Stat cards, Themes
│   │   ├── pages/            # Teacher, Admin, Scanner, History, SF2 pages
│   │   └── utils/api.js      # Unified API client
│   └── vite.config.js
├── supabase_schema.sql       # Copy-paste Supabase PostgreSQL setup script
├── vercel.json               # Vercel routing (SPA + Serverless /api/*)
└── package.json              # Fullstack build and dev runner
```

---

## 🛠️ Need Help or Troubleshooting?

- **Database Connection Error on Vercel:** Ensure your `DATABASE_URL` password in Vercel settings doesn't have unescaped special characters (e.g., `#`, `@`, `%`). If your password has special characters, URL-encode them or use letters and numbers for the password in Supabase.
- **Can't Scan / Blocked Student:** Ensure the student is set to **Officially Enrolled** in the Students roster tab. Only enrolled students are permitted to record attendance.
- **GPS Distance Warning:** If testing outside school, either switch attendance mode to **Flipped Classroom** in Settings or disable GPS verification.

- 
