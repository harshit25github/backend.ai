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