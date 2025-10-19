(function() {
    window.addEventListener('DOMContentLoaded', () => {
        const fetchBtn = document.getElementById('fetchPermitsBtn');
        const statusMsg = document.getElementById('permitStatusMessage');
        const permitResults = document.getElementById('permitResults');
        const fileInput = document.getElementById('permitFileInput');
        const fileList = document.getElementById('permitFileList');
        const clearBtn = document.getElementById('clearPermitInputs');
        const reportText = document.getElementById('permitReportText');
        const dayRangeSelect = document.getElementById('permitDayRange');
        const homeownerToggle = document.getElementById('homeownerToggle');

        if (fileInput && fileList) {
            fileInput.addEventListener('change', () => renderFileList(fileInput, fileList));
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (fileInput) fileInput.value = '';
                if (reportText) reportText.value = '';
                if (statusMsg) statusMsg.textContent = '';
                if (permitResults) permitResults.innerHTML = '';
                renderFileList(fileInput, fileList);
            });
        }

        if (fetchBtn) {
            fetchBtn.addEventListener('click', async () => {
                if (statusMsg) {
                    statusMsg.textContent = 'Fetching permits...';
                }
                fetchBtn.disabled = true;
                try {
                    const payload = await buildPayload();
                    const data = await requestPermits(payload);

                    if (!data || data.status !== 'ok') {
                        throw new Error((data && data.message) || 'Unable to fetch permits right now.');
                    }

                    if (!Array.isArray(data.rows) || data.rows.length === 0) {
                        if (statusMsg) {
                            statusMsg.textContent = 'No permits found for the selected window.';
                        }
                        if (permitResults) permitResults.innerHTML = '';
                        return;
                    }

                    const tableMarkup = buildPermitTable(data.rows);
                    if (permitResults) {
                        permitResults.innerHTML = renderPermitCard(tableMarkup, data.rows.length);
                        const modalTrigger = permitResults.querySelector('.permit-modal-trigger');
                        if (modalTrigger) {
                            modalTrigger.addEventListener('click', () => showPermitModal(tableMarkup));
                        }
                    }

                    if (statusMsg) {
                        statusMsg.textContent = data.message || `${data.row_count || data.rows.length} permits retrieved.`;
                    }
                } catch (error) {
                    if (statusMsg) {
                        statusMsg.textContent = error.message || 'Failed to fetch permits.';
                    }
                } finally {
                    fetchBtn.disabled = false;
                }
            });
        }

        function renderFileList(input, target) {
            if (!input || !target) return;
            target.innerHTML = '';
            if (!input.files || !input.files.length) {
                return;
            }
            const fragment = document.createDocumentFragment();
            Array.from(input.files).forEach(file => {
                const pill = document.createElement('span');
                pill.className = 'permits-file-pill';
                pill.textContent = file.name;
                fragment.appendChild(pill);
            });
            target.appendChild(fragment);
        }

        async function buildPayload() {
            const payload = {
                mode: 'fetch',
                days: (dayRangeSelect && dayRangeSelect.value) || 30,
                homeowner_only: Boolean(homeownerToggle && homeownerToggle.checked),
                report_text: reportText ? reportText.value.trim() : '',
                files: []
            };

            if (fileInput && fileInput.files && fileInput.files.length) {
                payload.mode = 'files';
                payload.files = await Promise.all(Array.from(fileInput.files).map(readFileAsBase64));
            } else if (payload.report_text) {
                payload.mode = 'stdin';
            }

            return payload;
        }

        async function requestPermits(payload) {
            const response = await fetch('/api/permits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data && data.message ? data.message : 'Request failed.');
            }
            return data;
        }

        function buildPermitTable(rows) {
            let body = '';
            rows.forEach(row => {
                const location = [row.address, row.city, row.zip].filter(Boolean).join(', ');
                const contractor = escapeHtml(row.contractor || '—');
                const project = escapeHtml(row.project_name || '—');
                const date = escapeHtml(row.issue_date || '—');
                const permitId = escapeHtml(row.permit_id || '—');
                const detailsUrl = row.details_url ? escapeHtml(row.details_url) : '';

                body += `
                    <tr>
                        <td data-label="Date"><span class="permit-date">${date}</span></td>
                        <td data-label="Permit ID"><span class="permit-id-chip">${permitId}</span></td>
                        <td data-label="Location"><div class="permit-location">${escapeHtml(location || '—')}</div></td>
                        <td data-label="Contractor"><div class="permit-contractor">${contractor}</div></td>
                        <td data-label="Project"><div class="permit-project">${project}</div></td>
                        <td data-label="Details">
                            ${detailsUrl
                                ? `<a class="permit-details-link" href="${detailsUrl}" target="_blank" rel="noopener">View <i class="fas fa-arrow-up-right-from-square"></i></a>`
                                : '<span class="permit-details-missing">N/A</span>'}
                        </td>
                    </tr>`;
            });

            return `
                <table class="permits-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Permit ID</th>
                            <th>Location</th>
                            <th>Contractor</th>
                            <th>Project</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>`;
        }

        function renderPermitCard(tableMarkup, count) {
            return `
                <div class="permit-table-card">
                    <div class="permit-table-head">
                        <div class="permit-table-title">
                            <i class="fas fa-city"></i>
                            <span>${count} permit${count === 1 ? '' : 's'} found</span>
                        </div>
                        <button type="button" class="permit-modal-trigger">
                            <i class="fas fa-up-right-from-square"></i>
                            <span>Open fullscreen</span>
                        </button>
                    </div>
                    <div class="permit-table-scroll">${tableMarkup}</div>
                </div>`;
        }

        function showPermitModal(contentHtml) {
            const overlay = document.createElement('div');
            overlay.className = 'permits-modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'permits-modal';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'permits-modal-close';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.addEventListener('click', () => document.body.removeChild(overlay));

            const content = document.createElement('div');
            content.className = 'permits-modal-content';
            content.innerHTML = contentHtml;

            modal.appendChild(closeBtn);
            modal.appendChild(content);
            overlay.appendChild(modal);
            overlay.addEventListener('click', event => {
                if (event.target === overlay) {
                    document.body.removeChild(overlay);
                }
            });

            document.body.appendChild(overlay);
        }

        function readFileAsBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const bytes = new Uint8Array(reader.result);
                    let binary = '';
                    bytes.forEach(byte => {
                        binary += String.fromCharCode(byte);
                    });
                    resolve({
                        name: file.name,
                        content_base64: btoa(binary)
                    });
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(file);
            });
        }

        function escapeHtml(value) {
            if (!value) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    });
})();
