import { Ionicons } from "@expo/vector-icons";
import { Href, usePathname, useRouter } from "expo-router";
import { useMemo, useState, type PropsWithChildren, type ComponentProps } from "react";
import {
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
  | "meus-treinos"
  | "perfil"
  | "coach"
  | "coach-equipes"
  | "coach-treinos"
  | "coach-financeiro"
  | "coach-produtos";

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
  { id: "meus-treinos", label: "Meus Treinos", href: "/app/meus-treinos", icon: "barbell-outline" },
  { id: "perfil", label: "Perfil", href: "/app/perfil", icon: "person-outline" },
  {
    id: "coach",
    label: "Agenda",
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
    label: "Biblioteca",
    href: "/app/coach/treinos",
    icon: "library-outline",
    requiredRole: "coach"
  },
  {
    id: "coach-financeiro",
    label: "Financeiro",
    href: "/app/coach/financeiro",
    icon: "wallet-outline",
    requiredRole: "coach"
  },
  {
    id: "coach-produtos",
    label: "Meus Produtos",
    href: "/app/coach/produtos",
    icon: "pricetags-outline",
    requiredRole: "coach"
  }
];

/** Mantém apenas os destinos permitidos para os papéis do usuário atual. */
export function getVisibleNavigationItems(userRoles: UserRoles): NavigationItem[] {
  return navigationItems.filter((item) => !item.requiredRole || hasRole(userRoles, item.requiredRole));
}

type AthleteShellProps = PropsWithChildren<{
  active: NavigationId;
  /** A tela Hoje usa o chrome de painel editorial da composição C. */
  editorial?: boolean;
}>;

export function AthleteShell({ children, active, editorial = false }: AthleteShellProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { userRoles } = useUserRoles();
  const items = useMemo(() => getVisibleNavigationItems(userRoles), [userRoles]);
  // Loja, perfil e financeiro não são o contexto de treino: exibem a marca FitBlock, não a do
  // Coach Híbrido.
  const isTrainingContext =
    active !== "loja"
    && active !== "meus-treinos"
    && active !== "perfil"
    && active !== "coach-financeiro"
    && active !== "coach-produtos";

  function navigate(href: Href) {
    if (pathname !== href) router.push(href);
  }

  return (
    <View style={styles.appRoot}>
      {!isMobile && (
        <Sidebar
          active={active}
          items={items}
          onNavigate={navigate}
          isTrainingContext={isTrainingContext}
          editorial={editorial}
          onSignOut={() => void signOut()}
        />
      )}
      <View style={[styles.mainColumn, editorial && styles.editorialMainColumn]}>
        <TopBar
          editorial={editorial}
          isMobile={isMobile}
          isTrainingContext={isTrainingContext}
          userEmail={user?.email}
          onSignOut={() => void signOut()}
        />
        <ScrollView
          style={[styles.scroll, editorial && styles.editorialScroll]}
          contentContainerStyle={[
            styles.scrollContent,
            editorial && styles.editorialScrollContent,
            isMobile && styles.mobileScrollContent
          ]}
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

function Sidebar({
  active,
  items,
  onNavigate,
  isTrainingContext,
  editorial,
  onSignOut
}: NavigationProps & { isTrainingContext: boolean; editorial: boolean; onSignOut: () => void }) {
  return (
    <View style={styles.sidebar}>
      {editorial || !isTrainingContext ? <FitblockTrainingBrand /> : <TrainingBrand />}
      <View style={styles.sidebarDivider} />
      <Text style={styles.sidebarEyebrow}>ÁREA DO ATLETA</Text>
      <ScrollView
        style={styles.sidebarNavScroll}
        contentContainerStyle={styles.sidebarNav}
        showsVerticalScrollIndicator={false}
        testID="sidebar-nav-scroll"
      >
        {items.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={item.id === active}
            onPress={() => onNavigate(item.href)}
          />
        ))}
      </ScrollView>
      <View style={styles.sidebarBottom} testID="sidebar-bottom">
        <View style={styles.sidebarHelp}>
          <View style={styles.sidebarSupportIcon}>
            <Ionicons name="help-outline" size={17} color={colors.white} />
          </View>
          <View>
            <Text style={styles.sidebarBottomTitle}>Precisa de ajuda?</Text>
            <Text style={styles.sidebarBottomText}>Fale com a FitBlock</Text>
          </View>
        </View>
        <SidebarSignOut onSignOut={onSignOut} />
      </View>
    </View>
  );
}

/** "atleta.silva@fitblock.com" → "Atleta". Sem sobrenome cadastrado, o primeiro nome basta. */
function deriveDisplayName(email?: string): string {
  const localPart = email?.split("@")[0] ?? "";
  const firstToken = localPart.split(/[._-]/)[0] || "atleta";
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

/** "atleta.silva@fitblock.com" → "AS". Iniciais reais no lugar de um placeholder fixo. */
function deriveInitials(email?: string): string {
  const localPart = email?.split("@")[0] ?? "";
  const tokens = localPart.split(/[._-]/).filter(Boolean);

  if (tokens.length === 0) return "AT";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();

  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

function TopBar({
  editorial,
  isMobile,
  isTrainingContext,
  userEmail,
  onSignOut
}: {
  editorial: boolean;
  isMobile: boolean;
  isTrainingContext: boolean;
  userEmail?: string;
  onSignOut: () => void;
}) {
  const initials = deriveInitials(userEmail);

  return (
    <View style={[styles.topBar, isMobile && styles.mobileTopBar]}>
      {editorial ? (
        <Text style={styles.topBarGreeting} testID="topbar-greeting">
          Olá, {deriveDisplayName(userEmail)}!
        </Text>
      ) : isMobile ? (
        isTrainingContext ? <TrainingBrand compact /> : <FitblockTrainingBrand compact />
      ) : (
        <View>
          <Text style={styles.topBarEyebrow}>QUARTA · 05 AGO 2026</Text>
          <Text style={styles.topBarTitle}>Treine com intenção.</Text>
        </View>
      )}
      <View style={styles.topBarActions}>
        <HeaderIconButton
          accessibilityLabel="Abrir notificações"
        >
          <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
          <View style={styles.notificationDot} />
        </HeaderIconButton>
        <View style={styles.profileChip}>
          <Text style={styles.profileInitials}>{initials}</Text>
        </View>
        {!isMobile && !editorial && <Text style={styles.profileName}>{userEmail?.split("@")[0] ?? "Atleta"}</Text>}
        <HeaderIconButton
          accessibilityLabel="Sair da conta"
          testID="sign-out"
          onPress={onSignOut}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
        </HeaderIconButton>
      </View>
    </View>
  );
}

function HeaderIconButton({
  accessibilityLabel,
  children,
  onPress,
  testID
}: PropsWithChildren<{
  accessibilityLabel: string;
  onPress?: () => void;
  testID?: string;
}>) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, isFocused && styles.focusedIconButton, pressed && styles.pressed]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function SidebarSignOut({ onSignOut }: { onSignOut: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sair da conta"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onSignOut}
      style={({ pressed }) => [styles.sidebarSignOut, isFocused && styles.focusedSidebarSignOut, pressed && styles.pressed]}
      testID="sign-out"
    >
      <Ionicons name="log-out-outline" size={16} color={colors.textSecondary} />
      <Text style={styles.sidebarSignOutText}>Sair</Text>
    </Pressable>
  );
}

function TrainingBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="Coach Híbrido by FitBlock"
      accessibilityRole="image"
      style={compact ? styles.mobileBrand : styles.sidebarBrand}
      testID="training-brand"
    >
      <View style={styles.brandDot} />
      <View style={compact ? styles.mobileBrandCopy : styles.sidebarBrandCopy}>
        <Text style={compact ? styles.mobileWordmark : styles.sidebarWordmark}>FITBLOCK</Text>
        <Text style={compact ? styles.mobileBrandByline : styles.sidebarBrandByline}>COACH HÍBRIDO</Text>
      </View>
    </View>
  );
}

function FitblockTrainingBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="FitBlock"
      accessibilityRole="image"
      style={compact ? styles.mobileBrand : styles.sidebarFitblockBrand}
    >
      <View style={styles.brandDot} />
      <Text style={compact ? styles.mobileWordmark : styles.sidebarWordmark}>FITBLOCK</Text>
    </View>
  );
}

function BottomNavigation({ active, items, onNavigate }: NavigationProps) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const primaryItems = items.slice(0, 4);
  const overflowItems = items.slice(4);
  const isOverflowActive = overflowItems.some((item) => item.id === active);

  return (
    <>
      {isOverflowOpen && overflowItems.length > 0 && (
        <View style={styles.bottomOverflowPanel} testID="bottom-nav-overflow">
          <Text style={styles.bottomOverflowTitle}>MAIS OPÇÕES</Text>
          {overflowItems.map((item) => (
            <OverflowNavItem
              key={item.id}
              item={item}
              active={item.id === active}
              onPress={() => {
                setIsOverflowOpen(false);
                onNavigate(item.href);
              }}
            />
          ))}
        </View>
      )}
      <View style={styles.bottomNavigation}>
        {primaryItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={item.id === active}
            onPress={() => onNavigate(item.href)}
            compact
          />
        ))}
        {overflowItems.length > 0 && (
          <OverflowButton
            active={isOverflowActive || isOverflowOpen}
            expanded={isOverflowOpen}
            onPress={() => setIsOverflowOpen((open) => !open)}
          />
        )}
      </View>
    </>
  );
}

function OverflowButton({ active, expanded, onPress }: { active: boolean; expanded: boolean; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mais opções de navegação"
      accessibilityState={{ expanded, selected: active }}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bottomNavItem,
        active && styles.bottomNavItemActive,
        isFocused && styles.focusedBottomNavItem,
        pressed && styles.pressed
      ]}
      testID="nav-more"
    >
      <Ionicons name="ellipsis-horizontal" size={21} color={active ? colors.purple400 : colors.textSecondary} />
      <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>Mais</Text>
    </Pressable>
  );
}

function OverflowNavItem({
  item,
  active,
  onPress
}: {
  item: NavigationItem;
  active: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.overflowNavItem,
        active && styles.overflowNavItemActive,
        isFocused && styles.focusedOverflowNavItem,
        pressed && styles.pressed
      ]}
      testID={`nav-${item.id}`}
    >
      <Ionicons name={item.icon} size={20} color={active ? colors.purple400 : colors.textPrimary} />
      <Text style={[styles.overflowNavLabel, active && styles.overflowNavLabelActive]}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
    </Pressable>
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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      testID={`nav-${item.id}`}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.bottomNavItem : styles.sidebarNavItem,
        isFocused && (compact ? styles.focusedBottomNavItem : styles.focusedSidebarNavItem),
        active && (compact ? styles.bottomNavItemActive : styles.sidebarNavItemActive),
        pressed && styles.pressed
      ]}
    >
      <Ionicons
        name={item.icon}
        size={compact ? 21 : 20}
        color={active ? colors.purple400 : colors.textSecondary}
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
    backgroundColor: colors.bgDeep,
    flex: 1,
    flexDirection: "row",
    minHeight: "100%"
  },
  mainColumn: {
    flex: 1,
    minWidth: 0
  },
  editorialMainColumn: {
    backgroundColor: colors.bg
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.bg
  },
  editorialScroll: {
    backgroundColor: colors.bg
  },
  scrollContent: {
    alignSelf: "center",
    maxWidth: 1400,
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[8],
    paddingTop: spacing[8],
    width: "100%"
  },
  editorialScrollContent: {
    maxWidth: 760,
    paddingBottom: spacing[6],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5]
  },
  mobileScrollContent: {
    paddingBottom: 112,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5]
  },
  sidebar: {
    backgroundColor: colors.bgDeep,
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    width: 200
  },
  sidebarBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 64,
    paddingHorizontal: spacing[3]
  },
  brandDot: {
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: 10,
    width: 10
  },
  sidebarBrandCopy: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0
  },
  sidebarWordmark: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 20,
    letterSpacing: 0.3
  },
  mobileWordmark: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 17,
    letterSpacing: 0.3
  },
  sidebarBrandByline: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 1
  },
  sidebarFitblockBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    height: 56,
    paddingHorizontal: spacing[3]
  },
  sidebarDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginBottom: spacing[6],
    marginTop: spacing[4]
  },
  sidebarEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
    textTransform: "uppercase"
  },
  sidebarNavScroll: {
    flex: 1
  },
  sidebarNav: {
    gap: spacing[1]
  },
  sidebarNavItem: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 52,
    paddingHorizontal: spacing[3]
  },
  sidebarNavItemActive: {
    backgroundColor: colors.surface03,
    borderColor: colors.borderPurple,
    borderWidth: 1
  },
  sidebarNavLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 14
  },
  sidebarNavLabelActive: {
    color: colors.textPrimary
  },
  sidebarBottom: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[3],
    marginTop: spacing[3],
    paddingTop: spacing[4]
  },
  sidebarHelp: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3]
  },
  sidebarSupportIcon: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  sidebarBottomTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  sidebarBottomText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    marginTop: 2
  },
  sidebarSignOut: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  focusedSidebarSignOut: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  sidebarSignOutText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.bg,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 82,
    paddingHorizontal: spacing[8]
  },
  mobileTopBar: {
    backgroundColor: colors.bgDeep,
    minHeight: 70,
    paddingHorizontal: spacing[4]
  },
  mobileBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  mobileBrandCopy: {
    justifyContent: "center"
  },
  mobileBrandByline: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 8,
    letterSpacing: 0.6,
    marginTop: 0
  },
  topBarEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  topBarTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 24,
    letterSpacing: 0.2
  },
  topBarGreeting: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 26,
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
  focusedIconButton: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  notificationDot: {
    backgroundColor: colors.purple500,
    borderColor: colors.bg,
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
    backgroundColor: colors.purple700,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  profileInitials: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11
  },
  profileName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13,
    marginLeft: spacing[1]
  },
  bottomNavigation: {
    alignItems: "stretch",
    backgroundColor: colors.bgDeep,
    borderTopColor: colors.border,
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
    borderRadius: radius.md,
    gap: 3,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 58,
    paddingHorizontal: 4
  },
  focusedBottomNavItem: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  bottomNavItemActive: {
    backgroundColor: colors.bg
  },
  bottomNavLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10
  },
  bottomNavLabelActive: {
    color: colors.purple500
  },
  bottomOverflowPanel: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    bottom: Platform.OS === "ios" ? 88 : 76,
    gap: spacing[1],
    left: spacing[4],
    padding: spacing[3],
    position: "absolute",
    right: spacing[4]
  },
  bottomOverflowTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1]
  },
  overflowNavItem: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[2]
  },
  overflowNavItemActive: {
    backgroundColor: colors.bgDeep
  },
  focusedOverflowNavItem: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  overflowNavLabel: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 14
  },
  overflowNavLabelActive: {
    color: colors.purple500
  },
  focusedSidebarNavItem: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  pressed: {
    opacity: 0.72
  }
});
