import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, Card, Loading, Mono, SectionTitle } from "@/src/components/ui";
import { rupiah, ymdToDisplay } from "@/src/format";
import { makeStyles, useTheme } from "@/src/theme";

const ROLE_LABEL: Record<string, string> = { owner: "OWNER", kasir: "KASIR", mekanik: "MEKANIK", partman: "PARTMAN" };

export default function Beranda() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, can } = useAuth();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/dashboard"), refetchInterval: 30000 });
  const d = dash.data;

  const Stat = ({ label, value, tone, testID, onPress }: { label: string; value: string | number; tone?: string; testID: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.stat, tone ? { borderColor: tone } : null]} testID={testID}>
      <Mono style={[styles.statVal, tone ? { color: tone } : null]}>{String(value)}</Mono>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );

  const goQueue = (filter: string) => router.push({ pathname: "/(tabs)/antrian", params: { filter } });

  return (
    <View style={styles.root} testID="dashboard-screen">
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>KLINIK SUEL MOTOR</Text>
          <Text style={styles.hello}>{user?.name} · <Text style={{ color: colors.brandPrimary }}>{ROLE_LABEL[user?.role ?? ""]}</Text></Text>
        </View>
        <View style={styles.dateBox}><Mono style={styles.dateText}>{d ? ymdToDisplay(d.today) : "--/--/----"}</Mono></View>
        <Pressable onPress={() => router.push("/notifikasi")} style={styles.bell} testID="notification-bell-button">
          <Ionicons name="notifications" size={22} color={colors.onSurfaceInverse} />
          {d?.notif_unread ? <View style={styles.bellBadge}><Text style={styles.bellBadgeText} testID="notification-unread-count">{d.notif_unread > 99 ? "99+" : d.notif_unread}</Text></View> : null}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={dash.refetch} tintColor={colors.brandPrimary} />}>
        {dash.isLoading || !d ? <Loading /> : (
          <>
            {d.tools?.due && can("mekanik") ? (
              <Pressable style={styles.toolsBanner} onPress={() => router.push("/tools")} testID="tools-due-banner">
                <Ionicons name="alarm" size={22} color={colors.onWarning} />
                <Text style={styles.toolsBannerText}>Waktunya checklist tools mingguan{d.tools.days_since != null ? ` — sudah ${d.tools.days_since} hari` : ""}. Tap untuk mulai.</Text>
              </Pressable>
            ) : null}
            {can("kasir") ? (
              <View style={styles.omzetBox} testID="omzet-card">
                <Text style={styles.omzetLabel}>OMZET HARI INI</Text>
                <Mono style={styles.omzetVal} testID="omzet-today-value">{rupiah(d.omzet_hari_ini)}</Mono>
                <View style={styles.omzetRow}>
                  <Text style={styles.omzetSub}>{d.transaksi_hari_ini} transaksi</Text>
                  {user?.role === "owner" ? <Text style={styles.omzetSub}>Bulan ini: <Text style={{ fontFamily: undefined }}>{rupiah(d.omzet_bulan_ini)}</Text></Text> : null}
                </View>
              </View>
            ) : null}

            {can("mekanik") ? (
              <>
                <SectionTitle title="Antrian Servis Hari Ini" />
                <View style={styles.grid}>
                  <Stat label="MENUNGGU" value={d.menunggu} tone={colors.warning} testID="stat-menunggu" onPress={() => goQueue("MENUNGGU_SERVIS")} />
                  <Stat label="DIPROSES" value={d.diproses} tone={colors.info} testID="stat-diproses" onPress={() => goQueue("DIPROSES")} />
                  <Stat label="PERSETUJUAN" value={d.menunggu_persetujuan} tone={colors.warning} testID="stat-persetujuan" onPress={() => goQueue("MENUNGGU_PERSETUJUAN")} />
                  <Stat label="MENUNGGU KASIR" value={d.menunggu_kasir} tone={colors.brandPrimary} testID="stat-menunggu-kasir" onPress={() => goQueue("kasir")} />
                </View>
              </>
            ) : null}

            {can("kasir") ? (
              <>
                <SectionTitle title="Kasir" />
                <View style={styles.grid}>
                  <Stat label="MENUNGGU KASIR" value={d.menunggu_kasir} tone={colors.brandPrimary} testID="stat-kasir-menunggu" onPress={() => goQueue("kasir")} />
                  <Stat label="MENUNGGU BAYAR" value={d.menunggu_pembayaran} tone={colors.brandPrimary} testID="stat-kasir-bayar" onPress={() => goQueue("kasir")} />
                  <Stat label="SUDAH DIBAYAR" value={d.sudah_dibayar} tone={colors.success} testID="stat-kasir-dibayar" onPress={() => goQueue("dibayar")} />
                  <Stat label="PIUTANG BELUM LUNAS" value={rupiah(d.piutang_total)} tone={d.piutang_count > 0 ? colors.warning : undefined} testID="stat-kasir-hutang" onPress={() => router.push("/piutang")} />
                </View>
                <Card testID="payment-method-card">
                  <SectionTitle title="Metode Pembayaran Hari Ini" />
                  {["CASH", "TRANSFER", "QRIS", "DEBIT", "KREDIT"].map((m) => (
                    <View key={m} style={styles.methodRow}>
                      <Text style={styles.methodLabel}>{m}</Text>
                      <Mono>{rupiah(d.by_method?.[m] ?? 0)}</Mono>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {user?.role === "owner" ? (
              <>
                <SectionTitle title="Ringkasan Bengkel" />
                <View style={styles.grid}>
                  <Stat label="SERVIS HARI INI" value={d.total_servis_hari_ini} testID="stat-owner-servis" />
                  <Stat label="OMZET JASA" value={rupiah(d.omzet_jasa)} testID="stat-owner-jasa" />
                  <Stat label="OMZET PART" value={rupiah(d.omzet_part)} testID="stat-owner-part" />
                  <Stat label="STOK MENIPIS" value={d.stok_menipis} tone={d.stok_menipis > 0 ? colors.error : undefined} testID="stat-owner-lowstock" onPress={() => router.push({ pathname: "/(tabs)/stok", params: { low: "1" } })} />
                  <Stat label="PELANGGAN" value={d.jumlah_pelanggan} testID="stat-owner-customers" onPress={() => router.push("/master/pelanggan")} />
                  <Stat label="KENDARAAN" value={d.jumlah_kendaraan} testID="stat-owner-vehicles" onPress={() => router.push("/master/motor")} />
                  <Stat label="PIUTANG" value={rupiah(d.piutang_total)} tone={d.piutang_count > 0 ? colors.warning : undefined} testID="stat-owner-debts" onPress={() => router.push("/piutang")} />
                  <Stat label="PENGINGAT SERVIS" value={d.reminders_due} tone={d.reminders_due > 0 ? colors.info : undefined} testID="stat-owner-reminders" onPress={() => router.push("/pengingat")} />
                </View>
                <Card testID="mechanic-performance-card">
                  <SectionTitle title="Performa Mekanik Hari Ini" />
                  {d.performa_mekanik?.length ? d.performa_mekanik.map((p: any) => (
                    <View key={p.mechanic} style={styles.methodRow}><Text style={styles.methodLabel}>{p.mechanic}</Text><Mono>{p.count} servis selesai</Mono></View>
                  )) : <Text style={styles.muted}>Belum ada servis selesai hari ini.</Text>}
                </Card>
              </>
            ) : null}

            {user?.role === "partman" ? (
              <View style={styles.grid}>
                <Stat label="STOK MENIPIS" value={d.stok_menipis} tone={d.stok_menipis > 0 ? colors.error : undefined} testID="stat-partman-lowstock" onPress={() => router.push({ pathname: "/(tabs)/stok", params: { low: "1" } })} />
                <Stat label="SERVIS HARI INI" value={d.total_servis_hari_ini} testID="stat-partman-servis" />
              </View>
            ) : null}

            <SectionTitle title="Aksi Cepat" />
            <View style={{ gap: 10 }}>
              {can("mekanik", "kasir") ? <Button title="Transaksi Servis Baru" variant="success" icon="add-circle" onPress={() => router.push("/transaksi/baru")} testID="quick-new-transaction-button" style={{ minHeight: 60 }} /> : null}
              {can("mekanik") ? <Button title="Antrian Servis" variant="info" icon="construct" onPress={() => goQueue("aktif")} testID="quick-queue-button" /> : null}
              {can("kasir") ? <Button title="Antrian Kasir" variant="primary" icon="cash" onPress={() => goQueue("kasir")} testID="quick-cashier-button" /> : null}
              {can("partman") ? <Button title="Stok Suku Cadang" variant="dark" icon="cube" onPress={() => router.push("/(tabs)/stok")} testID="quick-stock-button" /> : null}
              {can("kasir", "partman") ? <Button title="Jual Part Langsung (Outlet)" variant="primary" icon="storefront" onPress={() => router.push("/outlet")} testID="quick-outlet-button" /> : null}
              <Button title="Histori Servis" variant="outline" icon="time" onPress={() => router.push("/histori")} testID="quick-history-button" />
              <Button title="Pengingat Servis" variant="outline" icon="alarm" onPress={() => router.push("/pengingat")} testID="quick-reminders-button" />
              {can("kasir") ? <Button title="Piutang / Hutang" variant="outline" icon="wallet" onPress={() => router.push("/piutang")} testID="quick-debts-button" /> : null}
              {can("kasir") ? <Button title="Catat Belanja" variant="outline" icon="cart" onPress={() => router.push("/belanja")} testID="quick-expenses-button" /> : null}
              {can("mekanik") ? <Button title="Checklist Tools" variant="outline" icon="hammer" onPress={() => router.push("/tools")} testID="quick-tools-button" /> : null}
              {user?.role === "owner" ? <Button title="Laporan & Excel" variant="outline" icon="stats-chart" onPress={() => router.push("/laporan")} testID="quick-report-button" /> : null}
            </View>
          </>
        )}
        {dash.isError ? (
          <View style={{ alignItems: "center", gap: 8, padding: 16 }}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.error} />
            <Text style={{ color: colors.error }}>Gagal memuat dashboard.</Text>
            <Button title="Coba lagi" variant="outline" small onPress={() => dash.refetch()} testID="dashboard-retry-button" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  top: { backgroundColor: c.surfaceInverse, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 3, borderBottomColor: c.brandPrimary },
  brand: { color: c.onSurfaceInverse, fontSize: 18, fontWeight: "500", letterSpacing: 1.5 },
  hello: { color: c.onSurfaceInverse, opacity: 0.85, fontSize: 13, marginTop: 2 },
  dateBox: { borderWidth: 1.5, borderColor: c.brandPrimary, paddingHorizontal: 8, paddingVertical: 4 },
  dateText: { color: c.onSurfaceInverse, fontSize: 12 },
  bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
  bellBadge: { position: "absolute", top: 4, right: 2, backgroundColor: c.brandPrimary, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.surfaceInverse },
  bellBadgeText: { color: c.onBrandPrimary, fontSize: 10, fontWeight: "500" },
  toolsBanner: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: c.warning, padding: 12, marginBottom: 16, borderWidth: 2, borderColor: c.border },
  toolsBannerText: { color: c.onWarning, fontWeight: "500", flex: 1, fontSize: 13 },
  omzetBox: { backgroundColor: c.surfaceInverse, padding: 16, marginBottom: 16, borderLeftWidth: 6, borderLeftColor: c.brandPrimary },
  omzetLabel: { color: c.brandPrimary, fontSize: 12, letterSpacing: 1.5 },
  omzetVal: { color: c.onSurfaceInverse, fontSize: 30, marginTop: 4 },
  omzetRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  omzetSub: { color: c.onSurfaceInverse, opacity: 0.75, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  stat: { width: "48%", flexGrow: 1, borderWidth: 2, borderColor: c.border, padding: 12, minHeight: 84, justifyContent: "center" },
  statVal: { fontSize: 24, color: c.onSurface },
  statLabel: { fontSize: 11, color: c.muted, marginTop: 4, letterSpacing: 1 },
  methodRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.divider },
  methodLabel: { color: c.onSurface, fontSize: 14 },
  muted: { color: c.muted, fontSize: 13 },
}));
