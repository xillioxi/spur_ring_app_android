import type { PropsWithChildren } from 'react';

interface PhoneFrameProps extends PropsWithChildren {
  tone?: 'white' | 'soft';
  className?: string;
}

export default function PhoneFrame({ children, tone = 'white', className = '' }: PhoneFrameProps) {
  return (
    <div className={`phone-frame phone-frame-${tone} ${className}`}>
      {children}
    </div>
  );
}
