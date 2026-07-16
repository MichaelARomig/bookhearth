'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';

interface AuthDisabledViewProps {
  title: string;
  message: string;
}

export default function AuthDisabledView({ title, message }: AuthDisabledViewProps) {
  const _ = useTranslation();
  const router = useRouter();

  useTheme({ systemUIVisible: false });

  return (
    <div className='bg-base-200/50 text-base-content hero min-h-screen items-center justify-center px-4'>
      <div className='hero-content text-center'>
        <div className='flex max-w-xl flex-col gap-4'>
          <h1 className='text-2xl font-semibold'>{title}</h1>
          <p className='text-base-content/70 text-sm leading-relaxed'>{message}</p>
          <div className='flex flex-col justify-center gap-3 sm:flex-row'>
            <button className='btn btn-primary rounded-xl' onClick={() => router.push('/user')}>
              {_('Open Services & Sync')}
            </button>
            <button className='btn btn-outline rounded-xl' onClick={() => router.push('/library')}>
              {_('Go to Library')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
