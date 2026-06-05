function updateAnalysisUI(state) {
    const section = document.getElementById('analysis-status');
    const errorEl = document.getElementById('analysis-error');
    const retryBtn = document.getElementById('retry');

    if (state.status === 'failed') {
        section.hidden = false;
        errorEl.textContent = state.error || 'Analysis failed';
        errorEl.className = '';
        retryBtn.disabled = false;
        return;
    }

    if (state.status === 'pending') {
        section.hidden = false;
        errorEl.textContent = 'Analysis in progress…';
        errorEl.className = 'pending';
        retryBtn.disabled = true;
        return;
    }

    section.hidden = true;
}

function getActiveTab() {
    return ext.tabs.query({ active: true, currentWindow: true })
        .then((tabs) => tabs[0] || null);
}

function sendToActiveTab(message) {
    return getActiveTab().then((tab) => {
        if (!tab?.id) {
            throw new Error('No active tab');
        }
        return ext.tabs.sendMessage(tab.id, message);
    });
}

function refreshAnalysisStatus() {
    return sendToActiveTab({ type: 'get-status' })
        .then((state) => {
            if (state) {
                updateAnalysisUI(state);
            }
        })
        .catch(() => {
            document.getElementById('analysis-status').hidden = true;
        });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("[YouTube Tracker] Popup loaded.");

    const serverInput = document.getElementById('server');
    const statusDiv = document.getElementById('status');
    const storage = getStorage();

    storage.get('server').then((result) => {
        if (result.server) {
            serverInput.value = result.server;
        }
    });

    document.getElementById('save').addEventListener('click', () => {
        const server = serverInput.value;
        storage.set({ server }).then(() => {
            console.log("[YouTube Tracker] URL saved:", server);
            statusDiv.textContent = 'Saved!';
            setTimeout(() => statusDiv.textContent = '', 1500);
        });
    });

    document.getElementById('retry').addEventListener('click', () => {
        sendToActiveTab({ type: 'retry-analysis' })
            .then((response) => {
                if (!response?.ok) {
                    statusDiv.textContent = response?.error || 'Could not retry';
                    return;
                }
                updateAnalysisUI({ status: 'pending', error: null });
            })
            .catch(() => {
                statusDiv.textContent = 'Open a YouTube watch page first.';
            });
    });

    ext.runtime.onMessage.addListener((message) => {
        if (message.type === 'analysis-status') {
            updateAnalysisUI(message);
        }
    });

    refreshAnalysisStatus();
});
