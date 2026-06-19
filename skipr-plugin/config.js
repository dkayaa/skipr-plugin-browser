/* exported DEFAULT_API_BASE, normalizeApiUrl, resolveApiUrl */
const DEFAULT_API_BASE = 'https://skipr-plugin.com';

function normalizeApiUrl(url) {
    if (!url) {
        return '';
    }
    return url.trim().replace(/\/+$/, '');
}

function resolveApiUrl(storedServer) {
    const override = normalizeApiUrl(storedServer || '');
    return override || DEFAULT_API_BASE;
}
