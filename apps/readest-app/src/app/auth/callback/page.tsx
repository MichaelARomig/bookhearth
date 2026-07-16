'use client';

import { useTranslation } from '@/hooks/useTranslation';
import AuthDisabledView from '../AuthDisabledView';

export default function AuthCallback() {
  const _ = useTranslation();

  return (
    <AuthDisabledView
      title={_('Authentication Callback Ignored')}
      message={_(
        'This build no longer completes hosted account sign-in callbacks. If you were trying to configure sync, use Services & Sync instead.',
      )}
    />
  );
}
