import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ModuleHeader, ThemedStatusBar, useKit } from "@/src/components/ui-kit";
import { accountBalances, customerStatus, latestMonthKey, monthMetrics, productStatus } from "@/src/data/calc";
import { orderProfit } from "@/src/data/profit";
import { useBos } from "@/src/data/store";
import { formatRupiah, monthLabel } from "@/src/data/time";

// Shared drill-down list opened from the Analytics + Home dashboards. It never stores its
// own numbers: every list is derived from the same calculation layer for the selected
// period, so the detail always matches the KPI/segment/region/status it was opened from.
type Row = { id: string; title: string; sub: string; value: string; to?: { type: string; value: string } };

export default function DetailScreen() {
  const kit = useKit(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { data } = useBos();
  const params = useLocalSearchParams<{ type?: string; value?: string; month?: string }>();
  const type = String(params.type ?? "");
  const value = params.value ? String(params.value) : "";
  const month = params.month && String(params.month) ? String(params.month) : latestMonthKey(data);
  const period = monthLabel(month);

  const result = useMemo<{ title: string; subtitle: string; total?: number; totalLabel?: string; totalText?: string; rows: Row[] }>(() => {
    const customerName = (id: string) => data.customers.find((customer) => customer.id === id)?.name ?? "Tanpa pelanggan";
    const inMonth = (date: string) => date.slice(0, 7) === month;
    // Nilai order = nilai jual aktual dari Profit Engine (sumber yang sama dengan Pendapatan/Kas Masuk).
    const netOf = (order: (typeof data.orders)[number]) => orderProfit(data, order).omzet;
    const saleOrders = () => data.orders.filter((order) => order.status === "Selesai" && inMonth(order.date)).sort((left, right) => right.date.localeCompare(left.date));
    const orderRows = (): Row[] => saleOrders().map((order) => ({ id: order.id, title: order.code || "Order", sub: `${order.date} · ${customerName(order.customerId)}`, value: formatRupiah(netOf(order)) }));

    // ---- Customers ----
    if (type === "customer-segment" || type === "customer-region" || type === "customer-active") {
      const statuses = customerStatus(data, month);
      const filtered = type === "customer-segment"
        ? statuses.filter((item) => item.segment === value)
        : type === "customer-region"
          ? statuses.filter((item) => (item.customer.city || "Lainnya") === value)
          : statuses.filter((item) => ["Pelanggan Loyal", "Pelanggan Berulang", "Pelanggan Baru"].includes(item.segment));
      const rows: Row[] = filtered.sort((left, right) => right.spend - left.spend).map((item) => ({
        id: item.customer.id, title: item.customer.name,
        sub: `${item.customer.city || "Lainnya"} · ${item.orders} order · ${item.lastOrder ? `order terakhir ${item.lastOrder}` : "belum ada order"}`,
        value: formatRupiah(item.spend),
      }));
      const title = type === "customer-segment" ? value : type === "customer-region" ? `Wilayah ${value}` : "Pelanggan Aktif";
      return { title, subtitle: `${period} · ${rows.length} pelanggan`, rows };
    }

    if (type === "customer-region-others") {
      const statuses = customerStatus(data, month);
      const counts = new Map<string, number>();
      statuses.forEach((item) => { const city = item.customer.city || "Lainnya"; counts.set(city, (counts.get(city) ?? 0) + 1); });
      const ranked = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
      const rows: Row[] = ranked.slice(9).map((region) => ({ id: region.name, title: region.name, sub: `${region.count} pelanggan`, value: `${region.count} pelanggan`, to: { type: "customer-region", value: region.name } }));
      return { title: "Daerah Lainnya", subtitle: `${period} · ${rows.length} wilayah`, rows };
    }

    // ---- Products ----
    if (type === "product-availability" || type === "product-turnover" || type === "product-stock") {
      const statuses = productStatus(data, month);
      const filtered = type === "product-availability"
        ? statuses.filter((item) => item.availability === value)
        : type === "product-turnover"
          ? statuses.filter((item) => item.turnover === value)
          : statuses;
      const rows: Row[] = filtered.sort((left, right) => right.stockValue - left.stockValue).map((item) => ({
        id: item.product.id, title: item.product.name,
        sub: `${item.stock} pcs · ROP ${item.product.rop}${item.lastSale ? ` · terjual ${item.lastSale}` : " · belum terjual"}`,
        value: formatRupiah(item.stockValue),
      }));
      if (type === "product-stock") {
        const total = statuses.reduce((sum, item) => sum + Math.max(0, item.stockValue), 0);
        return { title: "Nilai Stok", subtitle: `${period} · ${rows.length} produk`, total, totalLabel: "Total nilai stok", rows };
      }
      return { title: value, subtitle: `${type === "product-availability" ? "Ketersediaan" : "Perputaran"} · ${period}`, rows };
    }

    const metrics = monthMetrics(data, month);

    // ---- Sales ----
    if (type === "sales-omzet" || type === "sales-total-order" || type === "sales-aov") {
      const rows = orderRows();
      if (type === "sales-total-order") return { title: "Total Order", subtitle: `${period} · order selesai`, totalText: `${rows.length} order`, totalLabel: "Jumlah order", rows };
      if (type === "sales-aov") return { title: "AOV", subtitle: `${period} · ${rows.length} order selesai`, total: metrics.aov, totalLabel: "Rata-rata nilai order (AOV)", rows };
      return { title: "Omzet", subtitle: `${period} · ${rows.length} order selesai`, total: metrics.omzet, totalLabel: "Total omzet", rows };
    }

    if (type === "sales-qty") {
      const qtyOf = (productId: string) => Math.round(saleOrders().reduce((sum, order) => sum + order.items.filter((item) => item.productId === productId).reduce((total, item) => total + (item.qty - Math.max(0, Math.min(item.qty, item.returnedQty ?? 0))), 0), 0));
      const rows: Row[] = data.products
        .map((product) => ({ product, qty: qtyOf(product.id) }))
        .filter((entry) => entry.qty > 0)
        .sort((left, right) => right.qty - left.qty)
        .map((entry) => ({ id: entry.product.id, title: entry.product.name, sub: `${entry.product.sku} · ${formatRupiah(entry.product.price)}/pcs`, value: `${entry.qty} pcs` }));
      return { title: "Qty Terjual", subtitle: `${period} · total ${metrics.qty} pcs`, totalText: `${metrics.qty} pcs`, totalLabel: "Total qty terjual", rows };
    }

    if (type === "sales-channel") {
      const channel = data.channels.find((entry) => entry.name === value);
      const orders = saleOrders().filter((order) => order.channelId === (channel?.id ?? ""));
      const rows: Row[] = orders.map((order) => ({ id: order.id, title: order.code || "Order", sub: `${order.date} · ${customerName(order.customerId)}`, value: formatRupiah(netOf(order)) }));
      const total = orders.reduce((sum, order) => sum + netOf(order), 0);
      return { title: value, subtitle: `${period} · ${rows.length} order`, total, totalLabel: "Total omzet channel", rows };
    }

    // ---- Finance (drill-down read-only ke sumber transaksi, mengikuti periode terpilih) ----
    if (type === "finance-kas-masuk" || type === "finance-pendapatan") {
      const rows = orderRows();
      const isCash = type === "finance-kas-masuk";
      return { title: isCash ? "Kas Masuk" : "Pendapatan", subtitle: `${period} · ${rows.length} order selesai`, total: isCash ? metrics.cashIn : metrics.omzet, totalLabel: isCash ? "Total kas masuk (settlement order)" : "Total pendapatan", rows };
    }

    // HPP / Biaya Channel / Packaging / Pajak per order — langsung dari Profit Engine per item.
    if (type === "finance-hpp" || type === "finance-biaya-channel" || type === "finance-packaging" || type === "finance-pajak") {
      const pick = (entry: ReturnType<typeof orderProfit>) => type === "finance-hpp" ? entry.hpp : type === "finance-biaya-channel" ? entry.channelCostTotal : type === "finance-packaging" ? entry.packaging : entry.tax;
      const label = type === "finance-hpp" ? "HPP" : type === "finance-biaya-channel" ? "Biaya Channel" : type === "finance-packaging" ? "Packaging" : "Pajak / PPh";
      const rows: Row[] = saleOrders().map((order) => {
        const entry = orderProfit(data, order);
        const items = entry.items.map((item) => `${data.products.find((product) => product.id === item.productId)?.name ?? item.productId} ${formatRupiah(type === "finance-hpp" ? item.hpp : type === "finance-biaya-channel" ? item.channelCostTotal : type === "finance-packaging" ? item.packaging : item.tax)}`).join(" · ");
        return { id: order.id, title: order.code || "Order", sub: `${order.date} · ${items}`, value: formatRupiah(pick(entry)) };
      }).filter((row) => row.value !== formatRupiah(0));
      const total = type === "finance-hpp" ? metrics.cogs : type === "finance-biaya-channel" ? metrics.channelFee : type === "finance-packaging" ? metrics.packaging : metrics.tax;
      return { title: label, subtitle: `${period} · per order → order item`, total, totalLabel: `Total ${label}`, rows };
    }

    if (type === "finance-pengeluaran") {
      const rows: Row[] = data.expenses.filter((expense) => inMonth(expense.date)).sort((left, right) => right.date.localeCompare(left.date)).map((expense) => ({ id: expense.id, title: expense.category || "Pengeluaran", sub: `${expense.date} · ${expense.note || "Pengeluaran"} · ${data.accounts.find((account) => account.id === expense.accountId)?.name ?? "tanpa akun"}`, value: formatRupiah(expense.amount) }));
      return { title: "Pengeluaran", subtitle: `${period} · biaya operasional`, total: metrics.expenses, totalLabel: "Total pengeluaran", rows };
    }

    if (type === "finance-kas-keluar") {
      const purchases: Row[] = data.purchases.filter((purchase) => inMonth(purchase.date)).map((purchase) => ({ id: purchase.id, title: purchase.code || "Pembelian", sub: `${purchase.date} · Pembelian`, value: formatRupiah(purchase.items.reduce((sum, item) => sum + item.qty * item.cost, 0)) }));
      const expenses: Row[] = data.expenses.filter((expense) => inMonth(expense.date)).map((expense) => ({ id: expense.id, title: expense.category || "Pengeluaran", sub: `${expense.date} · ${expense.note || "Pengeluaran"}`, value: formatRupiah(expense.amount) }));
      const channelFee: Row[] = metrics.channelFee > 0 ? [{ id: "channel-fee", title: "Biaya Channel", sub: `${period} · dipotong dari settlement`, value: formatRupiah(metrics.channelFee), to: { type: "finance-biaya-channel", value: "" } }] : [];
      return { title: "Kas Keluar", subtitle: `${period} · pembelian, pengeluaran & biaya channel`, total: metrics.cashOut, totalLabel: "Total kas keluar", rows: [...purchases, ...expenses, ...channelFee] };
    }

    if (type === "finance-biaya" || type === "finance-laba" || type === "finance-margin") {
      const costRows: Row[] = [
        { id: "hpp", title: "HPP (Modal Terjual)", sub: `${period} · rata-rata bergerak`, value: formatRupiah(metrics.cogs), to: { type: "finance-hpp", value: "" } },
        { id: "channel-fee", title: "Biaya Channel", sub: `${period} · dari master Biaya Channel`, value: formatRupiah(metrics.channelFee), to: { type: "finance-biaya-channel", value: "" } },
        { id: "packaging", title: "Packaging", sub: `${period} · komponen Biaya Channel`, value: formatRupiah(metrics.packaging), to: { type: "finance-packaging", value: "" } },
        { id: "tax", title: "Pajak / PPh", sub: `${period} · komponen Biaya Channel`, value: formatRupiah(metrics.tax), to: { type: "finance-pajak", value: "" } },
        { id: "expenses", title: "Pengeluaran (Biaya Operasional)", sub: `${period} · ${data.expenses.filter((expense) => inMonth(expense.date)).length} transaksi`, value: formatRupiah(metrics.expenses), to: { type: "finance-pengeluaran", value: "" } },
      ];
      const totalBiaya = metrics.cogs + metrics.channelFee + metrics.packaging + metrics.tax + metrics.expenses;
      const hasTx = metrics.orders > 0 || metrics.expenses > 0;
      if (type === "finance-laba" || type === "finance-margin") {
        const rows: Row[] = hasTx ? [{ id: "pendapatan", title: "Pendapatan", sub: `${period} · nilai jual aktual`, value: formatRupiah(metrics.omzet), to: { type: "finance-pendapatan", value: "" } }, ...costRows] : [];
        if (type === "finance-margin") return { title: "Margin", subtitle: `${period} · laba bersih ÷ pendapatan`, totalText: `${Math.round(metrics.marginPct)}%`, totalLabel: `Margin · laba ${formatRupiah(metrics.netProfit)} dari ${formatRupiah(metrics.omzet)}`, rows };
        return { title: "Laba Bersih", subtitle: `${period} · pendapatan − biaya`, total: metrics.netProfit, totalLabel: "Laba bersih bisnis", rows };
      }
      return { title: "Biaya", subtitle: `${period} · HPP, biaya channel, packaging, pajak & pengeluaran`, total: totalBiaya, totalLabel: "Total biaya", rows: hasTx ? costRows : [] };
    }

    // Saldo per Akun: tanpa value = daftar akun; dengan value = mutasi akun pada periode.
    if (type === "finance-saldo-akun") {
      const balances = accountBalances(data, month);
      if (!value) {
        const rows: Row[] = balances.map((account) => ({ id: account.id, title: `${account.name} · ${account.type}`, sub: `Saldo awal ${formatRupiah(account.openingBalance)} · masuk ${formatRupiah(account.cashIn)} · keluar ${formatRupiah(account.cashOut)}`, value: formatRupiah(account.balance), to: { type: "finance-saldo-akun", value: account.id } }));
        return { title: "Saldo Kas", subtitle: `s/d akhir ${period} · ${rows.length} akun`, total: balances.reduce((sum, account) => sum + account.balance, 0), totalLabel: "Total saldo seluruh akun", rows };
      }
      const account = balances.find((entry) => entry.id === value);
      if (!account) return { title: "Akun Kas", subtitle: period, rows: [] };
      const orders: Row[] = saleOrders().filter((order) => order.accountId === account.id).map((order) => { const entry = orderProfit(data, order); return { id: order.id, title: `Masuk · ${order.code || "Order"}`, sub: `${order.date} · ${customerName(order.customerId)}${entry.channelCostTotal > 0 ? ` · biaya channel −${formatRupiah(entry.channelCostTotal)}` : ""}`, value: `+${formatRupiah(entry.omzet)}` }; });
      const purchases: Row[] = data.purchases.filter((purchase) => inMonth(purchase.date) && purchase.accountId === account.id).map((purchase) => ({ id: purchase.id, title: `Keluar · ${purchase.code || "Pembelian"}`, sub: `${purchase.date} · Pembelian`, value: `−${formatRupiah(purchase.items.reduce((sum, item) => sum + item.qty * item.cost, 0))}` }));
      const expenses: Row[] = data.expenses.filter((expense) => inMonth(expense.date) && expense.accountId === account.id).map((expense) => ({ id: expense.id, title: `Keluar · ${expense.category || "Pengeluaran"}`, sub: `${expense.date} · ${expense.note || "Pengeluaran"}`, value: `−${formatRupiah(expense.amount)}` }));
      const rows = [...orders, ...purchases, ...expenses].sort((left, right) => right.sub.slice(0, 10).localeCompare(left.sub.slice(0, 10)));
      return { title: account.name, subtitle: `${account.type} · mutasi ${period} · saldo awal ${formatRupiah(account.openingBalance)}`, total: account.balance, totalLabel: `Saldo s/d akhir ${period}`, rows };
    }

    return { title: "Detail", subtitle: period, rows: [] };
  }, [data, type, value, month, period]);

  const emptyText = type.startsWith("finance-") ? "Tidak ada transaksi pada periode ini." : "Belum ada data untuk periode ini.";

  const openRow = (row: Row) => { if (row.to) router.push({ pathname: "/detail", params: { type: row.to.type, value: row.to.value, month } }); };

  return <View style={kit.screen}><ThemedStatusBar />
    <View style={{ paddingTop: insets.top + 6 }}><ModuleHeader title={result.title} subtitle={result.subtitle} onBack={() => router.back()} /></View>
    <ScrollView contentContainerStyle={[kit.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
      {result.totalText !== undefined || result.total !== undefined ? <View style={kit.card}><Text style={kit.cardTitle}>{result.totalLabel}</Text><Text style={[kit.rowValue, { fontSize: 18, marginTop: 4 }]}>{result.totalText !== undefined ? result.totalText : formatRupiah(result.total ?? 0)}</Text></View> : null}
      {result.rows.length === 0 ? <EmptyState text={emptyText} /> : result.rows.map((row) => row.to
        ? <Pressable key={row.id} testID={`detail-row-${row.id}`} accessibilityRole="button" onPress={() => openRow(row)} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
            <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{row.title}</Text><Text numberOfLines={1} style={kit.rowSub}>{row.sub}</Text></View>
            <Text style={kit.rowValue}>{row.value}</Text>
          </Pressable>
        : <View key={row.id} testID={`detail-row-${row.id}`} style={kit.row}>
            <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{row.title}</Text><Text numberOfLines={1} style={kit.rowSub}>{row.sub}</Text></View>
            <Text style={kit.rowValue}>{row.value}</Text>
          </View>)}
    </ScrollView>
  </View>;
}
