import getDexie from './lib/dexie';

export default class PersistentMap {
  constructor(dbName) {
    this.dbName = dbName;
    this.db = null;
  }

  init() {
    return getDexie().then((Dexie) => {
      this.db = new Dexie(this.dbName);
      this.db.version(1).stores({ kv: 'key' });
      return this.db.open();
    });
  }

  unload() {
    if (this.db !== null) {
      return this.db.close();
    }
    return Promise.resolve();
  }

  destroy() {
    if (this.db !== null) {
      return this.db.delete();
    }

    return getDexie().then(Dexie => Dexie.delete(this.dbName));
  }

  get(key) {
    return this.db.kv.get(key).then(v => v && v.value);
  }

  set(key, value) {
    return this.db.kv.put({ key, value });
  }

  has(key) {
    return this.db.kv.get(key).then(v => v !== undefined);
  }

  delete(key) {
    return this.db.kv.delete(key);
  }

  clear() {
    return this.db.kv.clear();
  }

  size() {
    return this.db.kv.count();
  }

  keys() {
    return this.db.kv.toCollection().primaryKeys();
  }

  entries() {
    return this.db.kv.toArray()
      .then(x => x.map(({ key, value }) => [key, value]));
  }
}
