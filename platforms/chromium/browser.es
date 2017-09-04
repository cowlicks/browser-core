import { window, chrome } from './globals';

export class Window {
  constructor(window) {
    this.window = window;
  }
}

export function mapWindows() {
  return [window];
}


export function isTabURL() {
  return false;
}

export function getLang() {
  return window.navigator.language || window.navigator.userLanguage;
}

export function getBrowserMajorVersion() {
  const raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
  return raw ? parseInt(raw[2], 10) : false;
}

export function setInstallDatePref() { }
export function setOurOwnPrefs() { }
export function enableChangeEvents() {}

export function addWindowObserver() {}
export function removeWindowObserver() {}
export function forEachWindow(cb) {
  mapWindows().forEach(cb);
}
export function mustLoadWindow() {
  return true;
}

export function waitWindowReady(win) {
  return Promise.resolve();
}

export function newTab(url, active = false) {
  return new Promise((resolve) => {
    chrome.tabs.create(
      { url, active },
      (tab) => { console.error('new tab', tab); resolve(tab.id); },
    );
  });
}


export function closeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(Number(tabId), resolve);
  });
}


export function updateTab(tabId, url) {
  return new Promise((resolve) => {
    chrome.tabs.update(Number(tabId), { url }, resolve);
  });
}


export function getUrlForTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(Number(tabId), (result) => {
      if (chrome.runtime.lastError) {
        resolve(false);
      } else {
        resolve(result.url);
      }
    });
  });
}


export function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true }, (result) => {
      const tab = result[0];
      if (tab) {
        resolve({
          id: tab.id,
          url: tab.url,
        });
      } else {
        reject('Result of query for active tab is undefined');
      }
    });
  });
}


export function checkIsWindowActive(tabId) {
  if (Number(tabId) < 0) return Promise.resolve(false);

  return new Promise((resolve) => {
    chrome.tabs.get(Number(tabId), (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error while checking tab', chrome.runtime.lastError);
        resolve(false);
      } else {
        console.error(`<<<< check tab ${tabId}`, result);
        resolve(true);
      }
    });
  });
}


export function getCookies(url) {
  return new Promise((resolve) => {
    chrome.cookies.getAll(
      { url },
      cookies => resolve(cookies.map(c => c.value).join(';'))
    );
  });
}
