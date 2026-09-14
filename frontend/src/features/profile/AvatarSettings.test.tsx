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
    'preserves a custom avatar and restores Google default for %s',
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
      expect(screen.getByRole('textbox')).toHaveValue(customImage);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft avatar' } });
      rerender(<AvatarSettings user={user} updateUserSession={updateUserSession} visible={false} />);
      rerender(<AvatarSettings user={user} updateUserSession={updateUserSession} />);
      expect(screen.getByRole('textbox')).toHaveValue('Draft avatar');
      fireEvent.click(screen.getByRole('button', { name: /Default/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
      await waitFor(() => expect(updateUserSession).toHaveBeenCalledWith({ image: googleImage, googleImage }));
      expect(api.put).toHaveBeenCalledWith('/user/profile/avatar', { image: 'Default' });
    }
  );
});
