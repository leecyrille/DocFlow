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
                ${cfg.supervisorSignatures.map(s => buildSignatureField(s)).join('')}
            </div></div>
        </div>`;
        
        // Actions
        html += `<div class="form-actions">
            <button type="button" id="clear-form" class="btn btn-secondary">Clear</button>
            <button type="button" id="download-pdf" class="btn btn-secondary">🖨️ Print</button>
            <button type="submit" class="btn btn-primary"><span class="btn-text">Save & Sync</span></button>
        </div></form>`;
        
        return html;
    };
    
    function buildFields(fields) {
        return fields.map(f => {
            const fw = f.type === 'textarea' ? 'full-width' : '';
            const req = f.required ? 'required' : '';
            let input;
            if (f.type === 'textarea') {
                input = `<textarea id="${f.id}" name="${f.id}" class="form-input form-textarea auto-grow" rows="2" ${req} oninput="DocFlowFormBuilder.autoGrow(this)"></textarea>`;
            } else if (f.type === 'select') {
                input = `<select id="${f.id}" name="${f.id}" class="form-input" ${req}>${(f.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
            } else {
                input = `<input type="${f.type}" id="${f.id}" name="${f.id}" class="form-input" ${req} ${f.maxLength?`maxlength="${f.maxLength}"`:''}>`;
            }
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
        return Array.from({length:n},(_,i)=>`<tr><td><textarea name="mitigation_hazard_${i}" class="auto-grow" placeholder="Hazard..." rows="1" oninput="DocFlowFormBuilder.autoGrow(this)"></textarea></td><td><textarea name="mitigation_control_${i}" class="auto-grow" placeholder="Control..." rows="1" oninput="DocFlowFormBuilder.autoGrow(this)"></textarea></td><td><input type="text" name="mitigation_initial_${i}" class="initial-input" maxlength="5"></td></tr>`).join('');
    }
    
    function buildWorkers(n) {
        return Array.from({length:n},(_,i)=>`<div class="worker-row">
            <span>${i+1}.</span>
            <input type="text" name="worker_name_${i}" class="form-input" placeholder="Name">
            <div class="worker-signature-pad">
                <div class="signature-pad-container">
                    <canvas class="signature-canvas" id="worker_sig_canvas_${i}" data-name="worker_signature_${i}"></canvas>
                    <div class="signature-controls">
                        <button type="button" class="btn-clear" onclick="DocFlowFormBuilder.clearSignature('worker_sig_canvas_${i}')">Clear</button>
                    </div>
                </div>
                <input type="hidden" name="worker_signature_${i}" id="worker_signature_${i}" class="signature-data">
            </div>
        </div>`).join('');
    }
    
    function buildSignatureField(s) {
        if (s.type === 'signature') {
            return `<div class="signature-box">
                <label for="${s.id}">${s.label}</label>
                <div class="signature-pad-container">
                    <canvas class="signature-canvas" id="${s.id}_canvas" data-name="${s.id}"></canvas>
                    <div class="signature-controls">
                        <button type="button" class="btn-clear" onclick="DocFlowFormBuilder.clearSignature('${s.id}_canvas')">Clear</button>
                    </div>
                </div>
                <input type="hidden" name="${s.id}" id="${s.id}" class="signature-data">
            </div>`;
        }
        return `<div class="signature-box"><label for="${s.id}">${s.label}</label><input type="text" id="${s.id}" name="${s.id}"></div>`;
    }
    
    // Auto-grow textarea function
    DocFlowFormBuilder.autoGrow = function(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    };
    
    // Initialize auto-grow for all textareas
    DocFlowFormBuilder.initAutoGrow = function() {
        document.querySelectorAll('.auto-grow').forEach(ta => {
            DocFlowFormBuilder.autoGrow(ta);
            ta.addEventListener('input', () => DocFlowFormBuilder.autoGrow(ta));
        });
    };
    
    // ===============================
    // SIGNATURE PAD FUNCTIONALITY
    // ===============================
    
    const signaturePads = {};
    
    DocFlowFormBuilder.initSignaturePads = function() {
        document.querySelectorAll('.signature-canvas').forEach(canvas => {
            initSignaturePad(canvas);
        });
    };
    
    function initSignaturePad(canvas) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        
        // Set canvas size to match container
        canvas.width = rect.width || 250;
        canvas.height = 80;
        
        const pad = {
            canvas,
            ctx,
            drawing: false,
            lastX: 0,
            lastY: 0,
            hasSignature: false
        };
        
        signaturePads[canvas.id] = pad;
        
        // Clear canvas with signature line
        clearCanvas(pad);
        
        // Mouse events
        canvas.addEventListener('mousedown', e => startDrawing(pad, e));
        canvas.addEventListener('mousemove', e => draw(pad, e));
        canvas.addEventListener('mouseup', () => stopDrawing(pad));
        canvas.addEventListener('mouseout', () => stopDrawing(pad));
        
        // Touch events
        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            startDrawing(pad, e.touches[0]);
        }, { passive: false });
        
        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            draw(pad, e.touches[0]);
        }, { passive: false });
        
        canvas.addEventListener('touchend', () => stopDrawing(pad));
    }
    
    function getCanvasCoords(pad, e) {
        const rect = pad.canvas.getBoundingClientRect();
        const scaleX = pad.canvas.width / rect.width;
        const scaleY = pad.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    function startDrawing(pad, e) {
        pad.drawing = true;
        const coords = getCanvasCoords(pad, e);
        pad.lastX = coords.x;
        pad.lastY = coords.y;
        pad.hasSignature = true;
    }
    
    function draw(pad, e) {
        if (!pad.drawing) return;
        
        const coords = getCanvasCoords(pad, e);
        
        pad.ctx.beginPath();
        pad.ctx.moveTo(pad.lastX, pad.lastY);
        pad.ctx.lineTo(coords.x, coords.y);
        pad.ctx.strokeStyle = '#1a1a1a';
        pad.ctx.lineWidth = 2;
        pad.ctx.lineCap = 'round';
        pad.ctx.lineJoin = 'round';
        pad.ctx.stroke();
        
        pad.lastX = coords.x;
        pad.lastY = coords.y;
    }
    
    function stopDrawing(pad) {
        if (pad.drawing) {
            pad.drawing = false;
            saveSignatureData(pad);
        }
    }
    
    function clearCanvas(pad) {
        pad.ctx.fillStyle = '#fafafa';
        pad.ctx.fillRect(0, 0, pad.canvas.width, pad.canvas.height);
        
        // Draw signature line
        pad.ctx.beginPath();
        pad.ctx.moveTo(10, pad.canvas.height - 10);
        pad.ctx.lineTo(pad.canvas.width - 10, pad.canvas.height - 10);
        pad.ctx.strokeStyle = '#999';
        pad.ctx.lineWidth = 1;
        pad.ctx.stroke();
        
        pad.hasSignature = false;
    }
    
    function saveSignatureData(pad) {
        if (!pad.hasSignature) return;
        
        const dataName = pad.canvas.dataset.name;
        const hiddenInput = document.getElementById(dataName) || document.querySelector(`input[name="${dataName}"]`);
        
        if (hiddenInput) {
            // Save as base64 PNG
            hiddenInput.value = pad.canvas.toDataURL('image/png');
        }
    }
    
    DocFlowFormBuilder.clearSignature = function(canvasId) {
        const pad = signaturePads[canvasId];
        if (pad) {
            clearCanvas(pad);
            const dataName = pad.canvas.dataset.name;
            const hiddenInput = document.getElementById(dataName) || document.querySelector(`input[name="${dataName}"]`);
            if (hiddenInput) hiddenInput.value = '';
        }
    };
    
    DocFlowFormBuilder.getSignatureData = function(canvasId) {
        const pad = signaturePads[canvasId];
        if (pad && pad.hasSignature) {
            return pad.canvas.toDataURL('image/png');
        }
        return null;
    };
    
    DocFlowFormBuilder.loadSignature = function(canvasId, dataUrl) {
        const pad = signaturePads[canvasId];
        if (!pad || !dataUrl) return;
        
        const img = new Image();
        img.onload = function() {
            pad.ctx.fillStyle = '#fafafa';
            pad.ctx.fillRect(0, 0, pad.canvas.width, pad.canvas.height);
            pad.ctx.drawImage(img, 0, 0, pad.canvas.width, pad.canvas.height);
            pad.hasSignature = true;
        };
        img.src = dataUrl;
    };
    
    // Re-initialize signature pads on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            document.querySelectorAll('.signature-canvas').forEach(canvas => {
                const pad = signaturePads[canvas.id];
                if (pad) {
                    const rect = canvas.parentElement.getBoundingClientRect();
                    const tempData = pad.hasSignature ? canvas.toDataURL() : null;
                    canvas.width = rect.width || 250;
                    canvas.height = 80;
                    clearCanvas(pad);
                    if (tempData) DocFlowFormBuilder.loadSignature(canvas.id, tempData);
                }
            });
        }, 250);
    });
    
    // Initialize all components when form is loaded
    DocFlowFormBuilder.initForm = function() {
        DocFlowFormBuilder.initAutoGrow();
        DocFlowFormBuilder.initSignaturePads();
    };
})();
