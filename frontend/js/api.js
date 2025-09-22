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
}

const chatAPI = new ChatAPI();