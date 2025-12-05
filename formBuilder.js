/**
 * DocFlow Form Builder Module
 */
(function() {
    'use strict';
    window.DocFlowFormBuilder = {};
    
    DocFlowFormBuilder.buildForm = function(cfg) {
        let html = `<form id="safety-form" class="safety-form" novalidate>
            <input type="hidden" id="form-local-id" name="localId">
            <input type="hidden" id="form-type" name="formType" value="${cfg.id}">`;
        
        // Header
        html += `<div class="form-section">
            <div class="section-header">Part 1 - ${cfg.id === 'flra' ? 'Inspection Results' : 'Inspection Details'}</div>
            <div class="section-content"><div class="form-grid">${buildFields(cfg.headerFields)}</div></div>
        </div>`;
        
        // Checklists
        const keys = Object.keys(cfg.checklists);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i], cl = cfg.checklists[k];
            html += `<div class="form-section">
                <div class="section-header">${cl.title}</div>
                <div class="section-content">${buildChecklist(k, cl)}
                    ${cl.additionalFields ? buildAdditional(cl.additionalFields) : ''}
                </div>
            </div>`;
        }
        
        // Mitigations
        if (cfg.hasMitigations) {
            html += `<div class="form-section">
                <div class="section-header">Part 2 - Risk Mitigations</div>
                <div class="section-content">
                    <p class="section-note">Document prioritized hazards and control plans.</p>
                    <table class="mitigations-table">
                        <thead><tr><th style="width:35%">Hazards</th><th style="width:50%">Controls</th><th style="width:15%">Initial</th></tr></thead>
                        <tbody>${buildMitigations(cfg.mitigationRows || 10)}</tbody>
                    </table>
                </div>
            </div>`;
        }
        
        // Worker signatures
        if (cfg.hasWorkerSignatures) {
            html += `<div class="form-section">
                <div class="section-header">Worker Acknowledgment</div>
                <div class="section-content">
                    <p class="section-note">Workers signing acknowledge understanding of risks and controls.</p>
                    <div class="worker-signatures">${buildWorkers(cfg.workerSignatureRows || 10)}</div>
                </div>
            </div>`;
        }
        
        // Supervisor signatures
        html += `<div class="form-section">
            <div class="section-header">Signatures</div>
            <div class="section-content"><div class="signature-grid">
                ${cfg.supervisorSignatures.map(s => `<div class="signature-box"><label for="${s.id}">${s.label}</label><input type="text" id="${s.id}" name="${s.id}"></div>`).join('')}
            </div></div>
        </div>`;
        
        // Actions
        html += `<div class="form-actions">
            <button type="button" id="clear-form" class="btn btn-secondary">Clear</button>
            <button type="button" id="download-pdf" class="btn btn-secondary">📄 PDF</button>
            <button type="submit" class="btn btn-primary"><span class="btn-text">Save & Sync</span></button>
        </div></form>`;
        
        return html;
    };
    
    function buildFields(fields) {
        return fields.map(f => {
            const fw = f.type === 'textarea' ? 'full-width' : '';
            const req = f.required ? 'required' : '';
            let input;
            if (f.type === 'textarea') input = `<textarea id="${f.id}" name="${f.id}" class="form-input form-textarea" rows="3" ${req}></textarea>`;
            else if (f.type === 'select') input = `<select id="${f.id}" name="${f.id}" class="form-input" ${req}>${(f.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
            else input = `<input type="${f.type}" id="${f.id}" name="${f.id}" class="form-input" ${req} ${f.maxLength?`maxlength="${f.maxLength}"`:''}>`;
            return `<div class="form-group ${fw}"><label for="${f.id}" class="form-label ${f.required?'required':''}">${f.label}</label>${input}</div>`;
        }).join('');
    }
    
    function buildChecklist(key, cl) {
        const isOk = cl.responseType === 'ok-notok-na';
        const isYesNa = cl.responseType === 'yes-na';
        let labels, vals;
        
        if (isOk) {
            labels = ['OK','X','N/A'];
            vals = ['ok','notok','na'];
        } else if (isYesNa) {
            labels = ['Yes','N/A'];
            vals = ['yes','na'];
        } else {
            labels = ['N/A','Y','N'];
            vals = ['na','yes','no'];
        }
        
        return cl.items.map((item, i) => {
            const lbl = typeof item === 'object' ? item.label : item;
            const hasText = typeof item === 'object' && item.hasTextField;
            const id = `${key}_${i}`;
            
            let row = `<div class="hazard-row">
                <label class="hazard-label">${lbl}</label>
                <div class="checkbox-group">${vals.map((v,j)=>`<div class="checkbox-wrapper"><input type="radio" id="${id}_${v}" name="${id}" value="${v}"><label class="checkbox-label" for="${id}_${v}">${labels[j]}</label></div>`).join('')}</div>
                ${cl.hasExplanation?`<input type="text" name="${id}_explanation" class="form-input explanation-input" placeholder="Comments...">`:''}
            </div>`;
            
            if (hasText) row += `<div class="hazard-row other-row"><input type="text" name="${id}_text" class="form-input" placeholder="Specify..."></div>`;
            return row;
        }).join('');
    }
    
    function buildAdditional(fields) {
        return `<div class="form-grid additional-fields">${fields.map(f => `<div class="form-group"><label for="${f.id}" class="form-label">${f.label}</label>${f.type==='select'?`<select id="${f.id}" name="${f.id}" class="form-input">${(f.options||[]).map(o=>`<option value="${o.toLowerCase()}">${o}</option>`).join('')}</select>`:`<input type="${f.type}" id="${f.id}" name="${f.id}" class="form-input">`}</div>`).join('')}</div>`;
    }
    
    function buildMitigations(n) {
        return Array.from({length:n},(_,i)=>`<tr><td><textarea name="mitigation_hazard_${i}" placeholder="Hazard..." rows="2"></textarea></td><td><textarea name="mitigation_control_${i}" placeholder="Control..." rows="2"></textarea></td><td><input type="text" name="mitigation_initial_${i}" class="initial-input" maxlength="5"></td></tr>`).join('');
    }
    
    function buildWorkers(n) {
        return Array.from({length:n},(_,i)=>`<div class="worker-row"><span>${i+1}.</span><input type="text" name="worker_name_${i}" class="form-input" placeholder="Name"><input type="text" name="worker_signature_${i}" class="form-input" placeholder="Signature"></div>`).join('');
    }
})();
