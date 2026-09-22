import prisma from '@/lib/prisma';

export class MealFavoriteService {
  static async add(userId: string, mealLibraryId: string) {
    const meal = await prisma.mealLibrary.findUnique({ where: { id: mealLibraryId }, select: { id: true } });
    if (!meal) throw new Error('Library meal not found.');
    return prisma.mealFavorite.upsert({
      where: { userId_mealLibraryId: { userId, mealLibraryId } },
      create: { userId, mealLibraryId },
      update: {},
    });
  }

  static async remove(userId: string, mealLibraryId: string) {
    await prisma.mealFavorite.deleteMany({ where: { userId, mealLibraryId } });
    return { mealLibraryId, isFavorite: false };
  }
}
