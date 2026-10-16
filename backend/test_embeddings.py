from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

model = SentenceTransformer("all-MiniLM-L6-v2")

sentences = ["Machine learning allows computers to learn from data.",
        "Algorithms can learn patterns from data without being explicitly programmed.",
        "The weather is very hot today"
]

embeddings = model.encode(sentences)

similarity = cosine_similarity(embeddings)

print("Similarity matrix:")
print(similarity)
