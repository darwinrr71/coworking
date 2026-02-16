-- Optional: prevent booking overlaps per room at DB level.
-- Apply manually after confirming no overlapping data exists.
-- Requires: btree_gist extension.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_roomId_time_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startTime", "endTime", '[)') WITH &&
  );
