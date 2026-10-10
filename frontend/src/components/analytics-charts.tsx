import type { ComponentProps } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgTextBase } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fontSans, fontSansRegular, ThemeColors } from "@/src/theme";
import { Text } from "@/src/components/text";

// Label & angka grafik mengikuti font global Plus Jakarta Sans (jenis font yang
// sama dengan card KPI Utama); ketebalan tetap mengikuti prop fontWeight.
const ChartText = (props: ComponentProps<typeof SvgTextBase>) => (
  <SvgTextBase fontFamily={String(props.fontWeight ?? "400") === "700" ? fontSans : fontSansRegular} {...props} />
);

export type Segment = { label: string; count: number; colorKey: keyof ThemeColors };

type LinePoint = { label: string; value: number };

export function ActiveTrend({ data, colors, compact = false, formatValue = (value: number) => String(value), height: heightProp }: { data: LinePoint[]; colors: ThemeColors; compact?: boolean; formatValue?: (value: number) => string; height?: number }) {
  const width = 340;
  // height = tinggi viewBox; chartHeight = tinggi SVG aktual (prop `height` mengunci tinggi SVG).
  const chartHeight = heightProp ?? (compact ? 118 : 190);
  const height = heightProp ? Math.round(heightProp / 1.08) : (compact ? 108 : 174);
  const left = 30; const right = 12; const top = 15;
  const bottom = compact ? 22 : 27;
  // Skala mengikuti rentang data aktual (dengan headroom) agar garis mengisi tinggi card yang
  // dikunci; tidak mengubah nilai/kalkulasi, hanya penyajian.
  const values = data.map((item) => item.value);
  const rawMax = Math.max(...values); const rawMin = Math.min(...values);
  const pad = Math.max((rawMax - rawMin) * 0.35, rawMax * 0.12, 1);
  const max = rawMax + pad; const min = Math.max(0, rawMin - pad); const range = Math.max(1, max - min);
  const point = (item: LinePoint, index: number) => ({ ...item, x: left + (index * (width - left - right)) / Math.max(1, data.length - 1), y: top + ((max - item.value) / range) * (height - top - bottom) });
  const points = data.map(point); const path = points.map((item, index) => `${index ? "L" : "M"}${item.x},${item.y}`).join(" ");
  const area = `${path} L${points[points.length - 1].x},${height - bottom} L${points[0].x},${height - bottom} Z`;
  return <View style={styles.chartWrap}>
    <Svg width="100%" height={chartHeight} viewBox={`0 0 ${width} ${height}`}>
      {[0, 1, 2, 3].map((row) => { const y = top + (row * (height - top - bottom)) / 3; return <Line key={row} x1={left} x2={width - right} y1={y} y2={y} stroke={colors.border} strokeWidth="1" opacity="0.65" />; })}
      {points.map((item) => <Line key={item.x} x1={item.x} x2={item.x} y1={top} y2={height - bottom} stroke={colors.border} opacity="0.35" />)}
      <Path d={area} fill={colors.brandTertiary} opacity="0.7" />
      <Path d={path} fill="none" stroke={colors.brand} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((item, index) => { const edgeAnchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"; const edgeShift = index === 0 ? 6 : index === points.length - 1 ? -6 : 0; return <G key={item.x}>
        <Circle cx={item.x} cy={item.y} r="10" fill={colors.brandTertiary} opacity="0.65" />
        <Circle cx={item.x} cy={item.y} r="4.5" fill={colors.brand} stroke={colors.onSurface} strokeWidth="1.5" />
        <ChartText x={item.x + edgeShift} y={item.y - 12} fill={colors.onSurface} fontSize="11" fontWeight="700" textAnchor={edgeAnchor}>{formatValue(item.value)}</ChartText>
        <ChartText x={item.x + edgeShift} y={height - 7} fill={colors.onSurfaceTertiary} fontSize="10" textAnchor={edgeAnchor}>{item.label}</ChartText>
      </G>; })}
    </Svg>
  </View>;
}

// Two series (omzet + order) on one compact 6-month chart. Each series is scaled to its
// own range so both trends stay readable inside the same compact card height.
// Standar multi-series: line + titik, TANPA area fill; warna + legend jadi pembeda utama.
export function DualTrend({ primary, secondary, colors, compact = false, formatPrimary = (value: number) => String(value), formatSecondary = (value: number) => String(value), height: heightProp }: { primary: LinePoint[]; secondary: LinePoint[]; colors: ThemeColors; compact?: boolean; formatPrimary?: (value: number) => string; formatSecondary?: (value: number) => string; height?: number }) {
  const width = 340;
  const chartHeight = heightProp ?? (compact ? 144 : 206);
  const height = heightProp ? Math.round(heightProp / 1.075) : (compact ? 134 : 192);
  const left = 12; const right = 12; const top = 18;
  const bottom = compact ? 33 : 38;
  const project = (series: LinePoint[], bandTop: number, bandBottom: number) => {
    const max = Math.max(...series.map((item) => item.value));
    const min = Math.min(...series.map((item) => item.value));
    const range = Math.max(1, max - min);
    const plot = height - top - bottom;
    const yTop = top + bandTop * plot; const yBottom = top + bandBottom * plot;
    return series.map((item, index) => ({ ...item, x: left + (index * (width - left - right)) / Math.max(1, series.length - 1), y: yBottom - ((item.value - min) / range) * (yBottom - yTop) }));
  };
  const primaryPoints = project(primary, 0.05, 0.55); const secondaryPoints = project(secondary, 0.62, 0.94);
  const toPath = (points: { x: number; y: number }[]) => points.map((item, index) => `${index ? "L" : "M"}${item.x},${item.y}`).join(" ");
  const primaryPath = toPath(primaryPoints);
  return <View style={styles.chartWrap}>
    <Svg width="100%" height={chartHeight} viewBox={`0 0 ${width} ${height}`}>
      {[0, 1, 2, 3].map((row) => { const y = top + (row * (height - top - bottom)) / 3; return <Line key={row} x1={left} x2={width - right} y1={y} y2={y} stroke={colors.border} strokeWidth="1" opacity="0.65" />; })}
      <Path d={primaryPath} fill="none" stroke={colors.brand} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <Path d={toPath(secondaryPoints)} fill="none" stroke={colors.warning} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {secondaryPoints.map((item, index) => { const anchor = index === 0 ? "start" : index === secondaryPoints.length - 1 ? "end" : "middle"; const shift = index === 0 ? -2 : index === secondaryPoints.length - 1 ? 2 : 0; return <G key={`s-${item.x}`}>
        <Circle cx={item.x} cy={item.y} r="3.4" fill={colors.warning} stroke={colors.onSurface} strokeWidth="1.2" />
        <ChartText x={item.x + shift} y={item.y + 11} fill={colors.warning} fontSize="9" fontWeight="700" textAnchor={anchor}>{formatSecondary(item.value)}</ChartText>
      </G>; })}
      {primaryPoints.map((item, index) => { const anchor = index === 0 ? "start" : index === primaryPoints.length - 1 ? "end" : "middle"; const shift = index === 0 ? 2 : index === primaryPoints.length - 1 ? -2 : 0; return <G key={item.x}>
        <Circle cx={item.x} cy={item.y} r="3.4" fill={colors.brand} stroke={colors.onSurface} strokeWidth="1.2" />
        <ChartText x={item.x + shift} y={item.y - 8} fill={colors.onSurface} fontSize="9" fontWeight="700" textAnchor={anchor}>{formatPrimary(item.value)}</ChartText>
        <ChartText x={item.x + shift} y={height - 7} fill={colors.onSurfaceTertiary} fontSize="9" textAnchor={anchor}>{item.label}</ChartText>
      </G>; })}
    </Svg>
  </View>;
}

// Business Health Score ring: track + single progress arc, value and unit in the center.
export function ScoreGauge({ score, colors, tone, compact = false }: { score: number; colors: ThemeColors; tone: "success" | "warning" | "error" | "brandPrimary"; compact?: boolean }) {
  const size = compact ? 92 : 140; const center = size / 2; const stroke = compact ? 11 : 15; const radius = center - stroke / 2 - 2;
  const circumference = 2 * Math.PI * radius; const progress = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return <View style={[styles.donutGraphic, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors.gaugeTrack} strokeWidth={stroke} />
      <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors[tone]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${progress} ${circumference - progress}`} transform={`rotate(-90 ${center} ${center})`} />
    </Svg>
    <View style={styles.donutCenter}>
      <Text style={[styles.total, compact && { fontSize: 24 }, { color: colors.onSurface }]}>{score}</Text>
      <Text style={[styles.totalLabel, compact && { fontSize: 9 }, { color: colors.onSurfaceTertiary }]}>/ 100</Text>
    </View>
  </View>;
}

// Multi-series 6-month chart. Each series gets its own horizontal band and scale so
// lines never cross or overlap, keeping value labels readable inside a compact card.
// Standar: multi-series = line + titik data, tanpa area fill (area hanya untuk single-series);
// warna + legend adalah pembeda utama, dash hanya aksen. `height` mengunci tinggi SVG.
export type TrendSeries = { key: string; points: LinePoint[]; color: string; dash?: string; format: (value: number) => string; labelMode: "all" | "last"; labelPlacement?: "above" | "below" };

export function MultiTrend({ series, colors, compact = false, showArea = false, height: heightProp }: { series: TrendSeries[]; colors: ThemeColors; compact?: boolean; showArea?: boolean; height?: number }) {
  const width = 340;
  const chartHeight = heightProp ?? (compact ? (series.length > 2 ? 158 : 150) : (series.length > 2 ? 216 : 210));
  const height = heightProp ? Math.round(heightProp / 1.07) : (compact ? (series.length > 2 ? 148 : 140) : (series.length > 2 ? 202 : 196));
  const areaOn = showArea && series.length === 1;
  const left = 12; const right = 12; const top = 16;
  const bottom = compact ? 34 : 40;
  const plot = height - top - bottom;
  const gap = 0.07; const band = (1 - gap * (series.length - 1)) / series.length;
  const project = (points: LinePoint[], slot: number) => {
    const max = Math.max(...points.map((item) => item.value));
    const min = Math.min(...points.map((item) => item.value));
    const range = Math.max(1, max - min);
    const yTop = top + slot * (band + gap) * plot + plot * 0.04;
    const yBottom = top + (slot * (band + gap) + band) * plot;
    return points.map((item, index) => ({ ...item, x: left + (index * (width - left - right)) / Math.max(1, points.length - 1), y: yBottom - ((item.value - min) / range) * (yBottom - yTop) }));
  };
  const projected = series.map((item, index) => ({ ...item, points: project(item.points, index) }));
  const toPath = (points: { x: number; y: number }[]) => points.map((item, index) => `${index ? "L" : "M"}${item.x},${item.y}`).join(" ");
  const monthLabels = projected[0].points;
  return <View style={styles.chartWrap}>
    <Svg width="100%" height={chartHeight} viewBox={`0 0 ${width} ${height}`}>
      {[0, 1, 2, 3].map((row) => { const y = top + (row * plot) / 3; return <Line key={row} x1={left} x2={width - right} y1={y} y2={y} stroke={colors.border} strokeWidth="1" opacity="0.6" />; })}
      {areaOn && <Path d={`${toPath(projected[0].points)} L${projected[0].points[projected[0].points.length - 1].x},${height - bottom} L${projected[0].points[0].x},${height - bottom} Z`} fill={colors.brandTertiary} opacity="0.45" />}
      {projected.map((item) => <Path key={`line-${item.key}`} d={toPath(item.points)} fill="none" stroke={item.color} strokeWidth="2.2" strokeDasharray={item.dash} strokeLinejoin="round" strokeLinecap="round" />)}
      {projected.map((item) => <G key={`points-${item.key}`}>{item.points.map((point, index) => {
        const last = index === item.points.length - 1;
        const show = item.labelMode === "all" || last;
        const anchor = index === 0 ? "start" : last ? "end" : "middle";
        const shift = index === 0 ? -2 : last ? 2 : 0;
        const dy = item.labelPlacement === "below" ? 11 : -6;
        return <G key={`${item.key}-${point.x}`}>
          <Circle cx={point.x} cy={point.y} r="2.8" fill={item.color} />
          {show && <ChartText x={point.x + shift} y={point.y + dy} fill={item.color} fontSize="9" fontWeight="700" textAnchor={anchor}>{item.format(point.value)}</ChartText>}
        </G>;
      })}</G>)}
      {monthLabels.map((point, index) => { const anchor = index === 0 ? "start" : index === monthLabels.length - 1 ? "end" : "middle"; return <ChartText key={`month-${point.x}`} x={point.x} y={height - 8} fill={colors.onSurfaceTertiary} fontSize="9" textAnchor={anchor}>{point.label}</ChartText>; })}
    </Svg>
  </View>;
}

export function SegmentDonut({ segments, colors, onSelect, compact = false, unitLabel = "pelanggan" }: { segments: Segment[]; colors: ThemeColors; onSelect: (segment: Segment) => void; compact?: boolean; unitLabel?: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0); const size = compact ? 130 : 164; const center = size / 2; const radius = compact ? 48 : 63; const stroke = compact ? 15 : 19; const circumference = 2 * Math.PI * radius; let offset = 0;
  const colorFor = (key: Segment["colorKey"]) => colors[key];
  void onSelect;
  return <View style={[styles.donutArea, compact && { width: size }]}><View style={[styles.donutGraphic, compact && { width: size, height: size }]}><Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors.surfaceTertiary} strokeWidth={stroke} />
    {segments.map((segment) => { const length = total > 0 ? (segment.count / total) * circumference : 0; const dash = `${length} ${circumference - length}`; const currentOffset = offset; offset += length; return <Circle key={segment.label} cx={center} cy={center} r={radius} fill="none" stroke={colorFor(segment.colorKey)} strokeWidth={stroke} strokeDasharray={dash} strokeDashoffset={-currentOffset} transform={`rotate(-90 ${center} ${center})`} />; })}
  </Svg><View style={styles.donutCenter}><Text style={[styles.total, compact && { fontSize: 18 }, { color: colors.onSurface }]}>{total}</Text><Text style={[styles.totalLabel, compact && { fontSize: 9 }, { color: colors.onSurfaceTertiary }]}>{unitLabel}</Text></View></View></View>;
}

export function SectionIcon({ name, colors }: { name: keyof typeof MaterialCommunityIcons.glyphMap; colors: ThemeColors }) { return <View style={[styles.iconBubble, { backgroundColor: colors.brandTertiary }]}><MaterialCommunityIcons name={name} size={18} color={colors.brand} /></View>; }

const styles = StyleSheet.create({
  chartWrap: { marginTop: 5, width: "100%", position: "relative", overflow: "hidden" },
  donutArea: { alignItems: "center", justifyContent: "center", width: 114 },
  donutGraphic: { width: 116, height: 116, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", alignItems: "center" },
  total: { fontSize: 27, fontWeight: "800" },
  totalLabel: { fontSize: 11, marginTop: 2 },
  iconBubble: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});