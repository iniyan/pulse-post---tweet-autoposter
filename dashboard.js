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

  // AI Elements
  const aiPrompt = document.getElementById('aiPrompt');
  const aiTweetCount = document.getElementById('aiTweetCount');
  const generateAiBtn = document.getElementById('generateAiBtn');
  const aiResults = document.getElementById('aiResults');
  const approveAiBtn = document.getElementById('approveAiBtn');

  // Report Elements
  const reportTable = document.getElementById('reportTable').querySelector('tbody');

  let currentMode = 'text'; // 'text', 'images', 'ai', 'reports'
  let selectedImages = []; // Array of { file, caption }
  let textTweets = []; // Store text tweets locally (objects: { content, type })

  // Load saved state
  chrome.storage.local.get(['isRunning', 'tweets', 'imageTweets', 'mode', 'currentIndex', 'logs', 'minDelay', 'maxDelay'], (result) => {
    if (result.minDelay) minDelayInput.value = result.minDelay;
    if (result.maxDelay) maxDelayInput.value = result.maxDelay;

    // Restore mode
    if (result.mode) {
      // If mode was 'ai' or 'reports', we might default to 'text' or handle it.
      // For now, let's respect it if it's a valid tab, otherwise default to text.
      if (['text', 'images', 'ai', 'reports'].includes(result.mode)) {
        switchTab(result.mode);
      } else {
        switchTab('text');
      }
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
      // Check if tweets are objects or strings (migration)
      textTweets = result.tweets.map(t => typeof t === 'string' ? { content: t, type: 'text' } : t);
      updateCsvUI();
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
      textarea.className = 'manual-tweet-input';
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
      startBtn.disabled = !(textTweets.length > 0 || hasManualText);
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

    // Toggle automation controls visibility
    const automationControls = document.getElementById('automationControls');
    if (mode === 'reports') {
      automationControls.style.display = 'none';
      loadReports();
    } else {
      automationControls.style.display = 'block';
    }

    // Check if we can start
    chrome.storage.local.get(['tweets', 'imageTweets', 'isRunning'], (result) => {
      if (result.isRunning) return; // Don't change buttons if running

      if (mode === 'text') {
        checkStartButtonState();
      } else if (mode === 'images') {
        startBtn.disabled = selectedImages.length === 0 && !(result.imageTweets && result.imageTweets.length > 0);
      }
      // AI tab doesn't directly enable start button until tweets are approved
    });
  }

  // Text CSV Handling
  const clearCsvBtn = document.getElementById('clearCsvBtn');

  function updateCsvUI() {
    const hasTextTweets = textTweets.some(t => t.type === 'text');
    if (hasTextTweets) {
      clearCsvBtn.style.display = 'block';
      if (fileName.textContent === 'No file chosen') {
        fileName.textContent = `Loaded ${textTweets.filter(t => t.type === 'text').length} tweets`;
      }
    } else {
      clearCsvBtn.style.display = 'none';
      fileName.textContent = 'No file chosen';
      csvInput.value = '';
    }
    checkStartButtonState();
  }

  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      fileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const parsed = parseCSV(text);
        // Filter out existing CSV tweets (type 'text') to replace them, but keep AI tweets
        const aiTweets = textTweets.filter(t => t.type === 'ai');
        const newCsvTweets = parsed.map(t => ({ content: t, type: 'text' }));

        textTweets = [...aiTweets, ...newCsvTweets];

        log('Loaded ' + newCsvTweets.length + ' text tweets from ' + file.name);
        updateCsvUI();
        // Update storage
        chrome.storage.local.set({ tweets: textTweets });
      };
      reader.readAsText(file);
    }
  });

  clearCsvBtn.addEventListener('click', () => {
    // Remove only CSV tweets (type 'text')
    textTweets = textTweets.filter(t => t.type === 'ai');
    updateCsvUI();
    // Update storage
    chrome.storage.local.set({ tweets: textTweets });
    log('Removed CSV tweets.');
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

      const contentDiv = document.createElement('div');
      contentDiv.className = 'image-content';

      const textarea = document.createElement('textarea');
      textarea.className = 'image-caption';
      textarea.placeholder = 'Enter caption...';
      textarea.value = item.caption;
      textarea.addEventListener('input', (e) => {
        item.caption = e.target.value;
      });

      // Schedule Controls
      const scheduleDiv = document.createElement('div');
      scheduleDiv.className = 'schedule-container';

      const scheduleBtn = document.createElement('button');
      scheduleBtn.className = `schedule-btn ${item.scheduledTime ? 'active' : ''}`;
      scheduleBtn.innerHTML = item.scheduledTime
        ? `📅 ${new Date(item.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : '📅 Schedule';

      const dateInput = document.createElement('input');
      dateInput.type = 'datetime-local';
      dateInput.className = `schedule-input ${item.scheduledTime ? 'visible' : ''}`;
      if (item.scheduledTime) {
        dateInput.value = item.scheduledTime;
      }

      scheduleBtn.onclick = () => {
        if (dateInput.classList.contains('visible')) {
          // If visible, hide it. If no value, clear active state
          dateInput.classList.remove('visible');
          if (!dateInput.value) {
            item.scheduledTime = null;
            scheduleBtn.classList.remove('active');
            scheduleBtn.innerHTML = '📅 Schedule';
          }
        } else {
          // Show it
          dateInput.classList.add('visible');
          dateInput.focus();
        }
      };

      dateInput.addEventListener('change', (e) => {
        item.scheduledTime = e.target.value;
        if (item.scheduledTime) {
          scheduleBtn.classList.add('active');
          scheduleBtn.innerHTML = `📅 ${new Date(item.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
          dateInput.classList.remove('visible'); // Hide after selection
        } else {
          scheduleBtn.classList.remove('active');
          scheduleBtn.innerHTML = '📅 Schedule';
        }
      });

      // Close input if clicking outside (optional polish, but let's keep it simple for now)

      scheduleDiv.appendChild(scheduleBtn);
      scheduleDiv.appendChild(dateInput);

      contentDiv.appendChild(textarea);
      contentDiv.appendChild(scheduleDiv);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-image';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => {
        selectedImages.splice(index, 1);
        renderImageList();
        updateImageCount();
      };

      div.appendChild(img);
      div.appendChild(contentDiv);
      div.appendChild(removeBtn);
      imageList.appendChild(div);
    });
  }

  function updateImageCount() {
    imageCount.textContent = `${selectedImages.length} images selected`;
  }

  // AI Elements
  const apiKeyInput = document.getElementById('apiKey');
  // Variables aiPrompt, aiTweetCount, etc. are already declared at the top of the file.
  // We just need to access apiKeyInput here.

  // ... (existing code)

  // Load saved state
  chrome.storage.local.get(['isRunning', 'tweets', 'imageTweets', 'mode', 'currentIndex', 'logs', 'minDelay', 'maxDelay', 'apiKey'], (result) => {
    if (result.minDelay) minDelayInput.value = result.minDelay;
    if (result.maxDelay) maxDelayInput.value = result.maxDelay;
    if (result.apiKey) apiKeyInput.value = result.apiKey;

    // ... (rest of load logic)
  });

  // Save API Key on change
  apiKeyInput.addEventListener('change', () => {
    chrome.storage.local.set({ apiKey: apiKeyInput.value.trim() });
  });

  // AI Generation
  generateAiBtn.addEventListener('click', async () => {
    const prompt = aiPrompt.value.trim();
    const count = parseInt(aiTweetCount.value, 10);
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert('Please enter your OpenRouter API Key.');
      return;
    }

    if (!prompt) {
      alert('Please enter a prompt.');
      return;
    }

    generateAiBtn.disabled = true;
    generateAiBtn.textContent = 'Generating...';
    aiResults.innerHTML = '';
    approveAiBtn.style.display = 'none';

    // Save key just in case
    chrome.storage.local.set({ apiKey });

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pulsepost.extension', // Optional
          'X-Title': 'PulsePost' // Optional
        },
        body: JSON.stringify({
          "model": "x-ai/grok-4.1-fast:free",
          "messages": [
            {
              "role": "system",
              "content": `You are a helpful social media assistant. Generate exactly ${count} tweets based on the user's prompt. Return ONLY the tweets, one per line. Do not number them. Do not include hashtags unless asked. Keep them under 280 characters.`
            },
            {
              "role": "user",
              "content": prompt
            }
          ]
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid API Key. Please check your key.');
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }

      const content = data.choices[0].message.content;
      const tweets = content.split('\n').filter(line => line.trim().length > 0);

      renderAiResults(tweets);
      approveAiBtn.style.display = 'block';

    } catch (error) {
      console.error(error);
      alert('Failed to generate tweets: ' + error.message);
    } finally {
      generateAiBtn.disabled = false;
      generateAiBtn.textContent = 'Generate Tweets';
    }
  });

  function renderAiResults(tweets) {
    aiResults.innerHTML = '';
    tweets.forEach((text, index) => {
      const div = document.createElement('div');
      div.className = 'ai-tweet-item';

      const textarea = document.createElement('textarea');
      textarea.value = text;

      const actions = document.createElement('div');
      actions.className = 'ai-tweet-actions';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'small-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.style.color = 'var(--error-color)';
      removeBtn.onclick = () => div.remove();

      actions.appendChild(removeBtn);
      div.appendChild(textarea);
      div.appendChild(actions);
      aiResults.appendChild(div);
    });
  }

  approveAiBtn.addEventListener('click', () => {
    const textareas = aiResults.querySelectorAll('textarea');
    const newTweets = Array.from(textareas).map(t => ({
      content: t.value.trim(),
      type: 'ai'
    })).filter(t => t.content.length > 0);

    if (newTweets.length === 0) {
      alert('No tweets to approve.');
      return;
    }

    // Add to textTweets
    textTweets = [...textTweets, ...newTweets];

    // Clear AI results
    aiResults.innerHTML = '';
    approveAiBtn.style.display = 'none';
    aiPrompt.value = '';

    // Switch to text tab to show they are ready (conceptually, though we don't list them all in UI)
    // Or just notify
    alert(`Approved ${newTweets.length} AI tweets! They have been added to the queue.`);
    log(`Approved ${newTweets.length} AI tweets.`);

    // Update storage immediately so they are saved
    chrome.storage.local.set({ tweets: textTweets });

    // Enable start button if we are in text mode
    checkStartButtonState();
  });

  // Reports
  function loadReports() {
    chrome.storage.local.get(['dailyStats'], (result) => {
      const stats = result.dailyStats || {};
      reportTable.innerHTML = '';

      // Sort dates descending
      const dates = Object.keys(stats).sort().reverse();

      if (dates.length === 0) {
        reportTable.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">No activity yet.</td></tr>';
        return;
      }

      dates.forEach(date => {
        const dayStats = stats[date];
        const total = (dayStats.text || 0) + (dayStats.image || 0) + (dayStats.ai || 0);

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${date}</td>
          <td>${dayStats.text || 0}</td>
          <td>${dayStats.image || 0}</td>
          <td>${dayStats.ai || 0}</td>
          <td><strong>${total}</strong></td>
        `;
        reportTable.appendChild(row);
      });
    });
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
            caption: item.caption,
            scheduledTime: item.scheduledTime // Pass scheduled time
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
      // Text mode (includes AI tweets if they were added to textTweets)
      // Collect manual tweets
      const manualInputs = document.querySelectorAll('.manual-tweet-input');
      const manualTweets = Array.from(manualInputs)
        .map(input => input.value.trim())
        .filter(text => text.length > 0)
        .map(text => ({ content: text, type: 'text' }));

      const allTweets = [...textTweets, ...manualTweets];

      if (allTweets.length === 0) {
        alert('No tweets to post! Upload a CSV, generate AI tweets, or enter text manually.');
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
      chrome.storage.local.get(['isRunning', 'tweets', 'imageTweets', 'currentIndex', 'logs', 'mode', 'dailyStats'], (result) => {
        updateStatus(result);
        if (changes.logs) {
          renderLogs(result.logs);
        }
        if (changes.isRunning) {
          startBtn.disabled = result.isRunning;
          stopBtn.disabled = !result.isRunning;
        }
        if (changes.dailyStats && currentMode === 'reports') {
          loadReports();
        }
      });
    }
    // Check if we can start
    chrome.storage.local.get(['tweets', 'imageTweets', 'isRunning'], (result) => {
      if (result.isRunning) return; // Don't change buttons if running

      // Use the UI's current mode
      if (currentMode === 'text') {
        checkStartButtonState();
      } else if (currentMode === 'images') {
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
      statusDiv.style.color = 'var(--text-secondary)';
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

  // Clear All Queues
  const clearAllBtn = document.getElementById('clearAllBtn');
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL queues (Text, Images, AI)? This cannot be undone.')) {
      // Clear local state
      textTweets = [];
      selectedImages = [];

      // Clear UI
      manualTweetsList.innerHTML = '';
      addManualTweetInputs(5);
      imageList.innerHTML = '';
      imageCount.textContent = '0 images selected';
      fileName.textContent = 'No file chosen';
      csvInput.value = '';
      updateCsvUI(); // Hides the clear CSV button

      // Clear storage
      chrome.storage.local.set({
        tweets: [],
        imageTweets: [],
        currentIndex: 0,
        logs: []
      }, () => {
        log('All queues cleared.');
        checkStartButtonState();
        startBtn.disabled = true;
      });
    }
  });

  // Helper: Create Action Buttons (Emoji & Hashtag)
  function createInputActions(textarea, type = 'text') {
    const container = document.createElement('div');
    container.className = 'input-actions';

    // Emoji Button
    const emojiBtn = document.createElement('button');
    emojiBtn.className = 'action-icon-btn emoji-trigger';
    emojiBtn.innerHTML = '😊';
    emojiBtn.title = 'Add Emoji';
    emojiBtn.onclick = (e) => {
      e.stopPropagation();
      toggleEmojiPicker(e, textarea);
    };

    // Hashtag Button
    const hashtagBtn = document.createElement('button');
    hashtagBtn.className = 'action-icon-btn hashtag-btn';
    hashtagBtn.innerHTML = '✨'; // Sparkles
    hashtagBtn.title = 'Generate Hashtags';
    hashtagBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        alert('Please enter some text first.');
        return;
      }

      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        alert('Please enter your OpenRouter API Key in the AI Tweets tab first.');
        switchTab('ai');
        return;
      }

      hashtagBtn.innerHTML = '<span class="loading-spinner">↻</span>';
      hashtagBtn.disabled = true;

      try {
        const tags = await generateHashtags(text, apiKey);
        if (tags) {
          textarea.value += ' ' + tags;
          textarea.dispatchEvent(new Event('input')); // Trigger updates
        }
      } catch (err) {
        console.error(err);
        alert('Failed to generate hashtags: ' + err.message);
      } finally {
        hashtagBtn.innerHTML = '✨';
        hashtagBtn.disabled = false;
      }
    };

    container.appendChild(emojiBtn);
    container.appendChild(hashtagBtn);
    return container;
  }

  // Emoji Picker Logic
  const emojis = ['😀', '😂', '🥰', '😍', '😎', '😭', '😡', '👍', '👎', '🔥', '✨', '❤️', '💯', '🚀', '👀', '🤔', '🎉', '🙏', '🙌', '💀', '🤡', '💩', '👻', '🤖'];
  let activePicker = null;

  function toggleEmojiPicker(event, textarea) {
    if (activePicker) {
      activePicker.remove();
      activePicker = null;
      return;
    }

    const picker = document.createElement('div');
    picker.className = 'emoji-picker';

    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-btn';
      btn.textContent = emoji;
      btn.onclick = () => {
        insertAtCursor(textarea, emoji);
        picker.remove();
        activePicker = null;
      };
      picker.appendChild(btn);
    });

    // Position logic
    const rect = event.target.getBoundingClientRect();
    picker.style.top = `${rect.bottom + window.scrollY + 5}px`;
    picker.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(picker);
    activePicker = picker;

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', closePickerOutside);
    }, 0);
  }

  function closePickerOutside(e) {
    if (activePicker && !activePicker.contains(e.target) && !e.target.classList.contains('emoji-trigger')) {
      activePicker.remove();
      activePicker = null;
      document.removeEventListener('click', closePickerOutside);
    }
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = value.substring(0, start) + text + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  async function generateHashtags(text, apiKey) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pulsepost.extension',
        'X-Title': 'PulsePost'
      },
      body: JSON.stringify({
        "model": "x-ai/grok-4.1-fast:free",
        "messages": [
          {
            "role": "system",
            "content": "You are a social media expert. Generate 3-5 relevant, trending hashtags for the given tweet text. Return ONLY the hashtags separated by spaces. No other text."
          },
          {
            "role": "user",
            "content": text
          }
        ]
      })
    });

    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // Update Manual Inputs to include actions
  function addManualTweetInputs(count = 5) {
    for (let i = 0; i < count; i++) {
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '15px';

      const textarea = document.createElement('textarea');
      textarea.className = 'manual-tweet-input';
      textarea.style.marginBottom = '5px'; // Reduced margin for actions
      textarea.placeholder = 'Enter tweet text...';
      textarea.addEventListener('input', checkStartButtonState);

      const actions = createInputActions(textarea);

      wrapper.appendChild(textarea);
      wrapper.appendChild(actions);
      manualTweetsList.appendChild(wrapper);
    }
  }

  // Update Image List to include actions
  function renderImageList() {
    imageList.innerHTML = '';
    selectedImages.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'image-item';

      const img = document.createElement('img');
      img.className = 'image-preview';
      img.src = URL.createObjectURL(item.file);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'image-content';

      const textarea = document.createElement('textarea');
      textarea.className = 'image-caption';
      textarea.placeholder = 'Enter caption...';
      textarea.value = item.caption;
      textarea.addEventListener('input', (e) => {
        item.caption = e.target.value;
      });

      // Actions (Emoji/Hashtag)
      const actionsDiv = createInputActions(textarea, 'image');

      // Schedule Controls
      const scheduleDiv = document.createElement('div');
      scheduleDiv.className = 'schedule-container';

      const scheduleBtn = document.createElement('button');
      scheduleBtn.className = `schedule-btn ${item.scheduledTime ? 'active' : ''}`;
      scheduleBtn.innerHTML = item.scheduledTime
        ? `📅 ${new Date(item.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : '📅 Schedule';

      const dateInput = document.createElement('input');
      dateInput.type = 'datetime-local';
      dateInput.className = `schedule-input ${item.scheduledTime ? 'visible' : ''}`;
      if (item.scheduledTime) {
        dateInput.value = item.scheduledTime;
      }

      scheduleBtn.onclick = () => {
        if (dateInput.classList.contains('visible')) {
          dateInput.classList.remove('visible');
          if (!dateInput.value) {
            item.scheduledTime = null;
            scheduleBtn.classList.remove('active');
            scheduleBtn.innerHTML = '📅 Schedule';
          }
        } else {
          dateInput.classList.add('visible');
          dateInput.focus();
        }
      };

      dateInput.addEventListener('change', (e) => {
        item.scheduledTime = e.target.value;
        if (item.scheduledTime) {
          scheduleBtn.classList.add('active');
          scheduleBtn.innerHTML = `📅 ${new Date(item.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
          dateInput.classList.remove('visible');
        } else {
          scheduleBtn.classList.remove('active');
          scheduleBtn.innerHTML = '📅 Schedule';
        }
      });

      scheduleDiv.appendChild(scheduleBtn);
      scheduleDiv.appendChild(dateInput);

      contentDiv.appendChild(textarea);
      contentDiv.appendChild(actionsDiv); // Add actions
      contentDiv.appendChild(scheduleDiv);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-image';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => {
        selectedImages.splice(index, 1);
        renderImageList();
        updateImageCount();
      };

      div.appendChild(img);
      div.appendChild(contentDiv);
      div.appendChild(removeBtn);
      imageList.appendChild(div);
    });
  }

  // Update AI Results to include actions
  function renderAiResults(tweets) {
    aiResults.innerHTML = '';
    tweets.forEach((text, index) => {
      const div = document.createElement('div');
      div.className = 'ai-tweet-item';

      const textarea = document.createElement('textarea');
      textarea.value = text;

      const actions = document.createElement('div');
      actions.className = 'ai-tweet-actions';

      // Add Emoji/Hashtag actions to AI tweets too
      const inputActions = createInputActions(textarea);
      inputActions.style.marginRight = 'auto'; // Push remove button to right

      const removeBtn = document.createElement('button');
      removeBtn.className = 'small-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.style.color = 'var(--error-color)';
      removeBtn.onclick = () => div.remove();

      actions.appendChild(inputActions);
      actions.appendChild(removeBtn);
      div.appendChild(textarea);
      div.appendChild(actions);
      aiResults.appendChild(div);
    });
  }
});
