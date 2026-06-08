const STATUS_COPY = {
    ready: {
        pillClass: 'active',
        label: 'Active',
        title: 'Active',
        message: 'Skip segments loaded for the current video.',
        showRetry: false,
        showCard: true,
    },
    pending: {
        pillClass: 'pending',
        label: 'Pending',
        title: 'Analysis in progress',
        message: 'Waiting for skip segments from your server...',
        showRetry: false,
        showCard: true,
    },
    failed: {
        pillClass: 'failed',
        label: 'Failed',
        title: 'Analysis failed',
        message: null,
        showRetry: true,
        showCard: true,
    },
    idle: {
        pillClass: 'idle',
        label: 'Inactive',
        title: 'Not watching a video',
        message: 'Open a YouTube watch page to analyze skip segments.',
        showRetry: false,
        showCard: false,
    },
};

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

function updatePausedPill() {
    const pill = document.getElementById('status-pill');
    const label = document.getElementById('status-label');
    pill.className = 'status-pill paused';
    label.textContent = 'Paused';
    document.getElementById('analysis-status').hidden = true;
}

function updateAnalysisUI(state, skippingEnabled = true) {
    if (skippingEnabled === false && state?.status === 'ready') {
        updatePausedPill();
        return;
    }

    const status = state?.status || 'idle';
    const copy = STATUS_COPY[status] || STATUS_COPY.idle;

    const pill = document.getElementById('status-pill');
    const label = document.getElementById('status-label');
    pill.className = 'status-pill ' + copy.pillClass;
    label.textContent = copy.label;

    const section = document.getElementById('analysis-status');
    const titleEl = document.getElementById('status-title');
    const messageEl = document.getElementById('status-message');
    const retryBtn = document.getElementById('retry');

    if (!copy.showCard) {
        section.hidden = true;
        return;
    }

    section.hidden = false;
    section.className = 'status-card ' + (status === 'ready' ? 'ready' : status);
    setStatusIcon(status === 'ready' ? 'ready' : status);
    titleEl.textContent = copy.title;
    messageEl.textContent = state.error || copy.message;

    retryBtn.hidden = !copy.showRetry;
    retryBtn.disabled = !copy.showRetry;
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

function refreshAnalysisStatus(skippingEnabled = true) {
    return sendToActiveTab({ type: 'get-status' })
        .then((state) => {
            updateAnalysisUI(state || { status: 'idle' }, skippingEnabled);
        })
        .catch(() => {
            updateAnalysisUI({ status: 'idle' }, skippingEnabled);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    const serverInput = document.getElementById('server');
    const notifySelect = document.getElementById('notify-level');
    const skippingToggle = document.getElementById('skipping-enabled');
    const storage = getStorage();
    let skippingEnabled = true;

    storage.get(['server', 'notifyLevel', 'skippingEnabled']).then((result) => {
        if (result.server) {
            serverInput.value = result.server;
        }
        if (result.notifyLevel) {
            notifySelect.value = result.notifyLevel;
        }
        skippingEnabled = result.skippingEnabled !== false;
        skippingToggle.checked = skippingEnabled;
        refreshAnalysisStatus(skippingEnabled);
    });

    document.getElementById('save').addEventListener('click', () => {
        const server = serverInput.value.trim().replace(/\/+$/, '');
        storage.set({
            server,
            notifyLevel: notifySelect.value,
            skippingEnabled: skippingToggle.checked,
        }).then(() => {
            serverInput.value = server;
            skippingEnabled = skippingToggle.checked;
            showToast('Settings saved', 'success');
            refreshAnalysisStatus(skippingEnabled);
        });
    });

    notifySelect.addEventListener('change', () => {
        storage.set({ notifyLevel: notifySelect.value }).then(() => {
            showToast('Notification preference saved', 'success');
        });
    });

    skippingToggle.addEventListener('change', () => {
        skippingEnabled = skippingToggle.checked;
        storage.set({ skippingEnabled }).then(() => {
            showToast(skippingEnabled ? 'Auto-skip enabled' : 'Auto-skip paused', 'success');
            refreshAnalysisStatus(skippingEnabled);
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
            updateAnalysisUI(message, skippingEnabled);
        }
    });
});
