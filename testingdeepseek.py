import requests
import json

headers = {
    "Authorization": "Bearer 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",  # Replace with your real key
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost",  # or your frontend URL if hosted
    "X-Title": "PDFChatBot",              # Optional: name shown on OpenRouter
}

data = {
    "model": "deepseek/deepseek-chat:free",  # or deepseek-r1:free if needed
    "messages": [
        {
            "role": "user",
            "content": "What is the meaning of life?"
        }
    ]
}

response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, data=json.dumps(data))

print("Status Code:", response.status_code)
print("Response JSON:", response.json())
