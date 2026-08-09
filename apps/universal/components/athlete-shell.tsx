import { Ionicons } from "@expo/vector-icons";
import { Href, usePathname, useRouter } from "expo-router";
import { useMemo, type PropsWithChildren, type ComponentProps } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { useAuth } from "@/auth/auth-provider";
import { useUserRoles } from "@/auth/roles-provider";
import { hasRole, type AppRole, type UserRoles } from "@/auth/roles";

type IconName = ComponentProps<typeof Ionicons>["name"];
export type NavigationId =
  | "hoje"
  | "calendario"
  | "progresso"
  | "loja"
  | "perfil"
  | "coach"
  | "coach-equipes"
  | "coach-treinos";

type NavigationItem = {
  id: NavigationId;
  label: string;
  href: Href;
  icon: IconName;
  requiredRole?: AppRole;
};

const navigationItems: NavigationItem[] = [
  { id: "hoje", label: "Hoje", href: "/app/hoje", icon: "today-outline" },
  { id: "calendario", label: "Calendário", href: "/app/calendario", icon: "calendar-outline" },
  { id: "progresso", label: "Progresso", href: "/app/progresso", icon: "stats-chart-outline" },
  { id: "loja", label: "Loja", href: "/app/loja", icon: "bag-handle-outline" },
  { id: "perfil", label: "Perfil", href: "/app/perfil", icon: "person-outline" },
  {
    id: "coach",
    label: "Prescrever",
    href: "/app/coach/calendario",
    icon: "barbell-outline",
    requiredRole: "coach"
  },
  {
    id: "coach-equipes",
    label: "Equipes",
    href: "/app/coach/equipes",
    icon: "people-outline",
    requiredRole: "coach"
  },
  {
    id: "coach-treinos",
    label: "Treinos",
    href: "/app/coach/treinos",
    icon: "library-outline",
    requiredRole: "coach"
  }
];

/** Mantém apenas os destinos permitidos para os papéis do usuário atual. */
export function getVisibleNavigationItems(userRoles: UserRoles): NavigationItem[] {
  return navigationItems.filter((item) => !item.requiredRole || hasRole(userRoles, item.requiredRole));
}

type AthleteShellProps = PropsWithChildren<{
  active: NavigationId;
}>;

export function AthleteShell({ children, active }: AthleteShellProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { userRoles } = useUserRoles();
  const items = useMemo(() => getVisibleNavigationItems(userRoles), [userRoles]);
  const isTrainingContext = active !== "loja" && active !== "perfil";

  function navigate(href: Href) {
    if (pathname !== href) router.push(href);
  }

  return (
    <View style={styles.appRoot}>
      {!isMobile && (
        <Sidebar active={active} items={items} onNavigate={navigate} isTrainingContext={isTrainingContext} />
      )}
      <View style={styles.mainColumn}>
        <TopBar
          isMobile={isMobile}
          isTrainingContext={isTrainingContext}
          userEmail={user?.email}
          onSignOut={() => void signOut()}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, isMobile && styles.mobileScrollContent]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {isMobile && <BottomNavigation active={active} items={items} onNavigate={navigate} />}
      </View>
    </View>
  );
}

type NavigationProps = {
  active: NavigationId;
  items: NavigationItem[];
  onNavigate: (href: Href) => void;
};

function Sidebar({ active, items, onNavigate, isTrainingContext }: NavigationProps & { isTrainingContext: boolean }) {
  return (
    <View style={styles.sidebar}>
      {isTrainingContext ? <TrainingBrand /> : <FitblockTrainingBrand />}
      <View style={styles.sidebarDivider} />
      <Text style={styles.sidebarEyebrow}>ÁREA DO ATLETA</Text>
      <View style={styles.sidebarNav}>
        {items.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={item.id === active}
            onPress={() => onNavigate(item.href)}
          />
        ))}
      </View>
      <View style={styles.sidebarBottom}>
        <View style={styles.sidebarSupportIcon}>
          <Ionicons name="help-outline" size={17} color={colors.canvas} />
        </View>
        <View>
          <Text style={styles.sidebarBottomTitle}>Precisa de ajuda?</Text>
          <Text style={styles.sidebarBottomText}>Fale com a FitBlock</Text>
        </View>
      </View>
    </View>
  );
}

function TopBar({
  isMobile,
  isTrainingContext,
  userEmail,
  onSignOut
}: {
  isMobile: boolean;
  isTrainingContext: boolean;
  userEmail?: string;
  onSignOut: () => void;
}) {
  return (
    <View style={[styles.topBar, isMobile && styles.mobileTopBar]}>
      {isMobile ? (
        isTrainingContext ? <TrainingBrand compact /> : <FitblockTrainingBrand compact />
      ) : (
        <View>
          <Text style={styles.topBarEyebrow}>QUARTA · 05 AGO 2026</Text>
          <Text style={styles.topBarTitle}>Treine com intenção.</Text>
        </View>
      )}
      <View style={styles.topBarActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir notificações"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="notifications-outline" size={21} color={colors.ink} />
          <View style={styles.notificationDot} />
        </Pressable>
        <View style={styles.profileChip}>
          <Text style={styles.profileInitials}>AT</Text>
        </View>
        {!isMobile && <Text style={styles.profileName}>{userEmail?.split("@")[0] ?? "Atleta"}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          testID="sign-out"
          onPress={onSignOut}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function TrainingBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="Coach Híbrido by Fitblock Training"
      accessibilityRole="image"
      style={compact ? styles.mobileBrand : styles.sidebarBrand}
      testID="training-brand"
    >
      <Image
        source={require("../assets/coach-hibrido-mark.webp")}
        style={compact ? styles.mobileBrandMark : styles.sidebarBrandMark}
        resizeMode="contain"
      />
      <View style={compact ? styles.mobileBrandCopy : styles.sidebarBrandCopy}>
        <Image
          source={require("../assets/coach-hibrido-wordmark.webp")}
          style={compact ? styles.mobileBrandWordmark : styles.sidebarBrandWordmark}
          resizeMode="contain"
        />
        <Text style={compact ? styles.mobileBrandByline : styles.sidebarBrandByline}>by Fitblock Training</Text>
      </View>
    </View>
  );
}

function FitblockTrainingBrand({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Image
        source={require("../assets/fitblock-wordmark-black.png")}
        style={styles.mobileFitblockLogo}
        resizeMode="contain"
        accessibilityLabel="FitBlock Training"
      />
    );
  }

  return (
    <View style={styles.sidebarFitblockBrand}>
      <Image
        source={require("../assets/fitblock-wordmark-white.png")}
        style={styles.sidebarFitblockLogo}
        resizeMode="contain"
        accessibilityLabel="FitBlock Training"
      />
    </View>
  );
}

function BottomNavigation({ active, items, onNavigate }: NavigationProps) {
  return (
    <View style={styles.bottomNavigation}>
      {items.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          active={item.id === active}
          onPress={() => onNavigate(item.href)}
          compact
        />
      ))}
    </View>
  );
}

function NavItem({
  item,
  active,
  onPress,
  compact = false
}: {
  item: NavigationItem;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      testID={`nav-${item.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.bottomNavItem : styles.sidebarNavItem,
        active && (compact ? styles.bottomNavItemActive : styles.sidebarNavItemActive),
        pressed && styles.pressed
      ]}
    >
      <Ionicons
        name={item.icon}
        size={compact ? 21 : 20}
        color={active ? colors.fitblockPurple : compact ? colors.textMuted : colors.canvas}
      />
      <Text
        style={[
          compact ? styles.bottomNavLabel : styles.sidebarNavLabel,
          active && (compact ? styles.bottomNavLabelActive : styles.sidebarNavLabelActive)
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    backgroundColor: colors.softCloud,
    flex: 1,
    flexDirection: "row",
    minHeight: "100%"
  },
  mainColumn: {
    flex: 1,
    minWidth: 0
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    alignSelf: "center",
    maxWidth: 1400,
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[8],
    paddingTop: spacing[8],
    width: "100%"
  },
  mobileScrollContent: {
    paddingBottom: 112,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5]
  },
  sidebar: {
    backgroundColor: colors.black,
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    width: 252
  },
  sidebarBrand: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 56,
    paddingHorizontal: spacing[2]
  },
  sidebarBrandMark: {
    height: 36,
    width: 36
  },
  sidebarBrandCopy: {
    flex: 1,
    minWidth: 0
  },
  sidebarBrandWordmark: {
    height: 24,
    width: "100%"
  },
  sidebarBrandByline: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: -1
  },
  sidebarFitblockBrand: {
    alignItems: "flex-start",
    height: 42,
    justifyContent: "center",
    paddingHorizontal: spacing[3]
  },
  sidebarFitblockLogo: {
    height: 27,
    width: 148
  },
  sidebarDivider: {
    backgroundColor: colors.graphite,
    height: 1,
    marginBottom: spacing[8],
    marginTop: spacing[4]
  },
  sidebarEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3]
  },
  sidebarNav: {
    gap: spacing[2]
  },
  sidebarNavItem: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[3]
  },
  sidebarNavItemActive: {
    backgroundColor: colors.graphite,
    borderLeftColor: colors.fitblockPurple,
    borderLeftWidth: 3
  },
  sidebarNavLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    fontWeight: "600"
  },
  sidebarNavLabelActive: {
    color: colors.canvas
  },
  sidebarBottom: {
    alignItems: "center",
    borderTopColor: colors.graphite,
    borderTopWidth: 1,
    bottom: spacing[5],
    flexDirection: "row",
    gap: spacing[3],
    left: spacing[3],
    paddingTop: spacing[4],
    position: "absolute",
    right: spacing[3]
  },
  sidebarSupportIcon: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  sidebarBottomTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "700"
  },
  sidebarBottomText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    marginTop: 2
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 82,
    paddingHorizontal: spacing[8]
  },
  mobileTopBar: {
    minHeight: 70,
    paddingHorizontal: spacing[4]
  },
  mobileBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1]
  },
  mobileBrandMark: {
    height: 28,
    width: 28
  },
  mobileBrandCopy: {
    width: 82
  },
  mobileBrandWordmark: {
    height: 17,
    width: 82
  },
  mobileBrandByline: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.1,
    lineHeight: 9,
    marginTop: -1
  },
  mobileFitblockLogo: {
    height: 25,
    width: 126
  },
  topBarEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 4
  },
  topBarTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  topBarActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  iconButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44
  },
  notificationDot: {
    backgroundColor: colors.fitblockPurple,
    borderColor: colors.canvas,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 9,
    position: "absolute",
    right: 8,
    top: 8,
    width: 9
  },
  profileChip: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  profileInitials: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800"
  },
  profileName: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: spacing[1]
  },
  bottomNavigation: {
    alignItems: "stretch",
    backgroundColor: colors.canvas,
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    left: 0,
    paddingBottom: Platform.OS === "ios" ? 18 : 8,
    paddingTop: 8,
    position: "absolute",
    right: 0
  },
  bottomNavItem: {
    alignItems: "center",
    borderRadius: radius.sm,
    gap: 3,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 58,
    paddingHorizontal: 4
  },
  bottomNavItemActive: {
    backgroundColor: "#F0EBFF"
  },
  bottomNavLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "700"
  },
  bottomNavLabelActive: {
    color: colors.fitblockPurple
  },
  pressed: {
    opacity: 0.72
  }
});
