# 🚀 BDApp Project Setup Guide

## After Cloning Repository

এই guide follow করুন যখন `git clone` করবেন।

### 1️⃣ Python Environment Setup

```bash
# Virtual environment তৈরি করুন
python -m venv .venv

# Activate করুন
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Dependencies install করুন
pip install -r requirements.txt
```

### 2️⃣ Frontend Setup (React)

```bash
cd frontend

# Node modules install করুন
npm install

# Backend করুন (যদি প্রয়োজন হয়)
npm run build

# Frontend development server চালান
npm start
```

### 3️⃣ Database Setup

```bash
# Django migrations চালান
python manage.py migrate

# Superuser তৈরি করুন (প্রথমবার)
python manage.py createsuperuser

# Demo data populate করুন (optional)
python manage.py populate_demo_data
```

### 4️⃣ Environment Variables

আপনার local `.env` file তৈরি করুন:

```bash
# Linux/macOS:
cp .env.example .env

# Windows PowerShell:
Copy-Item .env.example .env
```

এরপর `.env` এ edit করুন আপনার settings অনুযায়ী।

### 5️⃣ Backend Server চালান

```bash
# Terminal 1 - Django development server
python manage.py runserver

# Terminal 2 - Frontend development server (frontend/ folder এ)
npm start
```

---

## 📁 What's on GitHub

✅ **Source Code** (সব কিছু tracked):
- `academics/` - Academic management
- `attendance/` - Attendance system
- `backend/` - Django backend
- `fees/` - Fee management
- `frontend/` - React frontend
- `results/` - Results system
- `schools/` - School management
- `users/` - User management
- `scripts/` - Utility scripts

✅ **Configuration**:
- `requirements.txt` - Python dependencies
- `package.json` & `package-lock.json` - Node dependencies
- `manage.py` - Django management
- `README.md` - Project overview
- `.gitignore` - Git configuration

---

## ❌ What's NOT on GitHub (Local Only)

These are automatically created during setup:

- `.venv/` - Python virtual environment
- `frontend/node_modules/` - Node modules
- `db.sqlite3` - Development database
- `__pycache__/` - Python cache
- `frontend/build/` - React build output
- `.env` - Environment variables (আপনি নিজে তৈরি করুন)

---

## 🔒 Security Notes

❗ **Never commit these files:**
- `.env` (API keys, passwords)
- `.venv/`
- `node_modules/`
- `credentials.json`
- Database files (`.db`, `.sqlite3`)

আমরা ইতিমধ্যে এগুলো `.gitignore` তে যোগ করেছি ✅

---

## 🐛 Troubleshooting

### Problem: `ModuleNotFoundError: No module named 'rest_framework'`

**Solution:**
```bash
pip install -r requirements.txt
```

### Problem: `npm: command not found`

**Solution:**
- Node.js install করুন: https://nodejs.org/

### Problem: Port 8000 already in use

**Solution:**
```bash
python manage.py runserver 8001
```

### Problem: Database migration errors

**Solution:**
```bash
# Migrations reset করুন
python manage.py migrate --fake users zero
python manage.py migrate
```

---

## 📊 Project Structure

```
bdapp.live/
├── backend/                 # Django backend
│   ├── settings.py
│   ├── urls.py
│   └── ...
├── frontend/                # React frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── academics/               # Django app
├── attendance/              # Django app
├── fees/                    # Django app
├── results/                 # Django app
├── schools/                 # Django app
├── users/                   # Django app
├── scripts/                 # Helper scripts
├── manage.py                # Django CLI
├── requirements.txt         # Python dependencies
└── README.md                # Main readme
```

---

## 🔧 Useful Commands

```bash
# Django
python manage.py shell              # Interactive shell
python manage.py makemigrations     # Create migrations
python manage.py migrate            # Apply migrations
python manage.py createsuperuser    # Create admin user

# React/Node
npm start                           # Development server
npm run build                       # Production build
npm test                            # Run tests

# Git
git pull origin main                # Get latest changes
git push origin main                # Push your changes
git status                          # Check status
```

---

## 📞 Support

যদি problem হয়, check করুন:
1. README.md (main project info)
2. Backend README (`backend/README.md`)
3. Git commit history (কী কী change হয়েছে দেখতে)

---

**Last Updated:** May 28, 2026
**Repository:** https://github.com/bdappitfirm/bdapp.live
