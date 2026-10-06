// Offline cache + pending-write queue on IndexedDB, one database per signed-in user.
// Storage only — what gets cached and when the queue is replayed lives in index.html's
// "offline cache & outbox" section.
//
// Stores:
//   notes  — the last-known copy of every (non-trashed) note, content included once it's been loaded
//   kv     — small blobs keyed by name ({k, v}), e.g. the checklist
//   outbox — writes made while offline, one entry per row ({key: 'table:id', seq, ...})
//
// Every call swallows its own errors: a private window, blocked site data or a full disk must
// degrade to "no offline cache", never break the app.

const LocalDB = (() => {
  let db = null;

  function req(r){
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  function done(tx){
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  async function open(userId){
    close();
    try{
      const r = indexedDB.open('graphidea-' + userId, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if(!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' });
        if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
        if(!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'key' });
      };
      db = await req(r);
    }catch(e){ db = null; }
    return !!db;
  }

  function close(){ if(db){ try{ db.close(); }catch(e){} db = null; } }

  async function getAll(store){
    if(!db) return [];
    try{ return await req(db.transaction(store, 'readonly').objectStore(store).getAll()); }
    catch(e){ return []; }
  }

  async function get(store, key){
    if(!db) return undefined;
    try{ return await req(db.transaction(store, 'readonly').objectStore(store).get(key)); }
    catch(e){ return undefined; }
  }

  async function put(store, value){
    if(!db) return;
    try{ const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); await done(tx); }
    catch(e){}
  }

  async function del(store, key){
    if(!db) return;
    try{ const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); await done(tx); }
    catch(e){}
  }

  // swap the whole store's contents in one transaction, so a crash halfway can't leave half a list
  async function replaceAll(store, values){
    if(!db) return;
    try{
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      os.clear();
      values.forEach(v => os.put(v));
      await done(tx);
    }catch(e){}
  }

  async function getKV(k){ const row = await get('kv', k); return row ? row.v : undefined; }
  function putKV(k, v){ return put('kv', { k, v }); }

  return { open, close, getAll, get, put, del, replaceAll, getKV, putKV };
})();
