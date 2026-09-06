import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RouteDocumentation {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  public?: boolean;
}

const routes: RouteDocumentation[] = [
  { method: 'get', path: '/health', tag: 'Operations', summary: 'Liveness probe', public: true },
  { method: 'get', path: '/ready', tag: 'Operations', summary: 'Database readiness probe', public: true },
  { method: 'post', path: '/api/auth/register', tag: 'Authentication', summary: 'Register a user', public: true },
  {
    method: 'post',
    path: '/api/auth/login',
    tag: 'Authentication',
    summary: 'Authenticate with email and password',
    public: true,
  },
  {
    method: 'post',
    path: '/api/auth/google',
    tag: 'Authentication',
    summary: 'Authenticate with Google',
    public: true,
  },
  { method: 'post', path: '/api/auth/verify-email', tag: 'Authentication', summary: 'Verify an email OTP' },
  { method: 'post', path: '/api/auth/resend-verification', tag: 'Authentication', summary: 'Resend an email OTP' },
  {
    method: 'post',
    path: '/api/auth/forgot-password',
    tag: 'Authentication',
    summary: 'Request password reset',
    public: true,
  },
  {
    method: 'post',
    path: '/api/auth/reset-password',
    tag: 'Authentication',
    summary: 'Complete password reset',
    public: true,
  },
  {
    method: 'post',
    path: '/api/auth/refresh',
    tag: 'Authentication',
    summary: 'Refresh an access session',
    public: true,
  },
  { method: 'post', path: '/api/auth/logout', tag: 'Authentication', summary: 'End the current session' },
  {
    method: 'post',
    path: '/api/nutritionist-applications',
    tag: 'Applications',
    summary: 'Submit a nutritionist application',
    public: true,
  },
  {
    method: 'post',
    path: '/api/nutritionist-applications/status',
    tag: 'Applications',
    summary: 'Check application status',
    public: true,
  },
  {
    method: 'post',
    path: '/api/nutritionist-applications/invitation',
    tag: 'Applications',
    summary: 'Accept an account invitation',
    public: true,
  },
  { method: 'get', path: '/api/user/profile', tag: 'User', summary: 'Read the authenticated user profile' },
  { method: 'put', path: '/api/user/profile', tag: 'User', summary: 'Update the user profile' },
  { method: 'put', path: '/api/user/profile/avatar', tag: 'User', summary: 'Update the profile avatar' },
  { method: 'put', path: '/api/user/profile/conditions', tag: 'User', summary: 'Update health conditions' },
  { method: 'put', path: '/api/user/profile/allergies', tag: 'User', summary: 'Update allergies' },
  { method: 'put', path: '/api/user/profile/safety', tag: 'User', summary: 'Update structured safety intake' },
  { method: 'put', path: '/api/user/profile/settings', tag: 'User', summary: 'Update account settings' },
  {
    method: 'get',
    path: '/api/user/onboarding/suggestions',
    tag: 'Onboarding',
    summary: 'Read onboarding suggestions',
  },
  { method: 'get', path: '/api/user/onboarding/safety-catalogue', tag: 'Onboarding', summary: 'Read safety catalogue' },
  { method: 'post', path: '/api/user/onboarding/profile', tag: 'Onboarding', summary: 'Save biometric profile' },
  { method: 'post', path: '/api/user/onboarding/preferences', tag: 'Onboarding', summary: 'Save food preferences' },
  { method: 'post', path: '/api/user/onboarding/conditions', tag: 'Onboarding', summary: 'Save health conditions' },
  { method: 'post', path: '/api/user/onboarding/allergies', tag: 'Onboarding', summary: 'Save allergies' },
  { method: 'post', path: '/api/user/onboarding/shopping-day', tag: 'Onboarding', summary: 'Save shopping schedule' },
  {
    method: 'post',
    path: '/api/user/onboarding/tos',
    tag: 'Onboarding',
    summary: 'Accept terms and clinical disclaimer',
  },
  { method: 'get', path: '/api/user/nutrition-report', tag: 'Reports', summary: 'Read nutrition report' },
  { method: 'get', path: '/api/user/nutrition-report/pdf', tag: 'Reports', summary: 'Download nutrition report PDF' },
  { method: 'post', path: '/api/user/nutrition-report/generate', tag: 'Reports', summary: 'Generate nutrition report' },
  {
    method: 'post',
    path: '/api/user/nutrition-report/acknowledge',
    tag: 'Reports',
    summary: 'Acknowledge nutrition report',
  },
  { method: 'get', path: '/api/user/account/export', tag: 'Privacy', summary: 'Export account data' },
  { method: 'delete', path: '/api/user/account', tag: 'Privacy', summary: 'Delete the user account' },
  { method: 'get', path: '/api/user/water/today', tag: 'Tracking', summary: 'Read today water intake' },
  { method: 'post', path: '/api/user/water', tag: 'Tracking', summary: 'Log water intake' },
  { method: 'delete', path: '/api/user/water/today', tag: 'Tracking', summary: 'Clear today water intake' },
  { method: 'get', path: '/api/user/notifications', tag: 'Notifications', summary: 'List notifications' },
  {
    method: 'patch',
    path: '/api/user/notifications/{id}/read',
    tag: 'Notifications',
    summary: 'Mark a notification read',
  },
  { method: 'get', path: '/api/user/checkin/status', tag: 'Tracking', summary: 'Read weekly check-in status' },
  { method: 'post', path: '/api/user/checkin', tag: 'Tracking', summary: 'Submit a weekly check-in' },
  { method: 'post', path: '/api/user/meals/generate', tag: 'Meals', summary: 'Generate a meal plan' },
  { method: 'get', path: '/api/user/meals/generation-status', tag: 'Meals', summary: 'Read generation status' },
  { method: 'post', path: '/api/user/meals/rollover', tag: 'Meals', summary: 'Ensure current plan rollover' },
  { method: 'get', path: '/api/user/meals/current', tag: 'Meals', summary: 'Read the current meal plan' },
  { method: 'get', path: '/api/user/meals/history', tag: 'Meals', summary: 'Read meal-plan history' },
  { method: 'post', path: '/api/user/meals/log-outside', tag: 'Meals', summary: 'Log an outside meal' },
  { method: 'patch', path: '/api/user/meals/{id}/status', tag: 'Meals', summary: 'Update meal completion status' },
  {
    method: 'get',
    path: '/api/user/meals/compatible-library',
    tag: 'Meals',
    summary: 'List compatible verified meals',
  },
  { method: 'get', path: '/api/user/meals/{id}', tag: 'Meals', summary: 'Read meal details' },
  { method: 'get', path: '/api/user/meals/{id}/swap-options', tag: 'Meals', summary: 'List meal swap options' },
  { method: 'get', path: '/api/user/meals/{id}/swap-preview', tag: 'Meals', summary: 'Preview a meal swap' },
  { method: 'post', path: '/api/user/meals/{id}/swap', tag: 'Meals', summary: 'Execute a meal swap' },
  { method: 'get', path: '/api/user/grocery/current', tag: 'Grocery', summary: 'Read the derived grocery list' },
  { method: 'post', path: '/api/user/grocery/generate', tag: 'Grocery', summary: 'Rebuild the grocery projection' },
  { method: 'get', path: '/api/user/grocery/pdf', tag: 'Grocery', summary: 'Download grocery PDF' },
  { method: 'patch', path: '/api/user/grocery/items/{id}/toggle', tag: 'Grocery', summary: 'Toggle a grocery item' },
  { method: 'patch', path: '/api/user/grocery/items/{id}/pantry', tag: 'Grocery', summary: 'Toggle pantry ownership' },
  { method: 'get', path: '/api/user/progress/history', tag: 'Tracking', summary: 'Read progress history' },
  { method: 'post', path: '/api/user/progress/weight', tag: 'Tracking', summary: 'Log a weight measurement' },
  { method: 'get', path: '/api/billing/access', tag: 'Billing', summary: 'Read subscription access' },
  { method: 'post', path: '/api/billing/subscriptions', tag: 'Billing', summary: 'Create a PayMongo hosted checkout' },
  {
    method: 'post',
    path: '/api/webhooks/paymongo',
    tag: 'Billing',
    summary: 'Receive signed PayMongo events',
    public: true,
  },
  { method: 'get', path: '/api/nutritionist/queue', tag: 'Nutritionist', summary: 'List review queue' },
  {
    method: 'get',
    path: '/api/nutritionist/queue/{id}',
    tag: 'Nutritionist',
    summary: 'Read and claim review details',
  },
  { method: 'patch', path: '/api/nutritionist/queue/{id}', tag: 'Nutritionist', summary: 'Submit a review decision' },
  { method: 'get', path: '/api/nutritionist/library', tag: 'Nutritionist', summary: 'List verified meal library' },
  { method: 'get', path: '/api/nutritionist/library-coverage', tag: 'Nutritionist', summary: 'Read library coverage' },
  { method: 'post', path: '/api/nutritionist/library', tag: 'Nutritionist', summary: 'Create a library meal' },
  { method: 'get', path: '/api/nutritionist/library/{id}', tag: 'Nutritionist', summary: 'Read a library meal' },
  { method: 'patch', path: '/api/nutritionist/library/{id}', tag: 'Nutritionist', summary: 'Update a library meal' },
  { method: 'delete', path: '/api/nutritionist/library/{id}', tag: 'Nutritionist', summary: 'Archive a library meal' },
  { method: 'get', path: '/api/nutritionist/approved', tag: 'Nutritionist', summary: 'List approved plans' },
  {
    method: 'get',
    path: '/api/nutritionist/compensation',
    tag: 'Compensation',
    summary: 'Read own compensation records',
  },
  { method: 'get', path: '/api/nutritionist/profile', tag: 'Nutritionist', summary: 'Read nutritionist profile' },
  { method: 'patch', path: '/api/nutritionist/profile', tag: 'Nutritionist', summary: 'Update nutritionist profile' },
  { method: 'get', path: '/api/admin/analytics', tag: 'Admin', summary: 'Read platform analytics' },
  { method: 'get', path: '/api/admin/users', tag: 'Admin', summary: 'List users' },
  { method: 'get', path: '/api/admin/nutritionists', tag: 'Admin', summary: 'List nutritionists' },
  {
    method: 'get',
    path: '/api/admin/nutritionist-applications',
    tag: 'Admin',
    summary: 'List nutritionist applications',
  },
  { method: 'get', path: '/api/admin/audit-events', tag: 'Admin', summary: 'List audit events' },
  { method: 'get', path: '/api/admin/safety-incidents', tag: 'Admin', summary: 'List safety incidents' },
  { method: 'get', path: '/api/admin/structured-safety-operations', tag: 'Admin', summary: 'Read safety operations' },
  { method: 'get', path: '/api/admin/compensation', tag: 'Compensation', summary: 'Read compensation workspace' },
  { method: 'get', path: '/api/admin/billing-operations', tag: 'Billing', summary: 'Read billing operations' },
  { method: 'get', path: '/api/fnri/lookup', tag: 'FNRI', summary: 'Look up Philippine food composition data' },
];

const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const errorSchema = registry.register(
  'ApiError',
  z.object({
    success: z.literal(false),
    error: z.string(),
    errorCode: z.string(),
    requestId: z.string().optional(),
  })
);

const successSchema = registry.register(
  'ApiSuccess',
  z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: z.unknown().optional(),
  })
);

for (const route of routes) {
  registry.registerPath({
    method: route.method,
    path: route.path,
    tags: [route.tag],
    summary: route.summary,
    security: route.public ? [] : [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Successful response',
        content: { 'application/json': { schema: successSchema } },
      },
      400: {
        description: 'Invalid request',
        content: { 'application/json': { schema: errorSchema } },
      },
      401: {
        description: 'Authentication required',
        content: { 'application/json': { schema: errorSchema } },
      },
      500: {
        description: 'Unexpected server error',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  });
}

export const openApiDocument = new OpenApiGeneratorV31(registry.definitions, {
  sortComponents: 'alphabetically',
}).generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'NutriMind API',
    version: '1.0.0',
    description:
      'REST API for NutriMind authentication, onboarding, meal planning, nutritionist review, billing, and administration.',
  },
  servers: [{ url: '/', description: 'Current deployment' }],
  tags: [...new Set(routes.map((route) => route.tag))].sort().map((name) => ({ name })),
});

export const documentedRouteCount = routes.length;
