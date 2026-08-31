import { Skeleton } from 'antd-mobile';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomTabBar from '../components/BottomTabBar';
import PhoneFrame from '../components/PhoneFrame';
import RecordingMetaRow from '../components/RecordingMetaRow';
import { recordingApi } from '../services/recordingService';
import type { RecordingGroup } from '../types';

export default function RecordingListPage() {
  const [groups, setGroups] = useState<RecordingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    recordingApi
      .listRecordings()
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PhoneFrame tone="soft">
      <main className="page page-with-tab recording-list-page">
        {loading ? (
          <div className="skeleton-list">
            <Skeleton.Title animated />
            <Skeleton.Paragraph lineCount={5} animated />
          </div>
        ) : (
          groups.map((group) => (
            <section className="record-group" key={group.key}>
              <h2>{group.title}</h2>
              <div className="record-card-list">
                {group.records.map((record) => (
                  <button className="record-card" key={record.id} type="button" onClick={() => navigate(`/records/${record.id}/summary`)}>
                    <span className={record.unread ? 'unread-dot' : 'unread-dot invisible'} />
                    <strong>{record.title}</strong>
                    <RecordingMetaRow record={record} compact />
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
      <BottomTabBar active="records" />
    </PhoneFrame>
  );
}
