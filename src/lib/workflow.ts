import type { EntryStatus, Role } from "@/lib/db/schema";

/**
 * The permit pipeline. Each stage consumes entries in `input` status and, when
 * completed, moves them to `output`. Reordering the pipeline is a matter of
 * reordering this array and fixing the input/output pairs.
 */
export type StageKey =
  | "CALL_CENTER"
  | "DATA_CHECK"
  | "LEGAL"
  | "ERP_ENTRY"
  | "PERMIT"
  | "ZONING";

export type Stage = {
  key: StageKey;
  title: string;
  shortTitle: string;
  description: string;
  roles: Role[];
  input: EntryStatus;
  output: EntryStatus;
  canReturn: boolean;
  canReject: boolean;
};

export const STAGES: Stage[] = [
  {
    key: "CALL_CENTER",
    title: "Farmer confirmation call",
    shortTitle: "Call centre",
    description: "Call the farmer and confirm every detail the scout captured.",
    roles: ["CALL_CENTER"],
    input: "SUBMITTED",
    output: "FARMER_CONFIRMED",
    canReturn: true,
    canReject: false,
  },
  {
    key: "DATA_CHECK",
    title: "Data check",
    shortTitle: "Data check",
    description: "Verify the captured data against the ID and bank card photos.",
    roles: ["IT_CHECKER"],
    input: "FARMER_CONFIRMED",
    output: "DATA_CHECKED",
    canReturn: true,
    canReject: true,
  },
  {
    key: "ERP_ENTRY",
    title: "ERP entry",
    shortTitle: "ERP",
    description: "Create the farmer and field in Synergy Bravo and record the codes.",
    roles: ["IT_CHECKER"],
    input: "DATA_CHECKED",
    output: "ERP_POSTED",
    canReturn: true,
    canReject: false,
  },
  {
    key: "PERMIT",
    title: "Permit and CCS clips",
    shortTitle: "Permit",
    description: "Open the harvest permit and issue the CCS clips.",
    roles: ["PERMIT_OFFICER"],
    input: "ERP_POSTED",
    output: "PERMIT_ISSUED",
    canReturn: true,
    canReject: false,
  },
  {
    key: "LEGAL",
    title: "Physical documents",
    shortTitle: "Legal",
    description: "Confirm the signed terms and copies of the farmer's documents have been received, now that the permit is open.",
    roles: ["LEGAL"],
    input: "PERMIT_ISSUED",
    output: "DOCS_RECEIVED",
    canReturn: true,
    canReject: false,
  },
  {
    key: "ZONING",
    title: "GIS zoning review",
    shortTitle: "Zoning",
    description: "Confirm the field was inspected, review the polygon, and confirm the transport zone.",
    roles: ["GIS_OFFICER"],
    input: "DOCS_RECEIVED",
    output: "ZONED",
    canReturn: true,
    canReject: false,
  },
];

export const STATUS_ORDER: EntryStatus[] = [
  "SUBMITTED",
  "FARMER_CONFIRMED",
  "DATA_CHECKED",
  "ERP_POSTED",
  "PERMIT_ISSUED",
  "DOCS_RECEIVED",
  "ZONED",
];

export const STATUS_LABEL: Record<EntryStatus, string> = {
  SUBMITTED: "Submitted",
  FARMER_CONFIRMED: "Farmer confirmed",
  DATA_CHECKED: "Data checked",
  DOCS_RECEIVED: "Documents received",
  ERP_POSTED: "In ERP",
  PERMIT_ISSUED: "Permit issued",
  ZONED: "Zoned · complete",
  RETURNED: "Returned to scout",
  REJECTED: "Rejected",
};

/** What a status means for the person looking at the entry: who it is waiting on. */
export function waitingOn(status: EntryStatus): string {
  const stage = STAGES.find((s) => s.input === status);
  if (stage) return stage.shortTitle;
  if (status === "RETURNED") return "Scout";
  if (status === "ZONED") return "Nobody — complete";
  return "—";
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  SCOUT: "Field scout",
  CALL_CENTER: "Call centre",
  IT_CHECKER: "IT data check & ERP",
  LEGAL: "Legal",
  PERMIT_OFFICER: "Permit officer",
  GIS_OFFICER: "GIS zoning",
};

export const ROLES: Role[] = ["ADMIN", "SCOUT", "CALL_CENTER", "IT_CHECKER", "LEGAL", "PERMIT_OFFICER", "GIS_OFFICER"];

export function stagesForRole(role: Role): Stage[] {
  return STAGES.filter((s) => s.roles.includes(role));
}

export function stageForStatus(status: EntryStatus): Stage | undefined {
  return STAGES.find((s) => s.input === status);
}

export function isStageRole(role: Role) {
  return stagesForRole(role).length > 0;
}

/** Stage index (0-based) that an entry has completed, for the progress rail. */
export function completedStageCount(status: EntryStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx < 0 ? 0 : idx; // SUBMITTED=0 completed, FARMER_CONFIRMED=1, ..., ZONED=6
}

export const CALL_CENTER_CHECKS: { key: string; label: string }[] = [
  { key: "name", label: "Farmer name" },
  { key: "phone", label: "Phone number" },
  { key: "idNumber", label: "ID number" },
  { key: "plot", label: "Plot LR number" },
  { key: "acreage", label: "Estimated acreage" },
  { key: "trips", label: "Estimated trips" },
  { key: "location", label: "Sub-location and area" },
  { key: "cbc", label: "Delivery CBC" },
  { key: "harvester", label: "Harvester" },
  { key: "bank", label: "Bank, account number, account name and branch" },
  { key: "terms", label: "Farmer agrees to the terms and conditions" },
];

export const LEGAL_DOCS: { key: string; label: string }[] = [
  { key: "idCopy", label: "Copy of national ID (front and back)" },
  { key: "signedTerms", label: "Signed terms and conditions undertaking" },
  { key: "bankProof", label: "Bank card / passbook copy" },
  { key: "landProof", label: "Land ownership or lease document" },
  { key: "consent", label: "Signed data protection consent" },
];

// Fail fast if the pipeline is edited inconsistently: each stage must start where the
// previous one ended, and STATUS_ORDER must list the same sequence.
(function checkPipeline() {
  for (let i = 1; i < STAGES.length; i++) {
    if (STAGES[i].input !== STAGES[i - 1].output) {
      throw new Error(`Workflow misconfigured: ${STAGES[i].key} expects ${STAGES[i].input} but ${STAGES[i - 1].key} produces ${STAGES[i - 1].output}`);
    }
  }
  const derived: EntryStatus[] = [STAGES[0].input, ...STAGES.map((s) => s.output)];
  if (derived.join() !== STATUS_ORDER.join()) {
    throw new Error(`Workflow misconfigured: STATUS_ORDER must be ${derived.join(" → ")}`);
  }
})();
