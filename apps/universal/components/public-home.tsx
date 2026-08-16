/*
 * FitBlock — Public Home / Dark Performance
 *
 * THESIS: performance becomes visible through real training media, decisive type and a
 * graphite environment; the page refuses a generic grid of equal marketing cards.
 * OWN-WORLD: #050507–#252530 graphite layers, Barlow Condensed display, Inter UI and a
 * selective FitBlock-purple signal for actions, focus and editorial emphasis.
 * STORY: a first-time visitor recognizes the FitBlock method, finds a fitting path and can
 * enter the existing app without losing the current navigation or published content.
 * FIRST VIEWPORT: training media owns the field; a protected left reading column carries the
 * title and the two existing actions, while the compact header keeps entry always reachable.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { createElement, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
  useWindowDimensions
} from "react-native";
import { colors, fontFamilies, layout, motion, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { ExperienceCard } from "@/components/experience-card";
import {
  editorialPosts,
  featuredCamps,
  featuredPrograms,
  homeNavigation,
  type HomeSectionId
} from "@/data/home";
import { homePillars } from "@/data/homePillars";

const wordmarkWhite = require("@/assets/fitblock-wordmark-white.png");
const fitblockMark = require("@/assets/fitblock-mark.png");
const heroVideoAsset = require("@/assets/hero.mp4");
const methodImages: ImageSourcePropType[] = [
  require("@/assets/mari-card.png"),
  require("@/assets/time-community.webp"),
  require("@/assets/dali-card.png")
];
const finalCtaImage = require("@/assets/tt1.png");
const finalCtaMobileImage = require("@/assets/tt2.png");

const disciplines = ["FORÇA", "SKILL", "ENDURANCE", "MOBILIDADE", "COMUNIDADE"];
const imageTextShadow = { textShadow: "0px 2px 10px rgba(0, 0, 0, 0.72)" } as unknown as TextStyle;

type HeadingLine = { text: string; accent?: boolean };
type SectionTone = "base" | "elevated" | "deep";
type CtaVariant = "primary" | "secondary" | "light";

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) {
          setReducedMotion(value);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reducedMotion;
}

function DisplayHeading({
  lines,
  size,
  color = colors.textPrimary,
  reveal,
  style,
  accessibilityRole = "header"
}: {
  lines: HeadingLine[];
  size: number;
  color?: string;
  reveal?: Animated.Value;
  style?: ViewStyle;
  accessibilityRole?: "header" | "none";
}) {
  const lineHeight = Math.round(size * 0.9);
  const horizontalPadding = Math.round(size * 0.12);

  return (
    <View style={[styles.headingStack, style]} accessibilityRole={accessibilityRole}>
      {lines.map((line, index) =>
        line.accent ? (
          <View
            key={`${line.text}-${index}`}
            style={[
              styles.headingAccent,
              { paddingHorizontal: horizontalPadding, paddingTop: Math.round(size * 0.06) }
            ]}
          >
            {reveal ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.headingAccentFill,
                  { transform: [{ scaleX: reveal }] }
                ]}
              />
            ) : (
              <View pointerEvents="none" style={styles.headingAccentFill} />
            )}
            <Text
              style={[
                styles.displayText,
                { fontSize: size, lineHeight, color: colors.white }
              ]}
            >
              {line.text}
            </Text>
          </View>
        ) : (
          <Text
            key={`${line.text}-${index}`}
            style={[styles.displayText, { fontSize: size, lineHeight, color }]}
          >
            {line.text}
          </Text>
        )
      )}
    </View>
  );
}

function SolidLabel({ label, style }: { label: string; style?: ViewStyle }) {
  return (
    <View style={[styles.solidLabel, style]}>
      <Text style={styles.solidLabelText}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  accessibilityLabel,
  variant = "primary",
  testID,
  fullWidth = false,
  style
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  variant?: CtaVariant;
  testID?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const [focused, setFocused] = useState(false);
  const isLight = variant === "light";
  const labelColor = isLight ? colors.bgDeep : colors.white;
  const arrowColor = variant === "primary" ? colors.white : colors.purple400;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === "primary" && styles.actionButtonPrimary,
        variant === "secondary" && styles.actionButtonSecondary,
        isLight && styles.actionButtonLight,
        fullWidth && styles.actionButtonFullWidth,
        focused && (isLight ? styles.focusOnLight : styles.focusOnDark),
        pressed && styles.pressed,
        style
      ]}
    >
      <Text style={[styles.actionButtonText, { color: labelColor }]}>{label}</Text>
      <View style={[styles.actionIcon, isLight && styles.actionIconLight]}>
        <Ionicons name="arrow-forward" size={17} color={arrowColor} />
      </View>
    </Pressable>
  );
}

function WatermarkField() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={styles.watermark}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Image
          key={`fitblock-mark-${index}`}
          source={fitblockMark}
          resizeMode="contain"
          style={[
            styles.watermarkMark,
            index % 2 === 1 && styles.watermarkMarkOffset,
            { top: 52 + Math.floor(index / 2) * 176 }
          ]}
        />
      ))}
    </View>
  );
}

function Section({
  tone = "base",
  children,
  testID,
  style
}: {
  tone?: SectionTone;
  children: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;

  return (
    <View
      testID={testID}
      style={[
        styles.section,
        tone === "elevated" && styles.sectionElevated,
        tone === "deep" && styles.sectionDeep
      ]}
    >
      <View style={[styles.sectionInner, isMobile && styles.sectionInnerMobile, style]}>{children}</View>
    </View>
  );
}

function SectionHead({
  lines,
  description,
  tone = "dark"
}: {
  lines: HeadingLine[];
  description: string;
  tone?: "dark" | "light";
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;
  const titleSize = isMobile ? (width < 360 ? 38 : 44) : 60;

  return (
    <View style={[styles.sectionHead, isMobile && styles.sectionHeadMobile]}>
      <DisplayHeading
        lines={lines}
        size={titleSize}
        color={tone === "dark" ? colors.textPrimary : colors.textPrimary}
        style={styles.sectionHeading}
      />
      <Text style={[styles.sectionDescription, isMobile && styles.sectionDescriptionMobile]}>{description}</Text>
    </View>
  );
}

export function PublicHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < layout.breakpoint.desktop;
  const [menuOpen, setMenuOpen] = useState(false);
  const sectionOffsets = useRef<Partial<Record<HomeSectionId, number>>>({});
  const scrollRef = useRef<ScrollView>(null);

  function navigateToSection(id: HomeSectionId) {
    setMenuOpen(false);
    if (id === "inicio") {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const offset = sectionOffsets.current[id];
    if (typeof offset === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, offset - spacing[4]), animated: true });
    }
  }

  function openApp() {
    setMenuOpen(false);
    router.push("/entrar");
  }

  function saveSectionOffset(id: HomeSectionId) {
    return (event: { nativeEvent: { layout: { y: number } } }) => {
      sectionOffsets.current[id] = event.nativeEvent.layout.y;
    };
  }

  return (
    <View style={styles.root} testID="public-home-dark-performance">
      <PublicHeader
        isCompact={isCompact}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((current) => !current)}
        onNavigate={navigateToSection}
        onOpenApp={openApp}
      />
      {isCompact && menuOpen ? <MobileMenu onNavigate={navigateToSection} onOpenApp={openApp} /> : null}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setMenuOpen(false)}
      >
        <View onLayout={saveSectionOffset("inicio")}>
          <Hero onExplore={() => navigateToSection("programas")} onOpenApp={openApp} />
        </View>
        <DisciplineBand />
        <View onLayout={saveSectionOffset("acompanhamento")}>
          <MethodSection onExplore={() => navigateToSection("programas")} />
        </View>
        <View onLayout={saveSectionOffset("programas")}>
          <ProgramsSection onOpenApp={openApp} />
        </View>
        <View onLayout={saveSectionOffset("camps")}>
          <ExperiencesSection />
        </View>
        <View onLayout={saveSectionOffset("conteudo")}>
          <ContentSection />
        </View>
        <View onLayout={saveSectionOffset("loja")}>
          <FinalCta onOpenApp={openApp} />
        </View>
        <PublicFooter onNavigate={navigateToSection} onOpenApp={openApp} />
      </ScrollView>
    </View>
  );
}

function PublicHeader({
  isCompact,
  menuOpen,
  onMenuToggle,
  onNavigate,
  onOpenApp
}: {
  isCompact: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onNavigate: (id: HomeSectionId) => void;
  onOpenApp: () => void;
}) {
  const [focusedControl, setFocusedControl] = useState<"login" | "menu" | "cta" | null>(null);

  return (
    <View style={[styles.header, isCompact && styles.headerCompact]}>
      <Image
        source={wordmarkWhite}
        resizeMode="contain"
        accessibilityLabel="FitBlock Training"
        style={[styles.headerLogo, isCompact && styles.headerLogoCompact]}
      />
      {!isCompact ? (
        <View style={styles.desktopNav}>
          {homeNavigation.map((item) => (
            <NavigationLink key={item.id} label={item.label} onPress={() => onNavigate(item.id)} />
          ))}
        </View>
      ) : (
        <View style={styles.compactActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar no app FitBlock"
            onBlur={() => setFocusedControl(null)}
            onFocus={() => setFocusedControl("login")}
            onPress={onOpenApp}
            style={({ pressed }) => [
              styles.compactLogin,
              focusedControl === "login" && styles.compactLoginFocused,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.compactLoginText}>Entrar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? "Fechar menu" : "Abrir menu"}
            accessibilityState={{ expanded: menuOpen }}
            testID="public-menu-toggle"
            onBlur={() => setFocusedControl(null)}
            onFocus={() => setFocusedControl("menu")}
            onPress={onMenuToggle}
            style={({ pressed }) => [
              styles.menuButton,
              focusedControl === "menu" && styles.menuButtonFocused,
              pressed && styles.pressed
            ]}
          >
            <Ionicons name={menuOpen ? "close" : "menu"} size={22} color={colors.white} />
          </Pressable>
        </View>
      )}
      {!isCompact ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Entrar no app FitBlock"
          onBlur={() => setFocusedControl(null)}
          onFocus={() => setFocusedControl("cta")}
          onPress={onOpenApp}
          style={({ pressed }) => [
            styles.headerCta,
            focusedControl === "cta" && styles.headerCtaFocused,
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.headerCtaText}>Entrar no app</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

function NavigationLink({ label, onPress }: { label: string; onPress: () => void }) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Ir para ${label}`}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setFocused(true)}
      onHoverOut={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [styles.navigationLink, focused && styles.navigationLinkFocused, pressed && styles.pressed]}
    >
      <Text style={styles.navigationLinkText}>{label}</Text>
    </Pressable>
  );
}

function MobileMenu({
  onNavigate,
  onOpenApp
}: {
  onNavigate: (id: HomeSectionId) => void;
  onOpenApp: () => void;
}) {
  return (
    <View style={styles.mobileMenu} accessibilityViewIsModal>
      {homeNavigation.map((item) => (
        <MobileNavigationLink key={item.id} label={item.label} onPress={() => onNavigate(item.id)} />
      ))}
      <ActionButton
        label="Entrar no app"
        accessibilityLabel="Entrar no app FitBlock"
        onPress={onOpenApp}
        fullWidth
        style={styles.mobileMenuCta}
      />
    </View>
  );
}

function MobileNavigationLink({ label, onPress }: { label: string; onPress: () => void }) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Ir para ${label}`}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.mobileMenuLink, focused && styles.mobileMenuLinkFocused, pressed && styles.pressed]}
    >
      <Text style={styles.mobileMenuLinkText}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.purple400} />
    </Pressable>
  );
}

function Hero({ onExplore, onOpenApp }: { onExplore: () => void; onOpenApp: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;
  const isNarrow = width < 360;
  const reduceMotion = useReducedMotion();
  const reveal = useRef(new Animated.Value(0)).current;
  const titleSize = isNarrow ? 48 : isMobile ? 60 : 92;

  useEffect(() => {
    if (reduceMotion) {
      reveal.setValue(1);
      return;
    }

    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: motion.slow,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, reveal]);

  return (
    <View style={[styles.hero, isMobile && styles.heroMobile]} testID="public-home-hero">
      <HeroMedia />
      <View pointerEvents="none" style={styles.heroScrim} />
      <View pointerEvents="none" style={[styles.heroReadingVeil, isMobile && styles.heroReadingVeilMobile]} />
      <WatermarkField />
      <View style={[styles.heroContent, isMobile && styles.heroContentMobile]}>
        <DisplayHeading
          lines={[{ text: "TREINE" }, { text: "COM INTENÇÃO.", accent: true }]}
          size={titleSize}
          reveal={reveal}
          style={styles.heroHeading}
        />
        <Text style={[styles.heroDescription, isMobile && styles.heroDescriptionMobile]}>
          A programação, o acompanhamento e a mentalidade FitBlock em um único lugar.
        </Text>
        <View style={[styles.heroActions, isMobile && styles.heroActionsMobile]}>
          <ActionButton
            label="Conheça os programas"
            accessibilityLabel="Conhecer programas FitBlock"
            onPress={onExplore}
            fullWidth={isMobile}
          />
          <ActionButton
            label="Entrar no app"
            accessibilityLabel="Entrar no app FitBlock"
            testID="public-home-app-cta"
            onPress={onOpenApp}
            variant="secondary"
            fullWidth={isMobile}
          />
        </View>
      </View>
    </View>
  );
}

function HeroMedia() {
  const videoSource = typeof heroVideoAsset === "string" ? heroVideoAsset : heroVideoAsset?.default;

  // Inicializa o player para reprodução nativa (mobile iOS/Android).
  // Na web o elemento <video> do browser é usado diretamente.
  const player = useVideoPlayer(heroVideoAsset, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={styles.heroMedia}
    >
      {Platform.OS === "web"
        ? createElement("video", {
            "aria-hidden": true,
            autoPlay: true,
            loop: true,
            muted: true,
            playsInline: true,
            src: videoSource,
            style: styles.heroVideo
          })
        : <VideoView
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            nativeControls={false}
            style={styles.heroVideoNative}
          />}
    </View>
  );
}

function DisciplineBand() {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;

  return (
    <View style={styles.disciplineBand}>
      <View style={[styles.disciplineBandInner, isMobile && styles.disciplineBandInnerMobile]}>
        {disciplines.map((discipline) => (
          <View key={discipline} style={styles.disciplineItem}>
            <View style={styles.disciplinePoint} />
            <Text style={styles.disciplineText}>{discipline}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MethodSection({ onExplore }: { onExplore: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;
  const [lead, ...supportingPillars] = homePillars;

  return (
    <Section>
      <SectionHead
        lines={[{ text: "UM MÉTODO." }, { text: "MUITAS FORMAS", accent: true }, { text: "DE EVOLUIR." }]}
        description="Treino, acompanhamento e comunidade para quem quer construir performance sem deixar a vida de lado."
      />
      <View style={styles.methodStack}>
        <MethodCard
          pillar={lead}
          image={methodImages[0]}
          size="lead"
          action={
            <ActionButton
              label="Conheça os programas"
              accessibilityLabel="Conhecer programas FitBlock"
              onPress={onExplore}
              variant="light"
              fullWidth={isMobile}
            />
          }
        />
        <View style={[styles.methodSupportingRow, isMobile && styles.methodSupportingRowMobile]}>
          {supportingPillars.map((pillar, index) => (
            <MethodCard
              key={pillar.title}
              pillar={pillar}
              image={methodImages[index + 1]}
              size={index === 0 ? "major" : "minor"}
            />
          ))}
        </View>
      </View>
    </Section>
  );
}

function MethodCard({
  pillar,
  image,
  size,
  action
}: {
  pillar: (typeof homePillars)[number];
  image: ImageSourcePropType;
  size: "lead" | "major" | "minor";
  action?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;
  const titleSize = size === "lead" ? (isMobile ? 40 : 54) : isMobile ? 36 : 42;

  return (
    <View
      style={[
        styles.methodCard,
        size === "lead" && styles.methodCardLead,
        size === "major" && styles.methodCardMajor,
        size === "minor" && styles.methodCardMinor,
        isMobile && styles.methodCardMobile
      ]}
    >
      <Image source={image} resizeMode="cover" accessible={false} style={styles.methodImage} />
      <View pointerEvents="none" style={styles.methodScrim} />
      <View style={[styles.methodContent, isMobile && styles.methodContentMobile]}>
        <View>
          <SolidLabel label={pillar.eyebrow} />
          <Text
            accessibilityRole="header"
            style={[styles.methodTitle, { fontSize: titleSize, lineHeight: Math.round(titleSize * 0.94) }]}
          >
            {pillar.title}
          </Text>
          <Text style={[styles.methodDescription, size !== "lead" && styles.methodDescriptionCompact]}>
            {pillar.description}
          </Text>
        </View>
        {action ? <View style={styles.methodAction}>{action}</View> : null}
      </View>
    </View>
  );
}

function ProgramsSection({ onOpenApp }: { onOpenApp: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;

  return (
    <Section tone="elevated">
      <SectionHead
        lines={[{ text: "COMECE ONDE" }, { text: "VOCÊ ESTÁ.", accent: true }]}
        description="Caminhos estruturados para diferentes objetivos, níveis e momentos do treinamento."
      />
      <View style={[styles.programGrid, isMobile && styles.programGridMobile]}>
        {featuredPrograms.map((program, index) => (
          <ProgramCard key={program.title} program={program} isFeatured={index === 0} onPress={onOpenApp} />
        ))}
      </View>
    </Section>
  );
}

function ProgramCard({
  program,
  isFeatured,
  onPress
}: {
  program: (typeof featuredPrograms)[number];
  isFeatured: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conhecer ${program.title}. ${program.type}. ${program.detail}`}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.programCard, focused && styles.cardFocused, pressed && styles.pressed]}
    >
      <View style={[styles.programSignal, isFeatured && styles.programSignalFeatured]} />
      <View style={styles.programCardContent}>
        <Text style={styles.programType}>{program.type}</Text>
        <Text accessibilityRole="header" style={styles.programTitle}>
          {program.title}
        </Text>
        <View style={styles.programFooter}>
          <Text style={styles.programDetail}>{program.detail}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.purple400} />
        </View>
      </View>
    </Pressable>
  );
}

function ExperiencesSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;
  const mobileCardWidth = Math.max(280, Math.min(390, width - layout.gutter.mobile * 2));

  return (
    <Section tone="deep" testID="experiences-fitblock-section">
      <SectionHead
        lines={[{ text: "TREINE JUNTO." }, { text: "VÁ MAIS LONGE.", accent: true }]}
        description="Camps e encontros para transformar a energia do treino em comunidade."
      />
      {isMobile ? (
        <ScrollView
          horizontal
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={mobileCardWidth + spacing[3]}
          contentContainerStyle={styles.experienceCarousel}
          accessibilityLabel="Experiências FitBlock. Deslize para ver os eventos e a comunidade."
        >
          {featuredCamps.map((experience) => (
            <ExperienceCard
              key={experience.id}
              experience={experience}
              style={[styles.carouselItem, { flexBasis: mobileCardWidth, width: mobileCardWidth }]}
            />
          ))}
          <ExperienceManifesto width={mobileCardWidth} />
        </ScrollView>
      ) : (
        <View style={styles.experienceGrid}>
          {featuredCamps.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
          <ExperienceManifesto />
        </View>
      )}
    </Section>
  );
}

function ExperienceManifesto({ width }: { width?: number }) {
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = viewportWidth < layout.breakpoint.tabletLarge;

  return (
    <View
      style={[
        styles.experienceManifesto,
        width ? [styles.carouselItem, { flexBasis: width, width }] : null
      ]}
    >
      <View style={styles.manifestoRule} />
      <DisplayHeading
        lines={[{ text: "O TREINO É" }, { text: "INDIVIDUAL." }, { text: "A JORNADA NÃO", accent: true }, { text: "PRECISA SER." }]}
        size={isMobile ? 31 : 37}
        style={styles.manifestoHeading}
      />
      <Text style={styles.manifestoCaption}>FITBLOCK COMMUNITY</Text>
    </View>
  );
}

function ContentSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;

  return (
    <Section>
      <SectionHead
        lines={[{ text: "IDEIAS QUE" }, { text: "MOVEM O TREINO.", accent: true }]}
        description="Conhecimento prático para treinar melhor, recuperar com inteligência e permanecer no processo."
      />
      <View style={styles.contentList}>
        {editorialPosts.map((post) => (
          <View key={post.title} style={[styles.contentRow, isMobile && styles.contentRowMobile]}>
            <SolidLabel label={post.category} style={styles.contentLabel} />
            <Text accessibilityRole="header" style={[styles.contentTitle, isMobile && styles.contentTitleMobile]}>
              {post.title}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={colors.purple400} />
          </View>
        ))}
      </View>
    </Section>
  );
}

function FinalCta({ onOpenApp }: { onOpenApp: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;

  return (
    <View style={styles.finalCta}>
      <Image
        source={isMobile ? finalCtaMobileImage : finalCtaImage}
        resizeMode="cover"
        accessible={false}
        style={styles.finalCtaImage}
      />
      <View pointerEvents="none" style={styles.finalCtaScrim} />
      <View pointerEvents="none" style={[styles.finalCtaReadingVeil, isMobile && styles.finalCtaReadingVeilMobile]} />
      <View style={[styles.finalCtaContent, isMobile && styles.finalCtaContentMobile]}>
        <DisplayHeading
          lines={[{ text: "PRONTO PARA" }, { text: "ENTRAR NO BLOCO?", accent: true }]}
          size={isMobile ? (width < 360 ? 40 : 48) : 68}
        />
        <Text style={styles.finalCtaDescription}>
          Conheça a programação FitBlock e encontre o caminho que faz sentido para você.
        </Text>
        <ActionButton
          label="Começar agora"
          accessibilityLabel="Conhecer a programação FitBlock"
          onPress={onOpenApp}
          fullWidth={isMobile}
          style={styles.finalCtaButton}
        />
      </View>
    </View>
  );
}

function PublicFooter({
  onNavigate,
  onOpenApp
}: {
  onNavigate: (id: HomeSectionId) => void;
  onOpenApp: () => void;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < layout.breakpoint.tabletLarge;

  return (
    <View style={styles.footer}>
      <View style={[styles.footerInner, isMobile && styles.footerInnerMobile]}>
        <View style={[styles.footerTop, isMobile && styles.footerTopMobile]}>
          <View style={styles.footerBrand}>
            <Image source={wordmarkWhite} style={styles.footerLogo} resizeMode="contain" accessibilityLabel="FitBlock Training" />
            <Text style={styles.footerStatement}>TREINE COM INTENÇÃO. PERMANEÇA NO PROCESSO.</Text>
          </View>
          <ActionButton
            label="Entrar no app"
            accessibilityLabel="Entrar no app FitBlock"
            onPress={onOpenApp}
            variant="secondary"
            fullWidth={isMobile}
          />
        </View>
        <View style={[styles.footerBottom, isMobile && styles.footerBottomMobile]}>
          <Text style={styles.footerCopyright}>© 2026 FITBLOCK TRAINING</Text>
          <View style={styles.footerLinks}>
            {homeNavigation.slice(1, 5).map((item) => (
              <FooterNavigationLink key={item.id} label={item.label} onPress={() => onNavigate(item.id)} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function FooterNavigationLink({ label, onPress }: { label: string; onPress: () => void }) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Ir para ${label}`}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.footerLink, focused && styles.footerLinkFocused, pressed && styles.pressed]}
    >
      <Text style={styles.footerLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    flex: 1,
    minHeight: "100%",
    position: "relative"
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 0
  },

  header: {
    alignItems: "center",
    backgroundColor: colors.bg,
    borderBottomColor: "rgba(248,248,250,0.1)",
    borderBottomWidth: 1,
    flexDirection: "row",
    height: 84,
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter.desktop,
    zIndex: 20
  },
  headerCompact: {
    height: 64,
    paddingHorizontal: layout.gutter.mobile
  },
  headerLogo: {
    height: 28,
    width: 154
  },
  headerLogoCompact: {
    height: 23,
    width: 127
  },
  desktopNav: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[5]
  },
  navigationLink: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[1]
  },
  navigationLinkFocused: {
    borderBottomColor: colors.purple400
  },
  navigationLinkText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  headerCta: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  headerCtaFocused: {
    borderColor: colors.white,
    borderWidth: 2
  },
  headerCtaText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  compactActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1]
  },
  compactLogin: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[2]
  },
  compactLoginFocused: {
    borderColor: colors.purple400
  },
  compactLoginText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: colors.surface03,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  menuButtonFocused: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  mobileMenu: {
    backgroundColor: colors.bgDeep,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    left: 0,
    paddingBottom: spacing[5],
    paddingHorizontal: layout.gutter.mobile,
    paddingTop: spacing[2],
    position: "absolute",
    right: 0,
    top: 64,
    zIndex: 30
  },
  mobileMenuLink: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52
  },
  mobileMenuLinkFocused: {
    backgroundColor: colors.surface01,
    borderBottomColor: colors.purple400
  },
  mobileMenuLinkText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 25,
    lineHeight: 26,
    textTransform: "uppercase"
  },
  mobileMenuCta: {
    marginTop: spacing[4]
  },

  headingStack: {
    alignItems: "flex-start"
  },
  displayText: {
    fontFamily: fontFamilies.displayBold,
    letterSpacing: -0.7,
    textTransform: "uppercase"
  },
  headingAccent: {
    alignSelf: "flex-start",
    overflow: "hidden",
    paddingBottom: 3,
    position: "relative"
  },
  headingAccentFill: {
    backgroundColor: colors.purple500,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    transformOrigin: "left"
  },
  solidLabel: {
    alignSelf: "flex-start",
    backgroundColor: colors.purple500,
    borderRadius: radius.xs,
    paddingHorizontal: spacing[3],
    paddingVertical: 6
  },
  solidLabelText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.05,
    textTransform: "uppercase"
  },
  actionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "space-between",
    minHeight: 52,
    paddingLeft: spacing[5],
    paddingRight: 6
  },
  actionButtonPrimary: {
    backgroundColor: colors.purple500
  },
  actionButtonSecondary: {
    backgroundColor: "rgba(16,16,20,0.82)",
    borderColor: colors.border
  },
  actionButtonLight: {
    backgroundColor: colors.white
  },
  actionButtonFullWidth: {
    alignSelf: "stretch",
    width: "auto"
  },
  actionButtonText: {
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  actionIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  actionIconLight: {
    backgroundColor: colors.surface02
  },
  focusOnDark: {
    borderColor: colors.white
  },
  focusOnLight: {
    borderColor: colors.purple500
  },
  watermark: {
    bottom: 0,
    left: 0,
    opacity: 0.035,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 3
  },
  watermarkMark: {
    height: 40,
    left: "-14%",
    position: "absolute",
    transform: [{ rotate: "-17deg" }],
    width: 200
  },
  watermarkMarkOffset: {
    left: "42%"
  },

  section: {
    alignItems: "center",
    backgroundColor: colors.bg,
    width: "100%"
  },
  sectionElevated: {
    backgroundColor: colors.surface01
  },
  sectionDeep: {
    backgroundColor: colors.bgDeep
  },
  sectionInner: {
    maxWidth: layout.container,
    paddingHorizontal: layout.gutter.desktop,
    paddingVertical: layout.section.desktop,
    width: "100%"
  },
  sectionInnerMobile: {
    paddingHorizontal: layout.gutter.mobile,
    paddingVertical: layout.section.mobile
  },
  sectionHead: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
    marginBottom: spacing[8]
  },
  sectionHeadMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[4],
    marginBottom: spacing[6]
  },
  sectionHeading: {
    flexShrink: 1
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    lineHeight: 25,
    maxWidth: 405,
    paddingBottom: 4,
    width: "34%"
  },
  sectionDescriptionMobile: {
    maxWidth: "100%",
    paddingBottom: 0,
    width: "100%"
  },

  hero: {
    backgroundColor: colors.bgDeep,
    minHeight: 660,
    overflow: "hidden",
    position: "relative"
  },
  heroMobile: {
    minHeight: 620
  },
  heroMedia: {
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0
  },
  heroVideo: {
    height: "100%",
    objectFit: "cover",
    width: "100%"
  } as unknown as TextStyle,
  heroVideoNative: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%"
  },
  heroScrim: {
    backgroundColor: "rgba(5,5,7,0.34)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1
  },
  heroReadingVeil: {
    backgroundColor: "rgba(5,5,7,0.78)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: "58%",
    zIndex: 2
  },
  heroReadingVeilMobile: {
    backgroundColor: "rgba(5,5,7,0.57)",
    top: "43%",
    width: "100%"
  },
  heroContent: {
    alignSelf: "center",
    justifyContent: "center",
    maxWidth: layout.container,
    minHeight: 660,
    paddingHorizontal: layout.gutter.desktop,
    paddingVertical: layout.section.desktop,
    width: "100%",
    zIndex: 4
  },
  heroContentMobile: {
    justifyContent: "flex-end",
    minHeight: 620,
    paddingHorizontal: layout.gutter.mobile,
    paddingVertical: spacing[7]
  },
  heroHeading: {
    maxWidth: 650
  },
  heroDescription: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyLg,
    lineHeight: 28,
    marginTop: spacing[5],
    maxWidth: 500,
    ...imageTextShadow
  },
  heroDescriptionMobile: {
    fontSize: typeScale.bodyMd,
    lineHeight: 24,
    marginTop: spacing[4],
    maxWidth: "100%"
  },
  heroActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
    marginTop: spacing[6]
  },
  heroActionsMobile: {
    alignItems: "stretch",
    flexDirection: "column"
  },

  disciplineBand: {
    alignItems: "center",
    backgroundColor: colors.bgDeep,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    width: "100%"
  },
  disciplineBandInner: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[5],
    maxWidth: layout.container,
    paddingHorizontal: layout.gutter.desktop,
    paddingVertical: spacing[4],
    width: "100%"
  },
  disciplineBandInnerMobile: {
    gap: spacing[3],
    paddingHorizontal: layout.gutter.mobile
  },
  disciplineItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  disciplinePoint: {
    backgroundColor: colors.purple400,
    borderRadius: radius.pill,
    height: 5,
    width: 5
  },
  disciplineText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.25,
    textTransform: "uppercase"
  },

  methodStack: {
    gap: spacing[3]
  },
  methodSupportingRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  methodSupportingRowMobile: {
    flexDirection: "column"
  },
  methodCard: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.feature,
    borderWidth: 1,
    justifyContent: "flex-end",
    minWidth: 0,
    overflow: "hidden",
    position: "relative"
  },
  methodCardLead: {
    minHeight: 490
  },
  methodCardMajor: {
    flex: 2,
    minHeight: 400
  },
  methodCardMinor: {
    flex: 1,
    minHeight: 400
  },
  methodCardMobile: {
    flex: 0,
    minHeight: 360
  },
  methodImage: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%"
  },
  methodScrim: {
    backgroundColor: "rgba(5,5,7,0.54)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  methodContent: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing[6]
  },
  methodContentMobile: {
    padding: spacing[5]
  },
  methodTitle: {
    color: colors.white,
    fontFamily: fontFamilies.displayBold,
    letterSpacing: -0.45,
    marginTop: spacing[3],
    textTransform: "uppercase",
    ...imageTextShadow
  },
  methodDescription: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    lineHeight: 24,
    marginTop: spacing[3],
    maxWidth: 490,
    ...imageTextShadow
  },
  methodDescriptionCompact: {
    fontSize: typeScale.bodySm,
    lineHeight: 21
  },
  methodAction: {
    marginTop: spacing[5]
  },

  programGrid: {
    flexDirection: "row",
    gap: spacing[3]
  },
  programGridMobile: {
    flexDirection: "column"
  },
  programCard: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    minHeight: 270,
    minWidth: 0,
    overflow: "hidden"
  },
  programSignal: {
    backgroundColor: colors.surface04,
    height: 5,
    width: "100%"
  },
  programSignalFeatured: {
    backgroundColor: colors.purple500
  },
  programCardContent: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing[5]
  },
  programType: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1.15,
    textTransform: "uppercase"
  },
  programTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.displayBold,
    fontSize: 38,
    letterSpacing: -0.45,
    lineHeight: 36,
    marginTop: spacing[5],
    textTransform: "uppercase"
  },
  programFooter: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    marginTop: spacing[5],
    paddingTop: spacing[3]
  },
  programDetail: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    lineHeight: 20
  },
  cardFocused: {
    borderColor: colors.purple400,
    borderWidth: 2
  },

  experienceGrid: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing[3]
  },
  experienceCarousel: {
    gap: spacing[3],
    paddingRight: layout.gutter.mobile
  },
  carouselItem: {
    flexGrow: 0,
    flexShrink: 0
  },
  experienceManifesto: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    justifyContent: "space-between",
    minHeight: 390,
    minWidth: 0,
    overflow: "hidden",
    padding: spacing[5]
  },
  manifestoRule: {
    backgroundColor: colors.purple500,
    height: 5,
    width: 64
  },
  manifestoHeading: {
    marginTop: spacing[6]
  },
  manifestoCaption: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: spacing[6]
  },

  contentList: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  contentRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[5],
    minHeight: 104,
    paddingVertical: spacing[4]
  },
  contentRowMobile: {
    alignItems: "flex-start",
    gap: spacing[3],
    minHeight: 0,
    paddingVertical: spacing[5]
  },
  contentLabel: {
    minWidth: 118
  },
  contentTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.displayBold,
    fontSize: 30,
    letterSpacing: -0.3,
    lineHeight: 30,
    textTransform: "uppercase"
  },
  contentTitleMobile: {
    fontSize: 27,
    lineHeight: 28
  },

  finalCta: {
    backgroundColor: colors.bgDeep,
    minHeight: 560,
    overflow: "hidden",
    position: "relative"
  },
  finalCtaImage: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%"
  },
  finalCtaScrim: {
    backgroundColor: "rgba(5,5,7,0.24)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  finalCtaReadingVeil: {
    backgroundColor: "rgba(5,5,7,0.88)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: "56%"
  },
  finalCtaReadingVeilMobile: {
    backgroundColor: "rgba(5,5,7,0.62)",
    top: "42%",
    width: "100%"
  },
  finalCtaContent: {
    alignSelf: "center",
    justifyContent: "center",
    maxWidth: layout.container,
    minHeight: 560,
    paddingHorizontal: layout.gutter.desktop,
    paddingVertical: spacing[9],
    width: "100%"
  },
  finalCtaContentMobile: {
    justifyContent: "flex-end",
    minHeight: 560,
    paddingHorizontal: layout.gutter.mobile,
    paddingVertical: spacing[7]
  },
  finalCtaDescription: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    lineHeight: 24,
    marginTop: spacing[5],
    maxWidth: 445,
    ...imageTextShadow
  },
  finalCtaButton: {
    marginTop: spacing[6]
  },

  footer: {
    alignItems: "center",
    backgroundColor: colors.bgDeep,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    width: "100%"
  },
  footerInner: {
    maxWidth: layout.container,
    paddingHorizontal: layout.gutter.desktop,
    paddingVertical: spacing[8],
    width: "100%"
  },
  footerInnerMobile: {
    paddingHorizontal: layout.gutter.mobile,
    paddingVertical: spacing[7]
  },
  footerTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  footerTopMobile: {
    flexDirection: "column",
    gap: spacing[5]
  },
  footerBrand: {
    gap: spacing[4],
    maxWidth: 330
  },
  footerLogo: {
    height: 28,
    width: 150
  },
  footerStatement: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12,
    letterSpacing: 0.55,
    lineHeight: 18,
    textTransform: "uppercase"
  },
  footerBottom: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "space-between",
    marginTop: spacing[8],
    paddingTop: spacing[4]
  },
  footerBottomMobile: {
    alignItems: "flex-start",
    flexDirection: "column"
  },
  footerCopyright: {
    color: colors.textMutedAccessible,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 11,
    letterSpacing: 0.8
  },
  footerLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4]
  },
  footerLink: {
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    justifyContent: "center",
    minHeight: 44
  },
  footerLinkFocused: {
    borderBottomColor: colors.purple400
  },
  footerLinkText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12
  },
  pressed: {
    opacity: 0.78
  }
});
