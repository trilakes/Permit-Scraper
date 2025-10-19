
window.addEventListener('DOMContentLoaded', function() {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const chatMessages = document.getElementById('chatMessages');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const charCount = document.getElementById('charCount');
    const clearChatBtn = document.getElementById('clearChatBtn');

    // Update character count
    if (messageInput && charCount) {
        messageInput.addEventListener('input', function() {
            charCount.textContent = `${messageInput.value.length}/2000`;
        });
    }

    // Send message on button click
    if (sendBtn && messageInput) {
        sendBtn.addEventListener('click', function() {
            sendMessage();
        });

        // Send message on Enter key (without Shift)
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;
        showLoading(true);
        sendBtn.disabled = true;
        messageInput.disabled = true;
        // Render user message
        renderMessage(text, 'user');
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        })
        .then(function(res) {
            return res.json();
        })
        .then(function(data) {
            if (data && data.ai_response && data.ai_response.message) {
                renderMessage(data.ai_response.message, 'assistant');
            } else {
                showError('No response from AI.');
            }
        })
        .catch(function() {
            showError('Failed to send message.');
        })
        .finally(function() {
            showLoading(false);
            sendBtn.disabled = false;
            messageInput.disabled = false;
            messageInput.value = '';
            charCount.textContent = '0/2000';
        });
    }

    function renderMessage(message, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = sender === 'user' ? 'user-message' : 'assistant-message';
        msgDiv.textContent = message;
        chatMessages.appendChild(msgDiv);
        // Auto-scroll to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 50);
    }

    function showLoading(show) {
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'block' : 'none';
        }
    }

    function showError(msg) {
        alert(msg);
    }

    if (clearChatBtn && chatMessages) {
        clearChatBtn.addEventListener('click', function() {
            chatMessages.innerHTML = '';
        });
    }
});
