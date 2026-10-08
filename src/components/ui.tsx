import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { addDays, formatDayLabel, todayKey } from '../lib/date';
import { useColors, useStyles } from './ThemeContext';
import { radius, spacing, type Colors } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles(createStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max;
  return (
    <View style={styles.track}>
      <View
        style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.danger : color }]}
      />
    </View>
  );
}

export function MacroRow({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.muted}>
          {Math.round(value)} / {goal} {unit}
        </Text>
      </View>
      <ProgressBar value={value} max={goal} color={color} />
    </View>
  );
}

export function DateSwitcher({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const isToday = date === todayKey();
  return (
    <View style={styles.dateRow}>
      <Pressable hitSlop={12} onPress={() => onChange(addDays(date, -1))} accessibilityLabel="Vorheriger Tag">
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </Pressable>
      <Pressable onPress={() => onChange(todayKey())}>
        <Text style={styles.dateLabel}>{formatDayLabel(date)}</Text>
      </Pressable>
      <Pressable
        hitSlop={12}
        disabled={isToday}
        onPress={() => onChange(addDays(date, 1))}
        accessibilityLabel="Nächster Tag"
      >
        <Ionicons name="chevron-forward" size={24} color={isToday ? colors.border : colors.primary} />
      </Pressable>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  return (
    <View style={{ marginBottom: spacing.md, flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
      />
    </View>
  );
}

/** Kompaktes Zahlenfeld ohne Label (z. B. für Satz-Tabellen). */
export function SmallInput(props: TextInputProps) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      keyboardType="decimal-pad"
      selectTextOnFocus
      {...props}
      style={[styles.input, styles.smallInput, props.style]}
    />
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.primarySoft;
  const fg = variant === 'secondary' ? colors.primary : colors.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 6 }} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const fg = selected ? colors.onPrimary : colors.text;
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {icon && <Ionicons name={icon} size={14} color={fg} style={{ marginRight: 4 }} />}
      <Text style={{ color: fg, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Umschalter zwischen zwei oder mehr Ansichten. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segment, value === o.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.border} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: IconName }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name={icon} size={30} color={colors.onPrimary} />
    </Pressable>
  );
}

/** Rundes Icon mit Hintergrund (Listen-Einträge). */
export function IconBadge({ icon, filled }: { icon: IconName; filled?: boolean }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  return (
    <View style={[styles.iconBadge, filled && { backgroundColor: colors.primary }]}>
      <Ionicons name={icon} size={22} color={filled ? colors.onPrimary : colors.primary} />
    </View>
  );
}

/** Wandelt Eingaben wie "12,5" in Zahlen um. */
export function parseNumber(text: string): number {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Formatiert Zahlen mit deutschem Dezimalkomma, ohne unnötige Nachkommastellen. */
export function formatNumber(n: number, maxDecimals = 1): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: maxDecimals });
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: c.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    track: { height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 4 },
    macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    macroLabel: { color: c.text, fontWeight: '600' },
    muted: { color: c.muted },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    dateLabel: { fontSize: 18, fontWeight: '700', color: c.text },
    fieldLabel: { color: c.muted, marginBottom: 4, fontSize: 13 },
    input: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
    },
    inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
    smallInput: { paddingVertical: 6, paddingHorizontal: spacing.sm, textAlign: 'center', minWidth: 56 },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
    },
    buttonText: { fontSize: 16, fontWeight: '600' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    segmented: {
      flexDirection: 'row',
      backgroundColor: c.cardAlt,
      borderRadius: radius.md,
      padding: 3,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
    segmentActive: { backgroundColor: c.card, shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
    segmentText: { color: c.muted, fontWeight: '600' },
    segmentTextActive: { color: c.text },
    empty: { alignItems: 'center', padding: spacing.xl },
    emptyText: { color: c.muted, marginTop: spacing.sm, textAlign: 'center' },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: c.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
  });
