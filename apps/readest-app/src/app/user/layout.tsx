import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services & Sync',
  description: 'Manage local sync categories and user-controlled service integrations.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
