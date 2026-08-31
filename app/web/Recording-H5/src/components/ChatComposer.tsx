import { FormEvent, useState } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Input } from 'antd-mobile';

interface ChatComposerProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
}

export default function ChatComposer({ placeholder = '信息信息信息信息信息信息', onSubmit }: ChatComposerProps) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    onSubmit(query);
    setValue('');
  }

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <Input value={value} onChange={setValue} placeholder={placeholder} clearable />
      <button type="submit" aria-label="发送">
        <SendHorizonal size={22} fill="currentColor" />
      </button>
    </form>
  );
}
