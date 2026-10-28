import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Line,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { FinancialTrendPoint } from '../types';
import { formatETB } from '../utils/currency';
import { AppIcon } from './AppIcon';
import { useTheme } from '../context/ThemeContext';

interface InteractiveTrendChartProps {
  data: FinancialTrendPoint[];
  chartType: 'INCOME_EXPENSE' | 'LIQUIDITY_TREND';
  timeframeLabel: string;
  emptyMessage?: string;
}

// ─── Smooth Bezier Spline Helper ──────────────────────────────────────────────
function getSmoothCurvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function getAreaPath(points: { x: number; y: number }[], bottomY: number): string {
  if (points.length < 2) return '';
  const curve = getSmoothCurvePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
}

export const InteractiveTrendChart: React.FC<InteractiveTrendChartProps> = ({
  data,
  chartType,
  timeframeLabel,
  emptyMessage = 'No financial data recorded for this timeframe.',
}) => {
  const { theme, isDark } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number>(
    data && data.length > 0 ? data.length - 1 : 0
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>{emptyMessage}</Text>
      </View>
    );
  }

  const activeIndex = hoverIndex !== null ? hoverIndex : selectedIndex;
  const activePoint = data[activeIndex] || data[data.length - 1];

  const colorA = '#10B981'; // vibrant neon emerald
  const colorB = chartType === 'INCOME_EXPENSE' ? '#F43F5E' : '#38BDF8'; // vibrant rose or cyan

  const labelA = chartType === 'INCOME_EXPENSE' ? 'Income (ገቢ)' : 'Safe (ካዝና)';
  const labelB = chartType === 'INCOME_EXPENSE' ? 'Expense (ወጪ)' : 'Bank (ባንክ)';

  const valuesA = data.map((d) =>
    chartType === 'INCOME_EXPENSE'
      ? d.totalIncome
      : (d.actualCash ?? d.cashBalance ?? d.expectedCash ?? 0)
  );
  const valuesB = data.map((d) =>
    chartType === 'INCOME_EXPENSE'
      ? d.totalExpense
      : (d.actualBank ?? d.bankBalance ?? d.expectedBank ?? 0)
  );

  const maxVal = Math.max(...valuesA, ...valuesB, 1000);

  // Dimensions
  const pointWidth = Math.max(68, 480 / Math.max(data.length, 1));
  const svgWidth = Math.max(data.length * pointWidth, 340);
  const svgHeight = 220;

  const PAD_TOP = 28;
  const PAD_BOTTOM = 36;
  const PAD_LEFT = 24;
  const PAD_RIGHT = 24;

  const plotW = svgWidth - PAD_LEFT - PAD_RIGHT;
  const plotH = svgHeight - PAD_TOP - PAD_BOTTOM;
  const bottomY = PAD_TOP + plotH;

  const xOf = (i: number) =>
    PAD_LEFT + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yOf = (v: number) =>
    PAD_TOP + plotH - Math.max(0, Math.min(plotH, (v / maxVal) * plotH));

  const pointsA = valuesA.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
  const pointsB = valuesB.map((v, i) => ({ x: xOf(i), y: yOf(v) }));

  const pathA = getSmoothCurvePath(pointsA);
  const pathB = getSmoothCurvePath(pointsB);
  const areaA = getAreaPath(pointsA, bottomY);
  const areaB = getAreaPath(pointsB, bottomY);

  // Track hover/touch location
  const handlePointerMove = (evt: any) => {
    try {
      const nativeEvt = evt.nativeEvent || evt;
      const locX = nativeEvt.locationX ?? nativeEvt.offsetX;
      if (typeof locX === 'number') {
        let closestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < data.length; i++) {
          const dist = Math.abs(xOf(i) - locX);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }
        setHoverIndex(closestIdx);
      }
    } catch {
      // ignore
    }
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  // Background gradient colors
  const bgGradStart = isDark ? '#0D1B3E' : '#FFFFFF';
  const bgGradMid   = isDark ? '#0A132C' : '#F1F7FE';
  const bgGradEnd   = isDark ? '#070C1D' : '#E6F0FA';

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#070C1D' : '#FFFFFF', borderColor: isDark ? '#1E2F5B' : '#E2E8F0' }]}>
      {/* ── Top Header ── */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : '#E0F2FE' }]}>
              <AppIcon
                name={chartType === 'INCOME_EXPENSE' ? 'activity' : 'landmark'}
                size={16}
                color={isDark ? '#38BDF8' : '#0284C7'}
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {chartType === 'INCOME_EXPENSE' ? 'Market Financial Trend' : 'Cash Safe vs. Bank Liquidity'}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {timeframeLabel} • hover/tap any node to inspect value
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: colorA }]} />
            <Text style={[styles.legendText, { color: theme.textSub }]}>{labelA}</Text>
          </View>
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: colorB }]} />
            <Text style={[styles.legendText, { color: theme.textSub }]}>{labelB}</Text>
          </View>
        </View>
      </View>

      {/* ── Floating Live Value Banner ── */}
      {activePoint && (
        <View style={[styles.liveValueBanner, { backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : '#F8FAFC', borderColor: isDark ? '#1E2F5B' : '#CBD5E1' }]}>
          <View style={styles.liveDateCol}>
            <Text style={[styles.liveDateText, { color: theme.text }]}>
              {activePoint.label} {activePoint.date ? `(${activePoint.date})` : ''}
            </Text>
            {activePoint.status && (
              <Text style={[
                styles.liveStatusTag,
                activePoint.status === 'BALANCED'
                  ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' }
                  : activePoint.status === 'SHORTAGE'
                  ? { color: '#F43F5E', backgroundColor: 'rgba(244,63,94,0.15)' }
                  : { color: '#FBBF24', backgroundColor: 'rgba(251,191,36,0.15)' },
              ]}>
                {activePoint.status}
              </Text>
            )}
          </View>

          <View style={styles.liveMetricsCol}>
            <View style={styles.liveMetricItem}>
              <Text style={[styles.liveMetricLabel, { color: colorA }]}>● {labelA}</Text>
              <Text style={[styles.liveMetricValue, { color: colorA }]}>
                {formatETB(valuesA[activeIndex])}
              </Text>
            </View>
            <View style={styles.liveMetricItem}>
              <Text style={[styles.liveMetricLabel, { color: colorB }]}>● {labelB}</Text>
              <Text style={[styles.liveMetricValue, { color: colorB }]}>
                {formatETB(valuesB[activeIndex])}
              </Text>
            </View>
            {chartType === 'INCOME_EXPENSE' && (
              <View style={styles.liveMetricItem}>
                <Text style={[styles.liveMetricLabel, { color: theme.textSub }]}>Net Retained</Text>
                <Text style={[
                  styles.liveMetricValue,
                  { color: valuesA[activeIndex] >= valuesB[activeIndex] ? '#10B981' : '#F43F5E' }
                ]}>
                  {valuesA[activeIndex] >= valuesB[activeIndex] ? '+' : ''}
                  {formatETB(valuesA[activeIndex] - valuesB[activeIndex])}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Smooth Gradient Interactive SVG Chart ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        <View
          // Web hover support
          {...(Platform.OS === 'web'
            ? ({
                onMouseMove: handlePointerMove,
                onMouseLeave: handlePointerLeave,
              } as any)
            : {})}
          onTouchMove={handlePointerMove}
          onTouchStart={handlePointerMove}
          style={{ width: svgWidth, height: svgHeight, position: 'relative' }}
        >
          <Svg width={svgWidth} height={svgHeight}>
            <Defs>
              {/* Rich smooth gradient background */}
              <LinearGradient id="smoothBgGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={bgGradStart} stopOpacity="1" />
                <Stop offset="45%" stopColor={bgGradMid} stopOpacity="1" />
                <Stop offset="100%" stopColor={bgGradEnd} stopOpacity="1" />
              </LinearGradient>

              {/* Income translucent area gradient */}
              <LinearGradient id="areaGradA" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colorA} stopOpacity="0.38" />
                <Stop offset="65%" stopColor={colorA} stopOpacity="0.10" />
                <Stop offset="100%" stopColor={colorA} stopOpacity="0.0" />
              </LinearGradient>

              {/* Expense/Bank translucent area gradient */}
              <LinearGradient id="areaGradB" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colorB} stopOpacity="0.32" />
                <Stop offset="65%" stopColor={colorB} stopOpacity="0.08" />
                <Stop offset="100%" stopColor={colorB} stopOpacity="0.0" />
              </LinearGradient>

              {/* Ambient radial glow for active point */}
              <LinearGradient id="activeGlow" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.6" />
                <Stop offset="100%" stopColor="#818CF8" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Smooth Gradient Canvas Rect with Rounded Corners */}
            <Rect
              x="0"
              y="0"
              width={svgWidth}
              height={svgHeight}
              rx="16"
              ry="16"
              fill="url(#smoothBgGrad)"
            />

            {/* Horizontal Grid Lines & Values */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const yPos = PAD_TOP + plotH * (1 - frac);
              return (
                <G key={frac}>
                  <Line
                    x1={PAD_LEFT}
                    y1={yPos}
                    x2={svgWidth - PAD_RIGHT}
                    y2={yPos}
                    stroke={isDark ? 'rgba(148,163,184,0.12)' : 'rgba(203,213,225,0.7)'}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={PAD_LEFT + 2}
                    y={yPos - 4}
                    fill={isDark ? '#64748B' : '#94A3B8'}
                    fontSize="9"
                    fontWeight="600"
                  >
                    {Math.round((maxVal * frac) / 1000)}k
                  </SvgText>
                </G>
              );
            })}

            {/* Translucent Area Fills under curves */}
            {areaB ? <Path d={areaB} fill="url(#areaGradB)" /> : null}
            {areaA ? <Path d={areaA} fill="url(#areaGradA)" /> : null}

            {/* Active Vertical Guideline Crosshair */}
            <Line
              x1={xOf(activeIndex)}
              y1={PAD_TOP - 4}
              x2={xOf(activeIndex)}
              y2={bottomY}
              stroke={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.35)'}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />

            {/* Smooth Curves */}
            {pathB ? (
              <Path
                d={pathB}
                fill="none"
                stroke={colorB}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {pathA ? (
              <Path
                d={pathA}
                fill="none"
                stroke={colorA}
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* Interactive Data Point Nodes */}
            {pointsA.map((pt, i) => {
              const isActive = i === activeIndex;
              return (
                <G key={`node-a-${i}`}>
                  {isActive && (
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={14}
                      fill={colorA}
                      opacity={0.25}
                    />
                  )}
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? 6.5 : 4}
                    fill={colorA}
                    stroke={isDark ? '#070C1D' : '#FFFFFF'}
                    strokeWidth={2}
                  />
                </G>
              );
            })}

            {pointsB.map((pt, i) => {
              const isActive = i === activeIndex;
              return (
                <G key={`node-b-${i}`}>
                  {isActive && (
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={13}
                      fill={colorB}
                      opacity={0.25}
                    />
                  )}
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? 6 : 3.5}
                    fill={colorB}
                    stroke={isDark ? '#070C1D' : '#FFFFFF'}
                    strokeWidth={2}
                  />
                </G>
              );
            })}

            {/* X-Axis Labels */}
            {data.map((d, i) => {
              const isSelected = i === activeIndex;
              return (
                <SvgText
                  key={`axis-${i}`}
                  x={xOf(i)}
                  y={bottomY + 18}
                  fill={isSelected ? (isDark ? '#38BDF8' : '#0284C7') : (isDark ? '#64748B' : '#94A3B8')}
                  fontSize="10"
                  fontWeight={isSelected ? 'bold' : '600'}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              );
            })}
          </Svg>

          {/* Interactive Tap Zones over each node */}
          {data.map((_, i) => (
            <TouchableOpacity
              key={`zone-${i}`}
              onPress={() => {
                setSelectedIndex(i);
                setHoverIndex(i);
              }}
              style={{
                position: 'absolute',
                left: xOf(i) - 20,
                top: 0,
                width: 40,
                height: svgHeight,
              }}
              activeOpacity={0.7}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 3,
    marginLeft: 32,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.1)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  liveValueBanner: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  liveDateCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  liveStatusTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveMetricsCol: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  liveMetricItem: {
    alignItems: 'flex-start',
  },
  liveMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  liveMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  emptyContainer: {
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  emptyText: {
    fontStyle: 'italic',
    fontSize: 13,
  },
});
