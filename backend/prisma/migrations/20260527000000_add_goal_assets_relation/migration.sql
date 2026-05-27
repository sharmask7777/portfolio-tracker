-- CreateTable
CREATE TABLE "_GoalAssets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GoalAssets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GoalAssets_B_index" ON "_GoalAssets"("B");

-- AddForeignKey
ALTER TABLE "_GoalAssets" ADD CONSTRAINT "_GoalAssets_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoalAssets" ADD CONSTRAINT "_GoalAssets_B_fkey" FOREIGN KEY ("B") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
