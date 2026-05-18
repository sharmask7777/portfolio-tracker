-- CreateTable
CREATE TABLE "PortfolioHistory" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "investedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalNAV" (
    "id" TEXT NOT NULL,
    "amfiCode" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "nav" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalNAV_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioHistory_portfolioId_idx" ON "PortfolioHistory"("portfolioId");

-- CreateIndex
CREATE INDEX "PortfolioHistory_date_idx" ON "PortfolioHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioHistory_portfolioId_date_key" ON "PortfolioHistory"("portfolioId", "date");

-- CreateIndex
CREATE INDEX "HistoricalNAV_amfiCode_idx" ON "HistoricalNAV"("amfiCode");

-- CreateIndex
CREATE INDEX "HistoricalNAV_date_idx" ON "HistoricalNAV"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalNAV_amfiCode_date_key" ON "HistoricalNAV"("amfiCode", "date");

-- AddForeignKey
ALTER TABLE "PortfolioHistory" ADD CONSTRAINT "PortfolioHistory_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
