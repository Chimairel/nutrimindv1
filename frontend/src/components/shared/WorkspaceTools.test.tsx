import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WorkspaceTools } from './WorkspaceTools';
import { workspaceTools, type WorkspaceRole } from '@/lib/workspace-navigation';

describe('WorkspaceTools', () => {
  it.each<WorkspaceRole>(['USER', 'NUTRITIONIST', 'ADMIN'])(
    'makes every %s tool discoverable without exposing other roles',
    async (role) => {
      const user = userEvent.setup();
      render(<WorkspaceTools role={role} />);
      await user.click(screen.getByRole('button', { name: 'All tools' }));
      for (const tool of workspaceTools[role]) {
        expect(screen.getByRole('link', { name: new RegExp(tool.label) })).toHaveAttribute('href', tool.href);
      }
      expect(screen.getAllByRole('link')).toHaveLength(workspaceTools[role].length);
      await user.type(screen.getByRole('searchbox'), 'no matching tool');
      expect(screen.getByRole('status')).toHaveTextContent('No matching tools');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );
  it('searches descriptions and closes the menu after choosing a function', async () => {
    const user = userEvent.setup();
    render(<WorkspaceTools role="USER" />);
    await user.click(screen.getByRole('button', { name: 'All tools' }));
    await user.type(screen.getByRole('searchbox'), 'allergies');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    const link = screen.getByRole('link', { name: /Health profile/ });
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
