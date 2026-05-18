import { serviceFetch } from '../api-clients/service-fetch';

export type ChatAskRequest = {
  question: string;
  context?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export type ChatAskResponse = {
  answer: string;
  citations?: Array<{
    title: string;
    url?: string;
    snippet?: string;
  }>;
  followUps?: string[];
  conversationId?: string;
};

export type ChatPublishRequest = {
  conversationId?: string;
  title?: string;
  question: string;
  answer: string;
  tags?: string[];
};

export type ChatPublishResponse = {
  questionId: string;
  url?: string;
};

export async function ask(payload: ChatAskRequest): Promise<ChatAskResponse> {
  return serviceFetch<ChatAskResponse>('community', '/community/chatbot/ask', {
    method: 'POST',
    auth: true,
    body: payload as unknown as Record<string, unknown>,
  });
}

export async function publish(payload: ChatPublishRequest): Promise<ChatPublishResponse> {
  return serviceFetch<ChatPublishResponse>('community', '/community/chatbot/publish', {
    method: 'POST',
    auth: true,
    body: payload as unknown as Record<string, unknown>,
  });
}
