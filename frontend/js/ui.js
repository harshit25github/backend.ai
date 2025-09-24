class ChatUI {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.chatIdInput = document.getElementById('chatId');
        this.managerChatMessages = document.getElementById('managerChatMessages');
        this.managerMessageInput = document.getElementById('managerMessageInput');
        this.managerChatIdInput = document.getElementById('managerChatId');
        // Enhanced manager elements
        this.enhancedChatMessages = document.getElementById('enhancedChatMessages');
        this.enhancedMessageInput = document.getElementById('enhancedMessageInput');
        this.enhancedSessionIdInput = document.getElementById('enhancedSessionId');
        this.userNameInput = document.getElementById('userName');
        this.enhancedContext = document.getElementById('enhancedContext');

        this.jsonResponse = document.getElementById('jsonResponse');
        this.streamResponse = document.getElementById('streamResponse');
        this.logsResponse = document.getElementById('logsResponse');
        this.apiResults = document.getElementById('apiResults');
        this.serverStatus = document.getElementById('serverStatus');
        this.contextDetails = document.getElementById('contextDetails');
        this.managerContext = document.getElementById('managerContext');
        this.currentStreamingMessage = null;
        this.currentManagerStreamingMessage = null;
        this.currentEnhancedStreamingMessage = null;
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

    // Manager Chat Methods
    addManagerMessage(content, type = 'user', isStreaming = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        if (isStreaming) {
            messageDiv.classList.add('streaming');
            this.currentManagerStreamingMessage = messageDiv;
        }

        messageDiv.textContent = content;
        this.managerChatMessages.appendChild(messageDiv);
        this.managerChatMessages.scrollTop = this.managerChatMessages.scrollHeight;

        return messageDiv;
    }

    updateManagerStreamingMessage(content) {
        if (this.currentManagerStreamingMessage) {
            this.currentManagerStreamingMessage.textContent = content;
            this.managerChatMessages.scrollTop = this.managerChatMessages.scrollHeight;
        }
    }

    finishManagerStreaming(finalContent) {
        if (this.currentManagerStreamingMessage) {
            this.currentManagerStreamingMessage.textContent = finalContent;
            this.currentManagerStreamingMessage.classList.remove('streaming');
            this.currentManagerStreamingMessage = null;
        }
    }

    clearManagerChat() {
        this.managerChatMessages.innerHTML = '';
        this.currentManagerStreamingMessage = null;
        this.hideManagerContext();
    }

    getManagerChatId() {
        return this.managerChatIdInput.value.trim() || 'manager-default';
    }

    getManagerMessage() {
        return this.managerMessageInput.value.trim();
    }

    clearManagerMessageInput() {
        this.managerMessageInput.value = '';
    }

    focusManagerMessageInput() {
        this.managerMessageInput.focus();
    }

    showManagerContext(context, lastAgent) {
        if (context) {
            const contextHtml = `
                <div class="context-item">
                    <strong>Last Agent:</strong> ${lastAgent || 'Unknown'}
                </div>
                <div class="context-item">
                    <strong>Trip Details:</strong>
                    <pre>${JSON.stringify(context.trip || {}, null, 2)}</pre>
                </div>
                <div class="context-item">
                    <strong>User Info:</strong>
                    <pre>${JSON.stringify(context.userInfo || {}, null, 2)}</pre>
                </div>
            `;
            this.contextDetails.innerHTML = contextHtml;
            this.managerContext.style.display = 'block';
        }
    }

    hideManagerContext() {
        this.managerContext.style.display = 'none';
    }

    addManagerSystemMessage(content) {
        this.addManagerMessage(content, 'system');
    }

    // Enhanced Manager Methods
    addEnhancedMessage(content, type = 'user', isStreaming = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        if (isStreaming) {
            messageDiv.classList.add('streaming');
            this.currentEnhancedStreamingMessage = messageDiv;
        }

        messageDiv.innerHTML = this.formatMessage(content);
        this.enhancedChatMessages.appendChild(messageDiv);
        this.enhancedChatMessages.scrollTop = this.enhancedChatMessages.scrollHeight;

        return messageDiv;
    }

    formatMessage(content) {
        // Convert newlines to <br> and preserve formatting
        return content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    updateEnhancedStreamingMessage(content) {
        if (this.currentEnhancedStreamingMessage) {
            this.currentEnhancedStreamingMessage.innerHTML = this.formatMessage(content);
            this.enhancedChatMessages.scrollTop = this.enhancedChatMessages.scrollHeight;
        }
    }

    finishEnhancedStreaming(finalContent) {
        if (this.currentEnhancedStreamingMessage) {
            this.currentEnhancedStreamingMessage.innerHTML = this.formatMessage(finalContent);
            this.currentEnhancedStreamingMessage.classList.remove('streaming');
            this.currentEnhancedStreamingMessage = null;
        }
    }

    clearEnhancedChat() {
        this.enhancedChatMessages.innerHTML = '';
        this.currentEnhancedStreamingMessage = null;
        this.hideEnhancedContext();
    }

    getEnhancedSessionId() {
        return this.enhancedSessionIdInput.value.trim() || 'enhanced-default';
    }

    getEnhancedMessage() {
        return this.enhancedMessageInput.value.trim();
    }

    getUserName() {
        return this.userNameInput.value.trim() || 'User';
    }

    clearEnhancedMessageInput() {
        this.enhancedMessageInput.value = '';
    }

    focusEnhancedMessageInput() {
        this.enhancedMessageInput.focus();
    }

    showEnhancedContext(context, lastAgent) {
        if (context) {
            // Show summary tab
            this.showContextSummary(context.summary);

            // Show itinerary tab
            this.showContextItinerary(context.itinerary);

            // Show raw data tab
            document.getElementById('rawTab').innerHTML = `
                <div class="context-item">
                    <strong>Last Agent:</strong> ${lastAgent || 'Unknown'}
                </div>
                <div class="context-item">
                    <strong>Full Context:</strong>
                    <pre>${JSON.stringify(context, null, 2)}</pre>
                </div>
            `;

            this.enhancedContext.style.display = 'block';
        }
    }

    showContextSummary(summary) {
        const summaryTab = document.getElementById('summaryTab');

        const originCity = summary.origin?.city || 'Not set';
        const destinationCity = summary.destination?.city || 'Not set';
        const dates = summary.outbound_date && summary.return_date
            ? `${summary.outbound_date} to ${summary.return_date}`
            : 'Not set';
        const passengers = summary.passenger_count || 'Not set';
        const budget = summary.budget?.amount
            ? `${summary.budget.currency} ${summary.budget.amount.toLocaleString()} ${summary.budget.per_person ? 'per person' : 'total'}`
            : 'Not set';
        const duration = summary.duration_days ? `${summary.duration_days} days` : 'Not set';

        summaryTab.innerHTML = `
            <div class="summary-grid">
                <div class="summary-item">
                    <strong>Origin:</strong> ${originCity}
                </div>
                <div class="summary-item">
                    <strong>Destination:</strong> ${destinationCity}
                </div>
                <div class="summary-item">
                    <strong>Dates:</strong> ${dates}
                </div>
                <div class="summary-item">
                    <strong>Duration:</strong> ${duration}
                </div>
                <div class="summary-item">
                    <strong>Passengers:</strong> ${passengers}
                </div>
                <div class="summary-item">
                    <strong>Budget:</strong> ${budget}
                </div>
                ${summary.tripTypes && summary.tripTypes.length > 0 ? `
                <div class="summary-item">
                    <strong>Trip Types:</strong> ${summary.tripTypes.join(', ')}
                </div>
                ` : ''}
                ${summary.placesOfInterest && summary.placesOfInterest.length > 0 ? `
                <div class="summary-item">
                    <strong>Places of Interest:</strong>
                    <ul>
                        ${summary.placesOfInterest.map(place => `<li><strong>${place.placeName}</strong>: ${place.placeDescription}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        `;
    }

    showContextItinerary(itinerary) {
        const itineraryTab = document.getElementById('itineraryTab');

        if (!itinerary.days || itinerary.days.length === 0) {
            itineraryTab.innerHTML = '<p>No itinerary created yet.</p>';
            return;
        }

        const daysHtml = itinerary.days.map((day, index) => `
            <div class="itinerary-day">
                <h4>${day.title} (${day.date})</h4>
                <div class="day-segments">
                    ${day.segments.morning && day.segments.morning.length > 0 ? `
                    <div class="segment">
                        <h5>🌅 Morning</h5>
                        <ul>
                            ${day.segments.morning.map(activity => `
                                <li><strong>${activity.places}</strong> (${activity.duration_hours}h) - ${activity.descriptor}</li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    ${day.segments.afternoon && day.segments.afternoon.length > 0 ? `
                    <div class="segment">
                        <h5>☀️ Afternoon</h5>
                        <ul>
                            ${day.segments.afternoon.map(activity => `
                                <li><strong>${activity.places}</strong> (${activity.duration_hours}h) - ${activity.descriptor}</li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    ${day.segments.evening && day.segments.evening.length > 0 ? `
                    <div class="segment">
                        <h5>🌙 Evening</h5>
                        <ul>
                            ${day.segments.evening.map(activity => `
                                <li><strong>${activity.places}</strong> (${activity.duration_hours}h) - ${activity.descriptor}</li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        const computedInfo = itinerary.computed ? `
            <div class="itinerary-stats">
                <strong>Stats:</strong>
                ${itinerary.computed.duration_days ? `Duration: ${itinerary.computed.duration_days} days` : ''}
                ${itinerary.computed.itinerary_length ? `| Days planned: ${itinerary.computed.itinerary_length}` : ''}
                ${itinerary.computed.matches_duration !== null ? `| Matches duration: ${itinerary.computed.matches_duration ? 'Yes' : 'No'}` : ''}
            </div>
        ` : '';

        itineraryTab.innerHTML = `
            ${daysHtml}
            ${computedInfo}
        `;
    }

    hideEnhancedContext() {
        this.enhancedContext.style.display = 'none';
    }

    addEnhancedSystemMessage(content) {
        this.addEnhancedMessage(content, 'system');
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

function handleManagerKeyPress(event) {
    if (event.key === 'Enter') {
        sendManagerStreamMessage();
    }
}

function handleEnhancedKeyPress(event) {
    if (event.key === 'Enter') {
        sendEnhancedMessage();
    }
}

function showContextTab(tabName) {
    document.querySelectorAll('.context-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.context-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
}

const ui = new ChatUI();