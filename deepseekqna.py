import requests
import json
import pdfplumber

def extract_pdf_info(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        metadata = pdf.metadata or {}
        text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        page_count = len(pdf.pages)

    # Clean and combine metadata
    meta_info = {
        "Title": metadata.get("Title", "Unknown"),
        "Author": metadata.get("Author", "Unknown"),
        "Pages": page_count
    }

    return meta_info, text

def query_deepseek(pdf_path, user_question):
    metadata, pdf_text = extract_pdf_info(pdf_path)

    # Prepare prompt with both metadata and content
    context = f"""
    This PDF contains the following metadata:
    - Title: {metadata['Title']}
    - Author: {metadata['Author']}
    - Pages: {metadata['Pages']}

    Content:
    {pdf_text[:3000]}  # limit to first 3000 chars if very long

    Now answer this question:
    {user_question}
    """

    headers = {
        "Authorization": "Bearer YOUR_API_KEY_HERE",
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

    response = requests.post("https://openrouter.ai/api/v1/chat/completions",
                             headers=headers,
                             data=json.dumps(data))

    print("Status Code:", response.status_code)
    print("Response JSON:", response.json())

# Example usage
query_deepseek("yourfile.pdf", "What is the summary of this document?")
