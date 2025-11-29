let activeTabId = null;

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'dashboard.html' });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_POSTING') {
        startPosting();
    } else if (request.action === 'STOP_POSTING') {
        stopPosting();
    } else if (request.action === 'CONTENT_SCRIPT_READY') {
        if (sender.tab.id === activeTabId) {
            handleContentScriptReady(sender.tab.id);
        }
    } else if (request.action === 'POST_SUCCESS') {
        if (sender.tab.id === activeTabId) {
            handlePostSuccess();
        }
    } else if (request.action === 'POST_ERROR') {
        if (sender.tab.id === activeTabId) {
            handlePostError(request.message);
        }
    }
});

function startPosting() {
    chrome.storage.local.set({ isRunning: true }, () => {
        log('Started posting process.');
        processNextTweet();
    });
}

function stopPosting() {
    chrome.storage.local.set({ isRunning: false }, () => {
        log('Stopped posting process.');
        if (activeTabId) {
            chrome.tabs.remove(activeTabId).catch(() => { });
            activeTabId = null;
        }
        chrome.alarms.clearAll();
    });
}

function processNextTweet() {
    chrome.storage.local.get(['tweets', 'imageTweets', 'mode', 'currentIndex', 'isRunning'], (result) => {
        if (!result.isRunning) return;

        const mode = result.mode || 'text';
        const index = result.currentIndex || 0;

        let items = [];
        if (mode === 'images') {
            items = result.imageTweets || [];
        } else {
            items = result.tweets || [];
        }

        if (index >= items.length) {
            log('All items posted!');
            stopPosting();
            return;
        }

        const item = items[index];
        const desc = mode === 'images' ? `Image ${index + 1}` : `"${item.substring(0, 20)}..."`;
        log(`Preparing to post ${desc} (${index + 1}/${items.length})`);

        // Open X.com compose page
        chrome.tabs.create({ url: 'https://x.com/compose/tweet' }, (tab) => {
            activeTabId = tab.id;
            // We wait for CONTENT_SCRIPT_READY message
        });
    });
}

function handleContentScriptReady(tabId) {
    chrome.storage.local.get(['tweets', 'imageTweets', 'mode', 'currentIndex'], (result) => {
        const mode = result.mode || 'text';
        const index = result.currentIndex || 0;

        let payload = {};

        if (mode === 'images') {
            const items = result.imageTweets || [];
            const item = items[index];
            if (item) {
                payload = {
                    action: 'DO_POST_IMAGE',
                    data: item.data, // base64
                    type: item.type,
                    caption: item.caption
                };
            }
        } else {
            const items = result.tweets || [];
            const item = items[index];
            if (item) {
                payload = {
                    action: 'DO_POST',
                    text: item
                };
            }
        }

        if (payload.action) {
            // Small delay to ensure UI is fully interactive
            setTimeout(() => {
                chrome.tabs.sendMessage(tabId, payload).catch(err => {
                    log('Error sending message to tab: ' + err.message);
                    handlePostError('Failed to communicate with tab');
                });
            }, 2000);
        }
    });
}

function handlePostSuccess() {
    log('Posted successfully.');
    closeActiveTab();

    chrome.storage.local.get(['currentIndex', 'minDelay', 'maxDelay'], (result) => {
        const nextIndex = (result.currentIndex || 0) + 1;
        chrome.storage.local.set({ currentIndex: nextIndex }, () => {
            const min = result.minDelay || 29;
            const max = result.maxDelay || 70;
            const delay = Math.floor(Math.random() * (max - min + 1) + min);

            log(`Waiting ${delay} seconds before next post...`);

            // Use alarms for the delay
            chrome.alarms.create('nextPost', { delayInMinutes: delay / 60 });
        });
    });
}

function handlePostError(msg) {
    log(`Error posting: ${msg}`);
    closeActiveTab();

    chrome.storage.local.get(['currentIndex', 'minDelay', 'maxDelay'], (result) => {
        const nextIndex = (result.currentIndex || 0) + 1;
        chrome.storage.local.set({ currentIndex: nextIndex }, () => {
            const min = result.minDelay || 29;
            const max = result.maxDelay || 70;
            const delay = Math.floor(Math.random() * (max - min + 1) + min);
            log(`Skipping to next in ${delay}s...`);
            chrome.alarms.create('nextPost', { delayInMinutes: delay / 60 });
        });
    });
}

function closeActiveTab() {
    if (activeTabId) {
        // Wait 30 seconds before closing the tab
        setTimeout(() => {
            if (activeTabId) {
                chrome.tabs.remove(activeTabId).catch(() => { });
                activeTabId = null;
            }
        }, 30000);
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'nextPost') {
        processNextTweet();
    }
});

function log(message) {
    chrome.storage.local.get(['logs'], (result) => {
        const logs = result.logs || [];
        logs.push({ timestamp: Date.now(), message });
        chrome.storage.local.set({ logs });
    });
}
