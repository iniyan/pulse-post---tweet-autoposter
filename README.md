# PulsePost - Automated X (Twitter) Poster

PulsePost is a powerful Chrome Extension designed to automate your X (formerly Twitter) posting workflow. It allows you to schedule and post text tweets and image tweets (with captions) from a CSV file or bulk image selection, all with randomized time delays to mimic human behavior.

## Features

*   **Automated Posting**: Posts tweets automatically without using the X API.
*   **Text & Image Support**:
    *   **Text Mode**: Upload a CSV file with tweets.
    *   **Image Mode**: Select up to 30 images, add captions to each, and post them sequentially.
*   **Human-Like Delays**: Set a minimum and maximum time gap (e.g., 30s - 70s) to randomize posting intervals.
*   **Smart Automation**: Uses advanced DOM manipulation to simulate human typing and pasting, ensuring high reliability and bypassing common automation detection.
*   **Dashboard Interface**: A clean, tabbed interface to manage your queue and view logs.
*   **Background Operation**: Runs in the background (opens a tab, posts, and closes it automatically).

## Installation

Since this is a custom extension, you need to load it manually into Chrome:

1.  **Download/Clone** this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** using the toggle in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the folder containing the PulsePost code (the folder with `manifest.json`).
6.  The **PulsePost** icon should appear in your toolbar.

## Usage

### Text Tweets
1.  Click the PulsePost extension icon to open the Dashboard.
2.  Ensure you are on the **Text Tweets** tab.
3.  **Upload CSV**: Select a `.csv` file containing your tweets.
    *   *Format*: One tweet per line.
4.  **Set Delays**: Adjust the Min and Max delay (in seconds) to control the gap between tweets.
5.  Click **Start Posting**.

### Image Tweets
1.  Click the PulsePost extension icon.
2.  Switch to the **Image Tweets** tab.
3.  Click **Select Images** and choose up to 30 images from your computer.
4.  (Optional) Add a caption for each image in the text box next to the preview.
5.  **Set Delays**: Adjust the Min and Max delay.
6.  Click **Start Posting**.

## How It Works
*   The extension opens a new tab to `x.com/compose/tweet`.
*   It automatically uploads your image or types your text.
*   It clicks the "Post" button.
*   It waits for the specified delay before processing the next item in the queue.
*   **Note**: You must be logged into X.com in your browser for this to work.

## Troubleshooting
*   **Text not appearing?** The extension uses a clipboard simulation to insert text reliably. Ensure you grant clipboard permissions if asked.
*   **Stuck?** Check the "Logs" section in the Dashboard for error messages. You can also reload the extension to reset the state.

## Privacy
This extension runs entirely locally on your machine. No data is sent to any external servers. Your cookies and session data remain in your browser.
