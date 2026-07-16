'use client';

import { useTranslation } from '@/hooks/useTranslation';
import AuthDisabledView from '../AuthDisabledView';

export default function AuthErrorPage() {
  const _ = useTranslation();

  return (
    <AuthDisabledView
      title={_('Authentication Disabled')}
      message={_(
        'This build no longer uses hosted Readest authentication. Open Services & Sync to configure local or self-hosted integrations instead.',
      )}
    />
  );
}
