import { Redirect } from "expo-router";

// Analytics entry point. Opening Analytics defaults to the Penjualan tab; the Pelanggan
// tab lives at /pelanggan and is reachable from the in-screen tab bar.
export default function Index() {
  return <Redirect href="/penjualan" />;
}
