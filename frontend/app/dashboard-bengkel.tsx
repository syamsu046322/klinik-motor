import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { api } from "@/src/api";
import { Card, Header, Loading, Mono, SectionTitle } from "@/src/components/ui";
import { rupiah } from "@/src/format";
import { makeStyles, useTheme } from "@/src/theme";

const DAY_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function dayShort(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return DAY_ID[new Date(y, m - 1, d).getDay()];
  } catch {
    return iso.slice(8);
  }
}

export default function DashboardBengkel() {
  const styles = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["dashboard-bengkel"], queryFn: () => api<any>("/reports/dashboard-bengkel") });
  const t = q.data?.today;
  const trend: any[] = q.data?.trend ?? [];
  const max = Math.max(1, ...trend.map((r) => r.laba_bersih));
  const min = Math.min(0, ...trend.map((r) => r.laba_bersih));
  const negMax = Math.max(1, Math.abs(min));

  const cards = [
    { label: "OMSET HARI INI", value: t?.omzet, color: colors.info, sub: "Status SELESAI & SUDAH DIBAYAR (bukan dibatalkan)", testID: "dashb-omzet" },
    { label: "MODAL PART HARI INI", value: t?.modal_part, color: colors.warning, sub: "HPP part yang terpakai (dari cost snapshot)", testID: "dashb-modal" },
    { label: "BELANJA BENGKEL HARI INI", value: t?.belanja_bengkel, color: colors.error, sub: "Belanja grup BENGKEL (keluar) saja", testID: "dashb-belanja" },
    { label: "LABA BERSIH HARI INI", value: t?.laba_bersih, color: colors.success, sub: "Omset - Modal Part - Belanja Bengkel", testID: "dashb-laba" },
  ];

  return (
    <View style={styles.root} testID="dashboard-bengkel-screen">
      <Header title="DASHBOARD BENGKEL" subtitle={t ? `Per ${t.date}` : "Ringkasan keuangan bengkel"} back />
      {q.isLoading ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}>

          {q.data?.kas?.level && q.data.kas.level !== "ok" ? (
            <View style={[styles.warnBox, { backgroundColor: q.data.kas.level === "danger" ? colors.errorTint : colors.warningTint, borderColor: q.data.kas.level === "danger" ? colors.error : colors.warning }]} testID="dashb-kas-warning">
              <Ionicons name="warning" size={22} color={q.data.kas.level === "danger" ? colors.error : colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.warnTitle, { color: q.data.kas.level === "danger" ? colors.error : colors.warning }]}>PENGINGAT KAS TIPIS</Text>
                <Text style={styles.warnMsg}>{q.data.kas.message}</Text>
                <Text style={styles.warnSub}>Saldo kas bengkel {rupiah(q.data.kas.saldo_bengkel)} · Belanja bulan ini {rupiah(q.data.kas.belanja_bulan)}</Text>
              </View>
            </View>
          ) : null}

          {cards.map((c) => (
            <Card key={c.label} testID={`${c.testID}-card`}>
              <Text style={styles.cardLabel}>{c.label}</Text>
              <Mono style={[styles.cardValue, { color: c.color }]} testID={c.testID}>{rupiah(c.value)}</Mono>
              <Text style={styles.cardSub}>{c.sub}</Text>
            </Card>
          ))}

          <Card testID="dashb-trend-card">
            <SectionTitle title="Tren 7 Hari — Laba Bersih Harian" />
            <View style={styles.chart} testID="dashb-trend-chart">
              {trend.map((r) => {
                const v = r.laba_bersih;
                const isToday = r.date === t?.date;
                return (
                  <View key={r.date} style={styles.barCol} testID={`dashb-bar-${r.date}`}>
                    <Text style={styles.barVal} numberOfLines={1}>{v >= 1000 ? `${Math.round(v / 1000)}k` : v <= -1000 ? `-${Math.round(Math.abs(v) / 1000)}k` : v}</Text>
                    <View style={styles.barTrack}>
                      <View style={styles.barCenter} />
                      {v >= 0
                        ? <View style={[styles.barUp, { height: Math.max(4, (v / max) * 56), backgroundColor: isToday ? colors.brandPrimary : colors.success }]} />
                        : <View style={[styles.barDown, { height: Math.max(4, (Math.abs(v) / negMax) * 56), backgroundColor: colors.error }]} />}
                    </View>
                    <Text style={[styles.barLabel, isToday && { color: colors.brandPrimary, fontWeight: "700" }]} numberOfLines={1}>{dayShort(r.date)}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.hint}>Batang oranye = hari ini. Laba bersih = Omset - Modal Part - Belanja Bengkel.</Text>
          </Card>

          <Card testID="dashb-target-card">
            <SectionTitle title="Target Laba Bersih Bulan Ini" />
            {(q.data?.month?.target ?? 0) > 0 ? (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <View>
                    <Text style={styles.cardSub}>Laba Bersih {q.data?.month?.period}</Text>
                    <Mono style={[styles.cardValue, { fontSize: 22 }]} testID="dashb-month-laba">{rupiah(q.data?.month?.laba_bersih)}</Mono>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.cardSub}>Target</Text>
                    <Mono style={{ fontSize: 15, fontWeight: "700", color: colors.onSurface }}>{rupiah(q.data?.month?.target)}</Mono>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, q.data?.month?.target_pct ?? 0)}%`, backgroundColor: q.data?.month?.tercapai ? colors.success : colors.brandPrimary }]} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onSurface }} testID="dashb-target-pct">{q.data?.month?.target_pct}% dari target</Text>
                  <View style={[styles.badge, { backgroundColor: q.data?.month?.tercapai ? colors.successTint : colors.surfaceTertiary }]} testID="dashb-target-status">
                    <Ionicons name={q.data?.month?.tercapai ? "checkmark-circle" : "time-outline"} size={16} color={q.data?.month?.tercapai ? colors.success : colors.muted} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: q.data?.month?.tercapai ? colors.success : colors.muted }}>{q.data?.month?.tercapai ? "TERCAPAI" : "BELUM TERCAPAI"}</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.cardSub}>Belum ada target. Atur target laba bulanan di menu Pengaturan Owner → Saldo Awal Kas.</Text>
            )}
          </Card>

          <Card testID="dashb-prive-card">
            <SectionTitle title="Prive Keluarga (Dipisah dari Laba)" />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.cardSub}>Prive hari ini</Text>
              <Mono style={[styles.cardValue, { color: colors.brandPrimary, fontSize: 20 }]} testID="dashb-prive">{rupiah(t?.prive)}</Mono>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <Text style={styles.cardSub}>Total prive 7 hari</Text>
              <Mono style={{ fontSize: 15, fontWeight: "700", color: colors.onSurface }} testID="dashb-prive-7d">{rupiah(q.data?.prive_7d)}</Mono>
            </View>
            <Text style={styles.hint}>Belanja grup KELUARGA dicatat sebagai pengambilan pemilik (prive) — tidak mengurangi laba bersih bengkel.</Text>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  cardLabel: { fontSize: 11, fontWeight: "700", color: c.muted, letterSpacing: 0.8 },
  cardValue: { fontSize: 30, fontWeight: "700", color: c.onSurface, marginTop: 6 },
  cardSub: { fontSize: 12, color: c.muted, marginTop: 6 },
  hint: { fontSize: 11, color: c.muted, marginTop: 10 },
  chart: { flexDirection: "row", gap: 8, alignItems: "flex-end", paddingTop: 6, minHeight: 150 },
  barCol: { flex: 1, alignItems: "center" },
  barVal: { fontSize: 9, color: c.muted, marginBottom: 2 },
  barTrack: { width: "100%", height: 118, alignItems: "center", justifyContent: "center" },
  barCenter: { position: "absolute", top: 59, left: 0, right: 0, height: 1, backgroundColor: c.divider },
  barUp: { width: 14, position: "absolute", top: 4 },
  barDown: { width: 14, position: "absolute", bottom: 4 },
  barLabel: { fontSize: 10, color: c.muted, marginTop: 4 },
  warnBox: { flexDirection: "row", gap: 12, alignItems: "flex-start", borderWidth: 2, padding: 12, marginBottom: 12 },
  warnTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  warnMsg: { fontSize: 13, color: c.onSurface, marginTop: 2 },
  warnSub: { fontSize: 11, color: c.muted, marginTop: 4 },
  progressTrack: { height: 12, backgroundColor: c.surfaceTertiary, marginTop: 12, borderRadius: 6, overflow: "hidden" },
  progressFill: { height: 12, borderRadius: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5 },
}));
