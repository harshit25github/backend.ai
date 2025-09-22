class ChatUI {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.chatIdInput = document.getElementById('chatId');
        this.jsonResponse = document.getElementById('jsonResponse');
        this.streamResponse = document.getElementById('streamResponse');
        this.logsResponse = document.getElementById('logsResponse');
        this.apiResults = document.getElementById('apiResults');
        this.serverStatus = document.getElementById('serverStatus');
        this.currentStreamingMessage = null;
    }

    addMessage(content, type = 'user', isStreaming = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        if (isStreaming) {
            messageDiv.classList.add('streaming');
            this.currentStreamingMessage = messageDiv;
        }
        
        messageDiv.textContent = content;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }

    updateStreamingMessage(content) {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.textContent = content;
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    finishStreaming(finalContent) {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.textContent = finalContent;
            this.currentStreamingMessage.classList.remove('streaming');
            this.currentStreamingMessage = null;
        }
    }

    addSystemMessage(content) {
        this.addMessage(content, 'system');
    }

    clearChat() {
        this.chatMessages.innerHTML = '';
        this.currentStreamingMessage = null;
    }

    setJsonResponse(data) {
        this.jsonResponse.textContent = JSON.stringify(data, null, 2);
    }

    appendStreamData(data) {
        const timestamp = new Date().toLocaleTimeString();
        this.streamResponse.textContent += `[${timestamp}] ${JSON.stringify(data)}\n`;
        this.streamResponse.scrollTop = this.streamResponse.scrollHeight;
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
        this.logsResponse.textContent += logEntry;
        this.logsResponse.scrollTop = this.logsResponse.scrollHeight;
    }

    setApiResults(results) {
        this.apiResults.innerHTML = '';
        
        for (const [endpoint, result] of Object.entries(results)) {
            const resultDiv = document.createElement('div');
            resultDiv.style.marginBottom = '10px';
            
            const statusClass = result.success ? 'success' : 'error';
            const statusText = result.success ? '✅' : '❌';
            
            resultDiv.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <span class="status-indicator ${statusClass}"></span>
                    <strong>${endpoint}</strong> ${statusText}
                </div>
                <pre style="margin-left: 20px; font-size: 0.8rem;">${JSON.stringify(result, null, 2)}</pre>
            `;
            
            this.apiResults.appendChild(resultDiv);
        }
    }

    updateServerStatus(isOnline, message = '') {
        if (isOnline) {
            this.serverStatus.textContent = message || '🟢 Server Online';
            this.serverStatus.className = 'server-status online';
        } else {
            this.serverStatus.textContent = message || '🔴 Server Offline';
            this.serverStatus.className = 'server-status offline';
        }
    }

    setServerStatusChecking() {
        this.serverStatus.textContent = '🟡 Checking connection...';
        this.serverStatus.className = 'server-status checking';
    }

    getChatId() {
        return this.chatIdInput.value.trim() || 'default-chat';
    }

    getMessage() {
        return this.messageInput.value.trim();
    }

    clearMessageInput() {
        this.messageInput.value = '';
    }

    focusMessageInput() {
        this.messageInput.focus();
    }

    showLoading(element) {
        const originalText = element.textContent;
        element.textContent = 'Loading...';
        element.disabled = true;
        
        return () => {
            element.textContent = originalText;
            element.disabled = false;
        };
    }
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendStreamMessage();
    }
}

const ui = new ChatUI();