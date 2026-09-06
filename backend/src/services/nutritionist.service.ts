import { NutritionistLibraryService } from './nutritionist-library.service';
import { NutritionistProfileService } from './nutritionist-profile.service';
import { NutritionistReviewService } from './nutritionist-review.service';

/**
 * Stable service façade used by existing controllers.
 *
 * Implementation is separated by operational responsibility so review,
 * profile, and verified-library changes can evolve independently.
 */
export class NutritionistService {
  static readonly getReviewQueue = NutritionistReviewService.getReviewQueue.bind(NutritionistReviewService);
  static readonly getReviewCardDetails = NutritionistReviewService.getReviewCardDetails.bind(NutritionistReviewService);
  static readonly approveMealPlan = NutritionistReviewService.approveMealPlan.bind(NutritionistReviewService);
  static readonly rejectMealPlan = NutritionistReviewService.rejectMealPlan.bind(NutritionistReviewService);
  static readonly getApprovedMeals = NutritionistReviewService.getApprovedMeals.bind(NutritionistReviewService);

  static readonly getProfile = NutritionistProfileService.getProfile.bind(NutritionistProfileService);
  static readonly updateProfile = NutritionistProfileService.updateProfile.bind(NutritionistProfileService);

  static readonly getMealLibrary = NutritionistLibraryService.getMealLibrary.bind(NutritionistLibraryService);
  static readonly checkLibraryMealMutationPermission =
    NutritionistLibraryService.checkLibraryMealMutationPermission.bind(NutritionistLibraryService);
  static readonly getMealLibraryWithFilters =
    NutritionistLibraryService.getMealLibraryWithFilters.bind(NutritionistLibraryService);
  static readonly getMealLibraryCoverage =
    NutritionistLibraryService.getMealLibraryCoverage.bind(NutritionistLibraryService);
  static readonly getLibraryMeal = NutritionistLibraryService.getLibraryMeal.bind(NutritionistLibraryService);
  static readonly certifyLibraryMealSafety =
    NutritionistLibraryService.certifyLibraryMealSafety.bind(NutritionistLibraryService);
  static readonly editLibraryMeal = NutritionistLibraryService.editLibraryMeal.bind(NutritionistLibraryService);
  static readonly deleteLibraryMeal = NutritionistLibraryService.deleteLibraryMeal.bind(NutritionistLibraryService);
  static readonly flagLibraryMeal = NutritionistLibraryService.flagLibraryMeal.bind(NutritionistLibraryService);
  static readonly resolveLibraryMealFlag =
    NutritionistLibraryService.resolveLibraryMealFlag.bind(NutritionistLibraryService);
}
