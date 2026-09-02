import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendNutritionistInvitationEmail } from '@/lib/email';

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const makeReferenceCode = () => `NM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

type ApplicationInput = {
  fullName: string;
  email: string;
  phoneNumber: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization: string;
  yearsOfExperience: number;
  university: string;
  professionalBio: string;
  availableCallSlots: string[];
  consent: true;
};

type ScheduleInput = {
  scheduledCallAt: string;
  meetingUrl: string;
  adminNotes?: string;
};

const publicApplicationSelect = {
  referenceCode: true,
  status: true,
  fullName: true,
  email: true,
  scheduledCallAt: true,
  meetingUrl: true,
  decisionReason: true,
  invitationSentAt: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NutritionistApplicationSelect;

export class NutritionistApplicationService {
  static async submit(input: ApplicationInput) {
    const email = input.email.trim().toLowerCase();
    const prcLicenseNumber = input.prcLicenseNumber.trim().toUpperCase();

    const [existingApplication, existingUser, existingProfile] = await Promise.all([
      prisma.nutritionistApplication.findFirst({
        where: { OR: [{ email }, { prcLicenseNumber }] },
        select: { email: true, prcLicenseNumber: true, referenceCode: true },
      }),
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.nutritionistProfile.findUnique({ where: { prcLicenseNumber }, select: { id: true } }),
    ]);

    if (existingApplication) {
      if (existingApplication.email === email) {
        throw new Error(`An application already exists for this email. Use reference ${existingApplication.referenceCode} to track it.`);
      }
      throw new Error('This PRC license number is already associated with an application.');
    }
    if (existingUser) throw new Error('An account already exists for this email address.');
    if (existingProfile) throw new Error('This PRC license number is already registered with NutriMind.');

    const application = await prisma.nutritionistApplication.create({
      data: {
        referenceCode: makeReferenceCode(),
        fullName: input.fullName.trim(),
        email,
        phoneNumber: input.phoneNumber.trim(),
        prcLicenseNumber,
        prcLicenseExpiry: new Date(input.prcLicenseExpiry),
        specialization: input.specialization.trim(),
        yearsOfExperience: input.yearsOfExperience,
        university: input.university.trim(),
        professionalBio: input.professionalBio.trim(),
        availableCallSlots: input.availableCallSlots,
        applicantConsentAt: new Date(),
      },
      select: publicApplicationSelect,
    });

    return application;
  }

  static async getPublicStatus(referenceCode: string, email: string) {
    const application = await prisma.nutritionistApplication.findFirst({
      where: {
        referenceCode: referenceCode.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
      },
      select: publicApplicationSelect,
    });
    if (!application) throw new Error('No application matched that reference code and email address.');
    return application;
  }

  static async listForAdmin() {
    return prisma.nutritionistApplication.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: {
        reviewedByAdmin: { select: { id: true, name: true, email: true } },
        invitedUser: { select: { id: true, emailVerified: true } },
      },
    });
  }

  static async setStage(
    adminUserId: string,
    applicationId: string,
    status: 'UNDER_REVIEW' | 'CALL_REQUIRED',
    adminNotes?: string
  ) {
    const application = await this.requireApplication(applicationId);
    const allowed =
      (status === 'UNDER_REVIEW' && application.status === 'SUBMITTED') ||
      (status === 'CALL_REQUIRED' && application.status === 'UNDER_REVIEW');
    if (!allowed) throw new Error(`Application cannot move from ${application.status} to ${status}.`);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.nutritionistApplication.update({
        where: { id: applicationId },
        data: {
          status,
          reviewedByAdminId: adminUserId,
          reviewedAt: new Date(),
          adminNotes: adminNotes?.trim() || application.adminNotes,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: `NUTRITIONIST_APPLICATION_${status}`,
          entityType: 'NutritionistApplication',
          entityId: applicationId,
          metadata: { referenceCode: application.referenceCode },
        },
      });
      return updated;
    });
  }

  static async scheduleCall(adminUserId: string, applicationId: string, input: ScheduleInput) {
    const application = await this.requireApplication(applicationId);
    if (application.status !== 'CALL_REQUIRED') {
      throw new Error('The application must be advanced to the call stage before scheduling.');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.nutritionistApplication.update({
        where: { id: applicationId },
        data: {
          status: 'CALL_SCHEDULED',
          reviewedByAdminId: adminUserId,
          scheduledCallAt: new Date(input.scheduledCallAt),
          meetingUrl: input.meetingUrl.trim(),
          adminNotes: input.adminNotes?.trim() || application.adminNotes,
          reviewedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'NUTRITIONIST_CALL_SCHEDULED',
          entityType: 'NutritionistApplication',
          entityId: applicationId,
          metadata: { scheduledCallAt: input.scheduledCallAt },
        },
      });
      return updated;
    });
  }

  static async decide(
    adminUserId: string,
    applicationId: string,
    input: { decision: 'approve'; adminNotes?: string } | { decision: 'reject'; reason: string; adminNotes?: string }
  ) {
    const application = await this.requireApplication(applicationId);
    if (['APPROVED', 'REJECTED', 'ACTIVATED'].includes(application.status)) {
      throw new Error('A final decision has already been recorded for this application.');
    }

    if (input.decision === 'reject') {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.nutritionistApplication.update({
          where: { id: applicationId },
          data: {
            status: 'REJECTED',
            decisionReason: input.reason.trim(),
            adminNotes: input.adminNotes?.trim() || application.adminNotes,
            reviewedByAdminId: adminUserId,
            reviewedAt: new Date(),
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            action: 'NUTRITIONIST_APPLICATION_REJECTED',
            entityType: 'NutritionistApplication',
            entityId: applicationId,
            metadata: { referenceCode: application.referenceCode },
          },
        });
        return { application: updated, invitationEmailSent: false };
      });
    }

    if (application.status !== 'CALL_SCHEDULED' || !application.scheduledCallAt) {
      throw new Error('Complete and record the required verification call before approving this application.');
    }
    if (application.scheduledCallAt.getTime() > Date.now()) {
      throw new Error('The scheduled verification call must take place before approval.');
    }
    if (application.prcLicenseExpiry.getTime() <= Date.now()) {
      throw new Error('An expired PRC license cannot be approved.');
    }

    const invitationToken = crypto.randomBytes(32).toString('base64url');
    const invitationTokenHash = hashToken(invitationToken);
    const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const placeholderPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const approved = await prisma.$transaction(async (tx) => {
      const duplicateUser = await tx.user.findUnique({ where: { email: application.email } });
      if (duplicateUser) throw new Error('An account already exists for this applicant email.');

      const user = await tx.user.create({
        data: {
          name: application.fullName,
          email: application.email,
          passwordHash: placeholderPasswordHash,
          role: 'NUTRITIONIST',
          emailVerified: false,
        },
      });
      await tx.nutritionistProfile.create({
        data: {
          userId: user.id,
          verifiedByAdminId: adminUserId,
          prcLicenseNumber: application.prcLicenseNumber,
          prcLicenseExpiry: application.prcLicenseExpiry,
          specialization: application.specialization,
          yearsOfExperience: application.yearsOfExperience,
          university: application.university,
          bio: application.professionalBio,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      const updated = await tx.nutritionistApplication.update({
        where: { id: applicationId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          reviewedAt: new Date(),
          reviewedByAdminId: adminUserId,
          adminNotes: input.adminNotes?.trim() || application.adminNotes,
          invitationTokenHash,
          invitationExpiresAt,
          invitedUserId: user.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'NUTRITIONIST_APPLICATION_APPROVED',
          entityType: 'NutritionistApplication',
          entityId: applicationId,
          metadata: { referenceCode: application.referenceCode, invitedUserId: user.id },
        },
      });
      return updated;
    });

    const invitationEmailSent = await this.deliverInvitation(approved, invitationToken);
    return { application: approved, invitationEmailSent };
  }

  static async resendInvitation(adminUserId: string, applicationId: string) {
    const application = await this.requireApplication(applicationId);
    if (application.status !== 'APPROVED' || !application.invitedUserId) {
      throw new Error('Only approved, unactivated applications can receive a new invitation.');
    }

    const invitationToken = crypto.randomBytes(32).toString('base64url');
    const updated = await prisma.nutritionistApplication.update({
      where: { id: applicationId },
      data: {
        invitationTokenHash: hashToken(invitationToken),
        invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        reviewedByAdminId: adminUserId,
      },
    });
    const invitationEmailSent = await this.deliverInvitation(updated, invitationToken);
    return { application: updated, invitationEmailSent };
  }

  static async acceptInvitation(token: string, password: string) {
    const application = await prisma.nutritionistApplication.findUnique({
      where: { invitationTokenHash: hashToken(token) },
    });
    if (!application || application.status !== 'APPROVED' || !application.invitedUserId) {
      throw new Error('This nutritionist invitation is invalid or has already been used.');
    }
    if (!application.invitationExpiresAt || application.invitationExpiresAt.getTime() <= Date.now()) {
      throw new Error('This nutritionist invitation has expired. Ask NutriMind for a new invitation.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: application.invitedUserId! },
        data: { passwordHash, emailVerified: true },
      });
      await tx.nutritionistApplication.update({
        where: { id: application.id },
        data: {
          status: 'ACTIVATED',
          activatedAt: new Date(),
          invitationTokenHash: null,
          invitationExpiresAt: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: application.invitedUserId!,
          action: 'NUTRITIONIST_ACCOUNT_ACTIVATED',
          entityType: 'NutritionistApplication',
          entityId: application.id,
          metadata: { referenceCode: application.referenceCode },
        },
      });
    });
    return { message: 'Nutritionist account activated. You can now sign in.' };
  }

  private static async requireApplication(id: string) {
    const application = await prisma.nutritionistApplication.findUnique({ where: { id } });
    if (!application) throw new Error('Nutritionist application not found.');
    return application;
  }

  private static async deliverInvitation(
    application: { id: string; email: string; fullName: string },
    invitationToken: string
  ) {
    try {
      await sendNutritionistInvitationEmail(application.email, invitationToken, application.fullName);
      await prisma.nutritionistApplication.update({
        where: { id: application.id },
        data: { invitationSentAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export default NutritionistApplicationService;
