/**
 * DocFlow Sync Module
 */
(function() {
    'use strict';
    window.DocFlowSync = {};
    
    let config = null, syncing = false;
    
    DocFlowSync.initialize = function(cfg) {
        config = cfg;
        window.addEventListener('online', () => setTimeout(() => DocFlowSync.syncNow(), 1000));
        setInterval(async () => {
            if (navigator.onLine && !syncing) {
                const s = await DocFlowDB.getStats();
                if (s.pending > 0) await DocFlowSync.syncNow();
            }
        }, 5 * 60 * 1000);
    };
    
    DocFlowSync.syncNow = async function() {
        if (syncing || !navigator.onLine) return { skipped: true };
        syncing = true;
        updateIndicator('syncing');
        
        const results = { attempted: 0, successful: 0, failed: 0 };
        
        try {
            const pending = await DocFlowDB.getPendingForms();
            if (pending.length === 0) { updateIndicator('online'); return results; }
            
            showNotification(`Syncing ${pending.length} form(s)...`, 'info');
            
            for (const form of pending) {
                results.attempted++;
                try {
                    const token = await config.getAccessToken();
                    const res = await fetch(`${config.apiEndpoint}/sync-form`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            form: prepareForm(form),
                            formType: form.formType,
                            pdf: form.pdf,
                            metadata: { localId: form.localId, timestamp: new Date().toISOString() }
                        })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        await DocFlowDB.updateStatus(form.localId, 'synced', { sharePointId: data.id, pdfUrl: data.pdfUrl });
                        results.successful++;
                    } else throw new Error(`Server: ${res.status}`);
                } catch (e) {
                    console.error('Sync error:', e);
                    await DocFlowDB.updateStatus(form.localId, 'error', { lastError: e.message });
                    results.failed++;
                }
            }
            
            if (results.successful > 0 && results.failed === 0) {
                showNotification(`Synced ${results.successful} form(s)`, 'success');
                updateIndicator('online');
            } else if (results.failed > 0) {
                showNotification(`${results.failed} form(s) failed`, 'error');
                updateIndicator('error');
            }
        } catch (e) {
            console.error('Sync error:', e);
            updateIndicator('error');
        } finally { syncing = false; }
        
        return results;
    };
    
    function prepareForm(form) {
        const data = { ...form };
        if (data.checklists) data.ChecklistData = JSON.stringify(data.checklists);
        if (data.mitigations) data.Mitigations = JSON.stringify(data.mitigations);
        if (data.workerSignatures) data.WorkerSignatures = JSON.stringify(data.workerSignatures);
        delete data.localId; delete data.status; delete data.syncAttempts;
        delete data.lastModified; delete data.pdf; delete data.checklists;
        delete data.mitigations; delete data.workerSignatures;
        return data;
    }
    
    function updateIndicator(status) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const cfg = {
            online: { icon: '●', text: 'Online', cls: 'status-online' },
            offline: { icon: '○', text: 'Offline', cls: 'status-offline' },
            syncing: { icon: '↻', text: 'Syncing...', cls: 'status-syncing' },
            error: { icon: '⚠', text: 'Error', cls: 'status-error' }
        }[status] || { icon: '○', text: 'Offline', cls: 'status-offline' };
        el.className = `sync-indicator ${cfg.cls}`;
        el.innerHTML = `<span class="status-icon">${cfg.icon}</span><span class="status-text">${cfg.text}</span>`;
    }
})();
