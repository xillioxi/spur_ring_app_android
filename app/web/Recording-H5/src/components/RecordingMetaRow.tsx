import { Clock3, MapPin, Smartphone } from 'lucide-react';
import type { RecordingMeta } from '../types';

interface RecordingMetaRowProps {
  record: Pick<RecordingMeta, 'duration' | 'date' | 'source' | 'location'>;
  compact?: boolean;
}

export default function RecordingMetaRow({ record, compact = false }: RecordingMetaRowProps) {
  return (
    <div className={`record-meta ${compact ? 'compact' : ''}`}>
      <span>
        <Clock3 size={compact ? 11 : 14} />
        {record.duration}
      </span>
      <span>
        <Smartphone size={compact ? 11 : 14} />
        {record.date}
        {record.source ? ` | ${record.source}` : ''}
      </span>
      <span>
        <MapPin size={compact ? 11 : 14} />
        {record.location}
      </span>
    </div>
  );
}
