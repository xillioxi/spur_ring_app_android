import { Bot, FileAudio } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface BottomTabBarProps {
  active: 'records' | 'assistant';
}

export default function BottomTabBar({ active }: BottomTabBarProps) {
  return (
    <nav className="bottom-tab-wrap" aria-label="底部导航">
      <div className="bottom-tab">
        <NavLink className={`tab-item ${active === 'records' ? 'active' : ''}`} to="/">
          <FileAudio size={20} strokeWidth={2.1} />
          <span>录音纪要</span>
        </NavLink>
        <NavLink className={`tab-item ${active === 'assistant' ? 'active' : ''}`} to="/assistant">
          <Bot size={20} strokeWidth={2.1} />
          <span>AI助手</span>
        </NavLink>
      </div>
    </nav>
  );
}
