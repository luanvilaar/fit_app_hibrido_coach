import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import {
  editorialPosts,
  featuredCamps,
  featuredPrograms,
  homeNavigation,
  type HomeSectionId
} from "@/data/home";
import { homePillars } from "@/data/homePillars";
import { ExperienceCard } from "@/components/experience-card";

const mari1Image = require("@/assets/mari1.webp");
const timeCommunityImage = require("@/assets/time-community.webp");


export function PublicHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [menuOpen, setMenuOpen] = useState(false);
  const sectionOffsets = useRef<Partial<Record<HomeSectionId, number>>>({});
  const scrollRef = useRef<ScrollView>(null);

  function goToSection(id: HomeSectionId) {
    setMenuOpen(false);
    if (id === "inicio") {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const offset = sectionOffsets.current[id];
    if (typeof offset === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, offset - 24), animated: true });
    }
  }

  function openApp() {
    setMenuOpen(false);
    router.push("/entrar");
  }

  return (
    <View style={styles.root}>
      <PublicHeader
        isMobile={isMobile}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((current) => !current)}
        onNavigate={goToSection}
        onOpenApp={openApp}
      />
      {isMobile && menuOpen && (
        <MobileMenu onNavigate={goToSection} onOpenApp={openApp} />
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setMenuOpen(false)}
        scrollEventThrottle={16}
      >
        <Hero onExplore={() => goToSection("programas")} onOpenApp={openApp} />
        <View
          onLayout={(event) => {
            sectionOffsets.current.acompanhamento = event.nativeEvent.layout.y;
          }}
        >
          <PillarsSection />
        </View>
        <View
          onLayout={(event) => {
            sectionOffsets.current.programas = event.nativeEvent.layout.y;
          }}
        >
          <ProgramsSection onOpenApp={openApp} />
        </View>
        <View
          onLayout={(event) => {
            sectionOffsets.current.camps = event.nativeEvent.layout.y;
          }}
        >
          <CampsSection />
        </View>
        <View
          onLayout={(event) => {
            sectionOffsets.current.conteudo = event.nativeEvent.layout.y;
          }}
        >
          <ContentSection />
        </View>
        <View
          onLayout={(event) => {
            sectionOffsets.current.loja = event.nativeEvent.layout.y;
          }}
        >
          <FinalCta onOpenApp={openApp} />
        </View>
        <PublicFooter onNavigate={goToSection} onOpenApp={openApp} />
      </ScrollView>
    </View>
  );
}

function PublicHeader({
  isMobile,
  menuOpen,
  onMenuToggle,
  onNavigate,
  onOpenApp
}: {
  isMobile: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onNavigate: (id: HomeSectionId) => void;
  onOpenApp: () => void;
}) {
  return (
    <View style={[styles.header, isMobile && styles.headerMobile]}>
      <Image
        source={require("../assets/fitblock-wordmark-black.png")}
        style={styles.headerLogo}
        resizeMode="contain"
        accessibilityLabel="FitBlock Training"
      />
      {!isMobile ? (
        <View style={styles.desktopNav}>
          {homeNavigation.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="link"
              accessibilityLabel={`Ir para ${item.label}`}
              onPress={() => onNavigate(item.id)}
              style={({ pressed }) => [styles.navLink, pressed && styles.pressed]}
            >
              <Text style={styles.navLinkText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.mobileHeaderActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar no app FitBlock"
            onPress={onOpenApp}
            style={({ pressed }) => [styles.mobileLogin, pressed && styles.pressed]}
          >
            <Text style={styles.mobileLoginText}>Entrar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? "Fechar menu" : "Abrir menu"}
            accessibilityState={{ expanded: menuOpen }}
            testID="public-menu-toggle"
            onPress={onMenuToggle}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          >
            <Ionicons name={menuOpen ? "close" : "menu"} size={23} color={colors.canvas} />
          </Pressable>
        </View>
      )}
      {!isMobile && (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir busca"
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
          >
            <Ionicons name="search-outline" size={19} color={colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir carrinho"
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
          >
            <Ionicons name="bag-handle-outline" size={19} color={colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar no app FitBlock"
            onPress={onOpenApp}
            style={({ pressed }) => [styles.headerCta, pressed && styles.pressed]}
          >
            <Text style={styles.headerCtaText}>Entrar no app</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.canvas} />
          </Pressable>
        </View>
      )}
    </View>
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
      {homeNavigation.map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole="link"
          accessibilityLabel={`Ir para ${item.label}`}
          onPress={() => onNavigate(item.id)}
          style={({ pressed }) => [styles.mobileMenuLink, pressed && styles.pressed]}
        >
          <Text style={styles.mobileMenuIndex}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={styles.mobileMenuLabel}>{item.label}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.fitblockPurple} />
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Entrar no app FitBlock"
        onPress={onOpenApp}
        style={({ pressed }) => [styles.mobileMenuCta, pressed && styles.pressed]}
      >
        <Text style={styles.mobileMenuCtaText}>Entrar no app</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.canvas} />
      </Pressable>
    </View>
  );
}

function Hero({ onExplore, onOpenApp }: { onExplore: () => void; onOpenApp: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={[styles.hero, isMobile && styles.heroMobile]} testID="public-home-hero">
      <View style={styles.heroTexture}>
        <Text style={styles.heroTextureText}>FITBLOCK</Text>
        <Text style={styles.heroTextureText}>FITBLOCK</Text>
        <Text style={styles.heroTextureText}>FITBLOCK</Text>
      </View>
      <View style={[styles.heroContent, isMobile && styles.heroContentMobile]}>
        <View style={styles.heroEyebrowRow}>
          <View style={styles.heroEyebrowLine} />
          <Text style={styles.heroEyebrow}>FITBLOCK TRAINING · PERFORMANCE REAL</Text>
        </View>
        <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
          TREINE{`\n`}
          <Text style={styles.heroTitleAccent}>COM INTENÇÃO.</Text>
        </Text>
        <Text style={styles.heroDescription}>
          A programação, o acompanhamento e a mentalidade FitBlock em um único lugar.
        </Text>
        <View style={styles.heroActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Conhecer programas FitBlock"
            onPress={onExplore}
            style={({ pressed }) => [styles.heroPrimaryCta, pressed && styles.pressed]}
          >
            <Text style={styles.heroPrimaryCtaText}>Conheça os programas</Text>
            <View style={styles.heroCtaIcon}>
              <Ionicons name="arrow-forward" size={18} color={colors.ink} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar no app FitBlock"
            testID="public-home-app-cta"
            onPress={onOpenApp}
            style={({ pressed }) => [styles.heroSecondaryCta, pressed && styles.pressed]}
          >
            <Text style={styles.heroSecondaryCtaText}>Entrar no app</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.heroRail, isMobile && styles.heroRailMobile]}>
        <View style={[styles.heroRailTop, isMobile && styles.heroRailTopMobile]}>
          <Text style={styles.heroRailNumber}>01</Text>
          <Text style={[styles.heroRailLabel, isMobile && styles.heroRailLabelMobile]}>MÉTODO{`\n`}FITBLOCK</Text>
        </View>
        <View style={[styles.heroRailBottom, isMobile && styles.heroRailBottomMobile]}>
          <View style={styles.heroRailRule} />
          <Text style={[styles.heroRailCaption, isMobile && styles.heroRailCaptionMobile]}>FORÇA · SKILL · ENDURANCE</Text>
        </View>
      </View>
    </View>
  );
}

function PillarsSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.section}>
      <SectionIntro
        eyebrow="O QUE FAZEMOS"
        title={<>UM MÉTODO. {`\n`}MUITAS FORMAS DE EVOLUIR.</>}
        description="Treino, acompanhamento e comunidade para quem quer construir performance sem deixar a vida de lado."
      />
      <View style={[styles.pillarGrid, isMobile && styles.pillarGridMobile]}>
        {homePillars.map((pillar) => {
          const hasPhoto = pillar.number === "01" || pillar.number === "03";
          return (
            <View
              key={pillar.number}
              style={[
                styles.pillarCard,
                pillar.tone === "purple" && styles.pillarCardPurple,
                pillar.tone === "ink" && styles.pillarCardInk,
                pillar.number === "01" && styles.pillarCardWithImage,
                pillar.number === "03" && styles.pillarCardWithImageCommunity
              ]}
            >
              {pillar.number === "01" && <View style={styles.pillarCardOverlay} />}
              {pillar.number === "03" && <View style={styles.pillarCardOverlayDark} />}
              <View style={styles.cardTopline}>
                <Text
                  style={[
                    styles.cardNumber,
                    pillar.tone === "ink" && styles.cardNumberLight,
                    hasPhoto && styles.cardNumberOnImage
                  ]}
                >
                  {pillar.number}
                </Text>
                <View style={[styles.cardArrow, pillar.tone === "ink" && styles.cardArrowLight]}>
                  <Ionicons name="arrow-up" size={17} color={pillar.tone === "ink" ? colors.ink : colors.fitblockPurple} />
                </View>
              </View>
              <View>
                {hasPhoto ? (
                  <View style={styles.purpleBadge}>
                    <Text
                      style={[
                        styles.cardEyebrow,
                        styles.cardEyebrowOnImage,
                        styles.cardEyebrowBadgeText
                      ]}
                    >
                      {pillar.eyebrow}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.cardEyebrow, pillar.tone === "ink" && styles.cardEyebrowLight]}>
                    {pillar.eyebrow}
                  </Text>
                )}
                <Text
                  style={[
                    styles.pillarTitle,
                    pillar.tone === "ink" && styles.pillarTitleLight,
                    hasPhoto && styles.pillarTitleOnImage
                  ]}
                >
                  {pillar.title}
                </Text>
                <Text
                  style={[
                    styles.pillarDescription,
                    pillar.tone === "ink" && styles.pillarDescriptionLight,
                    hasPhoto && styles.pillarDescriptionOnImage
                  ]}
                >
                  {pillar.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ProgramsSection({ onOpenApp }: { onOpenApp: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={[styles.section, styles.programsSection]}>
      <View style={[styles.sectionHeaderRow, isMobile && styles.sectionHeaderRowMobile]}>
        <SectionIntro
          eyebrow="PROGRAMAS"
          title={<>COMECE ONDE{`\n`}VOCÊ ESTÁ.</>}
          description="Caminhos estruturados para diferentes objetivos, níveis e momentos do treinamento."
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todos os programas"
          onPress={onOpenApp}
          style={({ pressed }) => [styles.outlineCta, pressed && styles.pressed]}
        >
          <Text style={styles.outlineCtaText}>Ver programas</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.ink} />
        </Pressable>
      </View>
      <View style={[styles.programGrid, isMobile && styles.programGridMobile]}>
        {featuredPrograms.map((program) => (
          <Pressable
            key={program.number}
            accessibilityRole="button"
            accessibilityLabel={`Conhecer ${program.title}`}
            onPress={onOpenApp}
            style={({ pressed }) => [styles.programCard, pressed && styles.programCardPressed]}
          >
            <View style={[styles.programVisual, program.accent === "purple" && styles.programVisualPurple, program.accent === "graphite" && styles.programVisualGraphite]}>
              <Text style={styles.programVisualNumber}>{program.number}</Text>
              <Text style={styles.programVisualWord}>FB</Text>
              <View style={styles.programVisualMarker} />
              <Text style={styles.programVisualLabel}>PERFORMANCE{`\n`}REAL</Text>
            </View>
            <View style={styles.programCopy}>
              <Text style={styles.programType}>{program.type}</Text>
              <Text style={styles.programTitle}>{program.title}</Text>
              <View style={styles.programMetaRow}>
                <Text style={styles.programDetail}>{program.detail}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.fitblockPurple} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CampsSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const mobileCardWidth = Math.max(280, Math.min(390, width - spacing[5] * 2));

  return (
    <View style={[styles.section, styles.campsSection]} testID="experiences-fitblock-section">
      <View style={[styles.darkSectionHeader, isMobile && styles.darkSectionHeaderMobile]}>
        <View>
          <Text style={styles.darkEyebrow}>EXPERIÊNCIAS FITBLOCK</Text>
          <Text style={styles.darkSectionTitle}>TREINE JUNTO.{`\n`}VÁ MAIS LONGE.</Text>
        </View>
        <Text style={[styles.darkSectionDescription, isMobile && styles.darkSectionDescriptionMobile]}>
          Camps e encontros para transformar a energia do treino em comunidade.
        </Text>
      </View>
      {isMobile ? (
        <ScrollView
          horizontal
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={mobileCardWidth + spacing[4]}
          contentContainerStyle={styles.campCarouselContent}
        >
          {featuredCamps.map((experience) => (
            <ExperienceCard
              key={experience.id}
              experience={experience}
              style={[styles.campCardMobile, { width: mobileCardWidth }]}
            />
          ))}
          <CampManifesto style={{ width: mobileCardWidth }} />
        </ScrollView>
      ) : (
        <View style={styles.campGrid}>
          {featuredCamps.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
          <CampManifesto />
        </View>
      )}
    </View>
  );
}

function CampManifesto({ style }: { style?: { width: number } }) {
  return (
    <View style={[styles.campManifesto, style]}>
      <Text style={styles.campManifestoMark}>+</Text>
      <Text style={styles.campManifestoText}>O treino é individual.{`\n`}A jornada não precisa ser.</Text>
      <Text style={styles.campManifestoCaption}>FITBLOCK COMMUNITY</Text>
    </View>
  );
}

function ContentSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.section}>
      <SectionIntro
        eyebrow="CONTEÚDO"
        title={<>IDEIAS QUE{`\n`}MOVEM O TREINO.</>}
        description="Conhecimento prático para treinar melhor, recuperar com inteligência e permanecer no processo."
      />
      <View style={styles.contentList}>
        {editorialPosts.map((post) => (
          <Pressable
            key={post.number}
            accessibilityRole="button"
            accessibilityLabel={`Ler: ${post.title}`}
            style={({ pressed }) => [styles.contentRow, isMobile && styles.contentRowMobile, pressed && styles.contentRowPressed]}
          >
            <Text style={[styles.contentNumber, isMobile && styles.contentNumberMobile]}>{post.number}</Text>
            <Text style={[styles.contentCategory, isMobile && styles.contentCategoryMobile]}>{post.category}</Text>
            <Text style={[styles.contentTitle, isMobile && styles.contentTitleMobile]}>{post.title}</Text>
            <Ionicons name="arrow-up" size={18} color={colors.fitblockPurple} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FinalCta({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <View style={styles.finalCta}>
      <View style={styles.finalCtaPattern}>
        <Text style={styles.finalCtaPatternText}>F</Text>
        <Text style={styles.finalCtaPatternText}>B</Text>
      </View>
      <Text style={styles.finalCtaEyebrow}>SEU PRÓXIMO TREINO COMEÇA AQUI</Text>
      <Text style={styles.finalCtaTitle}>PRONTO PARA{`\n`}ENTRAR NO BLOCO?</Text>
      <Text style={styles.finalCtaDescription}>Conheça a programação FitBlock e encontre o caminho que faz sentido para você.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Conhecer a programação FitBlock"
        onPress={onOpenApp}
        style={({ pressed }) => [styles.finalCtaButton, pressed && styles.pressed]}
      >
        <Text style={styles.finalCtaButtonText}>Começar agora</Text>
        <View style={styles.finalCtaButtonIcon}>
          <Ionicons name="arrow-forward" size={18} color={colors.ink} />
        </View>
      </Pressable>
    </View>
  );
}

function PublicFooter({ onNavigate, onOpenApp }: { onNavigate: (id: HomeSectionId) => void; onOpenApp: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.footer}>
      <View style={[styles.footerTop, isMobile && styles.footerTopMobile]}>
        <Image
          source={require("../assets/fitblock-wordmark-white.png")}
          style={styles.footerLogo}
          resizeMode="contain"
          accessibilityLabel="FitBlock Training"
        />
        <Text style={styles.footerStatement}>Treine com intenção.{`\n`}Permaneça no processo.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Entrar no app FitBlock"
          onPress={onOpenApp}
          style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
        >
          <Text style={styles.footerLinkText}>Entrar no app</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.fitblockPurpleLight} />
        </Pressable>
      </View>
      <View style={[styles.footerBottom, isMobile && styles.footerBottomMobile]}>
        <Text style={styles.footerCopyright}>© 2026 FITBLOCK TRAINING</Text>
        <View style={styles.footerLinks}>
          {homeNavigation.slice(1, 5).map((item) => (
            <Pressable key={item.id} onPress={() => onNavigate(item.id)} accessibilityRole="link" accessibilityLabel={`Ir para ${item.label}`}>
              <Text style={styles.footerNavText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={[styles.sectionIntro, isMobile && styles.sectionIntroMobile]}>
      <View style={styles.sectionIntroTitleBlock}>
        <View style={styles.sectionIntroAccent} />
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={[styles.sectionDescription, isMobile && styles.sectionDescriptionMobile]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.canvas,
    flex: 1,
    minHeight: "100%"
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 0
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    height: 78,
    justifyContent: "space-between",
    paddingHorizontal: "6%",
    zIndex: 10
  },
  headerMobile: {
    height: 70,
    paddingHorizontal: spacing[4]
  },
  headerLogo: {
    height: 29,
    width: 150
  },
  desktopNav: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[5]
  },
  navLink: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing[1]
  },
  navLinkText: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "600"
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  headerIconButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  headerCta: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  headerCtaText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  mobileHeaderActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  mobileLogin: {
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: spacing[2]
  },
  mobileLoginText: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  mobileMenu: {
    backgroundColor: colors.canvas,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    paddingBottom: spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    position: "absolute",
    top: 70,
    width: "100%",
    zIndex: 20
  },
  mobileMenuLink: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 54
  },
  mobileMenuIndex: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    width: 22
  },
  mobileMenuLabel: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.display,
    fontSize: 23,
    fontWeight: "400"
  },
  mobileMenuCta: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[4],
    minHeight: 50,
    paddingHorizontal: spacing[5]
  },
  mobileMenuCtaText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  hero: {
    backgroundColor: colors.ink,
    flexDirection: "row",
    minHeight: 620,
    overflow: "hidden"
  },
  // Empilha content sobre rail: a divisão 72/28 em row só faz sentido com espaço horizontal de desktop.
  heroMobile: {
    flexDirection: "column",
    minHeight: 0
  },
  heroContent: {
    justifyContent: "center",
    paddingHorizontal: "9%",
    paddingVertical: spacing[10],
    width: "72%",
    zIndex: 2
  },
  heroContentMobile: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    width: "100%"
  },
  heroTexture: {
    bottom: -44,
    left: "41%",
    opacity: 0.035,
    pointerEvents: "none",
    position: "absolute",
    transform: [{ rotate: "-18deg" }],
    zIndex: 1
  },
  heroTextureText: {
    color: colors.canvas,
    fontFamily: fontFamilies.display,
    fontSize: 154,
    fontWeight: "400",
    lineHeight: 130
  },
  heroEyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    marginBottom: spacing[6]
  },
  heroEyebrowLine: {
    backgroundColor: colors.fitblockPurple,
    height: 2,
    width: 44
  },
  heroEyebrow: {
    color: colors.stone,
    flexShrink: 1,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.4
  },
  // Tier de campanha: 96px, line-height 0.9, tracking 0 — Bebas já é condensada.
  heroTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displayCampaign,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: typeScale.displayCampaign * 0.9
  },
  // 96px de display quebra em qualquer viewport de telefone: cai para o tier displayHero.
  heroTitleMobile: {
    fontSize: typeScale.displayHero,
    lineHeight: typeScale.displayHero * 0.95
  },
  heroTitleAccent: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.display,
    fontWeight: "400"
  },
  heroDescription: {
    color: colors.stone,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyLg,
    lineHeight: 28,
    marginTop: spacing[6],
    maxWidth: 520
  },
  heroActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4],
    marginTop: spacing[7]
  },
  heroPrimaryCta: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "space-between",
    minHeight: 56,
    paddingLeft: spacing[5],
    paddingRight: 7,
    width: 226
  },
  heroPrimaryCtaText: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  heroCtaIcon: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  heroSecondaryCta: {
    alignItems: "center",
    borderColor: colors.ash,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: spacing[5]
  },
  heroSecondaryCtaText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  // Painel claro contra o preto do hero. Era roxo sólido: superfície cromática grande
  // demais para um sistema onde o acento só marca seta, número e estado ativo.
  heroRail: {
    backgroundColor: colors.softCloud,
    justifyContent: "space-between",
    minHeight: 620,
    padding: spacing[7],
    width: "28%"
  },
  // Empilhado abaixo do content: largura total, sem altura mínima de hero de desktop, texto lido da esquerda.
  heroRailMobile: {
    minHeight: 0,
    padding: spacing[6],
    width: "100%"
  },
  heroRailTop: {
    alignItems: "flex-end"
  },
  heroRailTopMobile: {
    alignItems: "flex-start"
  },
  heroRailNumber: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.headingLg,
    fontWeight: "400"
  },
  heroRailLabel: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: "400",
    lineHeight: 32,
    marginTop: spacing[3],
    textAlign: "right"
  },
  heroRailLabelMobile: {
    fontSize: 24,
    lineHeight: 24,
    textAlign: "left"
  },
  heroRailBottom: {
    alignItems: "flex-end"
  },
  heroRailBottomMobile: {
    alignItems: "flex-start",
    marginTop: spacing[5]
  },
  heroRailRule: {
    backgroundColor: colors.fitblockPurple,
    height: 2,
    marginBottom: spacing[3],
    width: "100%"
  },
  heroRailCaption: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.1,
    textAlign: "right"
  },
  heroRailCaptionMobile: {
    textAlign: "left"
  },
  // Ritmo vertical de 48px entre blocos: as seções encostam umas nas outras, sem
  // divisor decorativo. A separação vem da troca de superfície, não de margem.
  section: {
    alignSelf: "center",
    maxWidth: 1440,
    paddingHorizontal: "6%",
    paddingVertical: spacing[8],
    width: "100%"
  },
  sectionIntro: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[7]
  },
  // Compartilhado por Pilares, Programas e Conteúdo: em row a descrição de 34% vira uma
  // coluna de ~110px em telefone. Empilha título e descrição em vez disso.
  sectionIntroMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[4]
  },
  sectionIntroTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  sectionIntroAccent: {
    backgroundColor: colors.fitblockPurple,
    height: 8,
    marginBottom: spacing[3],
    width: 68
  },
  sectionEyebrow: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.5,
    marginBottom: spacing[2]
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displayHero,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: typeScale.displayHero * 0.9
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    lineHeight: 25,
    maxWidth: 370,
    paddingBottom: 3,
    width: "34%"
  },
  sectionDescriptionMobile: {
    maxWidth: "100%",
    width: "100%"
  },
  pillarGrid: {
    flexDirection: "row",
    gap: spacing[2]
  },
  pillarGridMobile: {
    flexDirection: "column"
  },
  // Container = raio 0, sem sombra. O card não levanta da página.
  pillarCard: {
    backgroundColor: colors.softCloud,
    borderRadius: radius.none,
    flex: 1,
    justifyContent: "space-between",
    minHeight: 320,
    padding: spacing[5]
  },
  pillarCardPurple: {
    backgroundColor: colors.softCloud
  },
  pillarCardWithImage: {
    backgroundImage: `url(${mari1Image})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  },
  pillarCardWithImageCommunity: {
    backgroundImage: `url(${timeCommunityImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  },
  pillarCardInk: {
    backgroundColor: colors.ink
  },
  // Degradê ancorado embaixo: o topo do card (número/seta) fica com a foto intacta; o
  // contraste concentra na metade inferior, onde título e descrição realmente ficam.
  pillarCardOverlay: {
    backgroundImage: "linear-gradient(180deg, rgba(113, 50, 245, 0) 0%, rgba(113, 50, 245, 0.15) 40%, rgba(113, 50, 245, 0.55) 65%, rgba(113, 50, 245, 0.9) 100%)",
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0
  },
  pillarCardOverlayDark: {
    backgroundImage: "linear-gradient(180deg, rgba(17, 17, 17, 0) 0%, rgba(17, 17, 17, 0.15) 40%, rgba(17, 17, 17, 0.55) 65%, rgba(17, 17, 17, 0.9) 100%)",
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0
  },
  cardTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardNumber: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: "400"
  },
  cardNumberLight: {
    color: colors.fitblockPurpleLight
  },
  // O "01"/"03" fica na faixa quase transparente do degradê — sombra garante leitura mesmo ali.
  cardNumberOnImage: {
    color: colors.canvas,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6
  },
  // alignSelf: hug a largura do texto (sem isso, herda o stretch do container coluna e vira uma barra do tamanho do card).
  purpleBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.fitblockPurple,
    justifyContent: "center",
    marginBottom: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1]
  },
  cardArrow: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  cardArrowLight: {
    backgroundColor: colors.fitblockPurpleLight
  },
  cardEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.4,
    marginBottom: spacing[2]
  },
  cardEyebrowLight: {
    color: colors.fitblockPurpleLight
  },
  cardEyebrowOnImage: {
    color: "rgba(255, 255, 255, 0.78)"
  },
  // Zera o marginBottom herdado de cardEyebrow: dentro do badge, o espaçamento vem do paddingVertical do próprio retângulo, senão o texto fica descentralizado para cima.
  cardEyebrowBadgeText: {
    marginBottom: 0
  },
  pillarTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 31,
    fontWeight: "400",
    lineHeight: 30
  },
  pillarTitleLight: {
    color: colors.canvas
  },
  pillarTitleOnImage: {
    color: colors.canvas,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6
  },
  pillarDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    lineHeight: 21,
    marginTop: spacing[4]
  },
  pillarDescriptionLight: {
    color: colors.stone
  },
  pillarDescriptionOnImage: {
    color: "rgba(255, 255, 255, 0.78)",
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6
  },
  programsSection: {
    backgroundColor: colors.softCloud,
    maxWidth: 2000,
    paddingLeft: "6%",
    paddingRight: "6%"
  },
  sectionHeaderRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionHeaderRowMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[5]
  },
  outlineCta: {
    alignItems: "center",
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[5]
  },
  outlineCtaText: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  programGrid: {
    flexDirection: "row",
    gap: spacing[2]
  },
  programGridMobile: {
    flexDirection: "column"
  },
  // A foto é o card: raio 0, sem padding interno, metadados logo abaixo.
  programCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.none,
    flex: 1,
    overflow: "hidden"
  },
  programCardPressed: {
    opacity: 0.78
  },
  // O cinza é o "estúdio" onde toda imagem de produto é montada.
  programVisual: {
    backgroundColor: colors.softCloud,
    height: 260,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: spacing[5]
  },
  programVisualPurple: {
    backgroundColor: colors.softCloud
  },
  programVisualGraphite: {
    backgroundColor: colors.graphite
  },
  programVisualNumber: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.display,
    fontSize: 20,
    fontWeight: "400"
  },
  programVisualWord: {
    alignSelf: "center",
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 142,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 128,
    opacity: 0.12
  },
  programVisualMarker: {
    backgroundColor: colors.fitblockPurple,
    height: 8,
    position: "absolute",
    right: 0,
    top: spacing[7],
    width: "28%"
  },
  programVisualLabel: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 24,
    fontWeight: "400",
    lineHeight: 22
  },
  programCopy: {
    padding: spacing[5]
  },
  programType: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.2
  },
  programTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 27,
    fontWeight: "400",
    marginTop: spacing[2]
  },
  programMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[5]
  },
  programDetail: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm
  },
  campsSection: {
    backgroundColor: colors.ink,
    maxWidth: 2000
  },
  darkSectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[7]
  },
  darkSectionHeaderMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[5]
  },
  darkEyebrow: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.5,
    marginBottom: spacing[2]
  },
  darkSectionTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displayHero,
    fontWeight: "400",
    lineHeight: typeScale.displayHero * 0.9
  },
  darkSectionDescription: {
    color: colors.stone,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    lineHeight: 25,
    maxWidth: 360,
    width: "34%"
  },
  darkSectionDescriptionMobile: {
    maxWidth: "100%",
    width: "100%"
  },
  campGrid: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing[2]
  },
  campCarouselContent: {
    gap: spacing[2]
  },
  campCardMobile: {
    flex: 0
  },
  // Bloco de manifesto claro dentro da seção escura: o contraste vem da troca de
  // superfície, não de uma quarta cor.
  campManifesto: {
    backgroundColor: colors.canvas,
    borderRadius: radius.none,
    flex: 1,
    justifyContent: "space-between",
    minHeight: 340,
    padding: spacing[5]
  },
  campManifestoMark: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.display,
    fontSize: 46,
    fontWeight: "400"
  },
  campManifestoText: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: "400",
    lineHeight: 32
  },
  campManifestoCaption: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.4
  },
  contentList: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1
  },
  contentRow: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[4],
    minHeight: 92,
    paddingHorizontal: spacing[3]
  },
  // 44px + 120px de colunas fixas somam ~165px antes do gap: em 320-375px de viewport
  // sobra menos de 30px pro título. Encolhe as colunas fixas pra abrir espaço.
  contentRowMobile: {
    gap: spacing[3]
  },
  contentRowPressed: {
    backgroundColor: colors.softCloud
  },
  contentNumber: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.display,
    fontSize: 24,
    fontWeight: "400",
    width: 44
  },
  contentNumberMobile: {
    fontSize: 18,
    width: 26
  },
  contentCategory: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.2,
    width: 120
  },
  contentCategoryMobile: {
    fontSize: 10,
    letterSpacing: 0.8,
    width: 64
  },
  contentTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.display,
    fontSize: 26,
    fontWeight: "400"
  },
  contentTitleMobile: {
    fontSize: 20
  },
  // campaign-tile: preto puro, headline de campanha queimada por cima, uma pill branca.
  finalCta: {
    alignItems: "center",
    backgroundColor: colors.ink,
    justifyContent: "center",
    minHeight: 520,
    overflow: "hidden",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[9]
  },
  finalCtaPattern: {
    bottom: -70,
    flexDirection: "row",
    gap: 8,
    opacity: 0.12,
    pointerEvents: "none",
    position: "absolute",
    right: "7%",
    transform: [{ rotate: "-8deg" }]
  },
  finalCtaPatternText: {
    color: colors.canvas,
    fontFamily: fontFamilies.display,
    fontSize: 240,
    fontWeight: "400",
    lineHeight: 220
  },
  finalCtaEyebrow: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1.5,
    textAlign: "center"
  },
  finalCtaTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displayCampaign,
    fontWeight: "400",
    lineHeight: typeScale.displayCampaign * 0.9,
    marginTop: spacing[3],
    textAlign: "center"
  },
  finalCtaDescription: {
    color: colors.stone,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    lineHeight: 24,
    marginTop: spacing[4],
    maxWidth: 450,
    textAlign: "center"
  },
  finalCtaButton: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "space-between",
    marginTop: spacing[6],
    minHeight: 56,
    paddingLeft: spacing[5],
    paddingRight: 7,
    width: 182
  },
  finalCtaButtonText: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  finalCtaButtonIcon: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  footer: {
    backgroundColor: colors.black,
    paddingHorizontal: "6%",
    paddingVertical: spacing[7]
  },
  footerTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  // Logo (150px fixa) + headline de 31px + link somam bem mais que qualquer viewport de
  // telefone numa row sem wrap (flexShrink é 0 por padrão no RN, então empilha em vez de tentar caber).
  footerTopMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[5]
  },
  footerLogo: {
    height: 28,
    width: 150
  },
  footerStatement: {
    color: colors.canvas,
    fontFamily: fontFamilies.display,
    fontSize: 31,
    fontWeight: "400",
    lineHeight: 29
  },
  footerLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44
  },
  footerLinkText: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "500"
  },
  footerBottom: {
    alignItems: "center",
    borderTopColor: colors.graphite,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[8],
    paddingTop: spacing[4]
  },
  // Copyright + 4 links de navegação também somam mais que a largura de um telefone em row.
  footerBottomMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[4]
  },
  footerCopyright: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "500",
    letterSpacing: 1
  },
  footerLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4]
  },
  footerNavText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption
  },
  pressed: {
    opacity: 0.72
  }
});
