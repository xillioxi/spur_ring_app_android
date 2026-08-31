import { Play, RotateCcw, RotateCw } from 'lucide-react';

interface AudioPlayerProps {
  duration?: string;
}

export default function AudioPlayer({ duration = '00:22' }: AudioPlayerProps) {
  return (
    <div className="audio-player" aria-label="音频播放控制">
      <button className="speed-button" type="button">
        1.0x <span>SET</span>
      </button>
      <button className="player-icon-button" type="button" aria-label="后退5秒">
        <RotateCcw size={22} />
        <span>5</span>
      </button>
      <button className="play-button" type="button" aria-label="播放">
        <Play size={24} fill="currentColor" />
      </button>
      <button className="player-icon-button" type="button" aria-label="前进5秒">
        <RotateCw size={22} />
        <span>5</span>
      </button>
      <span className="player-time">
        <b>00:00</b>
        <b>{duration}</b>
      </span>
    </div>
  );
}
