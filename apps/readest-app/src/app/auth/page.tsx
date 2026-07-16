'use client';

import { useTranslation } from '@/hooks/useTranslation';
import AuthDisabledView from './AuthDisabledView';

export default function AuthPage() {
  const _ = useTranslation();

  return (
    <AuthDisabledView
      title={_('Accounts Removed')}
      message={_(
        'This local-first build no longer offers Readest account sign-in, subscriptions, or official cloud setup. Use Services & Sync to configure WebDAV, KOReader sync, S3, Google Drive, and other user-controlled integrations.',
      )}
    />
  );
}
