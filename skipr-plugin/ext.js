const ext = typeof globalThis.browser !== "undefined" ? globalThis.browser : globalThis.chrome;

function getStorage() {
    return ext.storage.sync;
}
