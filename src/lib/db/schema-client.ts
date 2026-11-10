// Enum values that client components need, without importing the server-only Drizzle schema.
export const schema = {
  statuses: ["SUBMITTED", "FARMER_CONFIRMED", "DATA_CHECKED", "DOCS_RECEIVED", "ERP_POSTED", "PERMIT_ISSUED", "ZONED", "RETURNED", "REJECTED"] as const,
  roles: ["ADMIN", "SCOUT", "CALL_CENTER", "IT_CHECKER", "LEGAL", "PERMIT_OFFICER", "GIS_OFFICER"] as const,
};
