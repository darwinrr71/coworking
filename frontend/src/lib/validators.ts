import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Användarnamn krävs"),
  password: z.string().min(1, "Lösenord krävs"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Minst 3 tecken"),
  password: z.string().min(6, "Minst 6 tecken"),
});

export const roomSchema = z.object({
  name: z.string().min(1, "Namn krävs"),
  address: z.string().min(1, "Adress krävs"),
  capacity: z
    .union([z.string(), z.number(), z.undefined()])
    .transform((value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? NaN : Number(trimmed);
      }
      return NaN;
    })
    .refine((value) => Number.isFinite(value), "Kapacitet krävs")
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      "Kapacitet måste vara ett heltal > 0"
    ),
  pricePerHour: z
    .union([z.string(), z.number(), z.undefined()])
    .transform((value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? NaN : Number(trimmed);
      }
      return NaN;
    })
    .refine((value) => Number.isFinite(value), "Pris per timme krävs")
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      "Pris per timme måste vara ett heltal > 0"
    ),
  squareMeters: z
    .union([z.string(), z.number(), z.undefined()])
    .transform((value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? NaN : Number(trimmed);
      }
      return NaN;
    })
    .refine((value) => Number.isFinite(value), "Kvadratmeter krävs")
    .refine(
      (value) => Number.isInteger(value) && value > 0,
      "Kvadratmeter måste vara ett heltal > 0"
    ),
  description: z.string().min(1, "Beskrivning krävs"),
  type: z.enum(["KontorCoworking", "MotenEvent"]),
});

export const bookingSchema = z
  .object({
    roomId: z.number().int().positive("Rum-ID måste vara ett heltal > 0"),
    startTime: z.string().min(1, "Starttid krävs"),
    endTime: z.string().min(1, "Sluttid krävs"),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "Sluttid måste vara efter starttid",
    path: ["endTime"],
  })
  .refine((data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const validMinutes =
      start.getMinutes() === 0 &&
      end.getMinutes() === 0 &&
      start.getSeconds() === 0 &&
      end.getSeconds() === 0;
    const validHours =
      start.getHours() >= 8 &&
      start.getHours() <= 22 &&
      end.getHours() >= 8 &&
      end.getHours() <= 22;
    return validMinutes && validHours;
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
