class ChatAPI {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }

    setBaseUrl(url) {
        this.baseUrl = url;
    }

    async sendMessage(chatId, message) {
        const response = await fetch(`${this.baseUrl}/api/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chatId,
                message
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async sendStreamMessage(chatId, message, onToken, onComplete, onError) {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chatId,
                    message
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'token' && data.token) {
                                onToken(data.token);
                            } else if (data.type === 'done') {
                                onComplete(data.content);
                                return;
                            } else if (data.type === 'error') {
                                onError(new Error(data.error));
                                return;
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', line, e);
                        }
                    }
                }
            }
        } catch (error) {
            onError(error);
        }
    }

    async getHistory(chatId) {
        const response = await fetch(`${this.baseUrl}/api/chat/history/${chatId}`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async clearChat(chatId) {
        const response = await fetch(`${this.baseUrl}/api/chat/clear/${chatId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async sendManagerStreamMessage(chatId, message, onToken, onComplete, onError) {
        try {
            const response = await fetch(`${this.baseUrl}/api/manager/stream-manager`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chatId,
                    message
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'token' && data.token) {
                                onToken(data.token);
                            } else if (data.type === 'done') {
                                onComplete(data.content, data.context, data.lastAgent);
                                return;
                            } else if (data.type === 'error') {
                                onError(new Error(data.error));
                                return;
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', line, e);
                        }
                    }
                }
            }
        } catch (error) {
            onError(error);
        }
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat/history/test-connection`, {
                method: 'GET',
            });
            return {
                success: response.ok,
                status: response.status,
                statusText: response.statusText
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Enhanced Manager API methods
    async sendEnhancedMessage(sessionId, message, userInfo = null) {
        const response = await fetch(`${this.baseUrl}/api/enhanced-manager/enhanced-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId,
                message,
                userInfo
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async getEnhancedContext(sessionId) {
        const response = await fetch(`${this.baseUrl}/api/enhanced-manager/context/${sessionId}`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async resetEnhancedContext(sessionId, userInfo = null) {
        const response = await fetch(`${this.baseUrl}/api/enhanced-manager/context/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userInfo })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async updateEnhancedSummary(sessionId, summary) {
        const response = await fetch(`${this.baseUrl}/api/enhanced-manager/context/${sessionId}/summary`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ summary })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async updateEnhancedItinerary(sessionId, itinerary) {
        const response = await fetch(`${this.baseUrl}/api/enhanced-manager/context/${sessionId}/itinerary`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itinerary })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async getEnhancedSessions() {
        const response = await fetch(`${this.baseUrl}/api/enhanced-manager/sessions`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async testEnhancedHealth() {
        const response = await fetch(`${this.baseUrl}/api/enhanced-manager/health`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }
}

const chatAPI = new ChatAPI();