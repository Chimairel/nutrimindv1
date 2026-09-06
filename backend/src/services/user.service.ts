import { UserProfileService } from './user-profile.service';
import { UserSafetyIntakeService } from './user-safety-intake.service';
import { UserSafetyRecheckService } from './user-safety-recheck.service';

/** Stable façade for user profile, intake, and safety-recheck operations. */
export class UserService {
  static readonly updateUserProfile = UserProfileService.updateUserProfile.bind(UserProfileService);
  static readonly saveShoppingDay = UserProfileService.saveShoppingDay.bind(UserProfileService);
  static readonly acceptTos = UserProfileService.acceptTos.bind(UserProfileService);
  static readonly updateUserImage = UserProfileService.updateUserImage.bind(UserProfileService);
  static readonly completeOnboarding = UserProfileService.completeOnboarding.bind(UserProfileService);
  static readonly getUserProfileDetails = UserProfileService.getUserProfileDetails.bind(UserProfileService);

  static readonly updateHealthConditions = UserSafetyIntakeService.updateHealthConditions.bind(UserSafetyIntakeService);
  static readonly updateHealthConditionsWithCustom =
    UserSafetyIntakeService.updateHealthConditionsWithCustom.bind(UserSafetyIntakeService);
  static readonly updateAllergies = UserSafetyIntakeService.updateAllergies.bind(UserSafetyIntakeService);
  static readonly updateAllergiesWithCustom =
    UserSafetyIntakeService.updateAllergiesWithCustom.bind(UserSafetyIntakeService);
  static readonly updateSafetyProfile = UserSafetyIntakeService.updateSafetyProfile.bind(UserSafetyIntakeService);
  static readonly updateOtherConditions = UserSafetyIntakeService.updateOtherConditions.bind(UserSafetyIntakeService);
  static readonly updateOtherAllergies = UserSafetyIntakeService.updateOtherAllergies.bind(UserSafetyIntakeService);

  static readonly checkSafetyConflict = UserSafetyRecheckService.checkSafetyConflict.bind(UserSafetyRecheckService);
  static readonly runSafetyRecheck = UserSafetyRecheckService.runSafetyRecheck.bind(UserSafetyRecheckService);
}
