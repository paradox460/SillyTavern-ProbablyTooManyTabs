// st-mobile-styles.js
// Blocks SillyTavern's default mobile stylesheet while PTMT owns layout.

import { trackObserver } from './utils.js';

const MOBILE_STYLESHEET_MATCH = '/css/mobile-styles.css';

function isDefaultMobileStylesheet(node) {
    if (!(node instanceof HTMLLinkElement)) return false;
    const href = node.getAttribute('href') || node.href || '';
    return href.includes(MOBILE_STYLESHEET_MATCH) || href.endsWith('css/mobile-styles.css');
}

function killMobileStylesheet(link) {
    link.disabled = true;
    link.media = 'not all';
    link.remove();
}

function killExistingMobileStylesheets(root = document) {
    root.querySelectorAll?.('link[rel="stylesheet"], link[href]').forEach(link => {
        if (isDefaultMobileStylesheet(link)) killMobileStylesheet(link);
    });
}

export function initStMobileStylesBlocker() {
    killExistingMobileStylesheets();

    const observer = trackObserver(new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (isDefaultMobileStylesheet(node)) {
                    killMobileStylesheet(node);
                    continue;
                }
                killExistingMobileStylesheets(node);
            }
        }
    }));

    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
}
