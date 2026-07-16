'use client';

import { useTranslation } from '@/hooks/useTranslation';
import AuthDisabledView from '../AuthDisabledView';

export default function ResetPasswordPage() {
  const _ = useTranslation();

  return (
    <AuthDisabledView
      title={_('Password Recovery Disabled')}
      message={_(
        'Readest account recovery is not available in this local-first build because hosted accounts have been removed. Continue using local libraries and configure your own sync providers from Services & Sync.',
      )}
    />
  );
}
