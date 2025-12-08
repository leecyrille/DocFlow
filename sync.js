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
                    
                    // Extract signature images for separate upload
                    const signatures = extractSignatures(form);
                    
                    // Get PDF upload path info with sequence number
                    const formCfg = window.DocFlowApp?.getFormConfig?.(form.formType);
                    
                    // Get next sequence number for this form on this day
                    let sequenceNumber = 1;
                    if (window.DocFlowPDF?.getNextSequenceNumber) {
                        sequenceNumber = await window.DocFlowPDF.getNextSequenceNumber(form.formType, form, formCfg || {}, config);
                    }
                    
                    const pdfInfo = window.DocFlowPDF?.getUploadPath?.(form.formType, form, formCfg || {}, sequenceNumber) || {};
                    
                    const res = await fetch(`${config.apiEndpoint}/sync-form`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            form: prepareForm(form),
                            formType: form.formType,
                            pdf: form.pdf,
                            pdfUploadInfo: {
                                library: pdfInfo.library || 'SafetyFormPDFs',
                                folderPath: pdfInfo.folderPath || '',
                                filename: pdfInfo.filename || '',
                                serverRelativePath: pdfInfo.serverRelativePath || ''
                            },
                            signatures: signatures,
                            metadata: { localId: form.localId, timestamp: new Date().toISOString() }
                        })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        await DocFlowDB.updateStatus(form.localId, 'synced', { 
                            sharePointId: data.id, 
                            pdfUrl: data.pdfUrl,
                            signatureUrls: data.signatureUrls 
                        });
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
    
    // Extract signature image data from form for separate upload
    function extractSignatures(form) {
        const signatures = [];
        
        // Check supervisor signatures
        const supervisorSigFields = ['paceSupervisorSignature', 'clientRepSignature', 'inspectedBy', 'supervisor'];
        supervisorSigFields.forEach(field => {
            if (form[field] && form[field].startsWith('data:image/')) {
                signatures.push({
                    fieldName: field,
                    dataUrl: form[field],
                    type: 'supervisor'
                });
            }
        });
        
        // Check worker signatures
        if (form.workerSignatures) {
            form.workerSignatures.forEach((worker, i) => {
                if (worker.signature && worker.signature.startsWith('data:image/')) {
                    signatures.push({
                        fieldName: `worker_signature_${i}`,
                        dataUrl: worker.signature,
                        workerName: worker.name,
                        type: 'worker'
                    });
                }
            });
        }
        
        return signatures;
    }
    
    function prepareForm(form) {
        const data = { ...form };
        if (data.checklists) data.ChecklistData = JSON.stringify(data.checklists);
        if (data.mitigations) data.Mitigations = JSON.stringify(data.mitigations);
        if (data.workerSignatures) {
            // Convert worker signatures, replacing image data with placeholder for URL
            const workersForSync = data.workerSignatures.map(w => ({
                name: w.name,
                signature: w.signature && w.signature.startsWith('data:image/') ? '[IMAGE]' : w.signature
            }));
            data.WorkerSignatures = JSON.stringify(workersForSync);
        }
        
        // Replace image data in supervisor signatures with placeholder
        const supervisorSigFields = ['paceSupervisorSignature', 'clientRepSignature', 'inspectedBy', 'supervisor'];
        supervisorSigFields.forEach(field => {
            if (data[field] && data[field].startsWith('data:image/')) {
                data[field] = '[IMAGE]';
            }
        });
        
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
    
    // Helper to upload signature to SharePoint (called from API endpoint)
    DocFlowSync.uploadSignatureToSharePoint = async function(token, signatureData, folderPath, filename) {
        const base64Data = signatureData.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
        }
        
        const siteUrl = CONFIG?.sharePointSiteUrl || 'https://pacetechnologiesinc.sharepoint.com/sites/DocFlow';
        const uploadUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folderPath}')/Files/add(url='${filename}',overwrite=true)`;
        
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'image/png'
            },
            body: bytes.buffer
        });
        
        if (!response.ok) {
            throw new Error(`Failed to upload signature: ${response.status}`);
        }
        
        const result = await response.json();
        return result.d?.ServerRelativeUrl || result.ServerRelativeUrl;
    };
    
    // Upload PDF to SafetyFormPDFs SharePoint library
    DocFlowSync.uploadPDFToSharePoint = async function(token, pdfBlob, folderPath, filename) {
        const siteUrl = CONFIG?.sharePointSiteUrl || 'https://pacetechnologiesinc.sharepoint.com/sites/DocFlow';
        const library = CONFIG?.libraries?.safetyFormPDFs || 'SafetyFormPDFs';
        const fullFolderPath = `/sites/DocFlow/${library}/${folderPath}`;
        
        // First ensure the folder exists
        await ensureFolderExists(token, siteUrl, fullFolderPath);
        
        // Upload the PDF
        const uploadUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${fullFolderPath}')/Files/add(url='${filename}',overwrite=true)`;
        
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/pdf'
            },
            body: pdfBlob
        });
        
        if (!response.ok) {
            throw new Error(`Failed to upload PDF: ${response.status}`);
        }
        
        const result = await response.json();
        const serverRelativeUrl = result.d?.ServerRelativeUrl || result.ServerRelativeUrl;
        return `${siteUrl}${serverRelativeUrl}`;
    };
    
    // Ensure folder path exists in SharePoint
    async function ensureFolderExists(token, siteUrl, folderPath) {
        const parts = folderPath.split('/').filter(p => p && p !== 'sites' && p !== 'DocFlow');
        let currentPath = '/sites/DocFlow';
        
        for (let i = 0; i < parts.length; i++) {
            currentPath += '/' + parts[i];
            try {
                // Check if folder exists
                const checkUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${currentPath}')`;
                const checkRes = await fetch(checkUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json;odata=verbose'
                    }
                });
                
                if (!checkRes.ok && checkRes.status === 404) {
                    // Create the folder
                    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                    const folderName = parts[i];
                    const createUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${parentPath}')/Folders/add('${folderName}')`;
                    
                    await fetch(createUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json;odata=verbose'
                        }
                    });
                }
            } catch (e) {
                console.warn('Folder check/create error:', e);
            }
        }
    }
    
    // Get SharePoint library paths
    DocFlowSync.getLibraryPaths = function() {
        return {
            formTemplates: CONFIG?.libraries?.formTemplates || 'FormTemplates',
            appResources: CONFIG?.libraries?.appResources || 'AppResources',
            safetyFormPDFs: CONFIG?.libraries?.safetyFormPDFs || 'SafetyFormPDFs'
        };
    };
})();
