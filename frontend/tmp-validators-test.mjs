import { roomSchema } from "./src/lib/validators.ts";

const samples = [
  {
    name: "",
    capacity: undefined,
    pricePerHour: undefined,
    squareMeters: undefined,
    description: "",
    type: "KontorCoworking",
  },
  {
    name: "Test",
    capacity: undefined,
    pricePerHour: undefined,
    squareMeters: undefined,
    description: "Test",
    type: "KontorCoworking",
  },
  {
    name: "Test",
    capacity: NaN,
    pricePerHour: NaN,
    squareMeters: NaN,
    description: "Test",
    type: "KontorCoworking",
  },
  {
    name: "Test",
    capacity: "",
    pricePerHour: "",
    squareMeters: "",
    description: "Test",
    type: "KontorCoworking",
  },
];

for (const sample of samples) {
  const result = roomSchema.safeParse(sample);
  console.log(JSON.stringify(sample));
  console.log(result.success ? "ok" : result.error.errors.map((e) => ({ path: e.path, msg: e.message })));
}
