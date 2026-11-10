import { z } from "zod";

const kenyanPhone = z
  .string()
  .trim()
  .regex(/^(\+?254|0)?[17]\d{8}$/, "Enter a valid Kenyan mobile number, e.g. 0712 345 678");

export const latLng = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);

export const entryInputSchema = z.object({
  farmerName: z.string().trim().min(3, "Enter the farmer's full name").max(120),
  farmerPhone: kenyanPhone,
  farmerIdNumber: z.string().trim().regex(/^\d{6,10}$/, "ID number must be 6 to 10 digits"),
  plotLrNo: z.string().trim().min(1, "Enter the plot LR number").max(60),
  estimatedAcres: z.coerce.number().positive("Acreage must be greater than zero").max(10_000),
  estimatedTrips: z.coerce.number().int("Trips must be a whole number").min(1, "At least one trip").max(10_000),
  sublocation: z.string().trim().min(2, "Enter the sub-location").max(80),
  area: z.string().trim().min(2, "Enter the area").max(80),
  deliveryCbcId: z.string().uuid("Choose the cane buying centre"),
  harvesterId: z.string().uuid("Choose the harvester"),
  polygon: z.array(latLng).min(3, "Draw the field boundary with at least three corners").max(500),

  bankId: z.string().uuid("Choose the bank"),
  accountNumber: z.string().trim().regex(/^\d+$/, "Account number must contain digits only"),
  accountName: z.string().trim().min(3, "Enter the account name").max(120),
  branch: z.string().trim().min(2, "Enter the branch").max(80),
  bankCardPhotoUrl: z.string().url("Take a photo of the bank card or passbook").optional().or(z.literal("")),

  idFrontUrl: z.string().url("Take a photo of the front of the ID"),
  idBackUrl: z.string().url("Take a photo of the back of the ID"),
  farmerPhotoUrl: z.string().url("Take a photo of the farmer"),
  signatureUrl: z.string().url("Capture the farmer's signature"),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "The farmer must agree to the terms and conditions" }) }),
  dataConsent: z.literal(true, { errorMap: () => ({ message: "The farmer must consent to the data protection statement" }) }),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(60),
  password: z.string().min(1, "Enter your password"),
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(8, "Use at least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const userInputSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "3–40 characters: letters, numbers, dot, dash or underscore"),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "SCOUT", "CALL_CENTER", "IT_CHECKER", "LEGAL", "PERMIT_OFFICER", "GIS_OFFICER"]),
});

export const harvesterInputSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  idNumber: z.string().trim().max(20).optional().or(z.literal("")),
});

export const bankInputSchema = z.object({
  code: z.string().trim().regex(/^\d{1,4}$/, "Bank code is a number"),
  name: z.string().trim().min(2).max(120),
  accountLength: z.coerce.number().int().min(6).max(24),
});

export const cbcInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export function firstErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
