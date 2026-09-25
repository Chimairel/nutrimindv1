import prisma from '@/lib/prisma';
import { NotificationType, Prisma } from '@prisma/client';
import { lockUserProfile } from './profile-revision.service';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { buildDeterministicNutritionGuidance, NUTRITION_GUIDANCE_POLICY_VERSION } from '@/domain/deterministic-nutrition-report.policy';
import { ProfileCycleAdaptationService } from './profile-cycle-adaptation.service';
import { UpcomingPlanPreparationService } from './upcoming-plan-preparation.service';
import { PlanningReadinessService } from './planning-readiness.service';

type StoredNutritionReport = NonNullable<Awaited<ReturnType<typeof prisma.nutritionReport.findUnique>>>;
type ReportResponse = StoredNutritionReport & { referenceItems: ReturnType<typeof buildDeterministicNutritionGuidance>['referenceItems']; reportPolicyVersion: string | null };

export class NutritionReportService {
  private static readonly generationInFlight = new Map<string, Promise<ReportResponse>>();

  static async getReport(userId: string): Promise<ReportResponse | null> {
    const report = await prisma.nutritionReport.findUnique({ where: { userId } });
    if (!report) return null;
    const version = await prisma.nutritionReportVersion.findFirst({ where: { userId, version: report.version } });
    const content = version?.content as Record<string, unknown> | undefined;
    const policyVersion = version?.policyVersion === NUTRITION_GUIDANCE_POLICY_VERSION ? version.policyVersion : null;
    return {
      ...report, isStale: report.isStale || !policyVersion,
      referenceItems: policyVersion && Array.isArray(content?.referenceItems)
        ? content.referenceItems as ReportResponse['referenceItems'] : [],
      reportPolicyVersion: policyVersion,
    };
  }

  static async acknowledgeReport(userId: string, expectedVersion?: number) {
    const result = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const report = await tx.nutritionReport.findUniqueOrThrow({ where: { userId } });
      const profile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
      const version = await tx.nutritionReportVersion.findFirst({ where: { userId, version: report.version } });
      if (report.isStale || report.profileRevision !== profile.revision || expectedVersion !== report.version ||
          version?.policyVersion !== NUTRITION_GUIDANCE_POLICY_VERSION) {
        throw new Error('This guidance changed or is out of date. Refresh and review the current version.');
      }
      const acknowledgedAt = new Date();
      await tx.nutritionReportVersion.updateMany({ where: { userId, version: report.version }, data: { acknowledgedAt } });
      const firstAcknowledgment = !report.acknowledgedAt;
      const acknowledged = await tx.nutritionReport.update({ where: { userId }, data: { acknowledgedAt } });
      await ProfileCycleAdaptationService.acknowledgeProfileRevision(tx, userId, profile.revision);
      return { acknowledged, firstAcknowledgment };
    });
    const planningReadiness = await PlanningReadinessService.getForUser(userId);
    if (result.firstAcknowledgment) {
      try {
        await prisma.notification.create({ data: {
          userId, title: planningReadiness.title, message: planningReadiness.message,
          type: planningReadiness.canRequestPlan ? NotificationType.ASSIGNMENT : NotificationType.REVIEW_REQUEST,
        } });
      } catch (error) {
        console.error('[NutritionReportService] Planning-readiness notification failed:', error);
      }
    }
    UpcomingPlanPreparationService.triggerNonBlocking(userId);
    return { report: result.acknowledged, planningReadiness };
  }

  static async getHistory(userId: string) {
    return prisma.nutritionReportVersion.findMany({ where: { userId }, orderBy: { version: 'desc' }, take: 100 });
  }

  static async generateReport(userId: string): Promise<ReportResponse> {
    const existing = this.generationInFlight.get(userId);
    if (existing) return existing;
    const request = this.generateReportOnce(userId).finally(() => {
      if (this.generationInFlight.get(userId) === request) this.generationInFlight.delete(userId);
    });
    this.generationInFlight.set(userId, request);
    return request;
  }

  private static async generateReportOnce(userId: string): Promise<ReportResponse> {
    const { profile, safetyRestrictions, conditions, allergens, otherConditions, otherAllergies } =
      await loadUserNutritionContext(prisma, userId, 'Complete your profile before preparing nutrition guidance.');
    const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget) {
      throw new Error('Please complete your statistics and goals before preparing nutrition guidance.');
    }
    const guidance = buildDeterministicNutritionGuidance({
      age, dailyCalories: dailyCalorieTarget, weightKg, conditions, allergens,
      otherConditions: safetyRestrictions.customConditions,
      otherFoodRestrictions: safetyRestrictions.customFoodRestrictions,
    });
    const savedReport = {
      userId, generalSummary: guidance.generalSummary,
      foodsToAvoid: [] as string[], foodsToLimit: [] as string[],
      foodsRecommended: [] as string[], drinksGuidance: [] as string[],
      basedOnConditions: [...conditions, ...safetyRestrictions.customConditions],
      basedOnAllergies: [...allergens, ...safetyRestrictions.customFoodRestrictions],
    };
    const stored = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const currentProfile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
      if (currentProfile.revision !== profile.revision) throw new Error('Your profile changed. Please prepare the guidance again.');
      const current = await tx.nutritionReport.findUnique({ where: { userId } });
      const latest = await tx.nutritionReportVersion.findFirst({ where: { userId }, orderBy: { version: 'desc' } });
      const version = Math.max(current?.version ?? 0, latest?.version ?? 0) + 1;
      const generatedAt = new Date();
      const data = { ...savedReport, generatedAt, version, profileRevision: profile.revision, isStale: false, acknowledgedAt: null };
      await tx.nutritionReportVersion.create({ data: {
        userId, version, profileRevision: profile.revision, generatedAt,
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        content: JSON.parse(JSON.stringify({ ...savedReport, ...guidance })) as Prisma.InputJsonObject,
        profileSnapshot: JSON.parse(JSON.stringify({ profile, conditions, allergens, otherConditions, otherAllergies,
          nutritionReferences: guidance.nutritionReferences })) as Prisma.InputJsonObject,
      } });
      return tx.nutritionReport.upsert({ where: { userId }, update: data, create: data });
    });
    return { ...stored, referenceItems: guidance.referenceItems, reportPolicyVersion: NUTRITION_GUIDANCE_POLICY_VERSION };
  }
}
