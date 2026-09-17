import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import NutritionistCredentialModal, { maskPrcLicenseNumber } from './NutritionistCredentialModal';
import { PublicVerifier } from '@/types';

describe('maskPrcLicenseNumber', () => {
  it('masks license numbers properly, showing only the last 4 digits', () => {
    expect(maskPrcLicenseNumber('0123456')).toBe('PRC Lic. No. ••••••3456');
    expect(maskPrcLicenseNumber('1234')).toBe('PRC Lic. No. ••••••1234');
    expect(maskPrcLicenseNumber('')).toBe('PRC Lic. No. ••••••0001');
  });
});

describe('NutritionistCredentialModal', () => {
  const mockVerifier: PublicVerifier = {
    name: 'Andrea Reyes',
    image: 'https://images.unsplash.com/photo-1594824813515-3736561f30e0?w=400',
    prcLicenseNumber: '0098765',
    prcLicenseExpiry: '2028-12-31T00:00:00.000Z',
    specialization: 'Clinical Nutrition & Renal Dietetics',
    yearsOfExperience: 8,
    university: 'University of the Philippines Diliman',
    bio: 'Senior Clinical Nutritionist specializing in glycemic control and hypertension.',
  };

  it('renders correctly when open with full RND details and masked PRC license', () => {
    const onClose = vi.fn();
    render(
      <NutritionistCredentialModal
        isOpen={true}
        onClose={onClose}
        verifier={mockVerifier}
        nutritionistNote="Adjusted sodium levels down to match hypertension guidelines."
        reviewedAt="2026-09-17T08:00:00.000Z"
        mealName="Sinigang na Hipon"
      />
    );

    // Header & Name
    expect(screen.getByText(/Andrea Reyes, RND/i)).toBeInTheDocument();
    expect(screen.getByText('Verified Nutritionist')).toBeInTheDocument();
    expect(screen.getByText('PRC-Verified')).toBeInTheDocument();

    // Masked PRC
    expect(screen.getByText(/PRC Lic\. No\. ••••••8765/i)).toBeInTheDocument();

    // Credentials
    expect(screen.getByText('Clinical Nutrition & Renal Dietetics')).toBeInTheDocument();
    expect(screen.getByText('University of the Philippines Diliman')).toBeInTheDocument();
    expect(screen.getByText(/8\+ years/i)).toBeInTheDocument();

    // Clinical notes button is visible
    const viewNotesBtn = screen.getByRole('button', { name: /view clinical adjustments/i });
    expect(viewNotesBtn).toBeInTheDocument();

    // Click to switch to Clinical Review & Notes tab
    fireEvent.click(viewNotesBtn);

    // Review Notes & Date
    expect(screen.getByText(/Reviewed on/i)).toBeInTheDocument();
    expect(screen.getByText(/Adjusted sodium levels down to match hypertension guidelines\./i)).toBeInTheDocument();

    // Close button
    const closeBtn = screen.getByRole('button', { name: /close credential details/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders SVG avatar fallback when verifier does not have an image', () => {
    const verifierWithoutImg: PublicVerifier = {
      ...mockVerifier,
      image: null,
    };

    render(<NutritionistCredentialModal isOpen={true} onClose={() => {}} verifier={verifierWithoutImg} />);

    expect(screen.getByText(/Andrea Reyes, RND/i)).toBeInTheDocument();
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders officialHeadshot and digitalSignature when provided', () => {
    const verifierWithBiometrics: PublicVerifier = {
      ...mockVerifier,
      officialHeadshot: 'data:image/jpeg;base64,mockheadshotimage123',
      digitalSignature: 'data:image/png;base64,mocksignatureimage456',
    };

    render(<NutritionistCredentialModal isOpen={true} onClose={() => {}} verifier={verifierWithBiometrics} />);

    const headshot = screen.getByAltText('Andrea Reyes');
    expect(headshot).toHaveAttribute('src', verifierWithBiometrics.officialHeadshot);

    const signature = screen.getByAltText("Andrea Reyes's digital signature");
    expect(signature).toHaveAttribute('src', verifierWithBiometrics.digitalSignature);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <NutritionistCredentialModal isOpen={false} onClose={() => {}} verifier={mockVerifier} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
