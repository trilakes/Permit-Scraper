
// Permits Panel Microphone & Button Fixes
window.addEventListener('DOMContentLoaded', function() {
    // Microphone icon for permit panel (add if missing)
    var fetchBtn = document.getElementById('fetchPermitsBtn');
    if (fetchBtn && !fetchBtn.querySelector('.fa-microphone')) {
        var micIcon = document.createElement('i');
        micIcon.className = 'fas fa-microphone';
        fetchBtn.insertBefore(micIcon, fetchBtn.firstChild);
    }

    // Make fetch button larger and more prominent
    if (fetchBtn) {
        fetchBtn.style.fontSize = '1.25rem';
        fetchBtn.style.padding = '1em 2em';
        fetchBtn.style.borderRadius = '16px';
    }

    // Make GPT-3.5 button larger if present
    var gptBtn = document.querySelector('.gpt-btn');
    if (gptBtn) {
        gptBtn.style.fontSize = '1.1rem';
        gptBtn.style.padding = '0.8em 2em';
        gptBtn.style.borderRadius = '16px';
    }

    // Remove any duplicate event listeners by ensuring only one click handler is attached
    if (fetchBtn) {
        fetchBtn.onclick = async function() {
            const statusMsg = document.getElementById('permitStatusMessage');
            if (statusMsg) statusMsg.textContent = '';
            // Always keep controls/status visible at top
            const permitResults = document.getElementById('permitResults');
            if (permitResults) permitResults.innerHTML = '';

            // Gather inputs
            const dayRange = document.getElementById('permitDayRange')?.value || 30;
            const homeownerOnly = document.getElementById('homeownerToggle')?.checked || false;
            const reportText = document.getElementById('permitReportText')?.value || '';
            const fileInput = document.getElementById('permitFileInput');
            let mode = 'fetch';
            let files = [];
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                mode = 'files';
                for (let i = 0; i < fileInput.files.length; i++) {
                    const file = fileInput.files[i];
                    const reader = new FileReader();
                    files.push(await new Promise((resolve, reject) => {
                        reader.onload = () => {
                            const arrayBuffer = reader.result;
                            const uint8Array = new Uint8Array(arrayBuffer);
                            let binary = '';
                            for (let i = 0; i < uint8Array.length; i++) {
                                binary += String.fromCharCode(uint8Array[i]);
                            }
                            resolve({
                                name: file.name,
                                content_base64: btoa(binary)
                            });
                        };
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(file);
                    }));
                }
            } else if (reportText.trim()) {
                mode = 'stdin';
            }

            const payload = {
                mode,
                days: dayRange,
                homeowner_only: homeownerOnly,
                report_text: reportText,
                files
            };

            if (statusMsg) statusMsg.textContent = 'Fetching permits...';
            fetchBtn.disabled = true;
            try {
                const response = await fetch('/api/permits', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                fetchBtn.disabled = false;
                if (data.status !== 'ok') {
                    if (statusMsg) statusMsg.textContent = data.message || 'Error fetching permits.';
                    return;
                }
                if (data.row_count === 0) {
                    if (statusMsg) statusMsg.textContent = 'No permits found for the selected window.';
                    return;
                }
                if (data.rows && Array.isArray(data.rows)) {
                    showPermitModal(renderPermitTable(data.rows));
                    if (statusMsg) statusMsg.textContent = data.message || '';
                }
            } catch (err) {
                fetchBtn.disabled = false;
                if (statusMsg) statusMsg.textContent = 'Failed to fetch permits.';
            }
        };
    }

    // Helper to render permit table
    function renderPermitTable(rows) {
        if (!rows || rows.length === 0) return '<div>No permits found.</div>';
        let html = '<div class="permits-table-wrapper"><table class="permits-table"><thead><tr>';
        html += '<th>Date</th><th>ID</th><th>Location</th><th>Contractor</th><th>Project</th><th>Details</th></tr></thead><tbody>';
        for (const row of rows) {
            // Combine address, city, zip
            let location = [row.address, row.city, row.zip].filter(Boolean).join(', ');
            html += `<tr>
                <td><span class="permit-date">${row.issue_date || ''}</span></td>
                <td><span class="permit-id">${row.permit_id || ''}</span></td>
                <td><span class="permit-location">${location}</span></td>
                <td><span class="permit-contractor">${row.contractor || ''}</span></td>
                <td><span class="permit-project">${row.project_name || ''}</span></td>
                <td><a class="permit-details-link" href="${row.details_url || '#'}" target="_blank">View</a></td>
            </tr>`;
        }
        html += '</tbody></table></div>';
        return html;
    }

    // Modal logic for permit results
    function showPermitModal(contentHtml) {
        let overlay = document.createElement('div');
        overlay.className = 'permits-modal-overlay';
        let modal = document.createElement('div');
        modal.className = 'permits-modal';
        let closeBtn = document.createElement('button');
        closeBtn.className = 'permits-modal-close';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.onclick = function() {
            document.body.removeChild(overlay);
        };
        modal.appendChild(closeBtn);
        let content = document.createElement('div');
        content.innerHTML = contentHtml;
        content.style.overflowY = 'auto';
        content.style.maxHeight = '60vh';
        modal.appendChild(content);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }
});


        // Modal logic for permit results
        function showPermitModal(contentHtml) {
            let overlay = document.createElement('div');
            overlay.className = 'permits-modal-overlay';
            let modal = document.createElement('div');
            modal.className = 'permits-modal';
            let closeBtn = document.createElement('button');
            closeBtn.className = 'permits-modal-close';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.onclick = function() {
                document.body.removeChild(overlay);
            };
            modal.appendChild(closeBtn);
            let content = document.createElement('div');
            content.innerHTML = contentHtml;
            content.style.overflowY = 'auto';
            content.style.maxHeight = '60vh';
            modal.appendChild(content);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        }

        // Override permitResults rendering to use modal
        if (fetchBtn) {
            fetchBtn.addEventListener('click', async function() {
                const permitResults = document.getElementById('permitResults');
                const statusMsg = document.getElementById('permitStatusMessage');
                if (statusMsg) statusMsg.textContent = '';
                if (permitResults) permitResults.innerHTML = '';

                // Gather inputs
                const dayRange = document.getElementById('permitDayRange')?.value || 30;
                const homeownerOnly = document.getElementById('homeownerToggle')?.checked || false;
                const reportText = document.getElementById('permitReportText')?.value || '';
                const fileInput = document.getElementById('permitFileInput');
                let mode = 'fetch';
                let files = [];
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    mode = 'files';
                    for (let i = 0; i < fileInput.files.length; i++) {
                        const file = fileInput.files[i];
                        const reader = new FileReader();
                        files.push(await new Promise((resolve, reject) => {
                            reader.onload = () => {
                                resolve({
                                    name: file.name,
                                    content_base64: btoa(reader.result)
                                });
                            };
                            reader.onerror = reject;
                            reader.readAsBinaryString(file);
                        }));
                    }
                } else if (reportText.trim()) {
                    mode = 'stdin';
                }

                const payload = {
                    mode,
                    days: dayRange,
                    homeowner_only: homeownerOnly,
                    report_text: reportText,
                    files
                };

                if (statusMsg) statusMsg.textContent = 'Fetching permits...';
                fetchBtn.disabled = true;
                try {
                    const response = await fetch('/api/permits', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    fetchBtn.disabled = false;
                    if (data.status !== 'ok') {
                        if (statusMsg) statusMsg.textContent = data.message || 'Error fetching permits.';
                        return;
                    }
                    if (data.row_count === 0) {
                        if (statusMsg) statusMsg.textContent = 'No permits found for the selected window.';
                        return;
                    }
                    if (data.rows && Array.isArray(data.rows)) {
                        showPermitModal(renderPermitTable(data.rows));
                        if (statusMsg) statusMsg.textContent = data.message || '';
                    }
                } catch (err) {
                    fetchBtn.disabled = false;
                    if (statusMsg) statusMsg.textContent = 'Failed to fetch permits.';
                }
            });
        }
