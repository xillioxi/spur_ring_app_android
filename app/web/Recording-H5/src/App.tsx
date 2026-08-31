import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AssistantChatPage from './pages/AssistantChatPage';
import AssistantRemindersPage from './pages/AssistantRemindersPage';
import RecordingListPage from './pages/RecordingListPage';
import RecordingSummaryPage from './pages/RecordingSummaryPage';
import TranscriptPage from './pages/TranscriptPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecordingListPage />} />
        <Route path="/records/:id" element={<Navigate to="summary" replace />} />
        <Route path="/records/:id/summary" element={<RecordingSummaryPage />} />
        <Route path="/records/:id/transcript" element={<TranscriptPage />} />
        <Route path="/assistant" element={<Navigate to="/assistant/chat" replace />} />
        <Route path="/assistant/chat" element={<AssistantChatPage />} />
        <Route path="/assistant/reminders" element={<AssistantRemindersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
