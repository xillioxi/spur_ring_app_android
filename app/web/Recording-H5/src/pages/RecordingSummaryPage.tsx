import { DotLoading } from 'antd-mobile';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AudioPlayer from '../components/AudioPlayer';
import PageHeader from '../components/PageHeader';
import PhoneFrame from '../components/PhoneFrame';
import RecordingMetaRow from '../components/RecordingMetaRow';
import { recordingApi } from '../services/recordingService';
import type { RecordingDetail } from '../types';

export default function RecordingSummaryPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<RecordingDetail | null>(null);

  useEffect(() => {
    recordingApi.getRecording(id).then(setRecord);
  }, [id]);

  return (
    <PhoneFrame>
      <main className="page detail-page page-with-player">
        <PageHeader
          right={
            <button className="text-icon-button" type="button" onClick={() => navigate(`/records/${id}/transcript`)}>
              <FileText size={16} />
              逐字稿
            </button>
          }
        />
        {!record ? (
          <div className="center-loading">
            <DotLoading color="primary" />
          </div>
        ) : (
          <>
            <section className="record-title-block">
              <h1>{record.title}</h1>
              <RecordingMetaRow record={record} />
              <div className="tag-row">
                {record.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </section>
            <div className="hairline" />
            <section className="attendee-section">
              <p>出席人员</p>
              <div>
                {record.speakers.map((speaker) => (
                  <span key={speaker.id} style={{ color: speaker.color }}>
                    {speaker.name} {speaker.role}
                  </span>
                ))}
              </div>
            </section>
            <section className="summary-section">
              <h2>会议概述</h2>
              {record.summarySections.map((section) => (
                <article className="summary-block" key={section.title}>
                  {section.bullets.map((bullet) => (
                    <div className="summary-bullet" key={bullet}>
                      <span className="bullet-dot" />
                      <p>
                        <b>{section.title}：</b>
                        {bullet}
                      </p>
                    </div>
                  ))}
                </article>
              ))}
            </section>
          </>
        )}
      </main>
      <AudioPlayer duration={record?.duration} />
    </PhoneFrame>
  );
}
