'use client';

import React from 'react';
import StateNotice, {
  StateNoticeAction,
  StateNoticeProps,
} from './StateNotice';

export type UnauthorizedStateAction = StateNoticeAction;

export interface UnauthorizedStateProps extends Omit<StateNoticeProps, 'variant'> {
  variant?: 'card' | 'page';
}

export default function UnauthorizedState({
  variant = 'card',
  layoutVariant,
  ...props
}: UnauthorizedStateProps) {
  return (
    <StateNotice
      variant="action-needed"
      layoutVariant={layoutVariant || (variant === 'page' ? 'page' : 'inline')}
      {...props}
    />
  );
}
