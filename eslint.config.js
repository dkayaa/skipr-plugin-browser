import js from '@eslint/js';
import globals from 'globals';

const extensionApiGlobals = {
    ext: 'readonly',
    getStorage: 'readonly',
};

const configGlobals = {
    DEFAULT_API_BASE: 'readonly',
    normalizeApiUrl: 'readonly',
    resolveApiUrl: 'readonly',
};

const notificationGlobals = {
    showSkipNotification: 'readonly',
    hideSkipToast: 'readonly',
};

export default [
    js.configs.recommended,
    {
        files: ['skipr-plugin/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['skipr-plugin/background.js'],
        languageOptions: {
            globals: {
                ...globals.serviceworker,
                ...extensionApiGlobals,
                importScripts: 'readonly',
            },
        },
    },
    {
        files: ['skipr-plugin/processor.js', 'skipr-plugin/popup.js'],
        languageOptions: {
            globals: {
                ...extensionApiGlobals,
                ...configGlobals,
            },
        },
    },
    {
        files: ['skipr-plugin/processor.js'],
        languageOptions: {
            globals: {
                ...notificationGlobals,
            },
        },
    },
];
