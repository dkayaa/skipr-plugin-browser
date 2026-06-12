importScripts('ext.js');

const STATUS_META = {
    ready: { label: 'Active', color: '#22c55e' },
    pending: { label: 'Pending', color: '#eab308' },
    failed: { label: 'Failed', color: '#ef4444' },
    paused: { label: 'Paused', color: '#6b7280' },
    idle: { label: 'Inactive', color: null },
};

let lastAnalysisStatus = 'idle';
let skippingEnabled = true;

function updateBadge(status) {
    const meta = STATUS_META[status] || STATUS_META.idle;

    if (!meta.color) {
        ext.action.setBadgeText({ text: '' });
        ext.action.setTitle({ title: 'Skipr' });
        return;
    }

    ext.action.setBadgeBackgroundColor({ color: meta.color });
    ext.action.setBadgeText({ text: ' ' });
    ext.action.setTitle({ title: 'Skipr — ' + meta.label });
}

function applyBadge() {
    const status = (!skippingEnabled && lastAnalysisStatus === 'ready')
        ? 'paused'
        : lastAnalysisStatus;
    updateBadge(status);
}

function fetchTimestampsApi(url) {
    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    })
        .then((response) => response.json().then((data) => ({
            ok: true,
            status: response.status,
            data,
        })))
        .catch((error) => ({
            ok: false,
            error: error.message || 'Network request failed',
        }));
}

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'fetch-timestamps') {
        fetchTimestampsApi(message.url).then(sendResponse);
        return true;
    }

    if (message.type === 'skipping-enabled') {
        skippingEnabled = message.enabled !== false;
        applyBadge();
        return;
    }

    if (message.type === 'analysis-status') {
        lastAnalysisStatus = message.status || 'idle';
        applyBadge();
    }
});
