from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pdfplumber
import numpy as np
import traceback
import requests
import json
import sys


sys.stdout.reconfigure(encoding='utf-8') #make output on console error free (mostly)


app = Flask(__name__)
CORS(app)


# DeepSeek API details
DEEPSEEK_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_API_KEY = "Bearer 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"  # Replace with your actual key


pdf_data = {
    "text" : "",
    "meta_info": {
        "Title": "Unknown",
        "Author": "Unknown",
        "Pages": 0
    }
}

def determine_pdf_title(metadata, text):
    # 1. Check metadata title
    title = metadata.get("Title", "").strip()
    if title and title.lower() != "unknown":
        return title

    # 2. Fallback: use the first non-empty line of actual PDF content
    for line in text.splitlines():
        clean_line = line.strip()
        if clean_line:
            return clean_line[:80]  # optional: limit title length
    return "Untitled PDF"


def extract_pdf_info(pdf_path):
    print("[Python] Pdf Path:", pdf_path)
    try:
        with pdfplumber.open(pdf_path) as pdf:
            metadata = pdf.metadata or {}
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
            page_count = len(pdf.pages)

        # Populate data
        pdf_data["text"] = text
        pdf_data["meta_info"]["Title"] = determine_pdf_title(metadata, text)
        pdf_data["meta_info"]["Author"] = metadata.get("Author", "Unknown")
        pdf_data["meta_info"]["Pages"] = page_count

        # Safe print
        print(json.dumps(pdf_data, indent=2, ensure_ascii=False))

    except FileNotFoundError:
        print("[ERROR] PDF file not found.")
    except pdfplumber.pdf.PDFSyntaxError:
        print("[ERROR] Invalid or corrupted PDF file.")
    except Exception as e:
        print(f"[ERROR] Failed to extract PDF info: {e}")

    return pdf_data


@app.route('/process', methods=['POST'])
def process_pdf():
    try:
        data = request.json
        pdf_path = data.get('pdf_path')

        print(f"[INFO] PDF path received: {pdf_path}")

        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({"status": "error", "message": "Invalid or missing PDF path"}), 400

        extract_pdf_info(pdf_path)

        return jsonify({"status": "success", "message": "PDF processed successfully.", "pdf_data": pdf_data})  # ✅ ADD THIS

    except Exception as e:
        print("[ERROR] Exception in /process route:")
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Internal server error"}), 500

@app.route('/ask', methods=['POST'])
def ask_question():
    try:
        question = request.json.get("question")
        print(f"[INFO] Question: {question}")

        deepseek_response = query_deepseek(question)

        if deepseek_response.status_code != 200:
            print(f"[ERROR] DeepSeek API failed: {deepseek_response.status_code}", deepseek_response.text)
            return jsonify({"answer": "Sorry, DeepSeek API failed to respond properly."}), 500

        deepseek_answer = deepseek_response.json()["choices"][0]["message"]["content"]
        return jsonify({"answer": deepseek_answer})

    except Exception as e:
        print("[ERROR] Exception in /ask route:")
        traceback.print_exc()
        
        return jsonify({"answer": "Sorry, there was an error processing your question."}), 500

@app.route('/ask-target', methods=['POST'])
def ask_question_target():
    try:
        question = request.json.get("question")
        pdata = request.json.get("pdfData")
        print(f"[INFO] Question: {question}")
        print(f"[INFO] pdfData: {pdata}")

        deepseek_response = query_deepseek(question, pdata)

        if deepseek_response.status_code != 200:
            print(f"[ERROR] DeepSeek API failed: {deepseek_response.status_code}", deepseek_response.text)
            return jsonify({"answer": "Sorry, DeepSeek API failed to respond properly."}), 500

        deepseek_answer = deepseek_response.json()["choices"][0]["message"]["content"]
        return jsonify({"answer": deepseek_answer})

    except Exception as e:
        print("[ERROR] Exception in /ask route:")
        traceback.print_exc()
        
        return jsonify({"answer": "Sorry, there was an error processing your question."}), 500

def query_deepseek(user_question, pdata = None):
    try:
        if pdata == None:
            pdata = pdf_data
        # Ensure pdf_data is available
        if not pdata.get("text", "").strip():
            raise ValueError("PDF content is empty. Please process a valid PDF first.")


        # Prepare context
        context = f"""
        This PDF contains the following metapdata:
        - Title: {pdata["meta_info"].get("Title", "Unknown")}
        - Author: {pdata["meta_info"].get("Author", "Unknown")}
        - Pages: {pdata["meta_info"].get("Pages", "Unknown")}

        Content:
        {pdata["text"]}

        (In your response do not mention the above data. directly answer the question instead of saying like from you content/data wahtever
        You may use phrases like from the pdf you uploaded.
        because i am using your api in my project so act like a pdf bot)

        Now answer this question:
        {user_question}
        """ 

        headers = {
            "Authorization": DEEPSEEK_API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost",
            "X-Title": "PDFChatBot"
        }

        data = {
            "model": "deepseek/deepseek-chat:free",
            "messages": [
                {"role": "user", "content": context}
            ]
        }

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(data),
            timeout=15  # optional: avoid hanging
        )

        response.raise_for_status()  # Raise HTTPError for bad status codes

        print("Status Code:", response.status_code)
        print("Response JSON:", response.json())

        return response

    except requests.exceptions.Timeout:
        print("[ERROR] Request timed out.")
    except requests.exceptions.HTTPError as http_err:
        print(f"[ERROR] HTTP error occurred: {http_err}")
    except requests.exceptions.RequestException as req_err:
        print(f"[ERROR] Request exception occurred: {req_err}")
    except ValueError as val_err:
        print(f"[ERROR] Value error: {val_err}")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")

if __name__ == '__main__':
    app.run(port=5001, debug=True)
