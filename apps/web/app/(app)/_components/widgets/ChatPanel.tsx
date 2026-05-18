'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ChatPanel.module.css';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
  error?: string;
  citations?: Array<{ title: string; url?: string }>;
  followUps?: string[];
};

export type ChatPanelProps = {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void> | void;
  onFollowUp?: (text: string) => void;
  placeholder?: string;
  composerHint?: string;
  busy?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  renderContent?: (message: ChatMessage) => React.ReactNode;
};

export default function ChatPanel({
  messages,
  onSend,
  onFollowUp,
  placeholder = 'Ask the tutor a question…',
  composerHint,
  busy,
  emptyTitle = 'Start a conversation',
  emptyDescription = 'Ask about any concept, exercise, or piece of code and the tutor will help.',
  renderContent,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || busy) return;
    setDraft('');
    await onSend(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as React.FormEvent);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.scroller} ref={scrollerRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`${styles.message} ${
                message.role === 'user' ? styles.userMessage : styles.assistantMessage
              } ${message.pending ? styles.pendingMessage : ''}`}
            >
              <header className={styles.messageHeader}>
                <span className={styles.role}>
                  {message.role === 'user' ? 'You' : 'Tutor'}
                </span>
                {message.pending && <span className={styles.pendingPill}>thinking…</span>}
                {message.error && <span className={styles.errorPill}>error</span>}
              </header>
              <div className={styles.body}>
                {renderContent ? renderContent(message) : <p>{message.content}</p>}
              </div>
              {message.citations && message.citations.length > 0 && (
                <ul className={styles.citations}>
                  {message.citations.map((c, idx) => (
                    <li key={`${message.id}-cite-${idx}`}>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer">
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {message.followUps && message.followUps.length > 0 && (
                <div className={styles.followUps}>
                  {message.followUps.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={styles.followUpChip}
                      onClick={() => onFollowUp?.(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          aria-label="Message"
          disabled={busy}
        />
        <div className={styles.composerFooter}>
          <span className={styles.hint}>{composerHint ?? 'Enter to send · Shift+Enter for newline'}</span>
          <button type="submit" className={styles.sendBtn} disabled={!draft.trim() || busy}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
