'use client';

import { useTranslation } from '@/hooks/useTranslation';
import AuthDisabledView from '../AuthDisabledView';

export default function UpdateEmailPage() {
  const _ = useTranslation();

  return (
    <AuthDisabledView
      title={_('Account Updates Disabled')}
      message={_(
        'Email and account updates are unavailable in this local-first build because hosted Readest accounts are no longer part of the app.',
      )}
    />
  );
}
