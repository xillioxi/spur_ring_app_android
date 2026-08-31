import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  right?: React.ReactNode;
}

export default function PageHeader({ right }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="page-header">
      <button className="back-button" type="button" aria-label="返回" onClick={() => navigate(-1)}>
        <ChevronLeft size={26} />
      </button>
      <div className="header-right">{right}</div>
    </header>
  );
}
