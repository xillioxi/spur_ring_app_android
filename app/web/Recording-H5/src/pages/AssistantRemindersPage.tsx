import { DotLoading } from 'antd-mobile';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AssistantModeSwitch from '../components/AssistantModeSwitch';
import BottomTabBar from '../components/BottomTabBar';
import PhoneFrame from '../components/PhoneFrame';
import RecordingMetaRow from '../components/RecordingMetaRow';
import { recordingApi } from '../services/recordingService';
import type { ReminderCard } from '../types';

export default function AssistantRemindersPage() {
  const [reminders, setReminders] = useState<ReminderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    recordingApi
      .listReminders()
      .then(setReminders)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PhoneFrame tone="soft">
      <main className="page page-with-tab reminder-page">
        <AssistantModeSwitch
          value="agent"
          onChange={(value) => {
            if (value === 'model') navigate('/assistant/chat');
          }}
        />
        {loading ? (
          <div className="center-loading">
            <DotLoading color="primary" />
          </div>
        ) : (
          <section className="reminder-columns">
            <div className="reminder-column">
              {reminders.filter((_, index) => index % 2 === 0).map((reminder) => (
                <ReminderItem reminder={reminder} key={reminder.id} />
              ))}
            </div>
            <div className="reminder-column">
              {reminders.filter((_, index) => index % 2 === 1).map((reminder) => (
                <ReminderItem reminder={reminder} key={reminder.id} />
              ))}
            </div>
          </section>
        )}
      </main>
      <BottomTabBar active="assistant" />
    </PhoneFrame>
  );
}

function ReminderItem({ reminder }: { reminder: ReminderCard }) {
  return (
    <article className="reminder-card">
      <h2>{reminder.title}</h2>
      {reminder.bullets.map((bullet, index) => (
        <div className="reminder-bullet" key={`${reminder.id}-${index}`}>
          <span />
          <p>{bullet}</p>
        </div>
      ))}
      <RecordingMetaRow
        compact
        record={{
          duration: reminder.duration,
          date: reminder.date,
          source: '',
          location: reminder.location
        }}
      />
    </article>
  );
}
