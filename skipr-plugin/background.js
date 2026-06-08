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

ext.runtime.onMessage.addListener((message) => {
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
