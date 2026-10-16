# StudyVault

StudyVault is a full-stack web application that helps users upload, manage, and search their study documents using keyword-based and semantic search.

## Features

- Upload and manage PDF documents.
- Extract text from PDFs and split it into smaller chunks.
- Generate text embeddings using Sentence Transformers.
- Search document content using keyword matching or semantic similarity.
- Filter search results by document.
- View extracted document chunks.
- Retrieve relevant context for questions.

## Tech Stack

**Frontend:** React, Vite, CSS

**Backend:** Python, FastAPI

**Database:** SQLite with SQLAlchemy

**PDF Processing:** pypdf

**Embeddings and Semantic Search:** Sentence Transformers, NumPy, scikit-learn

**Containerization:** Docker, Docker Compose

## How It Works

1. Upload a PDF through the web interface.
2. StudyVault extracts the document's text.
3. The extracted text is split into overlapping chunks.
4. Each chunk is converted into an embedding and stored in the database.
5. Users can search for relevant content using keywords or semantic similarity.
6. The application can retrieve relevant chunks as context for a question.

## Running Locally

### Backend

Navigate to the backend directory and activate your Python virtual environment.

```powershell
python -m uvicorn main:app --reload
```

The backend API runs at `http://127.0.0.1:8000`.

### Frontend

Open a separate terminal and navigate to the frontend directory.

```powershell
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

## Running with Docker

From the project root, run:

```powershell
docker compose up --build
```

Then open `http://localhost:5173`.

## Current Scope

The application currently supports document management, keyword search, semantic retrieval, and context retrieval. Generating answers with a large language model is a potential future enhancement.

## Learning Goals

This project was built to gain practical experience with REST APIs, relational databases, PDF processing, text embeddings, semantic search, React, and Docker.
