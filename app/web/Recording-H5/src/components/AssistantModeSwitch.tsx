interface AssistantModeSwitchProps {
  value: 'model' | 'agent';
  onChange: (value: 'model' | 'agent') => void;
}

export default function AssistantModeSwitch({ value, onChange }: AssistantModeSwitchProps) {
  return (
    <div className="mode-switch" role="tablist" aria-label="AI 助手模式">
      <button className={value === 'model' ? 'active' : ''} type="button" onClick={() => onChange('model')}>
        大模型
      </button>
      <button className={value === 'agent' ? 'active' : ''} type="button" onClick={() => onChange('agent')}>
        智能体
      </button>
    </div>
  );
}
