import { Button, DotLoading } from 'antd-mobile';
import { Bot, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AssistantModeSwitch from '../components/AssistantModeSwitch';
import BottomTabBar from '../components/BottomTabBar';
import ChatComposer from '../components/ChatComposer';
import PhoneFrame from '../components/PhoneFrame';
import { recordingApi } from '../services/recordingService';
import type { AssistantMessage, AssistantPrompt } from '../types';

export default function AssistantChatPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<AssistantPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const chatThreadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    recordingApi
      .listAssistantPrompts()
      .then(setPrompts)
      .catch(() => setPrompts([]))
      .finally(() => setPromptsLoading(false));
  }, []);

  useEffect(() => {
    const query = searchParams.get('q')?.trim();
    if (!query) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const userMessage = createUserMessage(query);
    setMessages([userMessage]);
    setLoading(true);

    recordingApi
      .askAssistant(query)
      .then((nextMessages) => {
        setMessages([userMessage, ...nextMessages.filter((message) => message.role === 'assistant')]);
      })
      .catch(() => {
        setMessages([userMessage, createAssistantErrorMessage()]);
      })
      .finally(() => {
        setLoading(false);
        scrollChatToBottom();
      });
  }, [searchParams]);

  const isEmptyConversation = !loading && messages.length === 0;

  function handleSubmit(query: string) {
    setLoading(true);
    const userMessage = createUserMessage(query);

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    scrollChatToBottom();

    recordingApi
      .askAssistant(query)
      .then((nextMessages) => {
        const assistantMessage = nextMessages.find((message) => message.role === 'assistant');
        if (assistantMessage) {
          setMessages((currentMessages) => [...currentMessages, assistantMessage]);
          scrollChatToBottom();
        }
      })
      .catch(() => {
        setMessages((currentMessages) => [...currentMessages, createAssistantErrorMessage()]);
      })
      .finally(() => setLoading(false));
  }

  function scrollChatToBottom() {
    window.requestAnimationFrame(() => {
      const chatThread = chatThreadRef.current;
      if (chatThread) {
        chatThread.scrollTop = chatThread.scrollHeight;
      }
    });
  }

  return (
    <PhoneFrame tone="soft">
      <main className={`page page-with-tab assistant-chat-page ${isEmptyConversation ? 'assistant-chat-page-empty' : ''}`}>
        {isEmptyConversation && <AssistantStatusBar />}
        <AssistantModeSwitch
          value="model"
          onChange={(value) => {
            if (value === 'agent') navigate('/assistant/reminders');
          }}
        />
        <section className={`assistant-result-card ${isEmptyConversation ? 'assistant-result-card-empty' : ''}`}>
          {isEmptyConversation ? (
            <EmptyAssistantState
              prompts={prompts}
              loading={promptsLoading}
              onPromptClick={handleSubmit}
              onSubmit={handleSubmit}
            />
          ) : (
            <>
              <div className="chat-thread" ref={chatThreadRef}>
                {loading && messages.length === 0 ? (
                  <div className="center-loading">
                    <DotLoading color="primary" />
                  </div>
                ) : (
                  <>
                    {messages.map((message) =>
                      message.role === 'user' ? <UserBubble key={message.id} text={message.text} /> : <AssistantBubble key={message.id} message={message} />
                    )}
                    {loading && messages.length > 0 && <div className="assistant-typing">正在整理...</div>}
                  </>
                )}
              </div>
              <ChatComposer onSubmit={handleSubmit} />
            </>
          )}
        </section>
      </main>
      <BottomTabBar active="assistant" />
    </PhoneFrame>
  );
}

function AssistantStatusBar() {
  return (
    <div className="assistant-status-bar" aria-hidden="true">
      <span>9:41</span>
      <div className="assistant-status-icons">
        <span className="status-signal">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="status-wifi" />
        <span className="status-battery" />
      </div>
    </div>
  );
}

interface EmptyAssistantStateProps {
  prompts: AssistantPrompt[];
  loading: boolean;
  onPromptClick: (value: string) => void;
  onSubmit: (value: string) => void;
}

function EmptyAssistantState({ prompts, loading, onPromptClick, onSubmit }: EmptyAssistantStateProps) {
  return (
    <>
      <div className="assistant-empty-content">
        <div className="bot-mark">
          <Bot size={34} />
          <Sparkles size={15} fill="currentColor" />
        </div>
        <h1>有什么可以帮你么？</h1>
        <p>可以帮你整理录音纪要、留存灵感、撰写报告、一键提取待办事项</p>
        <div className="assistant-suggestion-label">猜你想问</div>
        <div className="prompt-row">
          {loading ? (
            <DotLoading color="primary" />
          ) : (
            prompts.map((prompt) => (
              <Button key={prompt.id} size="small" fill="outline" color="primary" onClick={() => onPromptClick(prompt.query)}>
                {prompt.label}
              </Button>
            ))
          )}
        </div>
      </div>
      <ChatComposer onSubmit={onSubmit} />
    </>
  );
}

function createUserMessage(text: string): AssistantMessage {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    text
  };
}

function createAssistantErrorMessage(): AssistantMessage {
  return {
    id: `assistant-error-${Date.now()}`,
    role: 'assistant',
    text: '请求失败，请稍后再试。'
  };
}

function UserBubble({ text }: { text: string }) {
  return <div className="user-bubble">{text}</div>;
}

function AssistantBubble({ message }: { message: AssistantMessage }) {
  return (
    <article className="assistant-bubble">
      <p>{message.text}</p>
      {message.relatedRecords?.map((record) => (
        <section className="assistant-record" key={record.title + record.bullets.join('')}>
          <h3>{record.title}</h3>
          {record.bullets.map((bullet) => (
            <div className="assistant-bullet" key={bullet}>
              <span />
              <p>{bullet}</p>
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
