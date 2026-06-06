-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "lastStudied" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "pdfCount" INTEGER NOT NULL DEFAULT 0,
    "audioCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "flashcards" TEXT,
    "quiz" TEXT,
    "quest" TEXT,
    "podcast" TEXT,
    "visual" TEXT,
    "activeModes" TEXT,
    "files" TEXT,
    "notesProgress" INTEGER NOT NULL DEFAULT 0,
    "flashcardsProgress" INTEGER NOT NULL DEFAULT 0,
    "quizProgress" INTEGER NOT NULL DEFAULT 0,
    "questProgress" INTEGER NOT NULL DEFAULT 0,
    "podcastProgress" INTEGER NOT NULL DEFAULT 0,
    "visualProgress" INTEGER NOT NULL DEFAULT 0,
    "audioProgress" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("activeModes", "audioCount", "createdAt", "date", "flashcards", "id", "imageCount", "lastStudied", "notes", "pdfCount", "podcast", "progress", "quest", "quiz", "title", "updatedAt", "userId", "videoCount", "visual") SELECT "activeModes", "audioCount", "createdAt", "date", "flashcards", "id", "imageCount", "lastStudied", "notes", "pdfCount", "podcast", "progress", "quest", "quiz", "title", "updatedAt", "userId", "videoCount", "visual" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
