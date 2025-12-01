# PulsePost - Automated X (Twitter) Poster

PulsePost is a powerful Chrome Extension designed to automate your X (formerly Twitter) posting workflow. It combines robust automation with AI-powered content generation, detailed analytics, and a modern, user-friendly interface.

## 🚀 Key Features

### 🤖 AI Integration
*   **AI Tweet Generation**: Generate creative tweets instantly using the **Grok-4.1** model (via OpenRouter).
*   **Smart Hashtags**: Automatically generate relevant, trending hashtags for your tweets with a single click.
*   **Custom Prompts**: Input any topic or requirement to get tailored content.

### 📊 Analytics & Reports
*   **Daily Reports**: Track your daily posting activity with a detailed table in the "Reports" tab.
*   **Stats Tracking**: Monitor the number of Text, Image, and AI tweets posted each day.

### 🖼️ Enhanced Media Support
*   **Image Scheduling**: Schedule specific images to be posted at exact dates and times.
*   **Bulk Upload**: Select up to 30 images at once.
*   **Captions**: Add custom captions to each image easily.

### 🛠️ Powerful Tools
*   **Universal Queue Management**: Clear all queues (Text, Image, AI) with a single click.
*   **Emoji Picker**: Built-in emoji picker for quick access to popular emojis.
*   **CSV Support**: Upload bulk text tweets via CSV and remove them easily if needed.
*   **Human-Like Delays**: Set randomized time gaps (e.g., 30s - 70s) to mimic natural behavior and avoid detection.

### 🎨 Modern UI
*   **Bento Grid Layout**: A clean, organized dashboard inspired by modern design trends.
*   **Light Theme**: A polished, professional look with glassmorphism effects.

## 📦 Installation

Since this is a custom extension, you need to load it manually into Chrome:

1.  **Download/Clone** this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** using the toggle in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the folder containing the PulsePost code (the folder with `manifest.json`).
6.  The **PulsePost** icon should appear in your toolbar.

## 📖 Usage

### 1. AI Tweets
1.  Go to the **AI Tweets** tab.
2.  Enter your **OpenRouter API Key**.
3.  Type a prompt (e.g., "5 funny tweets about coding").
4.  Click **Generate**.
5.  Review, edit, or remove tweets, then click **Approve & Queue**.

### 2. Text Tweets
1.  Go to the **Text Tweets** tab.
2.  **Manual Entry**: Type tweets directly and use the **Emoji** or **Smart Hashtag** buttons.
3.  **CSV Upload**: Upload a `.csv` file (one tweet per line).
4.  Click **Start Posting**.

### 3. Image Tweets
1.  Go to the **Image Tweets** tab.
2.  Select images from your computer.
3.  Add captions and use the **Schedule** button to set specific posting times.
4.  Click **Start Posting**.

### 4. Reports
*   Check the **Reports** tab to see a day-by-day breakdown of your posting history.

## ⚙️ Configuration
*   **Delays**: Adjust the Min and Max delay (in seconds) in the Settings panel.
*   **API Key**: Your OpenRouter API key is saved locally for convenience.

## 🔒 Privacy
This extension runs entirely locally on your machine. Your API keys and data are stored in your browser's local storage and are never sent to external servers (except for the necessary API calls to OpenRouter for AI features).

---
*Built for efficiency and simplicity.*
