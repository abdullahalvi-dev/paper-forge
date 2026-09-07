# Paper Forge AI

Paper Forge is a full-stack EdTech platform that uses Generative AI to automate question paper generation, support student practice, and streamline educational assessment workflows.

## Live Demo

https://www.paperforge.store/

## Overview

Paper Forge is designed for board-style educational assessments. It provides teachers with tools to create customized question papers and gives students an interactive environment for MCQ practice and evaluation.

The platform includes separate workflows for Teachers, Students, and Administrators.

## Key Features

### AI-Powered Assessment

- AI-powered question paper generation
- MCQs, short questions, and long questions
- Class → Subject → Chapter based question bank
- Difficulty-based question selection
- Multi-chapter paper generation
- Duplicate-question prevention
- AI chatbot for paper and practice workflows

### Teacher Features

- Generate customized question papers
- Select class, subject, chapter, question type, and difficulty
- Preview and edit generated papers
- PDF and Word export
- Print-friendly A4 paper format
- Question bank management
- Past papers and resource management

### Student Features

- MCQ practice from multiple chapters
- Timed practice sessions
- Automatic evaluation and results
- Practice paper generation
- Answer review

### Administration

- Role-based Teacher, Student, and Admin access
- User management
- Subscription management
- Question bank management
- Catalog management
- Payment history
- Paper generation logs
- Reports and system settings

## Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript
- Bootstrap 5

### Backend
- Node.js
- Express.js
- REST APIs

### Database
- MongoDB
- Mongoose

### Authentication
- JWT-based authentication
- Role-based access control
- Password reset with verification PIN
- OTP-based account activation

### AI
- Generative AI
- Google Gemini API
- AI chatbot integration

### Documents & Payments
- PDF generation
- Word document generation
- Stripe payment integration
- Manual administrative subscription activation

## Architecture

```text
Frontend
   ↓
REST API
   ↓
Node.js + Express.js
   ↓
MongoDB + Mongoose
   ↓
Generative AI / Gemini API
```

## User Roles

```text
Teacher
   ├── Generate Papers
   ├── Manage Questions
   ├── Preview / Export Papers
   └── Manage Resources

Student
   ├── Practice MCQs
   ├── Attempt Timed Tests
   └── View Results

Admin
   ├── Manage Users
   ├── Manage Questions
   ├── Manage Subscriptions
   ├── View Reports
   └── Manage System Settings
```

## Question Bank

The system organizes questions by:

```text
Class
 └── Subject
      └── Chapter
           ├── MCQs
           ├── Short Questions
           └── Long Questions
```

The current generated question bank contains:

- 96 chapter files
- 16,320 total questions
- 100 MCQs per chapter
- 50 short questions per chapter
- 20 long questions per chapter

Questions can also be added through the teacher interface, administrator tools, or API.

## Paper Generation

Paper Forge supports:

- Full Paper mode
- Custom Paper mode
- Multiple chapter selection
- Fixed question ordering
- Board-style A4 formatting
- Marks and instructions
- PDF export
- Word export
- Browser printing

Question order:

```text
MCQs
↓
Short Questions
↓
Long Questions
```

## Practice Mode

Students can generate practice sessions from multiple chapters.

Features include:

- Timed MCQ practice
- 60 seconds per MCQ
- Automatic submission
- Result calculation
- Practice history

## Subscription System

Paper Forge includes subscription management with:

- Monthly plan
- Yearly plan
- Free trial functionality
- Stripe payment support
- Administrative subscription management

## Project Structure

```text
paper-forge/
├── frontend/
├── backend/
├── .gitignore
└── README.md
```

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend requires a MongoDB connection and environment variables.

Create a `.env` file inside the backend directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret
GEMINI_API_KEY=your_api_key
```

Never commit real credentials, API keys, passwords, or secrets to the repository.

## Verification

The project was checked through JavaScript syntax validation and smoke testing of major application workflows, including:

- User registration and login
- Authentication and password reset
- Question paper generation
- PDF and Word export
- MCQ practice
- Subscription flow
- AI chatbot functionality

## Deployment

The frontend application is deployed using Vercel.

Live Demo:


https://www.paperforge.store/
## Author

**Muhammad Abdullah Alvi**

Full-Stack Developer | AI/LLM Engineer

GitHub: https://github.com/abdullahalvi-dev
