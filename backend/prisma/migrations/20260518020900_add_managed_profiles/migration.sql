-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN     "managedProfileId" TEXT;

-- CreateTable
CREATE TABLE "ManagedProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagedProfile_userId_idx" ON "ManagedProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedProfile_userId_pan_key" ON "ManagedProfile"("userId", "pan");

-- AddForeignKey
ALTER TABLE "ManagedProfile" ADD CONSTRAINT "ManagedProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_managedProfileId_fkey" FOREIGN KEY ("managedProfileId") REFERENCES "ManagedProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
