/**
 * DocFlow PDF Generator Module
 * Uses WYSIWYG printing - what you see on screen is what you get in print
 */
(function() {
    'use strict';
    window.DocFlowPDF = {};
    
    // Add print styles for WYSIWYG printing
    function addPrintStyles() {
        if (document.getElementById('docflow-print-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'docflow-print-styles';
        style.textContent = `
            @media print {
                /* Hide non-printable elements */
                .app-header, .view-tabs, .form-actions, .user-menu, 
                .sync-indicator, .user-menu-btn, #form-type-selector,
                .notification, .app-footer, .header-right, .btn,
                #list-view, .empty-state { display: none !important; }
                
                /* Reset body and container */
                body { 
                    background: white !important; 
                    color: black !important;
                    font-size: 10pt !important;
                    line-height: 1.3 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .app-container, .main-content, #form-view, #app-container {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                /* Form section styling */
                .form-section {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    margin: 0 0 8pt 0 !important;
                    border: 1px solid #ccc !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                }
                
                .section-header {
                    background: #2a3479 !important;
                    color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    padding: 4pt 8pt !important;
                    font-size: 10pt !important;
                    font-weight: bold !important;
                }
                
                .section-content {
                    padding: 8pt !important;
                }
                
                /* Form inputs - show values inline */
                .form-input, .form-textarea, textarea, input[type="text"], 
                input[type="date"], input[type="number"], select {
                    border: none !important;
                    border-bottom: 1px solid #999 !important;
                    background: transparent !important;
                    padding: 2pt 4pt !important;
                    font-size: 9pt !important;
                    box-shadow: none !important;
                    min-height: auto !important;
                }
                
                .form-textarea, textarea {
                    border: 1px solid #999 !important;
                    min-height: 30pt !important;
                    height: auto !important;
                    overflow: visible !important;
                    resize: none !important;
                }
                
                .form-label {
                    font-size: 8pt !important;
                    font-weight: 600 !important;
                    color: #333 !important;
                }
                
                .form-grid {
                    display: grid !important;
                    grid-template-columns: repeat(3, 1fr) !important;
                    gap: 6pt !important;
                }
                
                .form-group.full-width {
                    grid-column: 1 / -1 !important;
                }
                
                /* Checklist styling */
                .hazard-row {
                    padding: 2pt 0 !important;
                    border-bottom: 1px dotted #ccc !important;
                    font-size: 9pt !important;
                }
                
                .hazard-label {
                    font-size: 9pt !important;
                }
                
                .checkbox-group {
                    gap: 2pt !important;
                }
                
                .checkbox-label {
                    width: 18pt !important;
                    height: 18pt !important;
                    font-size: 7pt !important;
                    border: 1px solid #999 !important;
                }
                
                .checkbox-wrapper input:checked + .checkbox-label {
                    background: #2a3479 !important;
                    color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .explanation-input {
                    font-size: 8pt !important;
                    flex: 0 0 100pt !important;
                }
                
                /* Mitigations table */
                .mitigations-table {
                    font-size: 8pt !important;
                }
                
                .mitigations-table th {
                    background: #f0f0f0 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    padding: 3pt !important;
                    font-size: 8pt !important;
                }
                
                .mitigations-table td {
                    padding: 2pt !important;
                }
                
                .mitigations-table textarea {
                    font-size: 8pt !important;
                    border: 1px solid #ccc !important;
                    min-height: 20pt !important;
                }
                
                /* Worker signatures */
                .worker-row {
                    font-size: 8pt !important;
                    padding: 2pt 0 !important;
                }
                
                .worker-row input {
                    font-size: 8pt !important;
                }
                
                /* Signature boxes */
                .signature-grid {
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 8pt !important;
                }
                
                .signature-box label {
                    font-size: 8pt !important;
                }
                
                .signature-box input {
                    border-bottom: 2px solid #333 !important;
                }
                
                /* Signature canvas for print */
                .signature-canvas-container {
                    border: 1px solid #999 !important;
                    background: white !important;
                }
                
                .signature-canvas {
                    max-width: 100% !important;
                    height: auto !important;
                }
                
                .signature-image {
                    max-width: 150pt !important;
                    max-height: 50pt !important;
                    border-bottom: 2px solid #333 !important;
                }
                
                /* Page settings */
                @page {
                    size: letter portrait;
                    margin: 0.5in;
                }
                
                /* Print header - add form info */
                .print-header {
                    display: block !important;
                    text-align: center;
                    margin-bottom: 10pt;
                    padding-bottom: 8pt;
                    border-bottom: 2px solid #2a3479;
                }
                
                .print-header h1 {
                    font-size: 14pt !important;
                    color: #2a3479 !important;
                    margin: 0 !important;
                }
                
                .print-header .form-info {
                    font-size: 9pt !important;
                    color: #666 !important;
                }
            }
            
            /* Hide print header in normal view */
            .print-header { display: none; }
        `;
        document.head.appendChild(style);
    }
    
    // Initialize print styles when module loads
    addPrintStyles();
    
    DocFlowPDF.generate = async function(formType, data, cfg) {
        // For backwards compatibility, generate a simple blob
        // The actual printing uses browser's print functionality
        const content = JSON.stringify({ formType, data, cfg, generatedAt: new Date().toISOString() });
        const blob = new Blob([content], { type: 'application/json' });
        
        const dateField = formType === 'flra' ? 'assessmentDate' : 'inspectionDate';
        const dateStr = (data[dateField] || new Date().toISOString().split('T')[0]).replace(/-/g, '');
        const jobNum = (data.jobFileNumber || data.manliftNumber || 'NOJOB').replace(/[^a-zA-Z0-9]/g, '');
        const filename = `${dateStr}_${jobNum}_00.pdf`;
        const folderPath = `${cfg.folderName}/${dateStr.substring(0, 4)}/`;
        
        return {
            blob,
            filename,
            folderPath,
            fullPath: `${folderPath}${filename}`,
            base64: await blobToBase64(blob)
        };
    };
    
    DocFlowPDF.download = async function(formType, data, cfg) {
        // Use browser print for WYSIWYG output
        DocFlowPDF.print(cfg);
    };
    
    DocFlowPDF.print = function(cfg) {
        // Add print header with form info
        let printHeader = document.querySelector('.print-header');
        if (!printHeader) {
            printHeader = document.createElement('div');
            printHeader.className = 'print-header';
            const formContainer = document.getElementById('form-container');
            if (formContainer && formContainer.firstChild) {
                formContainer.insertBefore(printHeader, formContainer.firstChild);
            }
        }
        
        if (cfg) {
            printHeader.innerHTML = `
                <h1>Pace Technologies Inc.</h1>
                <div class="form-info">${cfg.name} | Form # ${cfg.formNumber} ${cfg.revision || ''}</div>
            `;
        }
        
        // Trigger print
        window.print();
    };
    
    // Generate PDF filename and path info
    DocFlowPDF.getFileInfo = function(formType, data, cfg) {
        const dateField = formType === 'flra' ? 'assessmentDate' : 'inspectionDate';
        const dateStr = (data[dateField] || new Date().toISOString().split('T')[0]).replace(/-/g, '');
        const year = dateStr.substring(0, 4);
        const jobNum = (data.jobFileNumber || data.manliftNumber || 'NOJOB').replace(/[^a-zA-Z0-9]/g, '');
        const filename = `${dateStr}_${jobNum}_${cfg.shortName || formType}.pdf`;
        
        // Folder structure: SafetyFormPDFs/{FormType}/{Year}/
        const folderPath = `${cfg.folderName || formType.toUpperCase()}/${year}`;
        
        return {
            filename,
            folderPath,
            fullPath: `${folderPath}/${filename}`,
            library: CONFIG?.libraries?.safetyFormPDFs || 'SafetyFormPDFs'
        };
    };
    
    // Get the SharePoint path where PDFs should be uploaded
    DocFlowPDF.getUploadPath = function(formType, data, cfg) {
        const fileInfo = DocFlowPDF.getFileInfo(formType, data, cfg);
        const siteUrl = CONFIG?.sharePointSiteUrl || 'https://pacetechnologiesinc.sharepoint.com/sites/DocFlow';
        
        return {
            ...fileInfo,
            siteUrl,
            serverRelativePath: `/sites/DocFlow/${fileInfo.library}/${fileInfo.folderPath}`,
            fullUrl: `${siteUrl}/${fileInfo.library}/${fileInfo.fullPath}`
        };
    };
    
    function blobToBase64(blob) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result.split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(blob);
        });
    }
})();
