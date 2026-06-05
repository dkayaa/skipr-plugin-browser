function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.hidden = false;

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toast.hidden = true;
    }, 2500);
}

function setStatusIcon(kind) {
    const icon = document.getElementById('status-icon');
    if (kind === 'pending') {
        icon.innerHTML = '<div class="spinner"></div>';
        return;
    }
    if (kind === 'failed') {
        icon.textContent = '!';
        return;
    }
    if (kind === 'ready') {
        icon.textContent = '\u2713';
        return;
    }
    icon.textContent = '';
}

function updateAnalysisUI(state) {
    const section = document.getElementById('analysis-status');
    const titleEl = document.getElementById('status-title');
    const messageEl = document.getElementById('status-message');
    const retryBtn = document.getElementById('retry');

    if (state.status === 'failed') {
        section.hidden = false;
        section.className = 'status-card failed';
        setStatusIcon('failed');
        titleEl.textContent = 'Analysis failed';
        messageEl.textContent = state.error || 'Something went wrong while analyzing this video.';
        retryBtn.hidden = false;
        retryBtn.disabled = false;
        return;
    }

    if (state.status === 'pending') {
        section.hidden = false;
        section.className = 'status-card pending';
        setStatusIcon('pending');
        titleEl.textContent = 'Analysis in progress';
        messageEl.textContent = 'Waiting for skip segments from your server...';
        retryBtn.hidden = true;
        return;
    }

    if (state.status === 'ready') {
        section.hidden = false;
        section.className = 'status-card ready';
        setStatusIcon('ready');
        titleEl.textContent = 'Ready to skip';
        messageEl.textContent = 'Skip segments loaded for the current video.';
        retryBtn.hidden = true;
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
            if (state && state.status !== 'idle') {
                updateAnalysisUI(state);
            }
        })
        .catch(() => {
            document.getElementById('analysis-status').hidden = true;
        });
}

document.addEventListener('DOMContentLoaded', () => {
    const serverInput = document.getElementById('server');
    const storage = getStorage();

    storage.get('server').then((result) => {
        if (result.server) {
            serverInput.value = result.server;
        }
    });

    document.getElementById('save').addEventListener('click', () => {
        const server = serverInput.value.trim().replace(/\/+$/, '');
        storage.set({ server }).then(() => {
            serverInput.value = server;
            showToast('Server URL saved', 'success');
        });
    });

    serverInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            document.getElementById('save').click();
        }
    });

    document.getElementById('retry').addEventListener('click', () => {
        sendToActiveTab({ type: 'retry-analysis' })
            .then((response) => {
                if (!response?.ok) {
                    showToast(response?.error || 'Could not retry', 'error');
                    return;
                }
                updateAnalysisUI({ status: 'pending', error: null });
            })
            .catch(() => {
                showToast('Open a YouTube watch page first', 'error');
            });
    });

    ext.runtime.onMessage.addListener((message) => {
        if (message.type === 'analysis-status') {
            updateAnalysisUI(message);
        }
    });

    refreshAnalysisStatus();
});
