import { z } from "zod";
export const statuses = {
  TO_CALL: "Te bellen",
  CALLED: "Gebeld",
  NO_ANSWER: "Niet opgenomen",
  CALLBACK: "Terugbellen",
  INTERESTED: "Geïnteresseerd",
  FOLLOW_UP: "Opvolgen",
  PROPOSAL_SENT: "Offerte gestuurd",
  CUSTOMER: "Klant geworden",
  NOT_INTERESTED: "Niet interessant",
  COMPLETED: "Afgerond",
} as const;
export const priorities = {
  HIGH: "Hoog",
  MEDIUM: "Normaal",
  LOW: "Laag",
} as const;
export const outcomes = {
  NO_ANSWER: "Niet opgenomen",
  SPOKEN: "Gesproken",
  CALLBACK: "Terugbellen",
  INTERESTED: "Geïnteresseerd",
  NOT_INTERESTED: "Geen interesse",
  WRONG_NUMBER: "Verkeerd nummer",
  OTHER: "Anders",
} as const;
const text = z.string().max(50000);
const id = z.string().min(1).max(200);
const stamp = z.iso.datetime({ offset: true });
export const StatusSchema = z.enum(
  Object.keys(statuses) as [
    keyof typeof statuses,
    ...(keyof typeof statuses)[],
  ],
);
export const PrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const ProspectSchema = z.object({
  id,
  originalNumber: z.number().finite().nullable(),
  companyName: z.string().trim().min(1).max(500),
  city: text,
  province: text.optional(),
  address: text.optional(),
  sourceUrl: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//.test(value))
    .optional(),
  sourceFetchedAt: stamp.optional(),
  sourceLicense: text.optional(),
  phone: text,
  phoneNormalized: text,
  website: text,
  logoDataUrl: z
    .string()
    .max(180000)
    .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/)
    .optional(),
  sector: text,
  valueProposition: text,
  email: z.union([z.literal(""), z.email()]),
  contactPerson: text,
  status: StatusSchema,
  priority: PrioritySchema,
  tags: z.array(z.string().max(200)).max(100),
  followUpAt: stamp.nullable(),
  lastContactedAt: stamp.nullable(),
  createdAt: stamp,
  updatedAt: stamp,
  source: text,
});
export const NoteSchema = z.object({
  id,
  prospectId: id,
  content: z.string().trim().min(1).max(50000),
  createdAt: stamp,
  updatedAt: stamp,
});
export const FollowUpSchema = z.object({
  id,
  prospectId: id,
  title: z.string().trim().min(1).max(500),
  description: text,
  dueAt: stamp,
  dateOnly: z.boolean(),
  completedAt: stamp.nullable(),
  createdAt: stamp,
});
export const ActivitySchema = z.object({
  id,
  prospectId: id,
  type: z.string().min(1).max(100),
  description: text,
  createdAt: stamp,
});
export const CallSchema = z.object({
  id,
  prospectId: id,
  initiatedAt: stamp,
  outcome: z
    .enum(
      Object.keys(outcomes) as [
        keyof typeof outcomes,
        ...(keyof typeof outcomes)[],
      ],
    )
    .nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  summary: text,
  confirmedAt: stamp.nullable(),
});
export const DraftSchema = z.object({
  id,
  prospectId: id,
  recipient: z.union([z.literal(""), z.email()]),
  subject: z.string().max(1000),
  body: text,
  template: z.number().int().min(0).max(5),
  tone: text,
  updatedAt: stamp,
});
export const ProfileSchema = z.object({
  name: z.string().max(300),
  company: z.string().min(1).max(300),
  email: z.union([z.literal(""), z.email()]),
  phone: z.string().max(100),
  website: z.string().max(500),
  signature: text,
  theme: z.enum(["light", "dark", "system"]),
  density: z.enum(["comfortable", "compact"]),
  tone: z.string().max(100),
  template: z.number().int().min(0).max(5),
  queue: z.enum(["all", "new", "high"]),
  conversationStatus: StatusSchema,
});
export type Prospect = z.infer<typeof ProspectSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type FollowUp = z.infer<typeof FollowUpSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Call = z.infer<typeof CallSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Status = Prospect["status"];
export const defaultProfile: Profile = {
  name: "",
  company: "Amocean",
  email: "",
  phone: "",
  website: "https://amocean.nl",
  signature: "",
  theme: "dark",
  density: "comfortable",
  tone: "Zakelijk",
  template: 0,
  queue: "all",
  conversationStatus: "CALLED",
};
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function normalizePhone(input: string): string {
  const clean = input
    .replace(/^(\+31|0031)\s*\(0\)/, "$1")
    .replace(/[\s().-]/g, "");
  const value = clean.replace(/^0031/, "+31").replace(/^\+31\(0\)/, "+31");
  if (/^0(?:800|900|906|909)\d{4}(?:\d{3})?$/.test(value))
    return "+31" + value.slice(1);
  if (/^\+31(?:800|900|906|909)\d{4}(?:\d{3})?$/.test(value)) return value;
  if (/^0[1-9]\d{8}$/.test(value)) return "+31" + value.slice(1);
  if (/^\+31[1-9]\d{8}$/.test(value)) return value;
  if (/^\+(?!31)\d{8,15}$/.test(value)) return value;
  return "";
}
export function safeUrl(input: string): string {
  if (!input.trim()) return "";
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(input) ? input : "https://" + input,
    );
    return ["https:", "http:"].includes(url.protocol) &&
      url.hostname.includes(".") &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function createProspect(
  fields: Partial<Prospect> & { companyName: string },
): Prospect {
  const time = now();
  return ProspectSchema.parse({
    id: uid(),
    originalNumber: null,
    city: "",
    phone: "",
    sector: "",
    valueProposition: "",
    email: "",
    contactPerson: "",
    status: "TO_CALL",
    priority: "MEDIUM",
    tags: [],
    followUpAt: null,
    lastContactedAt: null,
    createdAt: time,
    updatedAt: time,
    source: "manual",
    ...fields,
    phoneNormalized: normalizePhone(fields.phone ?? ""),
    website: safeUrl(fields.website ?? ""),
  });
}
export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
export function duplicate(a: Prospect, b: Prospect): boolean {
  if (a.phoneNormalized && a.phoneNormalized === b.phoneNormalized) return true;
  const hostname = (s: string) => {
    try {
      return new URL(s).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  if (hostname(a.website) && hostname(a.website) === hostname(b.website))
    return true;
  return (
    normalizeText(a.companyName) === normalizeText(b.companyName) &&
    normalizeText(a.city) === normalizeText(b.city)
  );
}
