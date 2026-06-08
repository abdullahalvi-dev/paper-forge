# Paper Forge - Complete System

Paper Forge is a full-stack EdTech platform for board-style paper generation, MCQ practice, subscriptions, resources, and admin management.

- Frontend: HTML, Bootstrap 5, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Auth: JWT role-based access plus password reset PIN
- Exports: PDF, Word, and print-friendly A4 paper view
- Roles: Teacher, Student, Admin

## Production Email Verification (SMTP)

Paper Forge uses OTP-only account activation. Configure a real SMTP provider in Vercel:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=Paper Forge <no-reply@example.com>
SUPER_ADMIN_EMAIL=abdullahalvi@gmail.com
```

Gmail SMTP example:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your_16_character_gmail_app_password
SMTP_FROM=Paper Forge <your-gmail@gmail.com>
```

After changing Vercel Environment Variables, redeploy the Production deployment. This project sends OTPs through SMTP only.

## Run Commands

Open this folder in VS Code, then run:

```powershell
cd backend
npm install
npm run dev
```

If PowerShell blocks `npm`, use:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:5000
```

MongoDB must be running locally, or set your Atlas URL in `backend/.env`.

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/paper_forge
JWT_SECRET=change_this_secret_before_production
ALLOW_ADMIN_REGISTER=true
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
```

If port 5000 is busy:

```powershell
$env:PORT=5055
npm.cmd run dev
```

Then open `http://localhost:5055`.

## New Feature Set

- Login/register and forgot-password flow with a 6-digit PIN valid for 10 minutes.
- Question bank organized by Class -> Subject -> Chapter.
- Each chapter file contains exactly 100 MCQs, 50 short questions, and 20 long questions.
- Multi-chapter paper generation with Full Paper and Custom Paper modes.
- Fixed paper order: MCQs first, short questions second, long questions third.
- Board-style A4 paper header, marks, instructions, PDF download, Word download, and browser print.
- Student MCQ practice from multiple chapters with exactly 60 seconds per MCQ.
- One-time free trial for first paper generation or practice session.
- Subscription plans: Monthly 2000 PKR and Yearly 20000 PKR.
- Stripe PaymentIntent support when Stripe keys are configured.
- AI chatbot command parser with Gemini API, backend validation, and role-based paper/practice generation.
- Development/demo payment mode for local testing.
- Jazzcash/cash manual admin override for 03047775129, Muhammad Abdullah Alvi.
- Past papers and books PDF library with admin/teacher upload.
- Admin users, subscriptions, settings, questions JSON import, payment history, and paper logs.
- Admin UI redesigned in a DashboardPack-style sales/admin layout: compact sidebar, top action bar, stat tiles, chart widgets, list widgets, and data tables.
- New admin pages: Catalog, Paper Logs, Reports, expanded Questions, expanded Users, expanded Payments, and expanded Subscriptions.

## Question Bank

Generated data is stored here:

```text
backend/data/question-bank/
backend/data/questions.1000plus.json
```

Current generated bank:

```text
96 chapter files
16,320 total questions
100 MCQs + 50 short + 20 long per chapter
```

Regenerate the bank:

```powershell
cd backend
npm.cmd run generate:questions
```

Import all questions into MongoDB:

```powershell
cd backend
npm.cmd run import:questions -- data/questions.1000plus.json --replace
```

Your own questions can be added from the teacher UI, admin JSON importer, or API. Minimal JSON shape:

```json
{
  "classLevel": "9th",
  "classId": "9th",
  "subject": "Physics",
  "subjectId": "Physics",
  "chapter": "Kinematics",
  "chapterId": "Kinematics",
  "type": "mcq",
  "question": "What is velocity?",
  "options": ["Displacement per unit time", "Mass per volume", "Force per area", "Energy per second"],
  "correctAnswer": "Displacement per unit time",
  "difficulty": "easy",
  "marks": 1
}
```

Use `type: "short"` or `type: "long"` and keep `options: []` for written questions.

## Important Pages

```text
/login.html
/register.html
/forgot-password.html
/check-email.html
/set-new-password.html

/dashboard/teacher-dashboard.html
/teacher/generate-paper.html
/teacher/chatbot.html
/teacher/preview-paper.html
/teacher/paper-history.html

/dashboard/student-dashboard.html
/student/practice-setup.html
/student/chatbot.html
/student/practice-test.html
/student/result.html

/dashboard/admin-dashboard.html
/admin/users.html
/admin/catalog.html
/admin/questions.html
/admin/subscriptions.html
/admin/paper-logs.html
/admin/payments.html
/admin/past-papers.html
/admin/reports.html
/admin/settings.html

/subscription.html
/resources.html
```

## Main API Routes

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/verify-pin
POST /api/auth/reset-password
GET  /api/auth/me

GET  /api/questions
POST /api/questions
POST /api/questions/bulk-json
PUT  /api/questions/:id
DELETE /api/questions/:id

POST /api/paper/generate
POST /api/papers/generate
GET  /api/papers
GET  /api/papers/:id
GET  /api/papers/:id/print
GET  /api/papers/:id/download/pdf
GET  /api/papers/:id/download/word

GET  /api/practice/mcq
POST /api/practice/generate
POST /api/practice/submit
POST /api/student/practice/generate
GET  /api/student/practice/:id
POST /api/student/practice/:id/submit

POST /api/chatbot/message

GET  /api/resources
GET  /api/resources/past-papers
GET  /api/resources/books
POST /api/resources

GET  /api/subscription/status
POST /api/subscription/create-order
POST /api/subscription/webhook
GET  /api/subscription/payments

GET  /api/admin/stats
GET  /api/admin/users
PATCH /api/admin/users/:id
DELETE /api/admin/users/:id
PUT  /api/admin/users/:id/subscription
GET  /api/admin/subscriptions
GET  /api/admin/questions
POST /api/admin/questions/bulk-json
GET  /api/admin/catalog
POST /api/admin/class
POST /api/admin/subject
POST /api/admin/chapter
PUT  /api/admin/catalog/:id
DELETE /api/admin/catalog/:id
GET  /api/admin/payments
GET  /api/admin/paper-logs
GET  /api/admin/settings
PUT  /api/admin/settings
```

## Payments

For local testing, the frontend uses provider `demo`, which activates the subscription instantly.

For Stripe, set:

```env
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
```

When both Stripe keys are present, `/subscription.html` shows a Stripe card form and confirms successful payments against Stripe before activating the subscription. Webhook support is also available at `/api/subscription/webhook`.

For Jazzcash/cash, admin can manually activate any user from Subscriptions.

## Verification

This project was checked with:

```powershell
node --check frontend/assets/js/app.js
Get-ChildItem backend -Recurse -Filter *.js | Where-Object { $_.FullName -notlike '*\node_modules\*' } | ForEach-Object { node --check $_.FullName }
```

Smoke-tested API flow:

```text
student login/register
board paper generation
fixed order: mcq, mcq, short, long
PDF download
demo subscription activation
Stripe key-aware card payment panel
MCQ practice generation with 60-second timer
forgot-password PIN verify and reset
```
