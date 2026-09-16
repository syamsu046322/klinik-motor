import type { Role } from "@/src/auth";

// Feature keys yang bisa diatur owner untuk role mekanik/kasir/partman.
export const FEATURES: { key: string; label: string }[] = [
  { key: "antrian", label: "Antrian Servis" },
  { key: "stok", label: "Stok Part" },
  { key: "history", label: "Histori Servis" },
  { key: "reminders", label: "Pengingat Servis" },
  { key: "debts", label: "Piutang / Hutang" },
  { key: "expenses", label: "Belanja" },
  { key: "tools", label: "Checklist Tools" },
  { key: "outlet", label: "Outlet & Penjualan Part" },
  { key: "stock-check", label: "Cek Fisik Stok" },
  { key: "customers", label: "Data Pelanggan" },
  { key: "vehicles", label: "Data Motor" },
  { key: "services", label: "Data Jasa" },
  { key: "stock-movements", label: "Mutasi Stok" },
];

export const CONFIGURABLE_ROLES: Role[] = ["mekanik", "kasir", "partman"];

export type RoleAccess = Record<string, Record<string, boolean>>;

// Default: fitur aktif kecuali owner mematikannya. Owner selalu penuh.
export function allowed(role: Role | undefined, roles: RoleAccess | undefined, key: string): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  const r = roles?.[role];
  if (!r || r[key] === undefined) return true;
  return !!r[key];
}
