import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { Button, Confirm, Empty, Header, Loading, Mono, useToast } from "@/src/components/ui";
import { rupiah } from "@/src/format";
import { makeStyles, useTheme } from "@/src/theme";

export default function SampahImport() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [del, setDel] = useState<any | null>(null);

  const q = useQuery({ queryKey: ["import-trash"], queryFn: () => api<any[]>("/import-trash") });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["import-trash"] }); qc.invalidateQueries({ queryKey: ["parts"] }); };

  const restore = useMutation({
    mutationFn: (id: string) => api(`/import-trash/${id}/restore`, { method: "POST" }),
    onSuccess: () => { invalidate(); toast.show("Part dipulihkan ke master", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/import-trash/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDel(null); toast.show("Dihapus permanen", "success"); },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <View style={styles.root} testID="import-trash-screen">
      <Header title="SAMPAH IMPORT" subtitle={q.data ? `${q.data.length} part sampah` : "Part sampah dari import Honda DMS"} back />
      {q.isLoading ? <Loading /> : (
        <FlatList data={q.data ?? []} keyExtractor={(r) => r.id} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty text="Tidak ada part sampah. Gunakan tombol 'Bersihkan Part Sampah' di halaman Stok." icon="trash-outline" testID="import-trash-empty" />}
          renderItem={({ item: r }) => (
            <View style={styles.card} testID={`trash-row-${r.code}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.name}>{r.name || "(tanpa nama)"}</Text>
                <Mono style={styles.code}>{r.code}</Mono>
              </View>
              <Text style={styles.sub}>{r.reason}{r.stock ? ` · stok ${r.stock}` : ""}{r.cost ? ` · modal ${rupiah(r.cost)}` : ""}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Button title="Pulihkan" variant="dark" small icon="arrow-undo-outline" style={{ flex: 1 }} loading={restore.isPending} onPress={() => restore.mutate(r.id)} testID={`trash-restore-${r.code}`} />
                <Button title="Hapus Permanen" variant="ghost" small icon="trash-outline" style={{ flex: 1, borderWidth: 2, borderColor: colors.error }} onPress={() => setDel(r)} testID={`trash-delete-${r.code}`} />
              </View>
            </View>
          )} />
      )}
      <Confirm visible={!!del} title="Hapus Permanen" message={`Hapus permanen part sampah "${del?.code}"?`} danger confirmLabel="YA, HAPUS"
        onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del.id)} loading={remove.isPending} testID="trash-delete-confirm" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { borderWidth: 2, borderColor: c.border, padding: 12, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: "600", color: c.onSurface, flex: 1 },
  code: { fontSize: 13, color: c.brandPrimary },
  sub: { fontSize: 12, color: c.muted, marginTop: 4 },
}));
