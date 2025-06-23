/*
  Warnings:

  - The values [STARTING,IN_PROGRESS] on the enum `GameStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `hostUserId` on the `games` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `question_sets` table. All the data in the column will be lost.
  - You are about to drop the column `difficulty` on the `question_sets` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `question_sets` table. All the data in the column will be lost.
  - Added the required column `createdBy` to the `games` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('FREE', 'PREMIUM', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "GameStatus_new" AS ENUM ('WAITING', 'LOBBY', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');
ALTER TABLE "games" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "games" ALTER COLUMN "status" TYPE "GameStatus_new" USING ("status"::text::"GameStatus_new");
ALTER TYPE "GameStatus" RENAME TO "GameStatus_old";
ALTER TYPE "GameStatus_new" RENAME TO "GameStatus";
DROP TYPE "GameStatus_old";
ALTER TABLE "games" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;

-- DropForeignKey
ALTER TABLE "games" DROP CONSTRAINT "games_questionSetId_fkey";

-- DropForeignKey
ALTER TABLE "question_sets" DROP CONSTRAINT "question_sets_categoryId_fkey";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "icon" DROP NOT NULL,
ALTER COLUMN "color" DROP NOT NULL;

-- AlterTable
ALTER TABLE "games" DROP COLUMN "hostUserId",
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "currentPlayers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "questionTime" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "totalQuestions" INTEGER NOT NULL DEFAULT 10,
ALTER COLUMN "roomCode" SET DATA TYPE TEXT,
ALTER COLUMN "questionSetId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'WAITING',
ALTER COLUMN "maxPlayers" SET DEFAULT 4,
ALTER COLUMN "timePerQuestion" SET DEFAULT 30;

-- AlterTable
ALTER TABLE "question_sets" DROP COLUMN "categoryId",
DROP COLUMN "difficulty",
DROP COLUMN "isActive",
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN     "createdBy" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'EN';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "createdBy" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'EN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "emailVerificationCode" TEXT,
ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCompletedSetup" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "question_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
