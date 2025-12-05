/**
 * DocFlow IndexedDB Module
 */
(function() {
    'use strict';
    window.DocFlowDB = {};
    
    const DB_NAME = 'DocFlowDB';
    const DB_VERSION = 1;
    const STORE = 'forms';
    let db = null;
    
    DocFlowDB.initialize = function() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => { db = req.result; resolve(db); };
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (d.objectStoreNames.contains(STORE)) d.deleteObjectStore(STORE);
                const s = d.createObjectStore(STORE, { keyPath: 'localId', autoIncrement: true });
                s.createIndex('status', 'status', { unique: false });
                s.createIndex('formType', 'formType', { unique: false });
            };
        });
    };
    
    DocFlowDB.saveForm = function(data) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE], 'readwrite');
            const store = tx.objectStore(STORE);
            const record = { ...data, status: 'pending', lastModified: new Date().toISOString(), syncAttempts: data.syncAttempts || 0 };
            if (data.localId) record.localId = data.localId;
            const req = data.localId ? store.put(record) : store.add(record);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };
    
    DocFlowDB.getForm = function(id) {
        return new Promise((resolve, reject) => {
            const req = db.transaction([STORE], 'readonly').objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };
    
    DocFlowDB.getAllForms = function() {
        return new Promise((resolve, reject) => {
            const req = db.transaction([STORE], 'readonly').objectStore(STORE).getAll();
            req.onsuccess = () => resolve((req.result || []).sort((a,b) => new Date(b.lastModified) - new Date(a.lastModified)));
            req.onerror = () => reject(req.error);
        });
    };
    
    DocFlowDB.getPendingForms = function() {
        return new Promise((resolve, reject) => {
            const req = db.transaction([STORE], 'readonly').objectStore(STORE).index('status').getAll('pending');
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    };
    
    DocFlowDB.updateStatus = function(id, status, meta = {}) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE], 'readwrite');
            const store = tx.objectStore(STORE);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const form = getReq.result;
                if (!form) { reject(new Error('Not found')); return; }
                const updated = { ...form, ...meta, status, lastModified: new Date().toISOString() };
                if (status === 'error') updated.syncAttempts = (form.syncAttempts || 0) + 1;
                store.put(updated).onsuccess = () => resolve();
            };
            getReq.onerror = () => reject(getReq.error);
        });
    };
    
    DocFlowDB.deleteForm = function(id) {
        return new Promise((resolve, reject) => {
            const req = db.transaction([STORE], 'readwrite').objectStore(STORE).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    };
    
    DocFlowDB.getStats = function() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE], 'readonly');
            const store = tx.objectStore(STORE);
            const stats = { total: 0, pending: 0, synced: 0, error: 0 };
            store.count().onsuccess = function() { stats.total = this.result; };
            const idx = store.index('status');
            idx.count('pending').onsuccess = function() { stats.pending = this.result; };
            idx.count('synced').onsuccess = function() { stats.synced = this.result; };
            idx.count('error').onsuccess = function() { stats.error = this.result; };
            tx.oncomplete = () => resolve(stats);
            tx.onerror = () => reject(tx.error);
        });
    };
})();
