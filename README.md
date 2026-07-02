# 🚀 AI Resume Screener

> **An Enterprise-Grade AI-Powered Resume Screening & Applicant Tracking System (ATS)** built with **Next.js, FastAPI, LangChain, ChromaDB, Supabase, and Large Language Models (LLMs)** to automate candidate evaluation, resume parsing, semantic matching, and AI-driven recruitment workflows.

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![LangChain](https://img.shields.io/badge/LangChain-AI-green)
![ChromaDB](https://img.shields.io/badge/ChromaDB-VectorDB-purple)

---

# 📖 Overview

AI Resume Screener is a **production-ready recruitment platform** that enables recruiters to automatically analyze resumes, compare them against job descriptions, calculate ATS scores, rank candidates, and generate AI-powered hiring insights.

Instead of relying on simple keyword matching, the system leverages **Natural Language Processing (NLP), Semantic Search, Embeddings, OCR, and Large Language Models (LLMs)** to evaluate resumes intelligently and provide explainable recommendations.

---

# ✨ Key Features

## 📄 Resume Processing

* Upload PDF, DOCX, and image-based resumes
* OCR support for scanned documents
* Automatic resume parsing
* Resume version management
* Structured JSON extraction
* Duplicate resume detection

---

## 💼 Job Description Analysis

* Upload or create job descriptions
* Automatic skill extraction
* Keyword analysis
* Experience detection
* Education requirement extraction
* Technology stack recognition

---

## 🤖 AI Resume Analysis

* ATS Score Calculation
* Resume–Job Description Matching
* Semantic Similarity Search
* Candidate Ranking
* Skill Gap Analysis
* Resume Improvement Suggestions
* Hiring Recommendation
* Resume Summary Generation
* Missing Skills Detection
* AI-Powered Candidate Insights

---

## 🧠 NLP & LLM Features

* Named Entity Recognition (NER)
* Skill Normalization
* Semantic Search
* Sentence Embeddings
* Retrieval-Augmented Generation (RAG)
* LLM-Based Resume Evaluation
* Interview Question Generation

---

## 📊 Recruiter Dashboard

* Resume Analytics
* ATS Score Distribution
* Candidate Comparison
* Candidate Ranking
* Job Posting Management
* Hiring Pipeline Overview
* Skill Analytics
* Interactive Charts
* Downloadable Reports

---

## 🔐 Authentication & Security

* JWT Authentication
* Refresh Tokens
* Role-Based Access Control
* Recruiter Dashboard
* Candidate Dashboard
* Admin Dashboard
* Secure Password Hashing
* API Rate Limiting

---

# 🏗️ System Architecture

```text
                 +-------------------------+
                 |      Next.js Frontend   |
                 +-----------+-------------+
                             |
                             |
                      REST API / JWT
                             |
                 +-----------v-------------+
                 |      FastAPI Backend    |
                 +-----------+-------------+
                             |
      +----------------------+----------------------+
      |                      |                      |
      |                      |                      |
 Resume Parser         AI Engine            ATS Engine
      |                      |                      |
      |                      |                      |
 OCR Module         LangChain + LLMs      Scoring Engine
      |                      |                      |
      +----------+-----------+-----------+----------+
                 |                       |
           ChromaDB Vector DB      PostgreSQL
                 |                       |
            Semantic Search        Supabase
```

---

# 🛠️ Tech Stack

## Frontend

* Next.js 15
* TypeScript
* Tailwind CSS
* shadcn/ui
* React Hook Form
* TanStack Query
* Zod
* Framer Motion
* Recharts

---

## Backend

* FastAPI
* Python 3.12
* SQLAlchemy
* Alembic
* Pydantic
* Celery
* Redis

---

## Artificial Intelligence

* LangChain
* OpenAI API
* Groq API
* Sentence Transformers
* Hugging Face Transformers
* spaCy
* NLTK

---

## Resume Parsing

* PyMuPDF
* pdfplumber
* python-docx
* PaddleOCR
* Tesseract OCR

---

## Database

* Supabase PostgreSQL

---

## Vector Database

* ChromaDB

---

## Deployment

* Docker
* Docker Compose
* GitHub Actions
* Vercel
* Render

---

# 📂 Project Structure

```text
ai-resume-screener/

├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── lib/
│   └── styles/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── database/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── parsers/
│   │   ├── ai/
│   │   ├── vectorstore/
│   │   ├── scoring/
│   │   ├── reports/
│   │   ├── utils/
│   │   └── workers/
│   │
│   ├── migrations/
│   ├── tests/
│   └── requirements.txt
│
├── docs/
├── docker/
├── scripts/
├── tests/
├── .github/
├── docker-compose.yml
├── README.md
└── LICENSE
```

---

# ⚙️ Core Modules

* Authentication & Authorization
* Resume Upload Service
* OCR Processing
* Resume Parser
* Job Description Parser
* NLP Skill Extraction
* ATS Scoring Engine
* Embedding Generator
* Semantic Search
* Retrieval-Augmented Generation (RAG)
* Candidate Ranking Engine
* Recruiter Dashboard
* Analytics Dashboard
* PDF Report Generator
* Notification Service

---

# 📊 ATS Scoring Parameters

| Parameter           | Weight |
| ------------------- | ------ |
| Skills Match        | 40%    |
| Experience          | 20%    |
| Education           | 10%    |
| Projects            | 10%    |
| Certifications      | 10%    |
| Semantic Similarity | 10%    |

---

# 🚀 Planned Workflow

```text
Recruiter Login
        │
        ▼
Create Job Description
        │
        ▼
Upload Candidate Resume
        │
        ▼
Resume Parsing
        │
        ▼
OCR (If Required)
        │
        ▼
Skill Extraction
        │
        ▼
Embedding Generation
        │
        ▼
Semantic Matching
        │
        ▼
ATS Score Calculation
        │
        ▼
AI Analysis
        │
        ▼
Candidate Ranking
        │
        ▼
Generate Report
```

---

# 📌 Future Enhancements

* Multi-language Resume Support
* AI Resume Generator
* AI Cover Letter Generator
* Voice Interview Assistant
* Interview Scheduling
* Email Automation
* Candidate Recommendation Engine
* Learning-to-Rank Models
* Bias Detection & Fairness Analysis
* Multi-Tenant SaaS Support
* Mobile Application
* Real-Time Notifications

---

# 🤝 Contributing

Contributions, feature requests, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push to your branch.
5. Open a Pull Request.

---

# 📄 License

This project is licensed under the **MIT License**.

---

# 👨‍💻 Author

**DHESIK V**

**AI/ML Engineer | Artificial Intelligence & Data Science Student**

* 💼 Passionate about Artificial Intelligence, Machine Learning, NLP, Computer Vision, and Full-Stack Development.
* 🚀 Building enterprise-grade AI applications with modern technologies.

---

⭐ **If you found this project helpful, consider giving it a star and sharing it with others!**
