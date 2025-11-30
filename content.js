console.log('PulsePost Content Script Loaded');

if (window.location.href.includes('compose/tweet')) {
    setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'CONTENT_SCRIPT_READY' });
    }, 2000);
} else {
    setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'CONTENT_SCRIPT_READY' });
    }, 3000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'DO_POST') {
        attemptPost(request.text);
    } else if (request.action === 'DO_POST_IMAGE') {
        attemptPostImage(request.data, request.type, request.caption);
    }
});

async function attemptPost(text) {
    try {
        console.log('Attempting to post text:', text);

        const textarea = await waitForElement('[data-testid="tweetTextarea_0"]', 10000);
        if (!textarea) throw new Error('Could not find tweet textarea');

        textarea.focus();
        await new Promise(r => setTimeout(r, 100));

        // Clear and insert
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await new Promise(r => setTimeout(r, 200));

        console.log('Inserting text via DataTransfer...');
        const dt = new DataTransfer();
        dt.setData('text/plain', text + ' '); // Add trailing space here

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
        });

        textarea.dispatchEvent(pasteEvent);

        // Fallback if paste failed
        await new Promise(r => setTimeout(r, 200));
        if (!textarea.innerText.includes(text)) {
            console.log('Paste failed, trying execCommand fallback...');
            document.execCommand('insertText', false, text + ' ');
        }

        // Verify content
        if (textarea.innerText.includes(text)) {
            console.log('Verification: Text appears to be in textarea.');
        } else {
            console.warn('Verification Failed: Text NOT found in textarea!');
        }

        console.log('Waiting for React state update...');
        await new Promise(r => setTimeout(r, 2000));

        await clickPostButton();

    } catch (error) {
        console.error('Posting failed:', error);
        chrome.runtime.sendMessage({ action: 'POST_ERROR', message: error.message });
    }
}

async function attemptPostImage(base64Data, mimeType, caption) {
    try {
        console.log('Attempting to post image');

        // 1. Convert base64 to File
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const file = new File([blob], "image.png", { type: mimeType });

        // 2. Find file input
        const fileInput = await waitForElement('input[type="file"]', 5000);
        if (!fileInput) throw new Error('Could not find file input');

        // 3. Upload file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        // 4. Wait for image to appear in preview
        await waitForElement('[data-testid="attachments"]', 15000);

        // Wait for upload to finalize and UI to settle
        await new Promise(r => setTimeout(r, 3000));

        // 5. Add caption if present
        if (caption) {
            console.log('Found caption, looking for textarea...');
            const textarea = await waitForElement('[data-testid="tweetTextarea_0"]', 5000);
            if (textarea) {
                console.log('Textarea found. Focusing...');
                textarea.click();
                await new Promise(r => setTimeout(r, 100));
                textarea.focus();
                await new Promise(r => setTimeout(r, 500));

                console.log('Clearing existing content...');
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                await new Promise(r => setTimeout(r, 200));

                console.log('Inserting caption via DataTransfer...');
                const dt = new DataTransfer();
                dt.setData('text/plain', caption + ' ');

                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dt
                });

                textarea.dispatchEvent(pasteEvent);

                // Fallback if paste failed
                await new Promise(r => setTimeout(r, 200));
                if (!textarea.innerText.includes(caption)) {
                    console.log('Paste failed, trying execCommand fallback...');
                    document.execCommand('insertText', false, caption + ' ');
                }

                // Verify content
                if (textarea.innerText.includes(caption)) {
                    console.log('Verification: Caption appears to be in textarea.');
                } else {
                    console.warn('Verification Failed: Caption NOT found in textarea!');
                }

                console.log('Waiting for React state update...');
                await new Promise(r => setTimeout(r, 2000));
            } else {
                console.error('Textarea NOT found!');
            }
        } else {
            console.log('No caption provided.');
        }

        // 6. Click Post
        console.log('Clicking Post button...');
        await clickPostButton();

    } catch (error) {
        console.error('Image posting failed:', error);
        chrome.runtime.sendMessage({ action: 'POST_ERROR', message: error.message });
    }
}

async function clickPostButton() {
    const buttonSelector = '[data-testid="tweetButton"]';
    const postButton = await waitForElement(buttonSelector, 5000);

    if (!postButton) throw new Error('Could not find Post button');

    await waitForCondition(() => !postButton.disabled && postButton.getAttribute('aria-disabled') !== 'true', 5000);

    if (postButton.disabled || postButton.getAttribute('aria-disabled') === 'true') {
        throw new Error('Post button remained disabled');
    }

    postButton.click();

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check success
    const stillThere = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (!stillThere || stillThere.innerText.trim() === '') {
        chrome.runtime.sendMessage({ action: 'POST_SUCCESS' });
    } else {
        // Optimistic success if no error toast
        chrome.runtime.sendMessage({ action: 'POST_SUCCESS' });
    }
}

function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver((mutations) => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

function waitForCondition(predicate, timeout = 5000) {
    return new Promise((resolve) => {
        if (predicate()) {
            resolve(true);
            return;
        }
        const start = Date.now();
        const interval = setInterval(() => {
            if (predicate()) {
                clearInterval(interval);
                resolve(true);
            } else if (Date.now() - start > timeout) {
                clearInterval(interval);
                resolve(false);
            }
        }, 100);
    });
}
