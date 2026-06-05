importScripts('ext.js');

const STATUS_META = {
    ready: { label: 'Active', color: '#22c55e' },
    pending: { label: 'Pending', color: '#eab308' },
    failed: { label: 'Failed', color: '#ef4444' },
    idle: { label: 'Inactive', color: null },
};

function updateBadge(status) {
    const meta = STATUS_META[status] || STATUS_META.idle;

    if (!meta.color) {
        ext.action.setBadgeText({ text: '' });
        ext.action.setTitle({ title: 'Skippy' });
        return;
    }

    ext.action.setBadgeBackgroundColor({ color: meta.color });
    ext.action.setBadgeText({ text: ' ' });
    ext.action.setTitle({ title: 'Skippy — ' + meta.label });
}

ext.runtime.onMessage.addListener((message) => {
    if (message.type === 'analysis-status') {
        updateBadge(message.status);
    }
});
