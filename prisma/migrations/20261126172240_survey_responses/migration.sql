-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT,
    "answer" TEXT NOT NULL,
    "otherText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SurveyResponse_shop_createdAt_idx" ON "SurveyResponse"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_shop_orderId_key" ON "SurveyResponse"("shop", "orderId");
