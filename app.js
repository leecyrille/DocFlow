/**
 * DocFlow Main Application
 */
(function() {
    'use strict';
    window.DocFlowApp = {};
    
    let config = null, formConfigs = null, currentFormType = 'flra', getToken = null;
    
    DocFlowApp.initialize = async function(cfg) {
        config = cfg;
        formConfigs = cfg.formConfigs;
        getToken = cfg.getAccessToken;
        
        if (cfg.user) {
            const name = cfg.user.name || cfg.user.username || 'User';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            document.getElementById('user-initials').textContent = initials;
            document.getElementById('user-name').textContent = name;
            document.getElementById('user-email').textContent = cfg.user.username || '';
        }
        
        await DocFlowDB.initialize();
        DocFlowSync.initialize({ apiEndpoint: cfg.apiEndpoint, getAccessToken: getToken });
        buildSelector();
        buildForm(currentFormType);
        setupListeners();
        await refreshList();
        updateOnline();
        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
    };
    
    // Get form configuration by type
    DocFlowApp.getFormConfig = function(formType) {
        return formConfigs?.formTypes?.[formType] || null;
    };
    
    // Get all form configs
    DocFlowApp.getAllFormConfigs = function() {
        return formConfigs;
    };
    
    function buildSelector() {
        const el = document.getElementById('form-type-selector');
        if (!el || !formConfigs?.formTypes) return;
        const types = Object.values(formConfigs.formTypes);
        el.innerHTML = `<div class="section-content"><div class="form-group">
            <label for="form-type-select" class="form-label">Select Form Type</label>
            <select id="form-type-select" class="form-input">
                ${types.map(t => `<option value="${t.id}" ${t.id === currentFormType ? 'selected' : ''}>${t.name} (${t.formNumber})</option>`).join('')}
            </select></div></div>`;
        document.getElementById('form-type-select').addEventListener('change', e => { currentFormType = e.target.value; buildForm(currentFormType); });
    }
    
    function buildForm(type) {
        const cfg = formConfigs?.formTypes?.[type];
        if (!cfg) return;
        document.getElementById('page-title').textContent = cfg.name;
        document.getElementById('form-number').textContent = `Form # ${cfg.formNumber} ${cfg.revision || ''}`;
        document.getElementById('form-container').innerHTML = DocFlowFormBuilder.buildForm(cfg);
        setupFormListeners();
        
        // Initialize form components (auto-grow textareas, signature pads)
        if (DocFlowFormBuilder.initForm) {
            setTimeout(() => DocFlowFormBuilder.initForm(), 100);
        }
        
        const dateEl = document.getElementById(type === 'flra' ? 'assessmentDate' : 'inspectionDate');
        if (dateEl) dateEl.valueAsDate = new Date();
    }
    
    function setupListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
        document.getElementById('sync-btn')?.addEventListener('click', async () => { await DocFlowSync.syncNow(); await refreshList(); });
    }
    
    function setupFormListeners() {
        document.getElementById('safety-form')?.addEventListener('submit', handleSubmit);
        document.getElementById('clear-form')?.addEventListener('click', clearForm);
        document.getElementById('download-pdf')?.addEventListener('click', handlePDF);
    }
    
    async function handleSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.querySelector('.btn-text').textContent = 'Saving...';
        try {
            const data = collectData();
            if (!validateData(data)) { showNotification('Fill required fields', 'error'); return; }
            let pdf = null;
            try { pdf = await DocFlowPDF.generate(currentFormType, data, formConfigs.formTypes[currentFormType]); } catch (e) {}
            await DocFlowDB.saveForm({ ...data, formType: currentFormType, pdf });
            showNotification('Form saved!', 'success');
            if (navigator.onLine) await DocFlowSync.syncNow();
            clearForm();
            await refreshList();
            switchView('list');
        } catch (e) { showNotification('Save failed', 'error'); }
        finally { btn.disabled = false; btn.querySelector('.btn-text').textContent = 'Save & Sync'; }
    }
    
    async function handlePDF() {
        try {
            const data = collectData();
            await DocFlowPDF.download(currentFormType, data, formConfigs.formTypes[currentFormType]);
            showNotification('PDF downloaded', 'success');
        } catch (e) { showNotification('PDF failed', 'error'); }
    }
    
    function collectData() {
        const cfg = formConfigs.formTypes[currentFormType];
        const data = { formType: currentFormType };
        
        // Preserve localId if editing existing form
        const localIdEl = document.getElementById('form-local-id');
        if (localIdEl && localIdEl.value) {
            data.localId = parseInt(localIdEl.value, 10);
        }
        
        cfg.headerFields.forEach(f => { data[f.id] = document.getElementById(f.id)?.value || ''; });
        data.checklists = {};
        Object.keys(cfg.checklists).forEach(key => {
            data.checklists[key] = {};
            cfg.checklists[key].items.forEach((_, i) => {
                const id = `${key}_${i}`;
                const sel = document.querySelector(`input[name="${id}"]:checked`);
                data.checklists[key][i] = { value: sel?.value || null, otherText: document.querySelector(`input[name="${id}_text"]`)?.value || '', explanation: document.querySelector(`input[name="${id}_explanation"]`)?.value || '' };
            });
        });
        if (cfg.hasMitigations) {
            data.mitigations = [];
            for (let i = 0; i < (cfg.mitigationRows || 10); i++) {
                const h = document.querySelector(`textarea[name="mitigation_hazard_${i}"]`)?.value || '';
                const c = document.querySelector(`textarea[name="mitigation_control_${i}"]`)?.value || '';
                const n = document.querySelector(`input[name="mitigation_initial_${i}"]`)?.value || '';
                if (h || c) data.mitigations.push({ hazard: h, control: c, initial: n });
            }
        }
        if (cfg.hasWorkerSignatures) {
            data.workerSignatures = [];
            for (let i = 0; i < (cfg.workerSignatureRows || 10); i++) {
                const name = document.querySelector(`input[name="worker_name_${i}"]`)?.value || '';
                const sig = document.querySelector(`input[name="worker_signature_${i}"]`)?.value || '';
                if (name || sig) data.workerSignatures.push({ name, signature: sig });
            }
        }
        cfg.supervisorSignatures.forEach(s => { data[s.id] = document.getElementById(s.id)?.value || ''; });
        data.title = currentFormType === 'flra' ? `${data.client || ''} - ${data.site || ''} - ${data.assessmentDate || ''}` : `Manlift ${data.manliftNumber || ''} - ${data.inspectionDate || ''}`;
        return data;
    }
    
    function validateData(data) {
        const cfg = formConfigs.formTypes[currentFormType];
        return cfg.headerFields.filter(f => f.required).every(f => data[f.id]?.trim());
    }
    
    function clearForm() {
        document.getElementById('safety-form')?.reset();
        document.getElementById('form-local-id').value = '';
        const dateEl = document.getElementById(currentFormType === 'flra' ? 'assessmentDate' : 'inspectionDate');
        if (dateEl) dateEl.valueAsDate = new Date();
    }
    
    function switchView(view) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
        document.getElementById('form-view').hidden = view !== 'form';
        document.getElementById('list-view').hidden = view !== 'list';
        if (view === 'list') refreshList();
    }
    
    async function refreshList() {
        const forms = await DocFlowDB.getAllForms();
        const stats = await DocFlowDB.getStats();
        document.getElementById('total-count').textContent = `${stats.total} form${stats.total !== 1 ? 's' : ''}`;
        document.getElementById('pending-count').textContent = `${stats.pending} pending`;
        const badge = document.getElementById('pending-badge');
        badge.textContent = stats.pending; badge.classList.toggle('hidden', stats.pending === 0);
        const list = document.getElementById('forms-list');
        const empty = document.getElementById('empty-state');
        if (forms.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); }
        else {
            empty.classList.add('hidden');
            list.innerHTML = forms.map(f => {
                const cfg = formConfigs?.formTypes?.[f.formType] || {};
                const statusCls = f.status === 'synced' ? 'status-synced' : f.status === 'error' ? 'status-error' : 'status-pending';
                const statusTxt = f.status === 'synced' ? '✓ Synced' : f.status === 'error' ? '⚠ Error' : '◐ Pending';
                return `<article class="form-card"><div class="form-card-header"><h3 class="form-card-title">${esc(f.title)}</h3><span class="form-card-status ${statusCls}">${statusTxt}</span></div><div class="form-card-meta"><span class="form-type-badge">${cfg.shortName || 'Form'}</span><span>${f.lastModified ? new Date(f.lastModified).toLocaleDateString() : ''}</span></div><div class="form-card-actions"><button class="card-btn btn-edit" data-id="${f.localId}">✎</button><button class="card-btn btn-pdf" data-id="${f.localId}">🖨️</button><button class="card-btn btn-delete" data-id="${f.localId}">🗑</button></div></article>`;
            }).join('');
            list.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => editForm(+btn.dataset.id)));
            list.querySelectorAll('.btn-pdf').forEach(btn => btn.addEventListener('click', () => downloadPDF(+btn.dataset.id)));
            list.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => deleteForm(+btn.dataset.id)));
        }
    }
    
    async function editForm(id) {
        const form = await DocFlowDB.getForm(id);
        if (!form) { showNotification('Not found', 'error'); return; }
        currentFormType = form.formType || 'flra';
        document.getElementById('form-type-select').value = currentFormType;
        buildForm(currentFormType);
        document.getElementById('form-local-id').value = id;
        const cfg = formConfigs.formTypes[currentFormType];
        cfg.headerFields.forEach(f => { const el = document.getElementById(f.id); if (el) el.value = form[f.id] || ''; });
        if (form.checklists) Object.entries(form.checklists).forEach(([k, items]) => Object.entries(items).forEach(([i, d]) => {
            if (d.value) { const r = document.querySelector(`input[name="${k}_${i}"][value="${d.value}"]`); if (r) r.checked = true; }
            if (d.otherText) { const t = document.querySelector(`input[name="${k}_${i}_text"]`); if (t) t.value = d.otherText; }
            if (d.explanation) { const e = document.querySelector(`input[name="${k}_${i}_explanation"]`); if (e) e.value = d.explanation; }
        }));
        if (form.mitigations) form.mitigations.forEach((m, i) => {
            const h = document.querySelector(`textarea[name="mitigation_hazard_${i}"]`); if (h) { h.value = m.hazard || ''; DocFlowFormBuilder.autoGrow(h); }
            const c = document.querySelector(`textarea[name="mitigation_control_${i}"]`); if (c) { c.value = m.control || ''; DocFlowFormBuilder.autoGrow(c); }
            const n = document.querySelector(`input[name="mitigation_initial_${i}"]`); if (n) n.value = m.initial || '';
        });
        if (form.workerSignatures) form.workerSignatures.forEach((w, i) => {
            const n = document.querySelector(`input[name="worker_name_${i}"]`); if (n) n.value = w.name || '';
            // Load signature image if it's a data URL
            if (w.signature && w.signature.startsWith('data:image/')) {
                const sigInput = document.getElementById(`worker_signature_${i}`);
                if (sigInput) sigInput.value = w.signature;
                if (DocFlowFormBuilder.loadSignature) {
                    DocFlowFormBuilder.loadSignature(`worker_sig_canvas_${i}`, w.signature);
                }
            }
        });
        // Load supervisor signatures
        cfg.supervisorSignatures.forEach(s => { 
            const el = document.getElementById(s.id); 
            if (el) el.value = form[s.id] || '';
            // Load signature canvas if it's an image
            if (s.type === 'signature' && form[s.id] && form[s.id].startsWith('data:image/')) {
                if (DocFlowFormBuilder.loadSignature) {
                    DocFlowFormBuilder.loadSignature(`${s.id}_canvas`, form[s.id]);
                }
            }
        });
        switchView('form');
        showNotification('Form loaded', 'info');
    }
    
    async function downloadPDF(id) { const f = await DocFlowDB.getForm(id); if (f) await DocFlowPDF.download(f.formType, f, formConfigs.formTypes[f.formType || 'flra']); }
    async function deleteForm(id) { if (!confirm('Delete?')) return; await DocFlowDB.deleteForm(id); showNotification('Deleted', 'success'); await refreshList(); }
    function updateOnline() {
        const el = document.getElementById('sync-status');
        if (navigator.onLine) { el.className = 'sync-indicator status-online'; el.innerHTML = '<span class="status-icon">●</span><span class="status-text">Online</span>'; }
        else { el.className = 'sync-indicator status-offline'; el.innerHTML = '<span class="status-icon">○</span><span class="status-text">Offline</span>'; }
    }
    function esc(t) { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
})();

function showNotification(msg, type = 'info') {
    const ex = document.getElementById('notification'); if (ex) ex.remove();
    const el = document.createElement('div'); el.id = 'notification'; el.className = `notification notification-${type}`; el.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 3000);
}
