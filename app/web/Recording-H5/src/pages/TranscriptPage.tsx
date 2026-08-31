import { DotLoading } from 'antd-mobile';
import { Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AudioPlayer from '../components/AudioPlayer';
import PageHeader from '../components/PageHeader';
import PhoneFrame from '../components/PhoneFrame';
import { recordingApi } from '../services/recordingService';
import type { RecordingDetail, TranscriptSegment } from '../types';

export default function TranscriptPage() {
  const { id = '' } = useParams();
  const [record, setRecord] = useState<RecordingDetail | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  useEffect(() => {
    Promise.all([recordingApi.getRecording(id), recordingApi.getTranscript(id)]).then(([nextRecord, nextSegments]) => {
      setRecord(nextRecord);
      setSegments(nextSegments);
    });
  }, [id]);

  const speakerMap = useMemo(() => new Map(record?.speakers.map((speaker) => [speaker.id, speaker]) ?? []), [record]);

  return (
    <PhoneFrame>
      <main className="page transcript-page page-with-player">
        <PageHeader />
        {!record ? (
          <div className="center-loading">
            <DotLoading color="primary" />
          </div>
        ) : (
          <section className="transcript-list">
            <div className="transcript-rail" aria-hidden="true">
              <span />
              <i />
              <i />
              <i />
              <i />
            </div>
            {segments.map((segment) => {
              const speaker = speakerMap.get(segment.speakerId);
              return (
                <article className="transcript-segment" key={segment.id}>
                  <div className="speaker-line">
                    <strong style={{ color: speaker?.color }}>{speaker?.name} {speaker?.role}</strong>
                    <span>{segment.time}</span>
                  </div>
                  <p>{renderTranscriptText(segment)}</p>
                </article>
              );
            })}
          </section>
        )}
      </main>
      <AudioPlayer duration={record?.duration} />
    </PhoneFrame>
  );
}

function renderTranscriptText(segment: TranscriptSegment) {
  if (!segment.highlight) return segment.text;

  const [before, after = ''] = segment.text.split(segment.highlight);
  return (
    <>
      {before}
      <mark>{segment.highlight}</mark>
      {segment.edited && <Pencil className="inline-pencil" size={16} fill="currentColor" />}
      {after}
    </>
  );
}
