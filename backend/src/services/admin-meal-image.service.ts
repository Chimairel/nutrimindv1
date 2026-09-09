import prisma from '@/lib/prisma';
import { removeMealImage, uploadMealImage } from '@/lib/cloudinary';
import { toPublicMealImage } from '@/domain/meal-image.policy';
import type { MealImageMetadata } from '@/validation/meal-image.schemas';

export class AdminMealImageService {
  static async list(page: number, limit: number, search?: string) {
    const where = search ? { mealName: { contains: search, mode: 'insensitive' as const } } : {};
    const [items, total] = await Promise.all([
      prisma.mealLibrary.findMany({ where, orderBy: { mealName: 'asc' }, skip: (page - 1) * limit, take: limit }),
      prisma.mealLibrary.count({ where }),
    ]);
    return {
      items: items.map((meal) => ({
        id: meal.id,
        mealName: meal.mealName,
        mealType: meal.mealType,
        status: meal.status,
        image: toPublicMealImage(meal),
        hasImage: Boolean(meal.imagePublicId),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async assign(adminUserId: string, mealId: string, file: Express.Multer.File, metadata: MealImageMetadata) {
    const meal = await prisma.mealLibrary.findUnique({ where: { id: mealId } });
    if (!meal) throw new Error('Meal library entry not found.');

    const uploaded = await uploadMealImage(file.buffer, mealId);
    if (!uploaded.width || !uploaded.height || uploaded.width < 320 || uploaded.height < 240) {
      await removeMealImage(uploaded.public_id);
      throw new Error('Image must be at least 320 by 240 pixels.');
    }
    if (uploaded.bytes > 5 * 1024 * 1024) {
      await removeMealImage(uploaded.public_id);
      throw new Error('Image must be no larger than 5 MB.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const updated = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            imagePublicId: uploaded.public_id,
            imageVersion: String(uploaded.version),
            imageFormat: uploaded.format,
            imageWidth: uploaded.width,
            imageHeight: uploaded.height,
            imageBytes: uploaded.bytes,
            imageKind: metadata.imageKind,
            imageAltText: metadata.altText,
            imageCreator: metadata.creator || null,
            imageSourcePageUrl: metadata.sourcePageUrl || null,
            imageLicenseCode: metadata.licenseCode,
            imageLicenseUrl: metadata.licenseUrl || null,
            imageAssignedAt: new Date(),
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            action: 'MEAL_IMAGE_ASSIGNED',
            entityType: 'MealLibrary',
            entityId: mealId,
            metadata: {
              imageKind: metadata.imageKind,
              licenseCode: metadata.licenseCode,
              replacedImage: Boolean(meal.imagePublicId),
            },
          },
        });
        return { ...updated, image: toPublicMealImage(updated) };
      });
    } catch (error) {
      await removeMealImage(uploaded.public_id).catch(() => undefined);
      throw error;
    }
  }

  static async unassign(adminUserId: string, mealId: string) {
    const meal = await prisma.mealLibrary.findUnique({ where: { id: mealId } });
    if (!meal) throw new Error('Meal library entry not found.');
    await prisma.$transaction(async (tx) => {
      await tx.mealLibrary.update({
        where: { id: mealId },
        data: {
          imagePublicId: null,
          imageVersion: null,
          imageFormat: null,
          imageWidth: null,
          imageHeight: null,
          imageBytes: null,
          imageKind: null,
          imageAltText: null,
          imageCreator: null,
          imageSourcePageUrl: null,
          imageLicenseCode: null,
          imageLicenseUrl: null,
          imageAssignedAt: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'MEAL_IMAGE_UNASSIGNED',
          entityType: 'MealLibrary',
          entityId: mealId,
        },
      });
    });
    return { id: mealId, image: null };
  }
}
