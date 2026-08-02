import AsyncStorage from '@react-native-async-storage/async-storage';
import {Conversation, ConversationSummary} from "../model/Conversation.ts";

const CONVERSATIONS_MESSAGES_KEY_PREFIX = '@conversation_messages_';
const CONVERSATIONS_SUMMARIES_KEY = '@conversation_summaries';
const CHAT_SETTINGS_KEY = '@chat_settings';

/** 对话设置 */
export interface ChatSettings {
    temperature: number; // 0 ~ 2
    topP: number;        // 0 ~ 1
    numCtx: number;      // 0 = 使用模型默认上下文
}

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
    temperature: 0.8,
    topP: 0.9,
    numCtx: 0,
};

const saveChatSettings = async (settings: ChatSettings) => {
    await AsyncStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(settings));
};

const loadChatSettings = async (): Promise<ChatSettings> => {
    const json = await AsyncStorage.getItem(CHAT_SETTINGS_KEY);
    if (json != null) {
        try {
            const parsed = JSON.parse(json);
            return {
                temperature: typeof parsed.temperature === 'number' ? parsed.temperature : DEFAULT_CHAT_SETTINGS.temperature,
                topP: typeof parsed.topP === 'number' ? parsed.topP : DEFAULT_CHAT_SETTINGS.topP,
                numCtx: typeof parsed.numCtx === 'number' ? parsed.numCtx : DEFAULT_CHAT_SETTINGS.numCtx,
            };
        } catch (e) {
            // 解析失败使用默认值
        }
    }
    return {...DEFAULT_CHAT_SETTINGS};
};

type EventHandler = () => void;
const eventMap = new Map<string, EventHandler[]>();

const StorageEvent = {
    SUMMARIES_UPDATED: 'summariesUpdated'
};

const subscribe = (event: string, handler: EventHandler) => {
    const handlers = eventMap.get(event) || [];
    handlers.push(handler);
    eventMap.set(event, handlers);
};

const unsubscribe = (event: string, handler: EventHandler) => {
    const handlers = eventMap.get(event) || [];
    eventMap.set(event, handlers.filter(h => h !== handler));
};

const emit = (event: string) => {
    const handlers = eventMap.get(event) || [];
    handlers.forEach(handler => handler());
};

const saveConversation = async (conversationId: string, messages: Message[], summary: string) => {
    const messagesKey = `${CONVERSATIONS_MESSAGES_KEY_PREFIX}${conversationId}`;

    // 存储对话内容
    await AsyncStorage.setItem(messagesKey, JSON.stringify({ id: conversationId, messages }));

    // 更新对话摘要列表
    const existingSummaries = await AsyncStorage.getItem(CONVERSATIONS_SUMMARIES_KEY);
    let summaries: ConversationSummary[] = existingSummaries ? JSON.parse(existingSummaries) : [];

    // 检查是否已经存在该对话摘要，如果存在则更新，否则添加
    const existingSummaryIndex = summaries.findIndex(summary => summary.id === conversationId);
    const newSummary= {
        id: conversationId,
        summary,
        lastConversation: new Date().toISOString()
    }
    if (existingSummaryIndex !== -1) {
        summaries[existingSummaryIndex] = newSummary;
    } else {
        summaries.push(newSummary);
    }

    await AsyncStorage.setItem(CONVERSATIONS_SUMMARIES_KEY, JSON.stringify(summaries));

    emit(StorageEvent.SUMMARIES_UPDATED);
};

const deleteConversation = async (conversationId: string) => {
    // 删除对话消息
    const messagesKey = `${CONVERSATIONS_MESSAGES_KEY_PREFIX}${conversationId}`;
    await AsyncStorage.removeItem(messagesKey);

    // 更新摘要列表
    const existingSummaries = await AsyncStorage.getItem(CONVERSATIONS_SUMMARIES_KEY);
    let summaries: ConversationSummary[] = existingSummaries ? JSON.parse(existingSummaries) : [];

    // 过滤掉要删除的对话摘要
    summaries = summaries.filter(summary => summary.id !== conversationId);
    await AsyncStorage.setItem(CONVERSATIONS_SUMMARIES_KEY, JSON.stringify(summaries));

    // 触发更新事件
    emit(StorageEvent.SUMMARIES_UPDATED);
};

const loadConversation = async (id: string) => {
    const messagesKey = `${CONVERSATIONS_MESSAGES_KEY_PREFIX}${id}`;

    const messagesJson = await AsyncStorage.getItem(messagesKey);

    if (messagesJson != null) {
        return JSON.parse(messagesJson) as Conversation
    }
};

const getAllSummaries = async () => {
    const jsonValue = await AsyncStorage.getItem(CONVERSATIONS_SUMMARIES_KEY);
    if (jsonValue != null) {
        return JSON.parse(jsonValue) as ConversationSummary[];
    }
    return [];
};

export {saveConversation, deleteConversation, loadConversation, getAllSummaries, subscribe, unsubscribe, StorageEvent, saveChatSettings, loadChatSettings, DEFAULT_CHAT_SETTINGS};

