/*
  Warnings:

  - You are about to drop the column `createdBy` on the `question_sets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "games" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'EN';

-- AlterTable
ALTER TABLE "question_sets" DROP COLUMN "createdBy",
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'system';
