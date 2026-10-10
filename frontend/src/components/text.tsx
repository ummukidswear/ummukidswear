import { forwardRef } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from "react-native";
import { fontSans, fontSansHeavy, fontSansMedium, fontSansRegular, fontSansSemibold } from "@/src/theme";

// Font global BOS: Plus Jakarta Sans — jenis font yang sama persis dengan yang
// dipakai card KPI Utama. Wrapper ini memetakan fontWeight pada style ke family
// Plus Jakarta Sans yang sesuai, sehingga seluruh teks aplikasi (judul, label,
// angka KPI, tombol, navigasi, form, tabel) memakai jenis font yang sama tanpa
// mengubah ukuran, ketebalan, warna, layout, maupun fungsi. Family eksplisit
// (mis. token tema) selalu dihormati apa adanya.
const familyForWeight = (weight: TextStyle["fontWeight"] | undefined): string => {
  switch (String(weight ?? "400")) {
    case "500":
      return fontSansMedium;
    case "600":
      return fontSansSemibold;
    case "700":
    case "bold":
      return fontSans;
    case "800":
    case "900":
      return fontSansHeavy;
    default:
      return fontSansRegular;
  }
};

const withGlobalFont = (style: TextProps["style"]) => {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return [style, { fontFamily: flat?.fontFamily ?? familyForWeight(flat?.fontWeight) }];
};

export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={withGlobalFont(style)} />;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={withGlobalFont(style)} />;
});
