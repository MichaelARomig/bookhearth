'use client';

import React, { useEffect, useState } from 'react';
import { LuFolderPlus } from 'react-icons/lu';

import Dialog from '@/components/Dialog';
import { useTranslation } from '@/hooks/useTranslation';

interface CreateCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (groupName: string) => Promise<boolean>;
}

const CreateCollectionDialog: React.FC<CreateCollectionDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const _ = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setGroupName('');
    setSubmitting(false);
    setError(null);
  }, [isOpen]);

  const submit = async () => {
    const trimmed = groupName.trim();
    if (!trimmed) {
      setError(_('Enter a collection name'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const completed = await onSubmit(trimmed);
      if (completed) {
        onClose();
      } else {
        setSubmitting(false);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : _('Could not create collection');
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={_('Import into Collection')}
      boxClassName='sm:!w-[480px] sm:!max-w-[480px] sm:!h-auto sm:!max-h-[80vh]'
    >
      <div className='flex flex-col gap-4 pb-6 pt-2'>
        <p className='text-base-content/70 text-sm leading-relaxed'>
          {_(
            'Name the collection, then choose the books to add. Collections are saved when they contain at least one book.',
          )}
        </p>
        <input
          type='text'
          autoFocus
          value={groupName}
          disabled={submitting}
          placeholder={_('Collection name')}
          className='input input-bordered eink-bordered placeholder:text-base-content/35 w-full'
          onChange={(e) => setGroupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <p className='text-base-content/55 text-xs leading-relaxed'>
          {_('Already imported books can be organized later from Select Books -> Collection.')}
        </p>
        {error && <p className='text-error text-sm leading-relaxed'>{error}</p>}
        <div className='flex justify-end gap-2 pt-1'>
          <button
            type='button'
            className='btn btn-ghost btn-sm eink-bordered'
            onClick={onClose}
            disabled={submitting}
          >
            {_('Cancel')}
          </button>
          <button
            type='button'
            className='btn btn-contrast btn-sm'
            onClick={() => void submit()}
            disabled={submitting || !groupName.trim()}
          >
            {submitting ? (
              <span className='loading loading-spinner loading-xs' />
            ) : (
              <LuFolderPlus className='h-4 w-4' />
            )}
            {_('Choose Books')}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default CreateCollectionDialog;
