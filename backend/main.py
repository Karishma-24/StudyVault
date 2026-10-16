import sys
import os
import re
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from pathlib import Path
from database import engine, SessionLocal
from models import Base, Document, DocumentChunk
from sentence_transformers import SentenceTransformer
import json
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="StudyVault API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

#Create database tables
Base.metadata.create_all(bind=engine)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

import re

def split_text(text, chunk_size=500, overlap=50):
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    current = ""

    def split_long_sentence(sentence):
        words = sentence.split()
        parts = []
        part = ""

        for word in words:
            candidate = f"{part} {word}".strip()

            if len(candidate) > chunk_size and part:
                parts.append(part)
                part = word
            else:
                part = candidate

        if part:
            parts.append(part)

        return parts

    for sentence in sentences:
        if not sentence:
            continue

        # Split sentences that exceed the size limit.
        if len(sentence) > chunk_size:
            if current:
                chunks.append(current)
                current = ""

            parts = split_long_sentence(sentence)
            chunks.extend(parts[:-1])
            current = parts[-1]
            continue

        candidate = f"{current} {sentence}".strip()

        if not current or len(candidate) <= chunk_size:
            current = candidate
            continue

        # Save the completed chunk.
        chunks.append(current)

        # Build overlap from complete words, up to the requested size.
        overlap_words = []
        overlap_length = 0

        for word in reversed(current.split()):
            extra = len(word) + (1 if overlap_words else 0)

            if overlap_length + extra > overlap:
                break

            overlap_words.insert(0, word)
            overlap_length += extra

        overlap_text = " ".join(overlap_words)

        # Keep the next chunk within the size limit.
        while overlap_text and len(overlap_text) + 1 + len(sentence) > chunk_size:
            overlap_words.pop(0)
            overlap_text = " ".join(overlap_words)

        current = f"{overlap_text} {sentence}".strip()

    if current:
        chunks.append(current)

    return chunks



@app.get("/")
def home():
    return {"message": "StudyVault is running!"}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):

    #1. Check that a file is a pdf
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )

    #2. Save the pdf
    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    #3. Extract text
    try:
        reader = PdfReader(file_path)

        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read PDF: {str(e)}"
        )

    #4. Save document information to database
    db = SessionLocal()

    document = Document(
        filename=file.filename,
        pages=len(reader.pages)
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    #5. Split text into chunks and save to database

    chunks = split_text(text)

    for index, chunk in enumerate(chunks):
        embedding = embedding_model.encode(chunk).tolist()

        db_chunk = DocumentChunk(
            document_id = document.id,
            chunk_index=index,
            text=chunk,
            embedding=json.dumps(embedding)
        )
        db.add(db_chunk)
    db.commit()
    document_id = document.id
    db.close()

    return {
        "id": document_id,
        "filename": file.filename,
        "pages": len(reader.pages),
        "text": text
    }


@app.get("/documents")
def get_documents():
    db = SessionLocal()

    documents = db.query(Document).all()

    db.close()

    return documents

@app.delete("/documents/{document_id}")
def delete_document(document_id: int):
    db = SessionLocal()

    try:
        document = db.query(Document).filter(
            Document.id == document_id
        ).first()

        if document is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )

        file_path = os.path.join("uploads",document.filename)

        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).delete(synchronize_session=False)

        db.delete(document)

        db.commit()

        if os.path.exists(file_path):
            os.remove(file_path)

        return {
            "message": "Document deleted successfully",
            "document_id": document_id
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# @app.get("/documents/{document_id}/chunks")
# def get_document_chunks(document_id: int):
#     db = SessionLocal()

#     chunks = (
#         db.query(DocumentChunk)
#         .filter(DocumentChunk.document_id == document_id)
#         .all()
#     )

#     db.close()

#     return chunks

@app.get("/documents/{document_id}/chunks")
def get_document_chunks(document_id: int):
    db = SessionLocal()

    try:
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .all()
        )

        return [
            {
                "id": chunk.id,
                "document_id": chunk.document_id,
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
            }
            for chunk in chunks
        ]

    finally:
        db.close()

@app.get("/search")
def search_chunks(q: str, document_id: int | None = None):
    db = SessionLocal()

    query = (
        db.query(DocumentChunk, Document)
        .join(Document, DocumentChunk.document_id == Document.id)
        .filter(DocumentChunk.text.ilike(f"%{q}%"))
    )

    if document_id is not None:
        query = query.filter(
            DocumentChunk.document_id == document_id
        )

    results = query.all()

    db.close()
    return [
        {
            "chunk_id": chunk.id,
            "document_id": document.id,
            "filename": document.filename,
            "chunk_index": chunk.chunk_index,
            "text": chunk.text
        }
        for chunk, document in results
    ]

@app.get("/semantic-search")
def semantic_search(q: str, document_id: int | None = None):
    db = SessionLocal()

    query = db.query(DocumentChunk)
    if document_id is not None:
        query = query.filter(
            DocumentChunk.document_id == document_id
        )
    chunks = query.all()
    documents = db.query(Document).all()

    query_embedding = embedding_model.encode(q)

    results = []

    SIMILARITY_THRESHOLD = 0.30

    for chunk in chunks:
        if chunk.embedding is None:
            continue
        chunk_embedding = np.array(json.loads(chunk.embedding))

        document = next(
            document
            for document in documents
            if document.id == chunk.document_id
        )

        similarity = cosine_similarity(
            [query_embedding],
            [chunk_embedding]
        )[0][0]
        if similarity >= SIMILARITY_THRESHOLD:
            results.append({
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": document.filename,
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
                "similarity": float(similarity)
            })
    db.close()

    results.sort(
        key=lambda x: x["similarity"],
        reverse=True
    )
    return results[:3]

@app.get("/ask")
def ask(q: str):
    db = SessionLocal()

    chunks = db.query(DocumentChunk).all()

    query_embedding = embedding_model.encode(q)

    results = []

    for chunk in chunks:
        if chunk.embedding is None:
            continue
        chunk_embedding = np.array(json.loads(chunk.embedding))
        similarity = cosine_similarity(
            [query_embedding],
            [chunk_embedding]
        )[0][0]
        results.append({
            "text": chunk.text,
            "similarity": float(similarity)
        })
    db.close()

    results.sort(
        key=lambda x: x["similarity"],
        reverse=True
    )
    top_chunks = results[:3]
    context = "\n\n".join(
        chunk["text"] for chunk in top_chunks
    )
    return {
        "question": q,
        "context": context
    }