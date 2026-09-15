import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AvatarSettings from './AvatarSettings';
import api from '@/lib/axios';
import type { UserSession } from '@/lib/context/AuthContext';

vi.mock('@/lib/axios', () => ({ default: { put: vi.fn() } }));
const googleImage = 'https://lh3.googleusercontent.com/test-photo';
const customImage = 'https://api.dicebear.com/10.x/open-peeps/svg?seed=Saved';

describe('shared avatar editor', () => {
  it.each(['USER', 'NUTRITIONIST', 'ADMIN'] as const)(
    'preserves avatar selection, restores Google default, and updates session for %s',
    async (role) => {
      const user: UserSession = {
        userId: 'fixture',
        name: 'Fixture',
        email: 'fixture@example.test',
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        reportAcknowledged: true,
        image: customImage,
        googleImage,
      };
      const updateUserSession = vi.fn();
      vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: { image: googleImage, googleImage } } });
      const { rerender } = render(<AvatarSettings user={user} updateUserSession={updateUserSession} />);

      // Seed input field and Avatar Studio must not exist
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByText(/Interactive Avatar Studio/i)).toBeNull();

      // Curated Filipino Avatars must exist
      expect(screen.getByText(/Curated Filipino Avatars/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Default/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Chimay/ })).toBeInTheDocument();

      // Switch visibility test
      rerender(<AvatarSettings user={user} updateUserSession={updateUserSession} visible={false} />);
      rerender(<AvatarSettings user={user} updateUserSession={updateUserSession} />);

      // Select Default and Save
      fireEvent.click(screen.getByRole('button', { name: /Default/ }));
      fireEvent.click(screen.getByRole('button', { name: /Save Avatar/i }));

      await waitFor(() => expect(updateUserSession).toHaveBeenCalledWith({ image: googleImage, googleImage }));
      expect(api.put).toHaveBeenCalledWith('/user/profile/avatar', { image: 'Default' });
    }
  );
});
