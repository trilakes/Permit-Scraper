(function() {
    window.addEventListener('DOMContentLoaded', () => {
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        const chatThread = document.getElementById('chatMessages');
        const typingIndicator = document.getElementById('typingIndicator');
        const charCount = document.getElementById('charCount');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const errorToast = document.getElementById('errorToast');
        const errorMessage = document.getElementById('errorMessage');
        const activeModelLabel = document.getElementById('activeModelLabel');
        const modelPrimaryToggle = document.getElementById('modelPrimaryToggle');
        const modelMenuToggle = document.getElementById('modelMenuToggle');
        const modelMenu = document.getElementById('modelMenu');
        const micBtn = document.getElementById('micBtn');
        const welcomeTime = document.getElementById('welcomeTime');

        const initialThreadMarkup = chatThread ? chatThread.innerHTML : '';

        let isSending = false;
        let autoSendTimer = null;
        let hideErrorTimer = null;
        let recognition = null;
        let isRecording = false;

        let activeModel = null;
        let defaultModel = null;
        let modelOptions = [];
        let toggleModelId = null;

        if (welcomeTime) {
            const now = new Date();
            welcomeTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        if (messageInput) {
            messageInput.addEventListener('input', handleInput);
            messageInput.addEventListener('keydown', handleKeyDown);
            messageInput.focus();
            updateCharCount();
            updateSendButtonState();
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => sendMessage());
        }

        if (clearChatBtn && chatThread) {
            clearChatBtn.addEventListener('click', clearConversation);
        }

        if (modelPrimaryToggle) {
            modelPrimaryToggle.addEventListener('click', handlePrimaryModelToggle);
        }

        if (modelMenuToggle) {
            modelMenuToggle.addEventListener('click', toggleModelMenu);
        }

        document.addEventListener('click', handleDocumentClick, true);
        document.addEventListener('keydown', handleEscapeKey, true);

        setupVoiceInput();
        fetchModelState();

        window.hideError = hideError;

        function handleInput() {
            updateCharCount();
            updateSendButtonState();
            scheduleAutoSend();
        }

        function handleKeyDown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            } else {
                scheduleAutoSend();
            }
        }

        function updateCharCount() {
            if (charCount && messageInput) {
                const length = messageInput.value.length;
                charCount.textContent = `${length}/2000`;
            }
        }

        function updateSendButtonState() {
            if (!sendBtn || !messageInput) return;
            const hasText = Boolean(messageInput.value.trim());
            sendBtn.disabled = !hasText || isSending;
        }

        function scheduleAutoSend() {
            clearAutoSend();
            if (!messageInput || !messageInput.value.trim()) {
                return;
            }
            autoSendTimer = window.setTimeout(() => {
                sendMessage({ autoTriggered: true });
            }, 5000);
        }

        function clearAutoSend() {
            if (autoSendTimer) {
                clearTimeout(autoSendTimer);
                autoSendTimer = null;
            }
        }

        async function sendMessage({ autoTriggered = false } = {}) {
            if (!messageInput || isSending) {
                return;
            }

            const text = messageInput.value.trim();
            if (!text) {
                return;
            }

            clearAutoSend();
            isSending = true;
            updateSendButtonState();
            toggleTyping(true);
            toggleOverlay(true);

            if (messageInput) {
                messageInput.disabled = true;
            }
            if (sendBtn) {
                sendBtn.disabled = true;
            }

            appendMessage({ type: 'user', message: text });
            messageInput.value = '';
            updateCharCount();
            updateSendButtonState();

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });

                const data = await response.json();
                if (!response.ok || data.error) {
                    throw new Error(data.error || 'The assistant could not process that request.');
                }

                const ai = data.ai_response || {};
                appendMessage({
                    type: 'assistant',
                    message: ai.message || '',
                    webResults: ai.web_results || ai.webResults || []
                });
            } catch (error) {
                showError(error.message || 'Failed to send your message.');
            } finally {
                isSending = false;
                toggleTyping(false);
                toggleOverlay(false);
                if (messageInput) {
                    messageInput.disabled = false;
                    messageInput.focus();
                }
                if (sendBtn) {
                    sendBtn.disabled = false;
                }
                updateSendButtonState();
            }
        }

        function appendMessage({ type, message, webResults }) {
            if (!chatThread) return;

            const container = document.createElement('div');
            container.classList.add('message-container');
            container.classList.add(type === 'user' ? 'user-message' : 'assistant-message');

            const avatar = document.createElement('div');
            avatar.classList.add('message-avatar');
            avatar.innerHTML = `<i class="fas ${type === 'user' ? 'fa-user' : 'fa-robot'}"></i>`;

            const content = document.createElement('div');
            content.classList.add('message-content');

            const bubble = document.createElement('div');
            bubble.classList.add('message-bubble');

            if (type === 'assistant') {
                const safeHtml = DOMPurify.sanitize(marked.parse(message || ''));
                bubble.innerHTML = safeHtml || '<p>...</p>';
            } else {
                bubble.textContent = message;
            }

            content.appendChild(bubble);

            if (Array.isArray(webResults) && webResults.length) {
                const resultsGrid = renderWebResults(webResults);
                if (resultsGrid) {
                    content.appendChild(resultsGrid);
                }
            }

            container.appendChild(avatar);
            container.appendChild(content);
            chatThread.appendChild(container);

            requestAnimationFrame(scrollToLatest);
        }

        function renderWebResults(results) {
            const validResults = results.filter(item => item && (item.title || item.url || item.snippet));
            if (!validResults.length) {
                return null;
            }

            const grid = document.createElement('div');
            grid.className = 'web-results-grid';

            validResults.slice(0, 6).forEach(result => {
                const hasUrl = Boolean(result.url);
                const card = document.createElement(hasUrl ? 'a' : 'div');
                card.className = 'web-result-card';
                if (hasUrl) {
                    card.href = result.url;
                    card.target = '_blank';
                    card.rel = 'noopener';
                }

                if (result.image) {
                    const media = document.createElement('div');
                    media.className = 'web-result-media';
                    const img = document.createElement('img');
                    img.src = result.image;
                    img.alt = result.title || result.url || 'Search result image';
                    media.appendChild(img);
                    card.appendChild(media);
                }

                const title = document.createElement('h4');
                title.className = 'web-result-title';
                title.textContent = result.title || result.url || 'Result';
                card.appendChild(title);

                if (result.snippet) {
                    const snippet = document.createElement('p');
                    snippet.className = 'web-result-snippet';
                    snippet.textContent = result.snippet;
                    card.appendChild(snippet);
                }

                const meta = document.createElement('div');
                meta.className = 'web-result-meta';

                let source = result.source || '';
                if (!source && result.url) {
                    try {
                        source = new URL(result.url).hostname;
                    } catch (err) {
                        source = '';
                    }
                }

                if (source) {
                    const sourceSpan = document.createElement('span');
                    sourceSpan.textContent = source;
                    meta.appendChild(sourceSpan);
                }
                if (hasUrl) {
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-arrow-up-right-from-square';
                    meta.appendChild(icon);
                }
                if (meta.childNodes.length) {
                    card.appendChild(meta);
                }

                grid.appendChild(card);
            });

            return grid;
        }

        function scrollToLatest() {
            if (!chatThread) return;
            chatThread.scrollTo({
                top: chatThread.scrollHeight,
                behavior: 'smooth'
            });
        }

        function toggleTyping(show) {
            if (!typingIndicator) return;
            typingIndicator.style.display = show ? 'block' : 'none';
        }

        function toggleOverlay(show) {
            if (!loadingOverlay) return;
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }

        function showError(message) {
            if (!errorToast || !errorMessage) {
                alert(message);
                return;
            }
            errorMessage.textContent = message;
            errorToast.style.display = 'flex';
            if (hideErrorTimer) {
                clearTimeout(hideErrorTimer);
            }
            hideErrorTimer = window.setTimeout(hideError, 5000);
        }

        function hideError() {
            if (errorToast) {
                errorToast.style.display = 'none';
            }
            if (hideErrorTimer) {
                clearTimeout(hideErrorTimer);
                hideErrorTimer = null;
            }
        }

        async function clearConversation() {
            if (!chatThread) return;
            chatThread.innerHTML = initialThreadMarkup;
            scrollToLatest();
            try {
                await fetch('/api/clear', { method: 'POST' });
            } catch (err) {
                console.warn('Failed to clear server history', err);
            }
        }

        async function fetchModelState() {
            try {
                const response = await fetch('/api/model');
                const data = await response.json();
                activeModel = data.model;
                modelOptions = Array.isArray(data.options) ? data.options : [];
                defaultModel = (modelOptions.find(option => option.is_default) || {}).id || data.model;
                const altOption = modelOptions.find(option => option.id !== defaultModel && option.id.includes('3.5'));
                toggleModelId = altOption ? altOption.id : defaultModel;
                updateModelUI();
                buildModelMenu();
            } catch (error) {
                console.warn('Unable to load model state', error);
            }
        }

        function updateModelUI() {
            if (!activeModelLabel || !modelPrimaryToggle) return;
            const current = modelOptions.find(option => option.id === activeModel);
            activeModelLabel.textContent = current ? current.display_name : activeModel;
            modelPrimaryToggle.classList.toggle('is-alt', activeModel && defaultModel && activeModel !== defaultModel);
        }

        function buildModelMenu() {
            if (!modelMenu) return;
            modelMenu.innerHTML = '';

            if (!modelOptions.length) {
                const empty = document.createElement('div');
                empty.className = 'model-menu-empty';
                empty.textContent = 'No alternate models available';
                modelMenu.appendChild(empty);
                return;
            }

            modelOptions.forEach(option => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.modelId = option.id;
                btn.textContent = option.display_name;
                if (option.id === activeModel) {
                    btn.classList.add('is-active');
                }
                btn.addEventListener('click', () => {
                    closeModelMenu();
                    setPreferredModel(option.id);
                });
                modelMenu.appendChild(btn);
            });
        }

        function handlePrimaryModelToggle() {
            if (!defaultModel) return;
            const nextModel = activeModel === defaultModel ? toggleModelId : defaultModel;
            setPreferredModel(nextModel);
        }

        async function setPreferredModel(modelId) {
            try {
                const payload = { model: modelId === defaultModel ? 'default' : modelId };
                const response = await fetch('/api/model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok || data.error) {
                    throw new Error(data.error || 'Unable to change model.');
                }
                await fetchModelState();
            } catch (error) {
                showError(error.message || 'Unable to switch models right now.');
            }
        }

        function toggleModelMenu() {
            if (!modelMenuToggle || !modelMenu) return;
            const isOpen = modelMenu.classList.toggle('is-open');
            modelMenuToggle.setAttribute('aria-expanded', String(isOpen));
        }

        function closeModelMenu() {
            if (!modelMenuToggle || !modelMenu) return;
            modelMenu.classList.remove('is-open');
            modelMenuToggle.setAttribute('aria-expanded', 'false');
        }

        function handleDocumentClick(event) {
            if (!modelMenu || !modelMenuToggle) return;
            if (!modelMenu.contains(event.target) && !modelMenuToggle.contains(event.target)) {
                closeModelMenu();
            }
        }

        function handleEscapeKey(event) {
            if (event.key === 'Escape') {
                closeModelMenu();
                if (isRecording) {
                    stopRecording();
                }
            }
        }

        function setupVoiceInput() {
            if (!micBtn) return;
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                micBtn.disabled = true;
                micBtn.title = 'Voice input is not supported in this browser.';
                return;
            }

            recognition = new SpeechRecognition();
            recognition.lang = navigator.language || 'en-US';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.addEventListener('start', () => {
                isRecording = true;
                setMicRecordingState(true);
            });

            recognition.addEventListener('end', () => {
                isRecording = false;
                setMicRecordingState(false);
            });

            recognition.addEventListener('error', event => {
                isRecording = false;
                setMicRecordingState(false);
                showError(event.error === 'not-allowed' ? 'Microphone access was denied.' : 'Voice input error.');
            });

            recognition.addEventListener('result', event => {
                let transcript = '';
                for (let i = 0; i < event.results.length; i += 1) {
                    transcript += event.results[i][0].transcript;
                }
                transcript = transcript.trim();
                if (transcript && messageInput) {
                    const needsSpace = messageInput.value && !messageInput.value.endsWith(' ');
                    messageInput.value += `${needsSpace ? ' ' : ''}${transcript}`;
                    updateCharCount();
                    updateSendButtonState();
                    scheduleAutoSend();
                }
            });

            micBtn.addEventListener('click', () => {
                if (!recognition) return;
                if (isRecording) {
                    stopRecording();
                } else {
                    startRecording();
                }
            });
        }

        function startRecording() {
            if (!recognition || isRecording) return;
            try {
                recognition.start();
            } catch (error) {
                showError('Unable to access the microphone.');
            }
        }

        function stopRecording() {
            if (!recognition || !isRecording) return;
            recognition.stop();
        }

        function setMicRecordingState(active) {
            if (!micBtn) return;
            micBtn.classList.toggle('is-recording', active);
            micBtn.setAttribute('aria-pressed', String(active));
        }
    });
})();
