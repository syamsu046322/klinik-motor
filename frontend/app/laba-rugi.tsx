import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { api, qs } from "@/src/api";
import { Badge, Card, Header, KV, Loading, Mono, SectionTitle } from "@/src/components/ui";
import { rupiah } from "@/src/format";
import { makeStyles, useTheme } from "@/src/theme";

function shiftMonth(m: string, d: number): string {
  const [y, mo] = m.split("-").map(Number);
  const dt = new Date(y, mo - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function labelMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export default function LabaRugi() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const lr = useQuery({ queryKey: ["laba-rugi", month], queryFn: () => api<any>(`/reports/laba-rugi${qs({ month })}`) });
  const cf = useQuery({ queryKey: ["cashflow", month], queryFn: () => api<any>(`/reports/cashflow${qs({ month })}`) });
  const t = lr.data?.total;
  const loading = lr.isLoading || cf.isLoading;

  return (
    <View style={styles.root} testID="laba-rugi-screen">
      <Header title="LABA RUGI HARIAN" subtitle="Omzet, modal, belanja & laba bersih bengkel" back />
      <View style={styles.monthBar}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} testID="lr-prev-month"><Ionicons name="chevron-back" size={22} color={colors.onSurfaceInverse} /></Pressable>
        <Text style={styles.monthText} testID="lr-month-label">{labelMonth(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8} testID="lr-next-month"><Ionicons name="chevron-forward" size={22} color={colors.onSurfaceInverse} /></Pressable>
      </View>
      {loading ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={lr.isRefetching} onRefresh={() => { lr.refetch(); cf.refetch(); }} tintColor={colors.brandPrimary} />}>

          <Card testID="lr-summary">
            <SectionTitle title="RINGKASAN LABA RUGI" />
            <KV k="Omzet (tanpa yang dibatalkan)" v={rupiah(t?.omzet)} mono testID="lr-omzet" />
            <KV k="Modal Part (HPP)" v={`- ${rupiah(t?.modal)}`} mono testID="lr-modal" />
            <KV k="Belanja Bengkel" v={`- ${rupiah(t?.belanja_bengkel)}`} mono testID="lr-belanja" />
            <View style={styles.grand}>
              <Text style={styles.grandLabel}>LABA BERSIH BENGKEL</Text>
              <Mono style={[styles.grandVal, { color: (t?.laba_bersih ?? 0) >= 0 ? colors.success : colors.error }]} testID="lr-laba-bersih">{rupiah(t?.laba_bersih)}</Mono>
            </View>
          </Card>

          <Card testID="lr-gaji">
            <SectionTitle title="GAJI MEKANIK vs LABA BERSIH" />
            <KV k="Total Gaji Mekanik" v={rupiah(lr.data?.gaji_mekanik)} mono />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <Text style={styles.para}>% Gaji terhadap Laba Bersih</Text>
              {lr.data?.gaji_pct === null ? <Badge label="LABA 0 / RUGI" tone="error" /> : (
                <Badge label={`${lr.data?.gaji_pct}% · ${lr.data?.gaji_ideal ? "IDEAL" : "TERLALU TINGGI"}`} tone={lr.data?.gaji_ideal ? "success" : "warning"} testID="lr-gaji-pct" />
              )}
            </View>
            <Text style={styles.hint}>Patokan sehat: gaji mekanik ≤ 30% dari laba bersih.</Text>
          </Card>

          <Card testID="lr-kas">
            <SectionTitle title="KAS BENGKEL" />
            <KV k="Saldo Awal" v={rupiah(cf.data?.bengkel?.saldo_awal)} mono />
            <KV k="Pemasukan (bayar + cicilan)" v={`+ ${rupiah(cf.data?.bengkel?.pemasukan)}`} mono />
            <KV k="Pengeluaran Bengkel" v={`- ${rupiah(cf.data?.bengkel?.pengeluaran)}`} mono />
            <KV k="Prive (Ambilan Keluarga)" v={`- ${rupiah(cf.data?.bengkel?.prive)}`} mono />
            <View style={styles.grand}>
              <Text style={styles.grandLabel}>SALDO KAS BENGKEL</Text>
              <Mono style={styles.grandVal} testID="lr-saldo-bengkel">{rupiah(cf.data?.bengkel?.saldo_akhir)}</Mono>
            </View>
          </Card>

          <Card testID="lr-kas-pribadi">
            <SectionTitle title="KAS PRIBADI (KELUARGA)" />
            <KV k="Saldo Awal Pribadi" v={rupiah(cf.data?.pribadi?.saldo_awal)} mono />
            <KV k="Masuk dari Prive" v={`+ ${rupiah(cf.data?.pribadi?.prive_masuk)}`} mono />
            <View style={styles.grand}>
              <Text style={styles.grandLabel}>SALDO KAS PRIBADI</Text>
              <Mono style={styles.grandVal} testID="lr-saldo-pribadi">{rupiah(cf.data?.pribadi?.saldo_akhir)}</Mono>
            </View>
            <Text style={styles.hint}>Belanja keluarga dicatat sebagai Prive (pengambilan pemilik), terpisah dari biaya bengkel.</Text>
          </Card>

          <SectionTitle title="RINCIAN HARIAN" />
          {(lr.data?.rows ?? []).length === 0 ? (
            <Text style={styles.empty}>Belum ada transaksi bulan ini.</Text>
          ) : (lr.data.rows.map((r: any) => (
            <View key={r.date} style={styles.dayRow} testID={`lr-day-${r.date}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.dayDate}>{r.date}</Text>
                <Mono style={[styles.dayLaba, { color: r.laba_bersih >= 0 ? colors.success : colors.error }]}>{rupiah(r.laba_bersih)}</Mono>
              </View>
              <Text style={styles.daySub}>Omzet {rupiah(r.omzet)} · Modal {rupiah(r.modal)} · Belanja {rupiah(r.belanja_bengkel)}{r.prive ? ` · Prive ${rupiah(r.prive)}` : ""}</Text>
            </View>
          )))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surfaceInverse, paddingHorizontal: 24, paddingVertical: 12 },
  monthText: { color: c.onSurfaceInverse, fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTopWidth: 2, borderTopColor: c.border, paddingTop: 10 },
  grandLabel: { fontSize: 13, fontWeight: "700", color: c.onSurface, letterSpacing: 0.5 },
  grandVal: { fontSize: 18, fontWeight: "700", color: c.onSurface },
  para: { fontSize: 14, color: c.onSurface },
  hint: { fontSize: 12, color: c.muted, marginTop: 8 },
  empty: { fontSize: 14, color: c.muted, padding: 16, textAlign: "center" },
  dayRow: { padding: 12, borderWidth: 1, borderColor: c.divider, marginBottom: 8 },
  dayDate: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  dayLaba: { fontSize: 15, fontWeight: "700" },
  daySub: { fontSize: 12, color: c.muted, marginTop: 4 },
}));
