/**
 * Synthetic test data only.
 *
 * Reserved `.invalid` email domains and `fixture-*` identifiers ensure these
 * objects cannot be confused with development or production records.
 */

export type SyntheticRole = 'USER' | 'NUTRITIONIST' | 'ADMIN';
export type SyntheticMealStatus = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'CANCELLED';

interface SyntheticUser {
  id: string;
  name: string;
  email: string;
  role: SyntheticRole;
  emailVerified: boolean;
}

interface SyntheticProfile {
  id: string;
  userId: string;
  conditions: string[];
  allergies: string[];
  otherConditions: string | null;
  otherAllergies: string | null;
}

interface SyntheticMealPlan {
  id: string;
  userId: string;
  status: SyntheticMealStatus;
  scheduledDate: string;
  expired: boolean;
}

export const syntheticUsers = {
  standardUser: {
    id: 'fixture-user-001',
    name: 'Fixture User',
    email: 'user@nutrimind.invalid',
    role: 'USER',
    emailVerified: true,
  },
  verifiedNutritionist: {
    id: 'fixture-nutritionist-verified-001',
    name: 'Fixture Verified Nutritionist',
    email: 'verified-nutritionist@nutrimind.invalid',
    role: 'NUTRITIONIST',
    emailVerified: true,
    isVerified: true,
  },
  unverifiedNutritionist: {
    id: 'fixture-nutritionist-unverified-001',
    name: 'Fixture Unverified Nutritionist',
    email: 'unverified-nutritionist@nutrimind.invalid',
    role: 'NUTRITIONIST',
    emailVerified: true,
    isVerified: false,
  },
  admin: {
    id: 'fixture-admin-001',
    name: 'Fixture Administrator',
    email: 'admin@nutrimind.invalid',
    role: 'ADMIN',
    emailVerified: true,
  },
} as const satisfies Record<string, SyntheticUser & { isVerified?: boolean }>;

export const syntheticProfiles = {
  withoutRestrictions: {
    id: 'fixture-profile-none-001',
    userId: syntheticUsers.standardUser.id,
    conditions: [],
    allergies: [],
    otherConditions: null,
    otherAllergies: null,
  },
  withEnumRestrictions: {
    id: 'fixture-profile-enum-001',
    userId: syntheticUsers.standardUser.id,
    conditions: ['DIABETES'],
    allergies: ['SHELLFISH'],
    otherConditions: null,
    otherAllergies: null,
  },
  withCustomRestrictions: {
    id: 'fixture-profile-custom-001',
    userId: syntheticUsers.standardUser.id,
    conditions: [],
    allergies: [],
    otherConditions: 'Synthetic custom condition',
    otherAllergies: 'Synthetic custom allergen',
  },
} as const satisfies Record<string, SyntheticProfile>;

const commonMealPlanFields = {
  userId: syntheticUsers.standardUser.id,
  scheduledDate: '2030-01-15T04:00:00.000Z',
  expired: false,
};

export const syntheticMealPlans = {
  approved: {
    ...commonMealPlanFields,
    id: 'fixture-plan-approved-001',
    status: 'APPROVED',
  },
  pending: {
    ...commonMealPlanFields,
    id: 'fixture-plan-pending-001',
    status: 'PENDING_REVIEW',
  },
  rejected: {
    ...commonMealPlanFields,
    id: 'fixture-plan-rejected-001',
    status: 'REJECTED',
  },
  cancelled: {
    ...commonMealPlanFields,
    id: 'fixture-plan-cancelled-001',
    status: 'CANCELLED',
  },
  expired: {
    id: 'fixture-plan-expired-001',
    userId: syntheticUsers.standardUser.id,
    status: 'APPROVED',
    scheduledDate: '2000-01-15T04:00:00.000Z',
    expired: true,
  },
} as const satisfies Record<string, SyntheticMealPlan>;
