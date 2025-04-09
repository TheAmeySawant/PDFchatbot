from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pdfplumber
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import traceback
import requests
import json

app = Flask(__name__)
CORS(app)

# Load embedder once
embedder = SentenceTransformer('all-MiniLM-L6-v2')

# Store chunks and embeddings
pdf_data = {
    "chunks": [],
    "embeddings": []
}

# DeepSeek API details
DEEPSEEK_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_API_KEY = "Bearer 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"  # Replace with your actual key

headers = {
    "Authorization": DEEPSEEK_API_KEY,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost",
    "X-Title": "PDFChatBot"
}

def extract_text_from_pdf(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join(page.extract_text() for page in pdf.pages if page.extract_text())
        print(f"[INFO] Extracted {len(text)} characters from PDF")
        return text
    except Exception as e:
        print(f"[ERROR] Failed to read PDF: {e}")
        return ""

def chunk_text(text, chunk_size=500):
    words = text.split()
    return [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]

@app.route('/process', methods=['POST'])
def process_pdf():
    try:
        data = request.json
        pdf_path = data.get('pdf_path')

        print(f"[INFO] PDF path received: {pdf_path}")

        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({"status": "error", "message": "Invalid or missing PDF path"}), 400

        text = extract_text_from_pdf(pdf_path)
        if not text.strip():
            return jsonify({"status": "error", "message": "No text extracted from PDF"}), 400

        chunks = chunk_text(text)
        if not chunks:
            return jsonify({"status": "error", "message": "Failed to split text into chunks"}), 500

        embeddings = embedder.encode(chunks)

        pdf_data["chunks"] = chunks
        pdf_data["embeddings"] = embeddings

        print(f"[INFO] PDF processed. Total chunks: {len(chunks)}")
        return jsonify({"status": "success", "chunks": len(chunks)})

    except Exception as e:
        print("[ERROR] Exception in /process route:")
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Internal server error"}), 500

@app.route('/ask', methods=['POST'])
def ask_question():
    try:
        question = request.json.get("question")
        print(f"[INFO] Question: {question}")

        if len(pdf_data["chunks"]) == 0 or len(pdf_data["embeddings"]) == 0:
            return jsonify({"answer": "Please upload and process a PDF before asking questions."}), 400

        query_embedding = embedder.encode([question])
        similarities = cosine_similarity(query_embedding, pdf_data["embeddings"])[0]
        best_idx = int(np.argmax(similarities))
        context = pdf_data["chunks"][best_idx]

        print(f"[INFO] Best matching chunk index: {best_idx}")

        # Send question + best chunk to DeepSeek
        payload = {
            "model": "deepseek/deepseek-chat:free",
            "messages": [
                {"role": "system", "content": "Answer based on the following PDF context."},
                {"role": "user", "content": f"Context: {context}\n\nQuestion: {question}"}
            ]
        }

        deepseek_response = requests.post(DEEPSEEK_API_URL, headers=headers, data=json.dumps(payload))
        if deepseek_response.status_code != 200:
            print(f"[ERROR] DeepSeek API failed: {deepseek_response.status_code}", deepseek_response.text)
            return jsonify({"answer": "Sorry, DeepSeek API failed to respond properly."}), 500

        deepseek_answer = deepseek_response.json()["choices"][0]["message"]["content"]
        return jsonify({"answer": deepseek_answer})

    except Exception as e:
        print("[ERROR] Exception in /ask route:")
        traceback.print_exc()
        return jsonify({"answer": "Sorry, there was an error processing your question."}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)
