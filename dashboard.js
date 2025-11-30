document.addEventListener('DOMContentLoaded', () => {
  const csvInput = document.getElementById('csvFile');
  const fileName = document.getElementById('fileName');
  const manualTweetsList = document.getElementById('manualTweetsList');
  const addMoreTweetsBtn = document.getElementById('addMoreTweetsBtn');
  const imageInput = document.getElementById('imageInput');
  const imageCount = document.getElementById('imageCount');
  const imageList = document.getElementById('imageList');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const minDelayInput = document.getElementById('minDelay');
  const maxDelayInput = document.getElementById('maxDelay');
  const statusDiv = document.getElementById('status');
  const progressDiv = document.getElementById('progress');
  const logsDiv = document.getElementById('logs');
  const clearLogsBtn = document.getElementById('clearLogs');
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const progressCount = document.getElementById('progressCount');
  const progressBar = document.getElementById('progressBar');

  let currentMode = 'text'; // 'text' or 'images'
  let selectedImages = []; // Array of { file, caption }
  let csvTweets = []; // Store CSV tweets locally

  // Load saved state
  chrome.storage.local.get(['isRunning', 'tweets', 'imageTweets', 'mode', 'currentIndex', 'logs', 'minDelay', 'maxDelay'], (result) => {
    if (result.minDelay) minDelayInput.value = result.minDelay;
    if (result.maxDelay) maxDelayInput.value = result.maxDelay;

    // Restore mode
    if (result.mode) {
      switchTab(result.mode);
    }

    // Restore running state
    if (result.isRunning) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      // If we have data loaded, enable start
      if ((result.mode === 'text' && result.tweets && result.tweets.length > 0) ||
        (result.mode === 'images' && result.imageTweets && result.imageTweets.length > 0)) {
        startBtn.disabled = false;
      }
    }

    if (result.tweets && result.tweets.length > 0) {
      fileName.textContent = `Loaded ${result.tweets.length} tweets`;
    }

    if (result.logs) {
      renderLogs(result.logs);
    }

    updateStatus(result);
  });

  // Initialize manual tweets
  function addManualTweetInputs(count = 5) {
    for (let i = 0; i < count; i++) {
      const textarea = document.createElement('textarea');
      textarea.className = 'manual-tweet-input image-caption'; // Reuse styling
      textarea.style.width = '100%';
      textarea.style.marginBottom = '10px';
      textarea.placeholder = 'Enter tweet text...';

      // Enable start button on input
      textarea.addEventListener('input', checkStartButtonState);

      manualTweetsList.appendChild(textarea);
    }
  }

  function checkStartButtonState() {
    if (currentMode === 'text') {
      const manualInputs = document.querySelectorAll('.manual-tweet-input');
      const hasManualText = Array.from(manualInputs).some(input => input.value.trim().length > 0);
      startBtn.disabled = !(csvTweets.length > 0 || hasManualText);
    }
  }

  addManualTweetInputs(5); // Add initial 5

  addMoreTweetsBtn.addEventListener('click', () => {
    addManualTweetInputs(5);
  });

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.tab;
      switchTab(mode);
    });
  });

  function switchTab(mode) {
    currentMode = mode;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
    tabContents.forEach(c => c.classList.toggle('active', c.id === `${mode}Tab`));

    // Check if we can start
    chrome.storage.local.get(['tweets', 'imageTweets', 'isRunning'], (result) => {
      if (result.isRunning) return; // Don't change buttons if running

      if (mode === 'text') {
        checkStartButtonState();
      } else {
        // For images, we check our local variable first, then storage
        startBtn.disabled = selectedImages.length === 0 && !(result.imageTweets && result.imageTweets.length > 0);
      }
    });
  }

  // Text CSV Handling
  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      fileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        csvTweets = parseCSV(text); // Store in local var
        log('Loaded ' + csvTweets.length + ' text tweets from ' + file.name);
        checkStartButtonState();
      };
      reader.readAsText(file);
    }
  });

  // Image Handling
  imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedImages.length > 30) {
      alert('You can only upload up to 30 images.');
      return;
    }

    files.forEach(file => {
      selectedImages.push({
        file: file,
        caption: ''
      });
    });

    renderImageList();
    updateImageCount();

    if (selectedImages.length > 0 && currentMode === 'images') {
      startBtn.disabled = false;
    }
  });

  function renderImageList() {
    imageList.innerHTML = '';
    selectedImages.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'image-item';

      const img = document.createElement('img');
      img.className = 'image-preview';
      img.src = URL.createObjectURL(item.file);

      const textarea = document.createElement('textarea');
      textarea.className = 'image-caption';
      textarea.placeholder = 'Enter caption...';
      textarea.value = item.caption;
      textarea.addEventListener('input', (e) => {
        item.caption = e.target.value;
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-image';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => {
        selectedImages.splice(index, 1);
        renderImageList();
        updateImageCount();
      };

      div.appendChild(img);
      div.appendChild(textarea);
      div.appendChild(removeBtn);
      imageList.appendChild(div);
    });
  }

  function updateImageCount() {
    imageCount.textContent = `${selectedImages.length} images selected`;
  }

  // Start/Stop
  startBtn.addEventListener('click', async () => {
    const minDelay = parseInt(minDelayInput.value, 10);
    const maxDelay = parseInt(maxDelayInput.value, 10);

    if (minDelay >= maxDelay) {
      alert('Min delay must be less than Max delay');
      return;
    }

    if (currentMode === 'images') {
      // Process images to base64 before saving
      if (selectedImages.length === 0) {
        // Check if we have saved images
        chrome.storage.local.get(['imageTweets'], (result) => {
          if (!result.imageTweets || result.imageTweets.length === 0) {
            alert('No images selected');
            return;
          }
          startPosting(minDelay, maxDelay);
        });
        return;
      }

      startBtn.disabled = true;
      startBtn.textContent = 'Processing Images...';

      try {
        const processedImages = await Promise.all(selectedImages.map(async (item) => {
          const base64 = await fileToBase64(item.file);
          return {
            data: base64,
            type: item.file.type,
            caption: item.caption
          };
        }));

        chrome.storage.local.set({
          imageTweets: processedImages,
          mode: 'images',
          currentIndex: 0,
          logs: []
        }, () => {
          startPosting(minDelay, maxDelay);
        });
      } catch (err) {
        console.error(err);
        alert('Error processing images');
        startBtn.disabled = false;
        startBtn.textContent = 'Start Posting';
      }
    } else {
      // Text mode
      // Collect manual tweets
      const manualInputs = document.querySelectorAll('.manual-tweet-input');
      const manualTweets = Array.from(manualInputs)
        .map(input => input.value.trim())
        .filter(text => text.length > 0);

      const allTweets = [...csvTweets, ...manualTweets];

      if (allTweets.length === 0) {
        alert('No tweets to post! Upload a CSV or enter text manually.');
        return;
      }

      console.log('Starting text posting with tweets:', allTweets);

      chrome.storage.local.set({
        tweets: allTweets,
        mode: 'text',
        currentIndex: 0,
        logs: []
      }, () => {
        startPosting(minDelay, maxDelay);
      });
    }
  });

  function startPosting(min, max) {
    chrome.storage.local.set({ minDelay: min, maxDelay: max }, () => {
      chrome.runtime.sendMessage({ action: 'START_POSTING' });
      startBtn.textContent = 'Start Posting'; // Reset text
    });
  }

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'STOP_POSTING' });
  });

  clearLogsBtn.addEventListener('click', () => {
    chrome.storage.local.set({ logs: [] });
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      chrome.storage.local.get(['isRunning', 'tweets', 'imageTweets', 'currentIndex', 'logs', 'mode'], (result) => {
        updateStatus(result);
        if (changes.logs) {
          renderLogs(result.logs);
        }
        if (changes.isRunning) {
          startBtn.disabled = result.isRunning;
          stopBtn.disabled = !result.isRunning;
        }
      });
    }
    // Check if we can start
    chrome.storage.local.get(['tweets', 'imageTweets', 'isRunning'], (result) => {
      if (result.isRunning) return; // Don't change buttons if running

      // Use the UI's current mode, not the stored mode (which might be old)
      if (currentMode === 'text') {
        checkStartButtonState();
      } else {
        // For images, we check our local variable first, then storage
        startBtn.disabled = selectedImages.length === 0 && !(result.imageTweets && result.imageTweets.length > 0);
      }
    });
  });

  function parseCSV(text) {
    const lines = text.split(/\r\n|\n/);
    const tweets = [];
    for (let line of lines) {
      line = line.trim();
      if (line) {
        if (line.startsWith('"') && line.endsWith('"')) {
          line = line.slice(1, -1);
        }
        line = line.replace(/""/g, '"');
        tweets.push(line);
      }
    }
    return tweets;
  }

  function updateStatus(state) {
    if (state.isRunning) {
      statusDiv.textContent = 'Running...';
      statusDiv.style.color = 'var(--success-color)';
    } else {
      statusDiv.textContent = 'Idle';
      statusDiv.style.color = '#8b98a5';
    }

    let total = 0;
    if (state.mode === 'images') {
      total = state.imageTweets ? state.imageTweets.length : 0;
    } else {
      total = state.tweets ? state.tweets.length : 0;
    }

    const current = state.currentIndex !== undefined ? state.currentIndex : 0;
    const displayCurrent = Math.min(current, total); // Don't show more than total

    // Update text
    progressDiv.textContent = `${state.mode === 'images' ? 'Images' : 'Tweets'}: ${displayCurrent}/${total}`;
    progressCount.textContent = `${displayCurrent}/${total}`;

    // Update bar
    const percent = total > 0 ? (displayCurrent / total) * 100 : 0;
    progressBar.style.width = `${percent}%`;
  }

  function renderLogs(logs) {
    logsDiv.innerHTML = '';
    if (!logs) return;
    [...logs].reverse().forEach(entry => {
      const div = document.createElement('div');
      div.className = 'log-entry';
      const time = new Date(entry.timestamp).toLocaleTimeString();
      div.innerHTML = `<span class="log-time">[${time}]</span> ${entry.message}`;
      logsDiv.appendChild(div);
    });
  }

  function log(message) {
    chrome.storage.local.get(['logs'], (result) => {
      const logs = result.logs || [];
      logs.push({ timestamp: Date.now(), message });
      chrome.storage.local.set({ logs });
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
});
