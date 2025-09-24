document.addEventListener('DOMContentLoaded', function() {
    ui.addLog('Frontend initialized');
    ui.focusMessageInput();
    
    checkServerConnection();
    
    const apiUrlInput = document.getElementById('apiUrl');
    apiUrlInput.addEventListener('change', function() {
        chatAPI.setBaseUrl(this.value);
        checkServerConnection();
    });
});

async function checkServerConnection() {
    ui.setServerStatusChecking();
    ui.addLog('Checking server connection...');
    
    try {
        const result = await chatAPI.testConnection();
        if (result.success) {
            ui.updateServerStatus(true, `🟢 Server Online (${result.status})`);
            ui.addLog('Server connection successful', 'success');
        } else {
            ui.updateServerStatus(false, `🔴 Server Offline (${result.status || 'No response'})`);
            ui.addLog(`Server connection failed: ${result.error || result.statusText}`, 'error');
        }
    } catch (error) {
        ui.updateServerStatus(false, '🔴 Connection Error');
        ui.addLog(`Connection error: ${error.message}`, 'error');
    }
}


async function sendStreamMessage() {
    const message = ui.getMessage();
    const chatId = ui.getChatId();
    
    if (!message) {
        ui.addSystemMessage('Please enter a message');
        return;
    }
    
    ui.addMessage(message, 'user');
    ui.clearMessageInput();
    ui.addLog(`Starting stream for chat: ${chatId}`);
    
    const streamBtn = event?.target || document.querySelector('.btn.secondary');
    const restoreBtn = ui.showLoading(streamBtn);
    
    let streamingContent = '';
    const streamingMessage = ui.addMessage('', 'assistant', true);
    
    try {
        await chatAPI.sendStreamMessage(
            chatId,
            message,
            (token) => {
                streamingContent += token;
                ui.updateStreamingMessage(streamingContent);
                ui.appendStreamData({ type: 'token', token });
            },
            (finalContent) => {
                ui.finishStreaming(finalContent || streamingContent);
                ui.setJsonResponse({ success: true, content: finalContent || streamingContent });
                ui.addLog('Stream completed successfully', 'success');
                ui.appendStreamData({ type: 'done', content: finalContent });
            },
            (error) => {
                ui.finishStreaming(`Error: ${error.message}`);
                ui.addSystemMessage(`Stream error: ${error.message}`);
                ui.addLog(`Stream error: ${error.message}`, 'error');
                ui.appendStreamData({ type: 'error', error: error.message });
            }
        );
    } catch (error) {
        ui.addSystemMessage(`Error: ${error.message}`);
        ui.addLog(`Stream setup error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
        ui.focusMessageInput();
    }
}

async function loadHistory() {
    const chatId = ui.getChatId();
    ui.addLog(`Loading history for chat: ${chatId}`);
    
    const historyBtn = event?.target || document.querySelector('.btn.info');
    const restoreBtn = ui.showLoading(historyBtn);
    
    try {
        const history = await chatAPI.getHistory(chatId);
        ui.setJsonResponse(history);
        
        ui.clearChat();
        
        if (history.messages && history.messages.length > 0) {
            history.messages.forEach(msg => {
                ui.addMessage(msg.content, msg.role);
            });
            ui.addLog(`Loaded ${history.messages.length} messages from history`, 'success');
        } else {
            ui.addSystemMessage('No messages found in history');
            ui.addLog('No messages found in history', 'info');
        }
    } catch (error) {
        ui.addSystemMessage(`Error loading history: ${error.message}`);
        ui.addLog(`Load history error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
    }
}

async function clearChat() {
    const chatId = ui.getChatId();
    
    if (!confirm(`Are you sure you want to clear chat: ${chatId}?`)) {
        return;
    }
    
    ui.addLog(`Clearing chat: ${chatId}`);
    
    const clearBtn = event?.target || document.querySelector('.btn.danger');
    const restoreBtn = ui.showLoading(clearBtn);
    
    try {
        const response = await chatAPI.clearChat(chatId);
        ui.setJsonResponse(response);
        ui.clearChat();
        ui.addSystemMessage('Chat cleared successfully');
        ui.addLog('Chat cleared successfully', 'success');
    } catch (error) {
        ui.addSystemMessage(`Error clearing chat: ${error.message}`);
        ui.addLog(`Clear chat error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
    }
}

async function testConnection() {
    ui.addLog('Testing connection...');
    
    const testBtn = event?.target || document.querySelector('.btn.info');
    const restoreBtn = ui.showLoading(testBtn);
    
    try {
        const result = await chatAPI.testConnection();
        ui.setApiResults({ 'Connection Test': result });
        
        if (result.success) {
            ui.updateServerStatus(true);
            ui.addLog('Connection test successful', 'success');
        } else {
            ui.updateServerStatus(false);
            ui.addLog(`Connection test failed: ${result.error}`, 'error');
        }
    } catch (error) {
        ui.addSystemMessage(`Connection test error: ${error.message}`);
        ui.addLog(`Connection test error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
    }
}

async function testAllEndpoints() {
    ui.addLog('Testing all endpoints...');
    
    const testBtn = event?.target || document.querySelector('.btn.warning');
    const restoreBtn = ui.showLoading(testBtn);
    
    const results = {};
    const testChatId = 'test-' + Date.now();
    
    try {
        ui.addLog('Testing POST /api/chat/message...');
        try {
            const messageResult = await chatAPI.sendMessage(testChatId, 'Test message');
            results['POST /api/chat/message'] = { success: true, data: messageResult };
        } catch (error) {
            results['POST /api/chat/message'] = { success: false, error: error.message };
        }
        
        ui.addLog('Testing GET /api/chat/history...');
        try {
            const historyResult = await chatAPI.getHistory(testChatId);
            results['GET /api/chat/history'] = { success: true, data: historyResult };
        } catch (error) {
            results['GET /api/chat/history'] = { success: false, error: error.message };
        }
        
        ui.addLog('Testing DELETE /api/chat/clear...');
        try {
            const clearResult = await chatAPI.clearChat(testChatId);
            results['DELETE /api/chat/clear'] = { success: true, data: clearResult };
        } catch (error) {
            results['DELETE /api/chat/clear'] = { success: false, error: error.message };
        }
        
        ui.addLog('Testing POST /api/chat/stream...');
        results['POST /api/chat/stream'] = { success: false, error: 'Stream testing requires manual verification' };
        
        ui.setApiResults(results);
        ui.addLog('All endpoint tests completed', 'success');
        
    } catch (error) {
        ui.addSystemMessage(`Test error: ${error.message}`);
        ui.addLog(`Test error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
    }
}

// Manager Agent Functions
async function sendManagerStreamMessage() {
    const message = ui.getManagerMessage();
    const chatId = ui.getManagerChatId();

    if (!message) {
        ui.addManagerSystemMessage('Please enter a travel message');
        return;
    }

    ui.addManagerMessage(message, 'user');
    ui.clearManagerMessageInput();
    ui.addLog(`Starting manager stream for chat: ${chatId}`);

    const streamBtn = event?.target || document.querySelector('button[onclick="sendManagerStreamMessage()"]');
    const restoreBtn = ui.showLoading(streamBtn);

    let streamingContent = '';
    const streamingMessage = ui.addManagerMessage('', 'assistant', true);
    let lastContext = null;
    let lastAgent = null;

    try {
        await chatAPI.sendManagerStreamMessage(
            chatId,
            message,
            (token) => {
                streamingContent += token;
                ui.updateManagerStreamingMessage(streamingContent);
                ui.appendStreamData({ type: 'token', token });
            },
            (finalContent, context, lastAgentName) => {
                ui.finishManagerStreaming(finalContent || streamingContent);
                lastContext = context;
                lastAgent = lastAgentName;

                // Show context automatically after response
                if (context) {
                    ui.showManagerContext(context, lastAgent);
                }

                ui.setJsonResponse({
                    success: true,
                    content: finalContent || streamingContent,
                    context: context,
                    lastAgent: lastAgent
                });
                ui.addLog('Manager stream completed successfully', 'success');
                ui.appendStreamData({ type: 'done', content: finalContent, context, lastAgent });
            },
            (error) => {
                ui.finishManagerStreaming(`Error: ${error.message}`);
                ui.addManagerSystemMessage(`Stream error: ${error.message}`);
                ui.addLog(`Manager stream error: ${error.message}`, 'error');
                ui.appendStreamData({ type: 'error', error: error.message });
            }
        );
    } catch (error) {
        ui.addManagerSystemMessage(`Error: ${error.message}`);
        ui.addLog(`Manager stream setup error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
        ui.focusManagerMessageInput();
    }
}

async function clearManagerChat() {
    const chatId = ui.getManagerChatId();

    if (!confirm(`Are you sure you want to clear manager chat: ${chatId}?`)) {
        return;
    }

    ui.addLog(`Clearing manager chat: ${chatId}`);
    ui.clearManagerChat();
    ui.addManagerSystemMessage('Manager chat cleared (UI only - server context preserved)');
    ui.addLog('Manager chat cleared successfully', 'success');
}

async function showManagerContext() {
    const chatId = ui.getManagerChatId();

    try {
        // Try to fetch current context from server
        const response = await fetch(`${chatAPI.baseUrl}/api/manager/v2/context/${chatId}`);

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.context) {
                ui.showManagerContext(data.context, 'Current Context');
                ui.addLog('Context loaded from server', 'success');
            } else {
                ui.addManagerSystemMessage('No context found for this chat ID');
                ui.addLog('No context found', 'info');
            }
        } else {
            ui.addManagerSystemMessage('Could not load context from server');
            ui.addLog('Context load failed', 'error');
        }
    } catch (error) {
        ui.addManagerSystemMessage(`Error loading context: ${error.message}`);
        ui.addLog(`Context load error: ${error.message}`, 'error');
    }
}

// Enhanced Manager Functions
async function sendEnhancedMessage() {
    const message = ui.getEnhancedMessage();
    const sessionId = ui.getEnhancedSessionId();
    const userName = ui.getUserName();

    if (!message) {
        ui.addEnhancedSystemMessage('Please enter a travel message');
        return;
    }

    ui.addEnhancedMessage(message, 'user');
    ui.clearEnhancedMessageInput();
    ui.addLog(`Sending enhanced message for session: ${sessionId}`);

    const sendBtn = event?.target || document.querySelector('button[onclick="sendEnhancedMessage()"]');
    const restoreBtn = ui.showLoading(sendBtn);

    try {
        const response = await chatAPI.sendEnhancedMessage(sessionId, message, {
            name: userName,
            uid: Date.now()
        });

        ui.addEnhancedMessage(response.message, 'assistant');

        // Show context automatically after response
        if (response.context) {
            ui.showEnhancedContext(response.context, response.lastAgent);
        }

        ui.setJsonResponse(response);
        ui.addLog('Enhanced message sent successfully', 'success');

    } catch (error) {
        ui.addEnhancedSystemMessage(`Error: ${error.message}`);
        ui.addLog(`Enhanced message error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
        ui.focusEnhancedMessageInput();
    }
}

async function clearEnhancedSession() {
    const sessionId = ui.getEnhancedSessionId();
    const userName = ui.getUserName();

    if (!confirm(`Are you sure you want to reset session: ${sessionId}?`)) {
        return;
    }

    ui.addLog(`Resetting enhanced session: ${sessionId}`);

    const resetBtn = event?.target || document.querySelector('button[onclick="clearEnhancedSession()"]');
    const restoreBtn = ui.showLoading(resetBtn);

    try {
        const response = await chatAPI.resetEnhancedContext(sessionId, {
            name: userName,
            uid: Date.now()
        });

        ui.clearEnhancedChat();
        ui.addEnhancedSystemMessage('Session reset successfully');
        ui.addLog('Enhanced session reset successfully', 'success');

    } catch (error) {
        ui.addEnhancedSystemMessage(`Error resetting session: ${error.message}`);
        ui.addLog(`Enhanced session reset error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
    }
}

async function showEnhancedContext() {
    const sessionId = ui.getEnhancedSessionId();

    ui.addLog(`Loading enhanced context for session: ${sessionId}`);

    const contextBtn = event?.target || document.querySelector('button[onclick="showEnhancedContext()"]');
    const restoreBtn = ui.showLoading(contextBtn);

    try {
        const response = await chatAPI.getEnhancedContext(sessionId);

        if (response.context) {
            ui.showEnhancedContext(response.context, 'Current Session');
            ui.addLog('Enhanced context loaded from server', 'success');
        } else {
            ui.addEnhancedSystemMessage('No context found for this session ID');
            ui.addLog('No enhanced context found', 'info');
        }

    } catch (error) {
        ui.addEnhancedSystemMessage(`Error loading context: ${error.message}`);
        ui.addLog(`Enhanced context load error: ${error.message}`, 'error');
    } finally {
        restoreBtn();
    }
}

async function updateSummary() {
    const sessionId = ui.getEnhancedSessionId();

    // Show a simple prompt for manual summary update
    const summaryData = prompt('Enter summary JSON (or leave empty to skip):');
    if (!summaryData) return;

    try {
        const summary = JSON.parse(summaryData);
        const response = await chatAPI.updateEnhancedSummary(sessionId, summary);

        ui.addEnhancedSystemMessage('Summary updated successfully');
        ui.addLog('Summary updated', 'success');

        // Refresh context display
        showEnhancedContext();

    } catch (error) {
        ui.addEnhancedSystemMessage(`Error updating summary: ${error.message}`);
        ui.addLog(`Summary update error: ${error.message}`, 'error');
    }
}

async function updateItinerary() {
    const sessionId = ui.getEnhancedSessionId();

    // Show a simple prompt for manual itinerary update
    const itineraryData = prompt('Enter itinerary JSON (or leave empty to skip):');
    if (!itineraryData) return;

    try {
        const itinerary = JSON.parse(itineraryData);
        const response = await chatAPI.updateEnhancedItinerary(sessionId, itinerary);

        ui.addEnhancedSystemMessage('Itinerary updated successfully');
        ui.addLog('Itinerary updated', 'success');

        // Refresh context display
        showEnhancedContext();

    } catch (error) {
        ui.addEnhancedSystemMessage(`Error updating itinerary: ${error.message}`);
        ui.addLog(`Itinerary update error: ${error.message}`, 'error');
    }
}