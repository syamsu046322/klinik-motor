import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { Empty, Header, Loading, Mono } from "@/src/components/ui";
import { fmtDateTime } from "@/src/format";
import { makeStyles, useTheme } from "@/src/theme";

export default function Mutasi() {
  const styles = useStyles();
  const { colors } = useTheme();
  const list = useQuery({ queryKey: ["stock-movements"], queryFn: () => api<any[]>("/stock-movements") });
  return (
    <View style={styles.root} testID="movements-screen">
      <Header title="MUTASI STOK" subtitle="Riwayat keluar / masuk part" back />
      {list.isLoading ? <Loading /> : (
        <FlatList data={list.data ?? []} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={list.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty text="Belum ada mutasi stok." icon="swap-vertical-outline" />}
          renderItem={({ item: m }) => (
            <View style={styles.row} testID={`movement-row-${m.id}`}>
              <Mono style={[styles.qty, { color: m.qty < 0 ? colors.error : colors.success }]}>{m.qty > 0 ? `+${m.qty}` : m.qty}</Mono>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.part_name} <Text style={styles.muted}>({m.part_code})</Text></Text>
                <Text style={styles.reason}>{m.reason}{m.transaction_no ? ` · ${m.transaction_no}` : ""}{m.note ? ` · ${m.note}` : ""}</Text>
                <Text style={styles.muted}>{fmtDateTime(m.created_at)} · {m.username}</Text>
              </View>
              <Mono style={styles.muted}>{m.stock_before} → {m.stock_after}</Mono>
            </View>
          )} />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 2, borderBottomColor: c.divider },
  qty: { fontSize: 18, width: 48 },
  name: { fontSize: 15, color: c.onSurface, fontWeight: "500" },
  reason: { fontSize: 13, color: c.onSurface },
  muted: { fontSize: 12, color: c.muted },
}));
