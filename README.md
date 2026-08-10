# VocabLearner (Vocab-helper)

VocabLearner is a powerful, AI-driven vocabulary learning tool consisting of two main components:
1. **Chrome Extension**: Allows you to instantly look up any word on any webpage, get AI-generated deep insights (using Google Gemini), and save the word to your personal database.
2. **Web Dashboard**: A React-based web application where you can manage your saved vocabulary, review AI insights, and practice the words you've learned.

---

## 🚀 Features

- **Instant Lookup**: Highlight any text on a webpage to instantly see its English definition, Vietnamese translation, and phonetic transcription.
- **Deep AI Insights**: Automatically fetches deep context, word forms, short meanings, and collocations using Google Gemini AI.
- **Smart Saving**: Save words directly to your Firebase Firestore database with one click.
- **Web Dashboard**: A beautiful, modern interface to review all your saved words, filter by topic, and refresh AI insights.
- **API Key Rotation**: Built-in support for multiple Gemini API keys to gracefully handle rate limits (`429 Too Many Requests`).

---

## 🛠 Prerequisites

Before you begin, ensure you have the following:
- **Node.js** (v16 or higher) installed for the Web Dashboard.
- A **Firebase Project** with Firestore Database enabled.
- One or more **Google Gemini API Keys** (Starting with `AIza...`) from [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## ⚙️ Setup Instructions

### 1. Configure Firebase
- Create a Firebase project and enable **Firestore Database**.
- Update the Firebase config in `webapp/src/firebase.ts` (and any related config in `extension/background.js`) with your project credentials.

### 2. Configure API Keys (Environment Variables)

To keep your Gemini API keys secure, they are stored in environment files that are ignored by Git.

**For the Web App:**
1. Navigate to the `webapp` folder.
2. Copy `.env.example` to a new file named `.env`:
   ```bash
   cd webapp
   cp .env.example .env
   ```
3. Open `webapp/.env` and add your Gemini API keys (comma-separated):
   ```env
   VITE_GEMINI_API_KEYS="AIzaKey1..., AIzaKey2..."
   ```

**For the Chrome Extension:**
1. Navigate to the `extension` folder.
2. Copy `env.example.js` to a new file named `env.js`:
   ```bash
   cd extension
   cp env.example.js env.js
   ```
3. Open `extension/env.js` and add your Gemini API keys:
   ```javascript
   export const GEMINI_API_KEY_STRING = "AIzaKey1..., AIzaKey2...";
   ```

### 3. Run the Web Dashboard
1. Open a terminal and navigate to the `webapp` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. The dashboard will be available at `http://localhost:5173`.

### 4. Install the Chrome Extension
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle switch in the top right corner).
3. Click **Load unpacked** and select the `extension` folder from this repository.
4. The Vocab-helper extension is now installed and active!

---

## 📖 Usage Guide

1. **Browsing & Looking Up**: While browsing the web, simply highlight any English word. A small tooltip will appear.
2. **Reviewing Insights**: Click the "Lookup" button on the tooltip. You'll instantly see the standard definition. After a brief moment, the AI Insights (deeper meanings, word forms, collocations) will load.
3. **Saving**: Click the "Save" button to push the word to your Firestore database.
4. **Dashboard**: Open the Web Dashboard (or click the extension icon to launch it) to view all your saved words. You can edit them, sort them by topics, or click "Làm mới AI Insight" to fetch fresh data if needed.

---

## 📝 Troubleshooting

- **AI Insights not loading / Error in tooltip**: Ensure your API keys in `env.js` and `.env` are valid Gemini API keys starting with `AIza`. If you get a `404` or `400` error, the key is likely invalid or lacks the necessary permissions.
- **429 Too Many Requests**: You have hit the free tier limit of Gemini. The system will automatically rotate to your next API key if you provided multiple keys.

---
*Happy Learning!*
