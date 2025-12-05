/**
 * DocFlow PDF Generator Module
 */
(function() {
    'use strict';
    window.DocFlowPDF = {};
    
    async function loadJsPDF() {
        if (window.jspdf) return window.jspdf.jsPDF;
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
        return window.jspdf.jsPDF;
    }
    
    DocFlowPDF.generate = async function(formType, data, cfg) {
        const jsPDF = await loadJsPDF();
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const m = 15, cw = pw - m * 2;
        let y = m;
        
        function check(need) { if (y + need > ph - m) { doc.addPage(); y = m; } }
        function section(title) {
            check(10);
            doc.setFillColor(26, 54, 93);
            doc.rect(m, y, cw, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(title.toUpperCase(), m + 2, y + 5);
            doc.setTextColor(0, 0, 0);
            y += 10;
        }
        function field(lbl, val) {
            check(6);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(lbl + ':', m, y);
            doc.setFont('helvetica', 'normal');
            doc.text(val || '_______________', m + doc.getTextWidth(lbl + ': '), y);
            y += 6;
        }
        
        // Header
        doc.setFillColor(26, 54, 93);
        doc.rect(m, y, 15, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('P', m + 5, y + 10);
        
        doc.setTextColor(26, 54, 93);
        doc.setFontSize(10);
        doc.text('Pace Technologies Inc.', m + 20, y + 5);
        doc.setFontSize(14);
        doc.text(cfg.name, m + 20, y + 12);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Form # ${cfg.formNumber} ${cfg.revision || ''}`, pw - m - 40, y + 5);
        y += 25;
        
        // Fields
        section('Inspection Details');
        cfg.headerFields.forEach(f => field(f.label, data[f.id]));
        y += 5;
        
        // Checklists
        Object.entries(cfg.checklists).forEach(([key, cl]) => {
            section(cl.title);
            const clData = data.checklists?.[key] || {};
            cl.items.forEach((item, i) => {
                check(5);
                const lbl = typeof item === 'object' ? item.label : item;
                const resp = clData[i]?.value || '';
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.text(lbl, m + 2, y);
                const mark = resp === 'yes' || resp === 'ok' ? '[✓]' : resp === 'no' || resp === 'notok' ? '[✗]' : resp === 'na' ? '[N/A]' : '[ ]';
                doc.text(mark, cw - 5, y);
                y += 4;
            });
            y += 3;
        });
        
        // Mitigations
        if (cfg.hasMitigations && data.mitigations?.length) {
            section('Risk Mitigations');
            data.mitigations.forEach((m2, i) => {
                if (m2.hazard || m2.control) {
                    check(10);
                    doc.setFontSize(7);
                    doc.text(`${i + 1}. ${m2.hazard || ''}`, m, y); y += 3;
                    doc.text(`   Control: ${m2.control || ''}`, m, y); y += 3;
                    doc.text(`   Initial: ${m2.initial || ''}`, m, y); y += 4;
                }
            });
        }
        
        // Worker signatures
        if (cfg.hasWorkerSignatures && data.workerSignatures?.length) {
            section('Worker Acknowledgment');
            data.workerSignatures.forEach((w, i) => {
                if (w.name || w.signature) {
                    check(4);
                    doc.setFontSize(7);
                    doc.text(`${i + 1}. ${w.name || ''} — ${w.signature || ''}`, m, y);
                    y += 4;
                }
            });
        }
        
        // Supervisor signatures
        section('Signatures');
        cfg.supervisorSignatures.forEach(sig => {
            check(8);
            doc.setFontSize(7);
            doc.text(sig.label + ':', m, y);
            doc.line(m + 40, y, m + 100, y);
            if (data[sig.id]) {
                doc.setFont('helvetica', 'italic');
                doc.text(data[sig.id], m + 42, y - 1);
                doc.setFont('helvetica', 'normal');
            }
            y += 8;
        });
        
        // Footer
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated: ${new Date().toISOString()}`, m, ph - 10);
        
        // Filename
        const dateField = formType === 'flra' ? 'assessmentDate' : 'inspectionDate';
        const dateStr = (data[dateField] || new Date().toISOString().split('T')[0]).replace(/-/g, '');
        const jobNum = (data.jobFileNumber || data.manliftNumber || 'NOJOB').replace(/[^a-zA-Z0-9]/g, '');
        const filename = `${dateStr}_${jobNum}_00.pdf`;
        const folderPath = `${cfg.folderName}/${dateStr.substring(0, 4)}/`;
        
        const blob = doc.output('blob');
        
        return {
            blob,
            filename,
            folderPath,
            fullPath: `${folderPath}${filename}`,
            base64: await blobToBase64(blob)
        };
    };
    
    DocFlowPDF.download = async function(formType, data, cfg) {
        const result = await DocFlowPDF.generate(formType, data, cfg);
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return result.filename;
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
