import { type PropsWithChildren, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { fontFamilies, motion, type ThemeColors } from "@fitblock/design-tokens";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useAppTheme } from "@/theme/theme-provider";

type TabOption<T extends string> = {
  accessibilityLabel?: string;
  label: string;
  testID?: string;
  value: T;
};

type AnimatedTabBarProps<T extends string> = {
  activeTabStyle?: StyleProp<ViewStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  label?: string;
  options: readonly TabOption<T>[];
  onChange: (next: T) => void;
  renderTabContent?: (option: TabOption<T>, active: boolean, index: number) => ReactNode;
  tabStyle?: StyleProp<ViewStyle>;
  testID?: string;
  textStyle?: StyleProp<TextStyle>;
  value: T;
};

const tabEasing = Easing.bezier(...motion.tab.easing);

/** Indicador compartilhado: o estado muda imediatamente e só a confirmação se anima. */
export function AnimatedTabBar<T extends string>({
  activeTabStyle,
  activeTextStyle,
  containerStyle,
  label,
  onChange,
  options,
  renderTabContent,
  tabStyle,
  testID,
  textStyle,
  value
}: AnimatedTabBarProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const progress = useRef(new Animated.Value(activeIndex)).current;
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(activeIndex);
      return;
    }

    const animation = Animated.timing(progress, {
      duration: motion.tab.enterMs,
      easing: tabEasing,
      toValue: activeIndex,
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, progress, reducedMotion]);

  const tabWidth = options.length > 0 ? barWidth / options.length : 0;
  const translateX = Animated.multiply(progress, tabWidth);
  const onLayout = (event: LayoutChangeEvent) => setBarWidth(event.nativeEvent.layout.width);

  return (
    <View accessibilityLabel={label} accessibilityRole="tablist" onLayout={onLayout} style={[styles.bar, containerStyle]} testID={testID}>
      {barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { transform: [{ translateX }], width: tabWidth }]}
          testID={testID ? `${testID}-indicator` : undefined}
        />
      )}
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.accessibilityLabel ?? `Ver ${option.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) onChange(option.value);
            }}
            style={({ pressed }) => [styles.tab, tabStyle, active && activeTabStyle, pressed && styles.pressed]}
            testID={option.testID}
          >
            {renderTabContent ? (
              renderTabContent(option, active, index)
            ) : (
              <Text style={[styles.text, textStyle, active && styles.textActive, active && activeTextStyle]}>{option.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type TabTransitionPanelProps = PropsWithChildren<{
  activeKey: string;
  enabled?: boolean;
  order?: readonly string[];
  reducedMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/** Painel de eixo compartilhado: 8 dp, opacidade sutil e cancelamento em troca rápida. */
export function TabTransitionPanel({ activeKey, children, enabled = true, order, reducedMotion: reducedMotionOverride, style, testID }: TabTransitionPanelProps) {
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionOverride ?? systemReducedMotion;
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const previousKey = useRef(activeKey);

  useEffect(() => {
    opacity.stopAnimation();
    translateX.stopAnimation();

    if (!enabled || reducedMotion) {
      previousKey.current = activeKey;
      opacity.setValue(1);
      translateX.setValue(0);
      return;
    }

    if (previousKey.current === activeKey) return;

    const previousIndex = order?.indexOf(previousKey.current) ?? 0;
    const activeIndex = order?.indexOf(activeKey) ?? previousIndex + 1;
    const direction = activeIndex >= previousIndex ? 1 : -1;
    previousKey.current = activeKey;

    opacity.setValue(0.78);
    translateX.setValue(direction * motion.tab.offset);
    const animation = Animated.parallel([
      Animated.timing(opacity, { duration: motion.tab.exitMs, easing: tabEasing, toValue: 1, useNativeDriver: true }),
      Animated.timing(translateX, { duration: motion.tab.enterMs, easing: tabEasing, toValue: 0, useNativeDriver: true })
    ]);
    animation.start();
    return () => animation.stop();
  }, [activeKey, enabled, opacity, order, reducedMotion, translateX]);

  if (!enabled) return <>{children}</>;

  return <Animated.View style={[style, { opacity, transform: [{ translateX }] }]} testID={testID}>{children}</Animated.View>;
}

/** A confirmação da aba mobile é contida no item; nunca desloca a barra ou a tela. */
export function TabSelectionMotion({ active, children }: PropsWithChildren<{ active: boolean }>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const selection = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    selection.stopAnimation();
    if (reducedMotion) {
      selection.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.timing(selection, {
      duration: motion.tab.pressMs,
      easing: tabEasing,
      toValue: active ? 1 : 0,
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [active, reducedMotion, selection]);

  const scale = selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  return <Animated.View style={[styles.selectionContent, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: { flexDirection: "row", position: "relative" },
    indicator: { backgroundColor: colors.purple500, bottom: 0, height: 3, left: 0, position: "absolute" },
    tab: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 48 },
    text: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 16 },
    textActive: { color: colors.textPrimary },
    selectionContent: { alignItems: "center", justifyContent: "center" },
    pressed: { opacity: 0.76 }
  });
}
