# PDF Chat Application

An interactive web application that allows users to chat with their PDF documents using AI. Upload PDFs and ask questions to get contextual answers based on the document's content.

## Features

- 🚀 Chat with any PDF document
- 🔒 User authentication system
- 💾 Save chat history and conversations
- 🌓 Dark/Light theme support
- 📱 Responsive design
- 🔄 Real-time PDF processing
- 📊 Session management
- ✨ Markdown support in chat

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript, EJS templating
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **ML Processing**: Python, Flask
- **Authentication**: JWT
- **Additional Libraries**: 
  - marked (Markdown processing)
  - multer (File uploads)
  - bcrypt (Password hashing)
  - Bootstrap (UI components)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
1. **Node.js** (v14 to v18 recommended)
   - Download: [https://nodejs.org/](https://nodejs.org/)
   - Choose the LTS version for best compatibility

2. **Python** (v3.8 to v3.11 recommended)
   - Download: [https://www.python.org/downloads/](https://www.python.org/downloads/)
   - Make sure to check "Add Python to PATH" during installation

3. **MongoDB Community Edition**
   - Download: [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
   - Important: Select "Install MongoDB Compass" during installation
   - Default connection string will be: mongodb://localhost:27017/PDFchatbot

### API Key Setup
1. Visit [https://openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Login/Create account to generate your API key
3. Copy the API key and add it to your .env file as:
```
DEEPSEEK_API_KEY="Bearer your_api_key_here"
```
Note: Make sure to include the "Bearer" prefix as shown above.

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd PdfChat
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the root directory and add your API key:
```
DEEPSEEK_API_KEY="Bearer your_api_key_here"
```

Note: Make sure to include the "Bearer" prefix as shown above.

5. Ensure MongoDB is running on your system (default: mongodb://localhost:27017/PDFchatbot)

## Project Structure

- `/views` - EJS templates for rendering pages
- `/public` - Static assets (CSS, JavaScript, images)
- `/dbmodels` - MongoDB schema definitions
- `/uploads` - Temporary storage for PDF uploads
- Python files for ML processing:
  - `deepseek_server.py` - Main ML server
  - `ml_server.py` - Alternative ML processing

## Running the Application

1. Start the MongoDB service on your system

2. Start both Node.js and Python servers:
```bash
npm start
```

This will concurrently start:
- Node.js server on http://localhost:3000
- Python ML server on http://localhost:5001

## Usage

1. Visit http://localhost:3000 in your browser
2. Register for an account or continue without login
3. Upload a PDF document
4. Start asking questions about your document
5. (Optional) Login to save your chat history and access it later

## Features in Detail

### For Non-logged in Users
- Upload and chat with PDFs
- Temporary session storage
- Dark/Light theme switching

### For Logged-in Users
- All features of non-logged in users
- Persistent storage of PDFs and chat history
- Rename PDFs
- Access to previous chat sessions
- PDF management through sidebar

## Development

- The Node.js server (`server.js`) handles routing, authentication, and database operations
- The Python server (`deepseek_server.py`) processes PDFs and generates responses using AI
- Chat sessions are stored in MongoDB for logged-in users and in-memory for non-logged in users

## Error Handling

The application includes comprehensive error handling for:
- PDF processing errors
- Authentication failures
- Server communication issues
- Invalid file uploads
- Session management

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- XSS protection
- CSRF prevention
- Secure cookie handling
- Input sanitization

## Browser Support

The application is tested and works on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

Feel free to fork the repository and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the LICENSE file for details.