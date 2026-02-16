-- Add seriesId and metadata to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS "Booking_seriesId_idx" ON "Booking"("seriesId");
CREATE INDEX IF NOT EXISTS "Booking_roomId_startTime_idx" ON "Booking"("roomId", "startTime");
CREATE INDEX IF NOT EXISTS "Booking_roomId_endTime_idx" ON "Booking"("roomId", "endTime");
