import { Button, DotLoading } from 'antd-mobile';
import { Bot, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AssistantModeSwitch from '../components/AssistantModeSwitch';
import BottomTabBar from '../components/BottomTabBar';
import ChatComposer from '../components/ChatComposer';
import PhoneFrame from '../components/PhoneFrame';
import { recordingApi } from '../services/recordingService';
import type { AssistantPrompt } from '../types';

export default function AssistantHomePage() {
  const [prompts, setPrompts] = useState<AssistantPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    recordingApi
      .listAssistantPrompts()
      .then(setPrompts)
      .finally(() => setLoading(false));
  }, []);

  function goChat(query: string) {
    navigate(`/assistant/chat?q=${encodeURIComponent(query)}`);
  }

  return (
    <PhoneFrame tone="soft">
      <main className="page page-with-tab assistant-home-page">
        <AssistantModeSwitch
          value="model"
          onChange={(value) => {
            if (value === 'agent') navigate('/assistant/reminders');
          }}
        />
        <section className="assistant-welcome">
          <div className="bot-mark">
            <Bot size={34} />
            <Sparkles size={15} fill="currentColor" />
          </div>
          <h1>有什么可以帮你么?</h1>
          <p>可以帮你整理录音纪要、留存灵感、撰写报告、一键提取待办事项</p>
          <div className="prompt-row">
            {loading ? (
              <DotLoading color="primary" />
            ) : (
              prompts.map((prompt) => (
                <Button key={prompt.id} size="small" fill="outline" color="primary" onClick={() => goChat(prompt.query)}>
                  {prompt.label}
                </Button>
              ))
            )}
          </div>
          <ChatComposer onSubmit={goChat} />
        </section>
      </main>
      <BottomTabBar active="assistant" />
    </PhoneFrame>
  );
}
