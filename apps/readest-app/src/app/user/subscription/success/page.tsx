'use client';

import { useTranslation } from '@/hooks/useTranslation';
import AuthDisabledView from '@/app/auth/AuthDisabledView';

export default function SubscriptionSuccessPage() {
  const _ = useTranslation();

  return (
    <AuthDisabledView
      title={_('Billing Disabled')}
      message={_(
        'Subscriptions and purchase processing are disabled in this local-first build. Use Services & Sync to configure your own storage and sync providers instead.',
      )}
    />
  );
}
