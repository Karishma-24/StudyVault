from main import split_text


text = """
Python is used for backend development.
Machine learning identifies patterns in data.
FastAPI helps developers build web APIs.
React creates interactive user interfaces.
Databases store application information.
Docker packages applications into containers.
Semantic search retrieves relevant information.
Embeddings represent text as numerical vectors.
"""

print("Input has correct phrase:", "patterns in data" in text)
print("Input has merged phrase:", "patterns in data" not in text and "patternsin data" in text)

chunks = split_text(text, chunk_size=100, overlap=20)
print("\n--- Validation ---")
print("Total chunks:", len(chunks))
print("All chunks within limit:", all(len(chunk) <= 500 for chunk in chunks))
print("No empty chunks:", all(chunk.strip() for chunk in chunks))


print("\n--- Exact Overlap Check ---")

for i in range(len(chunks) - 1):
    previous_words = chunks[i].split()
    next_words = chunks[i + 1].split()

    overlap_words = 0

    for size in range(1, min(len(previous_words), len(next_words)) + 1):
        if previous_words[-size:] == next_words[:size]:
            overlap_words = size

    overlap_text = " ".join(previous_words[-overlap_words:])

    print(f"\nChunk {i} -> Chunk {i + 1}")
    print("Overlapping words:", overlap_words)
    print("Overlapping text:", repr(overlap_text))
    print("Overlap characters:", len(overlap_text))


for i, chunk in enumerate(chunks):
    print(f"\nChunk {i}:")
    print(repr(chunk))
    print("Length:", len(chunk))

print("\n--- Space Diagnostic ---")

for i, chunk in enumerate(chunks):
    if "application" in chunk:
        print(f"Chunk {i}:", repr(chunk))
        print(
            "Contains correct phrase:",
            "application information" in chunk
        )
        print(
            "Contains merged phrase:",
            "applicationinformation" in chunk
        )

print("\n--- Final Phrase Check ---")
print("'patterns in data' exists:", "patterns in data" in chunks[0])
print("'patternsin data' exists:", "patternsin data" in chunks[0])
print("Chunk representation:", repr(chunks[0]))


from database import SessionLocal
from models import DocumentChunk

db = SessionLocal()

try:
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == 4)
        .order_by(DocumentChunk.chunk_index)
        .all()
    )

    print("\n--- Real PDF Chunk Validation ---")
    print("Total chunks:", len(chunks))
    print("All chunks within 500 characters:",
          all(len(chunk.text) <= 500 for chunk in chunks))

    for chunk in chunks:
        print(
            f"Chunk {chunk.chunk_index}: "
            f"{len(chunk.text)} characters"
        )
finally:
    db.close()
