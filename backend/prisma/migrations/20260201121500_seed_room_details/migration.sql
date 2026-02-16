UPDATE "Room"
SET
  "pricePerHour" = CASE
    WHEN "pricePerHour" = 0 THEN
      CASE
        WHEN "type" = 'workspace' THEN 25 + ("capacity" * 2)
        ELSE 40 + ("capacity" * 3)
      END
    ELSE "pricePerHour"
  END,
  "squareMeters" = CASE
    WHEN "squareMeters" = 0 THEN GREATEST(12, "capacity" * 3)
    ELSE "squareMeters"
  END,
  "description" = CASE
    WHEN "description" = '' THEN
      CASE
        WHEN "type" = 'workspace' THEN 'Espacio luminoso ideal para trabajo individual y equipos pequenos. Incluye wifi, cafe y pizarras.'
        ELSE 'Sala equipada para reuniones, presentaciones y videoconferencias. Ambiente profesional y comodo.'
      END
    ELSE "description"
  END;
