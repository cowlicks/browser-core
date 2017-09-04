import ResourceLoader, { Resource, UpdateCallbackHandler } from '../core/resource-loader';
import Language from '../core/language';
import { platformName } from '../core/platform';
import logger from './logger';

// Disk persisting
const RESOURCES_PATH = ['adblocker'];


// Common durations
const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;


// URLs to fetch block lists
// We need to map the platformName to the names we use in the adblocker lists:
// - mobile has been moved to a non-standard path
// - firefox is currently used for any browser (including chromium), it should
//   be renamed to 'browser' in the future, or 'firefox', 'chromium', etc.
//   should simply be aliases for 'browser'.
const PLATFORM = platformName === 'mobile' ? 'mobile-new' : (platformName || 'firefox');
const CDN_URL = 'https://cdn.cliqz.com/adblocking';
const BASE_URL = `${CDN_URL}/latest-filters/`;


function stripProtocol(url) {
  let result = url;
  ['http://', 'https://'].forEach((prefix) => {
    if (result.startsWith(prefix)) {
      result = result.substring(prefix.length);
    }
  });

  return result;
}

class FiltersList {
  constructor(checksum, asset, remoteURL) {
    this.checksum = checksum;
    this.baseRemoteURL = remoteURL;
    this.assetName = stripProtocol(asset);

    this.resource = new Resource(
      RESOURCES_PATH.concat(this.assetName.split('/')),
      { remoteURL: this.remoteURL(), dataType: 'plainText' },
    );
  }

  remoteURL() {
    return `${this.baseRemoteURL}?t=${parseInt(Date.now() / 60 / 60 / 1000, 10)}`;
  }

  load() {
    return this.resource
      .load()
      .then(this.updateList.bind(this))
      .catch((e) => {
        logger.error(`exception while loading ${this.assetName} ${e} ${e.stack}`);
      });
  }

  update() {
    return this.resource
      .updateFromRemote()
      .then(this.updateList.bind(this))
      .catch((e) => {
        logger.error(`exception while updating ${this.assetName} ${e} ${e.stack}`);
      });
  }

  needsToUpdate(checksum) {
    return checksum !== this.checksum;
  }

  stop() {
  }

  updateFromChecksum(checksum) {
    this.resource.remoteURL = this.remoteURL();
    this.checksum = checksum;
    return this.update();
  }

  updateList(data) {
    const trimmed = data.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    return undefined;
  }
}


/* Class responsible for loading, persisting and updating filters lists.
 */
export default class extends UpdateCallbackHandler {

  constructor(adbLang, adbLangOverride) {
    super();

    // Manage country-specific lists preferences
    this.adbLang = adbLang;
    this.adbLangOverride = adbLangOverride;

    // Resource managing the allowed lists for the adblocker
    this.allowedListsLoader = new ResourceLoader(
      RESOURCES_PATH.concat(PLATFORM, 'checksums'),
      {
        cron: 24 * ONE_HOUR,
        updateInterval: 15 * ONE_MINUTE,
        dataType: 'json',
        remoteURL: this.remoteURL(),
      },
    );
    this.allowedListsLoader.onUpdate(this.updateChecksums.bind(this));

    this.initLists();
  }

  initLists() {
    // Lists of filters currently loaded
    this.lists = new Map();
    // Available languages from filter lists
    this.availableLang = new Set();
    // Currently used language
    this.loadedLang = new Set();
  }

  remoteURL() {
    return `${CDN_URL}/${PLATFORM}/allowed-lists.json?t=${parseInt(Date.now() / 60 / 60 / 1000, 10)}`;
  }

  stop() {
    this.allowedListsLoader.stop();
  }

  load() {
    return this.allowedListsLoader
      .load()
      .then(this.updateChecksums.bind(this))
      .catch((e) => {
        logger.error(`exception while loading allowed lists ${e} ${e.stack}`);
      });
  }

  update() {
    return this.allowedListsLoader
      .updateFromRemote()
      .catch((e) => {
        logger.error(`exception while updating allowed lists ${e} ${e.stack}`);
      });
  }

  // Private API
  userOverrides() {
    const langOverride = this.adbLangOverride;
    if (typeof langOverride === 'string' && langOverride !== '') {
      return langOverride.split(';');
    }
    return [];
  }

  userLang() {
    // check if language specific filters are disabled
    if (!this.adbLang) {
      // ADB_USER_LANG default is set to true to keep the current behavior
      return [];
    }

    // check if language override exists
    const overrides = this.userOverrides();
    if (overrides.length > 0) {
      return overrides;
    }

    if (Language.state) {
      return Language.state();
    }
    return 'en';
  }

  updateChecksums(allowedLists) {
    // Update URL with current timestamp to play well with caching
    this.allowedListsLoader.resource.remoteURL = this.remoteURL();

    const filtersLists = [];

    this.availableLang = new Set();
    this.loadedLang = new Set();
    const userLang = this.userLang();
    Object.keys(allowedLists).forEach((list) => {
      Object.keys(allowedLists[list]).forEach((asset) => {
        const checksum = allowedLists[list][asset].checksum;
        let lang = null;

        if (list === 'country_lists') {
          lang = allowedLists[list][asset].language;
          this.availableLang.add(lang);
        }

        const assetName = stripProtocol(asset);
        const filterRemoteURL = BASE_URL + assetName;

        if (lang === null || userLang.indexOf(lang) !== -1) {
          filtersLists.push({
            checksum,
            asset,
            remoteURL: filterRemoteURL,
            key: list,
          });
          if (lang !== null) {
            this.loadedLang.add(lang);
          }
        }
      });
    });

    return this.updateLists(filtersLists);
  }

  updateLists(filtersLists) {
    const updatedLists = [];

    filtersLists.forEach((newList) => {
      const { checksum, asset, remoteURL, key } = newList;
      const isFiltersList = key !== 'js_resources';

      if (!this.lists.has(asset)) {
        // Create a new list
        const list = new FiltersList(checksum, asset, remoteURL);
        this.lists.set(asset, list);

        // Load the list async
        updatedLists.push(
          list
          .load()
          .then((filters) => {
            // Ignore any empty list
            if (filters !== undefined) {
              return {
                asset,
                filters,
                isFiltersList,
                checksum: list.checksum,
              };
            }

            return undefined;
          }),
        );
      } else {
        // Retrieve existing list
        const list = this.lists.get(asset);

        // Update the list only if needed (checksum is different)
        if (list.needsToUpdate(checksum)) {
          updatedLists.push(
            list
            .updateFromChecksum(checksum)
            .then((filters) => {
              // Ignore any empty list
              if (filters !== undefined) {
                return {
                  asset,
                  filters,
                  isFiltersList,
                  checksum: list.checksum,
                };
              }

              return undefined;
            }),
          );
        }
      }
    });

    // Wait for all lists to be fetched, filters the empty ones and
    // trigger callback (will typically trigger a FiltersEngine update)
    return Promise.all(updatedLists)
      .then(filters => filters.filter(f => f !== undefined))
      .then(filters => this.triggerCallbacks(filters));
  }
}
