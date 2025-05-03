from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pdfplumber
import numpy as np
import traceback
import requests
import json
import sys
from dotenv import load_dotenv

load_dotenv()  # Add this near the top of your file

sys.stdout.reconfigure(encoding='utf-8') #make output on console error free (mostly)


app = Flask(__name__)
CORS(app)


# DeepSeek API details
DEEPSEEK_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')  # Replace the hardcoded API key with environment variable


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

        if(deepseek_response.status_code):
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
    print("\n[Python] /ask-target route called")
    data = request.json
    question = data['question']
    pdf_data = data['pdfData']
    chat_history = data.get('chatHistory', '')
    token_limits = data.get('tokenLimits', {})

    print("[Python] Question:", question)
    print("[Python] PDF title:", pdf_data['meta_info']['Title'])
    print("[Python] PDF content length:", len(pdf_data['text']))
    print("[Python] Chat history length:", len(chat_history))
    print("[Python] Token limits:", token_limits)

    try:
        # Construct context with PDF content and chat history
        context = f"""
PDF Content:
{pdf_data['text']}

PDF Metadata:
Title: {pdf_data['meta_info']['Title']}
Author: {pdf_data['meta_info']['Author']}
Pages: {pdf_data['meta_info']['Pages']}

Previous Conversation:
{chat_history}

Current Question: {question}
"""
        print("[Python] Context constructed, length:", len(context))
        print("[Python] Calling DeepSeek API...")
        
        response = query_deepseek(context, token_limits)
        print("[Python] Got response from DeepSeek")
        print("[Python] Response length:", len(response))
        
        return jsonify({"answer": response})
    except Exception as e:
        print(f"[Python] Error in ask_question_target: {str(e)}")
        return jsonify({"error": str(e)}), 500

def query_deepseek(user_question, token_limits=None):
    try:
        print("[Python] Starting query_deepseek")
        context = user_question
        
        headers = {
            "Authorization": DEEPSEEK_API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "PDFChatBot"
        }

        messages = [
            {"role": "system", "content": "You are a helpful PDF assistant."},
            {"role": "user", "content": context}
        ]

        data = {
            "model": "deepseek/deepseek-chat:free",
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": token_limits.get("aiResponse", 2048) if token_limits else 2048
        }

        print("[Python] Preparing DeepSeek API request")
        print("[Python] Token limit:", data["max_tokens"])
        print("[Python] Message lengths:", [len(m["content"]) for m in messages])
        
        response = requests.post(
            DEEPSEEK_API_URL,
            headers=headers,
            json=data,
            timeout=30
        )
        
        print(f"[Python] DeepSeek API Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"[Python] DeepSeek API Error Response: {response.text}")
            return "I apologize, but I'm having trouble processing your request at the moment. Please try again."
            
        response_json = response.json()
        if not response_json.get("choices"):
            print("[Python] No choices in response:", response_json)
            return "I apologize, but I received an invalid response. Please try again."
            
        answer = response_json["choices"][0]["message"]["content"]
        print("[Python] Successfully got answer from DeepSeek")
        print("[Python] Answer length:", len(answer))
        return answer

    except requests.exceptions.Timeout:
        print("[Python] DeepSeek API timeout after 30 seconds")
        return "I apologize, but the request timed out. Please try again."
    except requests.exceptions.RequestException as e:
        print(f"[Python] Network error in query_deepseek: {str(e)}")
        return "I apologize, but there was a network error. Please try again."
    except Exception as e:
        print(f"[Python] Unexpected error in query_deepseek: {str(e)}")
        print("[Python] Error traceback:", traceback.format_exc())
        return "I apologize, but an unexpected error occurred. Please try again."

if __name__ == '__main__':
    app.run(port=5001, debug=True)
