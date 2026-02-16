-- CreateTable
CREATE TABLE "RoomImage" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'room-images',
    "path" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomImage_roomId_idx" ON "RoomImage"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomImage_roomId_path_key" ON "RoomImage"("roomId", "path");

-- AddForeignKey
ALTER TABLE "RoomImage" ADD CONSTRAINT "RoomImage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
