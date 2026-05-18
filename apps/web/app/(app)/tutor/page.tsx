'use client';

import { useCallback, useState } from 'react';
import styles from './page.module.css';
import ChatPanel, { type ChatMessage } from '../_components/widgets/ChatPanel';
import EmptyState from '../_components/widgets/EmptyState';
import { ask } from '../../lib/services/chatbot';
import { friendlyMessage } from '../../lib/api-clients/errors';
import { renderMarkdown } from '../../lib/markdown';

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

function makeId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function newConversation(): Conversation {
  return {
    id: makeId(),
    title: 'New conversation',
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export default function TutorPage() {
  const [conversations, setConversations] = useState<Conversation[]>([newConversation()]);
  const [activeId, setActiveId] = useState<string>(() => conversations[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const updateActive = useCallback(
    (mut: (conv: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((conv) => (conv.id === activeId ? mut(conv) : conv))
      );
    },
    [activeId]
  );

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { id: makeId(), role: 'user', content: text };
      const placeholderId = makeId();
      const pendingMsg: ChatMessage = {
        id: placeholderId,
        role: 'assistant',
        content: '',
        pending: true,
      };
      updateActive((conv) => ({
        ...conv,
        title: conv.messages.length === 0 ? text.slice(0, 48) : conv.title,
        messages: [...conv.messages, userMsg, pendingMsg],
        updatedAt: new Date().toISOString(),
      }));
      setBusy(true);
      setError(null);
      try {
        const response = await ask({
          question: text,
          history: active.messages.map((m) => ({ role: m.role, content: m.content })),
        });
        updateActive((conv) => ({
          ...conv,
          messages: conv.messages.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: response.answer,
                  pending: false,
                  citations: response.citations,
                  followUps: response.followUps,
                }
              : m
          ),
        }));
      } catch (err) {
        const message = friendlyMessage(err);
        setError(message);
        updateActive((conv) => ({
          ...conv,
          messages: conv.messages.map((m) =>
            m.id === placeholderId
              ? { ...m, content: message, pending: false, error: message }
              : m
          ),
        }));
      } finally {
        setBusy(false);
      }
    },
    [active.messages, updateActive]
  );

  function handleNew() {
    const next = newConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveId(next.id);
    setError(null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>AI Tutor</h1>
          <p className={styles.subtitle}>
            Ask any question about your courses, projects, or concepts you're stuck on.
          </p>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <h2 className={styles.sectionLabel}>Conversations</h2>
          <button type="button" className={styles.newChatBtn} onClick={handleNew}>
            + New conversation
          </button>
          {conversations.length === 0 ? (
            <EmptyState
              title="No history yet"
              description="Your past tutor conversations will appear here."
            />
          ) : (
            <ul className={styles.conversationsList}>
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    className={`${styles.conversationItem} ${
                      conv.id === activeId ? styles.conversationActive : ''
                    }`}
                    onClick={() => setActiveId(conv.id)}
                  >
                    <span className={styles.conversationTitle}>{conv.title}</span>
                    <span className={styles.conversationMeta}>
                      {conv.messages.length} messages
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className={styles.main}>
          <ChatPanel
            messages={active.messages}
            onSend={handleSend}
            onFollowUp={(text) => void handleSend(text)}
            busy={busy}
            renderContent={(message) =>
              message.role === 'assistant' && !message.pending ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(message.content),
                  }}
                />
              ) : (
                <p>{message.content}</p>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
