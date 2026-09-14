import {
  Activity,
  BookOpen,
  ClipboardList,
  Crown,
  Database,
  Download,
  HeartPulse,
  Home,
  ImageIcon,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Soup,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type WorkspaceRole = 'USER' | 'NUTRITIONIST' | 'ADMIN';
export type WorkspaceTool = { label: string; href: string; description: string; group: string; icon: LucideIcon };
export const workspaceLabels: Record<WorkspaceRole, string> = {
  USER: 'Personal workspace',
  NUTRITIONIST: 'Nutritionist workspace',
  ADMIN: 'Administrator workspace',
};
export const workspaceTools: Record<WorkspaceRole, WorkspaceTool[]> = {
  USER: [
    {
      label: 'Home',
      href: '/dashboard',
      description: 'Daily meals, nutrition totals, water, and check-ins.',
      group: 'Every day',
      icon: Home,
    },
    {
      label: 'Meals',
      href: '/meals',
      description: 'Your weekly plan, meal history, swaps, and library.',
      group: 'Every day',
      icon: Soup,
    },
    {
      label: 'Groceries',
      href: '/grocery',
      description: 'Approved ingredients, pantry items, and shopping PDF.',
      group: 'Every day',
      icon: ShoppingCart,
    },
    {
      label: 'Progress',
      href: '/progress',
      description: 'Log weight and follow your nutrition history.',
      group: 'Your health',
      icon: Activity,
    },
    {
      label: 'Health & goals',
      href: '/profile/health',
      description: 'Goals, conditions, allergies, location, and food preferences.',
      group: 'Your health',
      icon: HeartPulse,
    },
    {
      label: 'Premium access',
      href: '/profile/membership',
      description: 'View your plan, entitlements, and payment status.',
      group: 'Your account',
      icon: Crown,
    },
    {
      label: 'Profile',
      href: '/profile',
      description: 'Personal details, avatar, and account security.',
      group: 'Your account',
      icon: User,
    },
    {
      label: 'Exports',
      href: '/export',
      description: 'Download available nutrition and meal-plan reports.',
      group: 'Your account',
      icon: Download,
    },
  ],
  NUTRITIONIST: [
    {
      label: 'Reviews',
      href: '/nutritionist/reviews',
      description: 'Claim, inspect, correct, and review meal-plan rows.',
      group: 'Review work',
      icon: ClipboardList,
    },
    {
      label: 'Outside meals',
      href: '/nutritionist/outside-meals',
      description: 'Verify itemized food logs and correct nutrition estimates.',
      group: 'Review work',
      icon: Soup,
    },
    {
      label: 'Approved reviews',
      href: '/nutritionist/approved',
      description: 'Revisit your completed meal-plan reviews.',
      group: 'Review work',
      icon: ShieldCheck,
    },
    {
      label: 'Meal library',
      href: '/nutritionist/library',
      description: 'Manage recipes, ingredient evidence, and flags.',
      group: 'Professional tools',
      icon: BookOpen,
    },
    {
      label: 'Compensation',
      href: '/nutritionist/compensation',
      description: 'Review work credits, statements, and payout records.',
      group: 'Professional tools',
      icon: Receipt,
    },
    {
      label: 'Professional profile',
      href: '/nutritionist/profile',
      description: 'Your credentials, PRC license, and specialization.',
      group: 'Professional tools',
      icon: Stethoscope,
    },
  ],
  ADMIN: [
    {
      label: 'Overview',
      href: '/admin/overview',
      description: 'Account totals, review queues, and platform signals.',
      group: 'Platform',
      icon: Home,
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      description: 'Explore nutrition and usage trends.',
      group: 'Platform',
      icon: Activity,
    },
    {
      label: 'Operations',
      href: '/admin/operations',
      description: 'Monitor processing, reconciliation, and operational status.',
      group: 'Platform',
      icon: ShieldCheck,
    },
    {
      label: 'Users',
      href: '/admin/users',
      description: 'Search and manage user accounts.',
      group: 'People',
      icon: Users,
    },
    {
      label: 'Nutritionists',
      href: '/admin/nutritionists',
      description: 'Applications, credential screening, and PRC verification.',
      group: 'People',
      icon: Stethoscope,
    },
    {
      label: 'Compensation',
      href: '/admin/compensation',
      description: 'Work policies, statements, adjustments, and payout records.',
      group: 'People',
      icon: Receipt,
    },
    {
      label: 'Nutrition data',
      href: '/admin/data',
      description: 'Sources, releases, imports, publication, and FNRI catalogue.',
      group: 'Content & evidence',
      icon: Database,
    },
    {
      label: 'Meal images',
      href: '/admin/images',
      description: 'Assign and review meal photographs and attribution.',
      group: 'Content & evidence',
      icon: ImageIcon,
    },
  ],
};

export const primaryWorkspaceTools: Record<WorkspaceRole, WorkspaceTool[]> = {
  USER: workspaceTools.USER.filter((tool) =>
    ['/dashboard', '/meals', '/grocery', '/progress', '/profile'].includes(tool.href)
  ),
  NUTRITIONIST: workspaceTools.NUTRITIONIST.filter(
    (tool) => !['/nutritionist/outside-meals', '/nutritionist/approved'].includes(tool.href)
  ),
  ADMIN: [
    '/admin/overview',
    '/admin/users',
    '/admin/nutritionists',
    '/admin/data',
    '/admin/images',
    '/admin/operations',
    '/admin/compensation',
    '/admin/analytics',
  ].map((href) => {
    const tool = workspaceTools.ADMIN.find((entry) => entry.href === href)!;
    return {
      ...tool,
      group:
        href === '/admin/overview'
          ? 'Overview'
          : ['/admin/users', '/admin/nutritionists'].includes(href)
            ? 'People'
            : ['/admin/data', '/admin/images'].includes(href)
              ? 'Content & data'
              : 'Operations',
    };
  }),
};
