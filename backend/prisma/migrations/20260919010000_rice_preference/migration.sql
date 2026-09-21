CREATE TYPE "RicePreference" AS ENUM ('NO_RICE', 'FLEXIBLE', 'WITH_RICE');

ALTER TABLE "UserProfile" ADD COLUMN "ricePreference" "RicePreference";
