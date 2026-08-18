import React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '@/lib/mockData';

const STYLES = {
  pending:     'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  in_progress: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  ready:       'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  picked_up:   'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/30',
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold',
        STYLES[status] || STYLES.pending,
        className
      )}
      data-testid={`status-badge-${status}`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full',
        status === 'pending' && 'bg-amber-500',
        status === 'in_progress' && 'bg-blue-500',
        status === 'ready' && 'bg-emerald-500',
        status === 'picked_up' && 'bg-gray-500',
      )} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}
