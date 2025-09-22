import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = 'data';

const ensureDataDir = async () => {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
};

const getFilePath = (chatId) => path.join(DATA_DIR, `${chatId}.json`);

export const readConversation = async (chatId) => {
  try {
    await ensureDataDir();
    const filePath = getFilePath(chatId);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { chatId, messages: [], createdAt: new Date().toISOString() };
    }
    throw error;
  }
};

export const appendMessage = async (chatId, message) => {
  await ensureDataDir();
  const conversation = await readConversation(chatId);
  
  const newMessage = {
    ...message,
    timestamp: new Date().toISOString(),
    id: Date.now().toString()
  };
  
  conversation.messages.push(newMessage);
  conversation.updatedAt = new Date().toISOString();
  
  const filePath = getFilePath(chatId);
  await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
  
  return newMessage;
};

export const clearConversation = async (chatId) => {
  await ensureDataDir();
  const filePath = getFilePath(chatId);
  
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }
    throw error;
  }
};

export const rotateConversation = async (chatId, maxMessages = 100) => {
  const conversation = await readConversation(chatId);
  
  if (conversation.messages.length > maxMessages) {
    const keepMessages = conversation.messages.slice(-maxMessages);
    conversation.messages = keepMessages;
    conversation.rotatedAt = new Date().toISOString();
    
    const filePath = getFilePath(chatId);
    await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
  }
  
  return conversation;
};