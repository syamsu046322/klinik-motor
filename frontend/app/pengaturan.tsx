import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { api } from "@/src/api";
import { CONFIGURABLE_ROLES, FEATURES, type RoleAccess } from "@/src/access";
import { Button, Card, Confirm, Header, Input, Loading, SectionTitle, Sheet, useToast } from "@/src/components/ui";
import { parseNum, rupiah } from "@/src/format";
import { makeStyles, useTheme } from "@/src/theme";

export default function Pengaturan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const fin = useQuery({ queryKey: ["finance"], queryFn: () => api<any>("/settings/finance") });
  const sop = useQuery({ queryKey: ["sop-items"], queryFn: () => api<any[]>("/service-checklist-items") });
  const acc = useQuery({ queryKey: ["access"], queryFn: () => api<{ roles: RoleAccess }>("/settings/access") });

  const [finForm, setFinForm] = useState({ saldo_awal_bengkel: "", saldo_awal_pribadi: "", owner_draw: "" });
  const [roles, setRoles] = useState<RoleAccess>({});
  const [sopSheet, setSopSheet] = useState(false);
  const [sopName, setSopName] = useState("");
  const [sopEditId, setSopEditId] = useState<string | null>(null);
  const [sopDel, setSopDel] = useState<any | null>(null);

  useEffect(() => { if (fin.data) setFinForm({ saldo_awal_bengkel: String(fin.data.saldo_awal_bengkel || ""), saldo_awal_pribadi: String(fin.data.saldo_awal_pribadi || ""), owner_draw: String(fin.data.owner_draw || "") }); }, [fin.data]);
  useEffect(() => { if (acc.data) setRoles(acc.data.roles || {}); }, [acc.data]);

  const saveFin = useMutation({
    mutationFn: () => api("/settings/finance", { method: "PUT", body: { saldo_awal_bengkel: parseNum(finForm.saldo_awal_bengkel), saldo_awal_pribadi: parseNum(finForm.saldo_awal_pribadi), owner_draw: parseNum(finForm.owner_draw) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["cashflow"] }); qc.invalidateQueries({ queryKey: ["payroll"] }); toast.show("Saldo awal disimpan", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });
  const saveAcc = useMutation({
    mutationFn: () => api("/settings/access", { method: "PUT", body: { roles } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["access"] }); toast.show("Hak akses disimpan", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });
  const saveSop = useMutation({
    mutationFn: () => sopEditId ? api(`/service-checklist-items/${sopEditId}`, { method: "PUT", body: { name: sopName.trim(), active: true } }) : api("/service-checklist-items", { body: { name: sopName.trim() } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sop-items"] }); setSopSheet(false); toast.show("Item SOP disimpan", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });
  const delSop = useMutation({
    mutationFn: (id: string) => api(`/service-checklist-items/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sop-items"] }); setSopDel(null); toast.show("Item SOP dihapus", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const isOn = (role: string, key: string) => { const r = roles[role]; return !r || r[key] === undefined ? true : !!r[key]; };
  const toggle = (role: string, key: string, val: boolean) => setRoles((s) => ({ ...s, [role]: { ...(s[role] || {}), [key]: val } }));

  if (fin.isLoading || sop.isLoading || acc.isLoading) return <View style={styles.root}><Header title="PENGATURAN" back /><Loading /></View>;

  return (
    <View style={styles.root} testID="settings-screen">
      <Header title="PENGATURAN OWNER" subtitle="Saldo awal, SOP, gaji & hak akses" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card testID="settings-finance">
          <SectionTitle title="SALDO AWAL KAS" />
          <Input label="Saldo Awal Kas Bengkel" value={finForm.saldo_awal_bengkel} onChangeText={(v) => setFinForm({ ...finForm, saldo_awal_bengkel: v })} keyboardType="number-pad" testID="finance-bengkel-input" />
          <Input label="Saldo Awal Kas Pribadi (Tabungan)" value={finForm.saldo_awal_pribadi} onChangeText={(v) => setFinForm({ ...finForm, saldo_awal_pribadi: v })} keyboardType="number-pad" testID="finance-pribadi-input" />
          <Input label="Pengambilan Gaji Owner / bulan" value={finForm.owner_draw} onChangeText={(v) => setFinForm({ ...finForm, owner_draw: v })} keyboardType="number-pad" testID="finance-owner-draw-input" />
          <Button title="Simpan Saldo Awal" variant="primary" loading={saveFin.isPending} onPress={() => saveFin.mutate()} testID="finance-save-button" style={{ marginTop: 6 }} />
        </Card>

        <Card testID="settings-sop">
          <SectionTitle title="CHECKLIST SOP SERVIS" right={<Pressable onPress={() => { setSopEditId(null); setSopName(""); setSopSheet(true); }} hitSlop={8} testID="sop-add-button"><Ionicons name="add-circle" size={26} color={colors.brandPrimary} /></Pressable>} />
          <Text style={styles.hint}>Wajib 100% OK sebelum servis diselesaikan & nota dicetak.</Text>
          {(sop.data ?? []).map((it: any) => (
            <View key={it.id} style={styles.sopRow} testID={`sop-row-${it.id}`}>
              <Ionicons name="checkbox-outline" size={20} color={colors.onSurface} />
              <Text style={styles.sopName}>{it.name}</Text>
              <Pressable onPress={() => { setSopEditId(it.id); setSopName(it.name); setSopSheet(true); }} hitSlop={8} testID={`sop-edit-${it.id}`}><Ionicons name="create-outline" size={20} color={colors.info} /></Pressable>
              <Pressable onPress={() => setSopDel(it)} hitSlop={8} testID={`sop-delete-${it.id}`}><Ionicons name="trash-outline" size={20} color={colors.error} /></Pressable>
            </View>
          ))}
        </Card>

        <Card testID="settings-access">
          <SectionTitle title="HAK AKSES PER JABATAN" />
          <Text style={styles.hint}>Atur fitur yang bisa dilihat tiap jabatan. Owner selalu penuh.</Text>
          {CONFIGURABLE_ROLES.map((role) => (
            <View key={role} style={{ marginTop: 12 }}>
              <Text style={styles.roleTitle}>{role.toUpperCase()}</Text>
              {FEATURES.map((f) => (
                <View key={f.key} style={styles.accRow} testID={`access-${role}-${f.key}`}>
                  <Text style={styles.accLabel}>{f.label}</Text>
                  <Switch value={isOn(role, f.key)} onValueChange={(v) => toggle(role, f.key, v)}
                    trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
                </View>
              ))}
            </View>
          ))}
          <Button title="Simpan Hak Akses" variant="primary" loading={saveAcc.isPending} onPress={() => saveAcc.mutate()} testID="access-save-button" style={{ marginTop: 12 }} />
        </Card>
      </ScrollView>

      <Sheet visible={sopSheet} onClose={() => setSopSheet(false)} title={sopEditId ? "Ubah Item SOP" : "Tambah Item SOP"} testID="sop-sheet" scroll={false}>
        <Input label="Nama item checklist" value={sopName} onChangeText={setSopName} placeholder="mis. Baut Kencang" testID="sop-name-input" />
        <Button title="Simpan" variant="primary" loading={saveSop.isPending} disabled={!sopName.trim()} onPress={() => saveSop.mutate()} testID="sop-save-item-button" />
      </Sheet>

      <Confirm visible={!!sopDel} title="Hapus Item SOP" message={`Hapus item "${sopDel?.name}" dari checklist?`} danger confirmLabel="YA, HAPUS"
        onCancel={() => setSopDel(null)} onConfirm={() => delSop.mutate(sopDel.id)} loading={delSop.isPending} testID="sop-delete-confirm" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hint: { fontSize: 12, color: c.muted, marginBottom: 6 },
  sopRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider },
  sopName: { flex: 1, fontSize: 15, color: c.onSurface },
  roleTitle: { fontSize: 14, fontWeight: "700", color: c.brandPrimary, letterSpacing: 0.5, marginBottom: 4 },
  accRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  accLabel: { fontSize: 14, color: c.onSurface, flex: 1 },
}));
