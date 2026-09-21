-- OAuth identities are durable one-to-one links. These indexes prevent two
-- users from claiming the same provider subject and one user from accumulating
-- duplicate links for a provider during concurrent sign-in requests.
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"
ON "Account"("provider", "providerAccountId");

CREATE UNIQUE INDEX "Account_userId_provider_key"
ON "Account"("userId", "provider");
