import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Dock, DockItem, DockIcon, DockLabel, DockAvatar } from '../Dock';

describe('Dock Motion Primitive', () => {
  it('renders horizontal dock with accessible role and label', () => {
    render(
      <Dock ariaLabel="Application dock" direction="horizontal">
        <DockItem>
          <DockLabel>Home</DockLabel>
          <DockIcon>
            <span data-testid="icon">H</span>
          </DockIcon>
        </DockItem>
      </Dock>
    );

    const dock = screen.getByRole('toolbar', { name: 'Application dock' });
    expect(dock).toBeInTheDocument();
    expect(dock).toHaveClass('flex-row');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders vertical dock with accessible role and label', () => {
    render(
      <Dock ariaLabel="Sidebar navigation dock" direction="vertical">
        <DockItem>
          <DockLabel>Meals</DockLabel>
          <DockIcon>
            <span data-testid="meals-icon">M</span>
          </DockIcon>
        </DockItem>
      </Dock>
    );

    const dock = screen.getByRole('toolbar', { name: 'Sidebar navigation dock' });
    expect(dock).toBeInTheDocument();
    expect(dock).toHaveClass('flex-col');
  });

  it('supports active state and handles click interactions', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Dock ariaLabel="Navigation dock">
        <DockItem active={true} onClick={handleClick} className="test-item">
          <DockLabel>Progress</DockLabel>
          <DockIcon>
            <span>P</span>
          </DockIcon>
        </DockItem>
      </Dock>
    );

    const item = screen.getByText('P').closest('div[data-active="true"]');
    expect(item).toBeInTheDocument();

    if (item) {
      await user.click(item);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('renders DockAvatar within a DockItem without DOM attribute leaks', () => {
    render(
      <Dock ariaLabel="User dock" direction="vertical">
        <DockItem>
          <DockLabel>Profile · Chimay</DockLabel>
          <DockAvatar className="test-avatar-container">
            <span data-testid="custom-avatar">Avatar</span>
          </DockAvatar>
        </DockItem>
      </Dock>
    );

    const avatar = screen.getByTestId('custom-avatar');
    expect(avatar).toBeInTheDocument();
    const container = avatar.closest('.test-avatar-container');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('relative', 'flex', 'h-full', 'w-full');
  });
});
