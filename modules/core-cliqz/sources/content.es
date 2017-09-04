import { registerContentScript } from '../core/content/helpers';
import prefs from '../core/prefs';

const SPECIAL_KEYS = [8, 9, 13, 16, 17, 18, 19, 20, 27, 33, 34, 35, 36, 37, 38, 39, 40, 91, 224];

function queryCliqz(q, windowId) {
  chrome.runtime.sendMessage({
    windowId,
    payload: {
      module: 'core',
      action: 'queryCliqz',
      args: [
        decodeURIComponent(q)
      ],
    },
  });
}

function addListeners(window, windowId, targetID) {
  const target = window.document.getElementById(targetID);
  if (!target) return;

  target.addEventListener('keydown', (ev) => {
    if (SPECIAL_KEYS.indexOf(ev.which) !== -1) return;

    queryCliqz(ev.key, windowId);
    target.parentElement.style.visibility = 'hidden';
    ev.preventDefault();
  });

  window.addEventListener('click', () => {
    target.parentElement.style.visibility = 'visible';
  });
}

function interceptKeyDown(window, windowId, targetID) {
  if (prefs.get('focusUrlbar', 0) !== 1) {
    return;
  }

  if (window.document && window.document.readyState === 'complete') {
    addListeners(window, windowId, targetID);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      addListeners(window, windowId, targetID);
    });
  }
}

registerContentScript('about:newtab', (window, _, windowId) => {
  interceptKeyDown(window, windowId, 'newtab-search-text');
});

registerContentScript('about:home', (window, _, windowId) => {
  interceptKeyDown(window, windowId, 'searchText');
});
