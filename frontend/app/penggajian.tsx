import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { api, qs } from "@/src/api";
import { Badge, Button, Card, Confirm, Header, Input, KV, Loading, Mono, SectionTitle, Sheet, useToast } from "@/src/components/ui";
import { parseNum, rupiah } from "@/src/format";
import { makeStyles, useTheme } from "@/src/theme";

const POSITIONS = ["mekanik", "kasir", "partman", "owner"] as const;
type Pos = (typeof POSITIONS)[number];

function shiftMonth(m: string, d: number): string {
  const [y, mo] = m.split("-").map(Number);
  const dt = new Date(y, mo - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function labelMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

const emptyForm = { name: "", position: "mekanik" as Pos, base_salary: "", bonus_per_unit: "" };

export default function Penggajian() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [slip, setSlip] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);

  const report = useQuery({ queryKey: ["payroll", month], queryFn: () => api<any>(`/payroll/report${qs({ month })}`) });
  const emps = useQuery({ queryKey: ["employees"], queryFn: () => api<any[]>("/employees") });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["payroll"] }); qc.invalidateQueries({ queryKey: ["employees"] }); };
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), position: form.position, base_salary: parseNum(form.base_salary), bonus_per_unit: parseNum(form.bonus_per_unit), active: true };
      return editId ? api(`/employees/${editId}`, { method: "PUT", body }) : api("/employees", { body });
    },
    onSuccess: () => { invalidate(); setFormOpen(false); toast.show("Karyawan disimpan", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDel(null); toast.show("Karyawan dihapus", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const openNew = () => { setEditId(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (e: any) => { setEditId(e.id); setForm({ name: e.name, position: e.position, base_salary: String(e.base_salary || ""), bonus_per_unit: String(e.bonus_per_unit || "") }); setFormOpen(true); };
  const slipOf = (eid: string) => report.data?.slips?.find((s: any) => s.employee_id === eid);

  return (
    <View style={styles.root} testID="payroll-screen">
      <Header title="PENGGAJIAN KARYAWAN" subtitle="Gaji pokok + bonus unit servis (mekanik)" back
        right={<Pressable onPress={openNew} hitSlop={8} testID="employee-add-button"><Ionicons name="person-add" size={22} color={colors.onSurfaceInverse} /></Pressable>} />
      <View style={styles.monthBar}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} testID="payroll-prev-month"><Ionicons name="chevron-back" size={22} color={colors.onSurfaceInverse} /></Pressable>
        <Text style={styles.monthText}>{labelMonth(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8} testID="payroll-next-month"><Ionicons name="chevron-forward" size={22} color={colors.onSurfaceInverse} /></Pressable>
      </View>
      {report.isLoading || emps.isLoading ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={report.isRefetching} onRefresh={() => { report.refetch(); emps.refetch(); }} tintColor={colors.brandPrimary} />}>
          <Card testID="payroll-total">
            <SectionTitle title="TOTAL PENGGAJIAN BULAN INI" />
            <KV k="Total Gaji Karyawan" v={rupiah(report.data?.total_gaji)} mono />
            <KV k="Pengambilan Owner" v={rupiah(report.data?.owner_draw)} mono />
            <View style={styles.grand}>
              <Text style={styles.grandLabel}>GRAND TOTAL</Text>
              <Mono style={styles.grandVal} testID="payroll-grand-total">{rupiah(report.data?.grand_total)}</Mono>
            </View>
          </Card>

          <SectionTitle title="DAFTAR KARYAWAN" />
          {(emps.data ?? []).map((e: any) => {
            const s = slipOf(e.id);
            return (
              <Card key={e.id} testID={`employee-card-${e.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{e.name}</Text>
                    <Badge label={e.position.toUpperCase()} tone="brand" />
                  </View>
                  <Mono style={styles.slipTotal}>{rupiah(s?.total ?? e.base_salary)}</Mono>
                </View>
                <View style={{ marginTop: 8 }}>
                  <KV k="Gaji Pokok" v={rupiah(e.base_salary)} mono />
                  {e.position === "mekanik" ? <KV k={`Bonus (${s?.units ?? 0} unit × ${rupiah(e.bonus_per_unit)})`} v={rupiah(s?.bonus ?? 0)} mono /> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <Button title="Slip Gaji" variant="dark" small icon="receipt-outline" style={{ flex: 1 }} onPress={() => setSlip(s ?? { ...e, employee_id: e.id, base_salary: e.base_salary, bonus: 0, units: 0, total: e.base_salary, period: month })} testID={`employee-slip-${e.id}`} />
                  <Button title="Ubah" variant="outline" small icon="create-outline" style={{ flex: 1 }} onPress={() => openEdit(e)} testID={`employee-edit-${e.id}`} />
                  <Button title="Hapus" variant="ghost" small icon="trash-outline" style={{ flex: 1, borderWidth: 2, borderColor: colors.error }} onPress={() => setDel(e)} testID={`employee-delete-${e.id}`} />
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      <Sheet visible={formOpen} onClose={() => setFormOpen(false)} title={editId ? "Ubah Karyawan" : "Tambah Karyawan"} testID="employee-form-sheet">
        <Input label="Nama karyawan" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} testID="employee-name-input" />
        <Text style={styles.label}>Jabatan</Text>
        <View style={styles.posRow}>
          {POSITIONS.map((p) => (
            <Pressable key={p} onPress={() => setForm({ ...form, position: p })} style={[styles.posChip, form.position === p && styles.posChipActive]} testID={`employee-pos-${p}`}>
              <Text style={[styles.posChipText, form.position === p && styles.posChipTextActive]}>{p.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Input label="Gaji pokok / bulan" value={form.base_salary} onChangeText={(v) => setForm({ ...form, base_salary: v })} keyboardType="number-pad" testID="employee-salary-input" />
        {form.position === "mekanik" ? <Input label="Bonus per unit servis" value={form.bonus_per_unit} onChangeText={(v) => setForm({ ...form, bonus_per_unit: v })} keyboardType="number-pad" testID="employee-bonus-input" /> : null}
        <Button title="Simpan" variant="primary" loading={save.isPending} disabled={!form.name.trim()} onPress={() => save.mutate()} testID="employee-save-button" style={{ marginTop: 8 }} />
      </Sheet>

      <Sheet visible={!!slip} onClose={() => setSlip(null)} title="Slip Gaji" testID="payslip-sheet">
        {slip ? (
          <View>
            <Text style={styles.slipName}>{slip.name}</Text>
            <Text style={styles.slipPos}>{String(slip.position).toUpperCase()} · Periode {labelMonth(slip.period ?? month)}</Text>
            <View style={{ marginTop: 12 }}>
              <KV k="Gaji Pokok" v={rupiah(slip.base_salary)} mono />
              {slip.position === "mekanik" ? (
                <>
                  <KV k="Unit Servis Dikerjakan" v={String(slip.units ?? 0)} mono />
                  <KV k="Bonus per Unit" v={rupiah(slip.bonus_per_unit)} mono />
                  <KV k="Total Bonus" v={rupiah(slip.bonus)} mono />
                </>
              ) : null}
              <View style={styles.grand}>
                <Text style={styles.grandLabel}>TOTAL GAJI</Text>
                <Mono style={styles.grandVal} testID="payslip-total">{rupiah(slip.total)}</Mono>
              </View>
            </View>
          </View>
        ) : null}
      </Sheet>

      <Confirm visible={!!del} title="Hapus Karyawan" message={`Hapus data gaji ${del?.name}?`} danger confirmLabel="YA, HAPUS"
        onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del.id)} loading={remove.isPending} testID="employee-delete-confirm" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surfaceInverse, paddingHorizontal: 24, paddingVertical: 12 },
  monthText: { color: c.onSurfaceInverse, fontSize: 16, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface, marginBottom: 4 },
  slipTotal: { fontSize: 16, fontWeight: "700", color: c.brandPrimary },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTopWidth: 2, borderTopColor: c.border, paddingTop: 10 },
  grandLabel: { fontSize: 13, fontWeight: "700", color: c.onSurface, letterSpacing: 0.5 },
  grandVal: { fontSize: 18, fontWeight: "700", color: c.onSurface },
  label: { fontSize: 13, fontWeight: "600", color: c.onSurface, marginBottom: 6, marginTop: 4 },
  posRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  posChip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2, borderColor: c.border, backgroundColor: c.surface },
  posChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  posChipText: { fontSize: 12, fontWeight: "700", color: c.onSurface },
  posChipTextActive: { color: c.onBrandPrimary },
  slipName: { fontSize: 20, fontWeight: "700", color: c.onSurface },
  slipPos: { fontSize: 13, color: c.muted, marginTop: 2 },
}));
