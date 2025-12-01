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
        // If we are waiting for a tab, and this is it (or we just started), proceed
        // We add a small retry if activeTabId is not set yet (race condition)
        if (!activeTabId) {
            setTimeout(() => {
                if (activeTabId && sender.tab.id === activeTabId) {
                    handleContentScriptReady(sender.tab.id);
                }
            }, 500);
        } else if (sender.tab.id === activeTabId) {
            handleContentScriptReady(sender.tab.id);
        }
    } else if (request.action === 'POST_SUCCESS') {
        // Allow success from the active tab
        if (activeTabId && sender.tab.id === activeTabId) {
            handlePostSuccess();
        }
    } else if (request.action === 'POST_ERROR') {
        if (activeTabId && sender.tab.id === activeTabId) {
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
        if (!result.isRunning) {
            console.log('processNextTweet: isRunning is false, aborting.');
            return;
        }

        const mode = result.mode || 'text';
        const index = result.currentIndex || 0;

        let items = [];
        if (mode === 'images') {
            items = result.imageTweets || [];
        } else {
            items = result.tweets || [];
        }

        console.log(`Processing next tweet. Mode: ${mode}, Index: ${index}, Total Items: ${items.length}`);

        if (items.length === 0) {
            log('Error: No tweets found in queue. Stopping.');
            stopPosting();
            return;
        }

        if (index >= items.length) {
            log('All items posted! Stopping.');
            stopPosting();
            return;
        }

        const item = items[index];

        // Check for scheduled time
        if (mode === 'images' && item.scheduledTime) {
            const targetTime = new Date(item.scheduledTime).getTime();
            const now = Date.now();
            const delayMs = targetTime - now;

            if (delayMs > 0) {
                const delayMinutes = Math.max(0.1, delayMs / 60000); // Min 0.1 min
                log(`Scheduled post. Waiting until ${new Date(targetTime).toLocaleTimeString()}...`);
                chrome.alarms.create('nextPost', { delayInMinutes: delayMinutes });
                return;
            }
        }

        let desc = '';
        if (mode === 'images') {
            desc = `Image ${index + 1}`;
        } else {
            const text = typeof item === 'object' ? item.content : item;
            desc = `"${text.substring(0, 20)}..."`;
        }
        log(`Preparing to post ${desc} (${index + 1}/${items.length})`);

        // Open X.com compose page
        chrome.tabs.create({ url: 'https://x.com/compose/tweet' }, (tab) => {
            activeTabId = tab.id;
            console.log(`Opened tab ${tab.id} for posting.`);
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
                const text = typeof item === 'object' ? item.content : item;
                payload = {
                    action: 'DO_POST',
                    text: text
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

    chrome.storage.local.get(['tweets', 'imageTweets', 'mode', 'currentIndex', 'minDelay', 'maxDelay', 'dailyStats'], (result) => {
        // Update Stats
        const mode = result.mode || 'text';
        const index = result.currentIndex || 0;
        let type = 'text';

        if (mode === 'images') {
            type = 'image';
        } else {
            const items = result.tweets || [];
            const item = items[index];
            if (typeof item === 'object' && item.type) {
                type = item.type;
            }
        }

        const today = new Date().toISOString().split('T')[0];
        const stats = result.dailyStats || {};
        if (!stats[today]) stats[today] = { text: 0, image: 0, ai: 0 };

        if (type === 'ai') stats[today].ai++;
        else if (type === 'image') stats[today].image++;
        else stats[today].text++;

        const nextIndex = index + 1;

        chrome.storage.local.set({
            currentIndex: nextIndex,
            dailyStats: stats
        }, () => {
            // Check if next item is scheduled
            let nextDelay = 0;

            // Default random delay
            const min = result.minDelay || 29;
            const max = result.maxDelay || 70;
            nextDelay = Math.floor(Math.random() * (max - min + 1) + min);

            // If next item is scheduled, processNextTweet will handle the wait
            // But we still need to trigger it.
            // If we trigger it immediately, processNextTweet will check the schedule.
            // However, we usually want at least the min delay between actions to be safe.

            log(`Waiting ${nextDelay} seconds before next check...`);
            chrome.alarms.create('nextPost', { delayInMinutes: nextDelay / 60 });
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
        const tabIdToClose = activeTabId;
        activeTabId = null; // Clear global immediately so we don't track it anymore

        // Wait 30 seconds before closing the tab
        setTimeout(() => {
            chrome.tabs.remove(tabIdToClose).catch(() => { });
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
        // Limit logs to last 100 to prevent storage issues
        if (logs.length > 100) logs.shift();
        chrome.storage.local.set({ logs });
    });
}
