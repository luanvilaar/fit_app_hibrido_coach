import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextStyle
} from "react-native";
import type { CreateExerciseRequest, ExerciseCategory, ExerciseRecord } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import {
  applyMention,
  collectMentions,
  findMentionQuery,
  findMovementByName,
  splitSegments,
  suggestMovements,
  type BlockMovement,
  type MentionQuery
} from "@/data/coach-hibrido/mentions";
import {
  buildCreateExerciseRequest,
  defaultMovementCategory,
  describeMovementBankError,
  movementCategoryOptions
} from "@/data/coach-hibrido/movement-bank";
import { Chip } from "@/components/coach-hibrido/block-fields";

type MovementMentionInputProps = {
  value: string;
  catalog: ExerciseRecord[];
  placeholder: string;
  accessibilityLabel: string;
  testID: string;
  onChangeText: (value: string) => void;
  /** Ausente quando a tela não sabe cadastrar; sem ela o painel apenas sugere o que já existe. */
  onCreateMovement?: (input: CreateExerciseRequest) => Promise<ExerciseRecord>;
  /**
   * Avisa o bloco pai quando o painel (sugestões ou cadastro) está aberto, para ele também se
   * elevar acima dos blocos seguintes — sem isto, um painel alto vaza para dentro do próximo
   * bloco da lista sem que ninguém saiba que precisa ceder espaço de camada.
   */
  onPanelOpenChange?: (isOpen: boolean) => void;
};

/** O cadastro em andamento, congelado no ponto do texto onde a menção começou. */
type MovementCreation = {
  query: MentionQuery;
  name: string;
  category: ExerciseCategory;
  videoUrl: string;
  /** Salvar sem link exige um segundo toque — é a saída explícita, não o caminho fácil. */
  isConfirmingWithoutVideo: boolean;
  isSaving: boolean;
  error: string | null;
};

type PanelOption =
  | { kind: "movement"; exercise: ExerciseRecord }
  | { kind: "create"; term: string };

/** Só o Android precisa deste ajuste para casar a métrica do espelho com a do campo. */
const androidMetrics = Platform.OS === "android" ? { includeFontPadding: false } : null;

/**
 * No navegador o cursor herda a cor do texto, e o texto aqui é transparente — sem forçar
 * `caret-color` o coach digitaria sem ver onde está. É CSS puro, repassado pelo StyleSheet do
 * react-native-web; no iOS e no Android quem cumpre esse papel é `selectionColor`.
 */
const webCaret =
  Platform.OS === "web" ? ({ caretColor: colors.purple400 } as unknown as TextStyle) : null;

/** ↑↓ e Enter existem no teclado físico; no toque a lista é tocada. */
const hasPhysicalKeyboard = Platform.OS === "web";

/**
 * A métrica do texto, em números, porque a posição do painel se calcula com ela.
 * `styles.flow` lê daqui: mudar a fonte sem mudar a ancoragem passa a ser impossível.
 */
const FLOW_FONT_SIZE = 14;
const FLOW_LINE_HEIGHT = 22;
const FLOW_PADDING = spacing[3];

/** Um terço de linha entre o texto e o painel: perto o bastante para pertencer ao `@`. */
const PANEL_OFFSET = Math.round(FLOW_LINE_HEIGHT * 0.3);

/**
 * O `zIndex` que o campo assume enquanto seu painel está aberto, para subir de camada acima do
 * que vem depois dele no bloco. `BlockSheet` usa o mesmo valor para o bloco inteiro, cobrindo o
 * caso do painel vazar para além do próprio bloco.
 */
export const PANEL_ELEVATION = 20;

/**
 * A caixa onde o coach escreve o treino.
 *
 * Digitar `@` abre a lista do catálogo ancorada na própria linha em que o `@` está — num bloco
 * de vinte linhas, uma lista no fim do campo já nasce fora do campo de visão, e o coach fica
 * sem saber se a menção pegou.
 *
 * O texto é pintado duas vezes: um espelho colorido embaixo e o campo transparente por cima,
 * que só recebe digitação. É o que faz `@Front Squat` acender como link no mesmo instante em
 * que o nome fecha, sem esperar o coach salvar para descobrir. Um terceiro desenho do texto,
 * invisível, mede onde a linha do `@` termina — é a única grandeza que as três plataformas
 * relatam do mesmo jeito, e dela sai a posição do painel.
 */
export function MovementMentionInput({
  value,
  catalog,
  placeholder,
  accessibilityLabel,
  testID,
  onChangeText,
  onCreateMovement,
  onPanelOpenChange
}: MovementMentionInputProps) {
  const [cursor, setCursor] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  // Só governa a seleção no render seguinte a uma inserção; fora disso o cursor é do usuário.
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Esc fecha a lista sem fechar a menção; digitar de novo a traz de volta.
  const [dismissedTerm, setDismissedTerm] = useState<string | null>(null);
  // Altura do texto até o `@`; o resto da ancoragem é aritmética da métrica compartilhada.
  const [rulerHeight, setRulerHeight] = useState<number | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [creation, setCreation] = useState<MovementCreation | null>(null);

  const inputRef = useRef<TextInput>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const movements = useMemo(() => collectMentions(value, catalog), [value, catalog]);

  const typing = useMemo(
    () => (isFocused ? findMentionQuery(value, cursor) : null),
    [isFocused, value, cursor]
  );
  const query = typing && typing.term !== dismissedTerm ? typing : null;
  // Termo que já é um movimento inteiro não pede lista nem cadastro: a menção está fechada.
  const settled = useMemo(
    () => (query ? findMovementByName(catalog, query.term) : null),
    [catalog, query]
  );
  const suggestions = useMemo(
    () => (query && !settled ? suggestMovements(catalog, query.term) : []),
    [catalog, query, settled]
  );

  const term = query?.term.trim() ?? "";
  const canCreate = Boolean(onCreateMovement) && Boolean(query) && !settled && term.length >= 2;

  const options = useMemo<PanelOption[]>(() => {
    const list: PanelOption[] = suggestions.map((exercise) => ({ kind: "movement", exercise }));
    if (canCreate) list.push({ kind: "create", term });
    return list;
  }, [suggestions, canCreate, term]);

  // Sem sugestão e sem cadastro possível, ainda vale dizer que o texto continua valendo.
  const hasEmptyNotice = Boolean(query) && !settled && suggestions.length === 0 && term.length > 1;
  const isListOpen = !creation && Boolean(query) && !settled && (options.length > 0 || hasEmptyNotice);
  // Painel (lista ou formulário) aberto: o campo precisa subir de camada para não ser coberto
  // pelo que vem depois dele no bloco (dica de uso, movimentos vinculados, campos seguintes).
  const isPanelOpen = isListOpen || Boolean(creation);
  const anchorQuery = creation?.query ?? (isListOpen ? query : null);

  const activeOption = isListOpen
    ? options[Math.min(activeIndex, Math.max(options.length - 1, 0))] ?? null
    : null;

  /** Base da linha onde o `@` está, medida do topo do campo. */
  const lineBottom =
    rulerHeight === null ? FLOW_PADDING + FLOW_LINE_HEIGHT : rulerHeight - FLOW_PADDING;
  const below = lineBottom + PANEL_OFFSET;
  const above = lineBottom - FLOW_LINE_HEIGHT - PANEL_OFFSET - panelHeight;
  // Menção na última linha de um campo alto: abrir para baixo jogaria o painel para fora da tela.
  const flips = panelHeight > 0 && canvasHeight > 0 && below + panelHeight > canvasHeight && above >= 0;
  const panelTop = flips ? above : below;

  useEffect(() => {
    setActiveIndex(0);
  }, [query?.term]);

  useEffect(() => {
    onPanelOpenChange?.(isPanelOpen);
  }, [isPanelOpen, onPanelOpenChange]);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  /** O clique numa sugestão chega depois do blur do campo; sem isto o item some sob o cursor. */
  function keepOpen() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = null;
  }

  function returnToField() {
    keepOpen();
    setIsFocused(true);
    inputRef.current?.focus();
  }

  function insert(name: string, mention: MentionQuery) {
    const applied = applyMention(value, mention, name);

    onChangeText(applied.text);
    setCursor(applied.cursor);
    setPendingSelection({ start: applied.cursor, end: applied.cursor });
    setDismissedTerm(null);
    setCreation(null);
    returnToField();
  }

  function choose(option: PanelOption) {
    if (!query) return;

    if (option.kind === "movement") {
      insert(option.exercise.name, query);
      return;
    }

    keepOpen();
    setCreation({
      query,
      name: option.term,
      category: defaultMovementCategory,
      videoUrl: "",
      isConfirmingWithoutVideo: false,
      isSaving: false,
      error: null
    });
  }

  function patchCreation(patch: Partial<MovementCreation>) {
    setCreation((current) => (current ? { ...current, ...patch } : current));
  }

  function cancelCreation() {
    setCreation(null);
    returnToField();
  }

  async function saveCreation() {
    if (!creation || !onCreateMovement || creation.isSaving) return;

    if (!creation.videoUrl.trim() && !creation.isConfirmingWithoutVideo) {
      patchCreation({
        isConfirmingWithoutVideo: true,
        error: "Sem link o atleta não abre a demonstração. Toque de novo para salvar assim mesmo."
      });
      return;
    }

    let request: CreateExerciseRequest;

    try {
      request = buildCreateExerciseRequest(
        { name: creation.name, category: creation.category, videoUrl: creation.videoUrl },
        catalog
      );
    } catch (error) {
      patchCreation({ error: describeMovementBankError(error) });
      return;
    }

    patchCreation({ isSaving: true, error: null });

    try {
      const created = await onCreateMovement(request);
      // O nome que entra no texto é o que voltou do banco: é ele que o catálogo vai reconhecer.
      insert(created.name, creation.query);
    } catch (error) {
      patchCreation({ isSaving: false, error: describeMovementBankError(error) });
    }
  }

  function handleKeyPress(event: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (!isListOpen) return;

    const { key } = event.nativeEvent;
    const total = options.length;

    if (total > 0 && (key === "ArrowDown" || key === "ArrowUp")) {
      event.preventDefault?.();
      const step = key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (Math.min(index, total - 1) + step + total) % total);
      return;
    }

    // Enter aqui fecha a menção em vez de quebrar linha: a lista aberta é a intenção do momento.
    if (key === "Enter" || key === "Tab") {
      if (!activeOption) return;
      event.preventDefault?.();
      choose(activeOption);
      return;
    }

    if (key === "Escape") {
      event.preventDefault?.();
      setDismissedTerm(query?.term ?? "");
    }
  }

  return (
    <View
      onLayout={(event) => setCanvasHeight(event.nativeEvent.layout.height)}
      style={[styles.canvas, isPanelOpen && styles.canvasElevated]}
      testID={`${testID}-canvas`}
    >
      <MirroredBody
        draft={anchorQuery ? { start: anchorQuery.start, end: anchorQuery.end } : null}
        movements={movements}
        testID={testID}
        value={value}
      />

      <TextInput
        accessibilityLabel={accessibilityLabel}
        cursorColor={colors.purple400}
        multiline
        onBlur={() => {
          blurTimer.current = setTimeout(() => setIsFocused(false), 140);
        }}
        onChangeText={(next) => {
          setPendingSelection(null);
          setDismissedTerm(null);
          // Mexer no texto invalida o ponto onde o cadastro tinha travado a menção.
          setCreation(null);
          onChangeText(next);
        }}
        onFocus={() => {
          keepOpen();
          setIsFocused(true);
        }}
        onKeyPress={handleKeyPress}
        onSelectionChange={(event) => {
          setCursor(event.nativeEvent.selection.start);
          setPendingSelection(null);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        ref={inputRef}
        selection={pendingSelection ?? undefined}
        selectionColor={colors.purple400}
        style={[styles.flow, androidMetrics, styles.input, webCaret]}
        testID={testID}
        value={value}
      />

      {anchorQuery && (
        <MentionRuler prefix={value.slice(0, anchorQuery.start)} onMeasure={setRulerHeight} testID={testID} />
      )}

      {isFocused && <View pointerEvents="none" style={styles.focusRing} />}

      {isPanelOpen && (
        <View
          onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
          style={[styles.panel, { top: panelTop }]}
          testID={`${testID}-panel`}
        >
          {creation ? (
            <MovementForm
              creation={creation}
              onCancel={cancelCreation}
              onChange={patchCreation}
              onKeepOpen={keepOpen}
              onSave={saveCreation}
              testID={testID}
            />
          ) : (
            <View accessibilityRole="menu" testID={`${testID}-suggestions`}>
              <View style={styles.panelHeader}>
                {suggestions.length > 0 ? (
                  <Text style={styles.panelTitle}>
                    Movimentos do catálogo {term ? `com “${term}”` : ""}
                  </Text>
                ) : (
                  <Text style={styles.panelTitle} testID={`${testID}-no-suggestions`}>
                    Nenhum movimento com “{term}”
                  </Text>
                )}
                {hasPhysicalKeyboard && options.length > 0 && (
                  <Text style={styles.panelKeys}>↑↓ escolhe · Enter insere · Esc fecha</Text>
                )}
              </View>

              {suggestions.length === 0 && !canCreate && (
                <Text style={styles.panelNote}>
                  O texto continua valendo — só não terá vídeo.
                </Text>
              )}

              {options.map((option) =>
                option.kind === "movement" ? (
                  <MovementSuggestion
                    active={option === activeOption}
                    exercise={option.exercise}
                    key={option.exercise.id}
                    onPress={() => choose(option)}
                    onPressIn={keepOpen}
                    testID={`${testID}-suggestion-${option.exercise.slug}`}
                  />
                ) : (
                  <Pressable
                    accessibilityLabel={`Cadastrar ${option.term} no banco de movimentos`}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: option === activeOption }}
                    key="create"
                    onPress={() => choose(option)}
                    onPressIn={keepOpen}
                    style={({ pressed }) => [
                      styles.suggestion,
                      option === activeOption && styles.suggestionActive,
                      pressed && styles.suggestionPressed
                    ]}
                    testID={`${testID}-create`}
                  >
                    <Ionicons color={colors.mentionLink} name="add-circle-outline" size={17} />
                    <Text style={styles.suggestionName}>Cadastrar “{option.term}” no banco</Text>
                  </Pressable>
                )
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * O formulário do movimento novo, dentro do próprio painel.
 *
 * Ele nasce do termo que o coach acabou de digitar, e é por isso que fica aqui e não numa tela
 * à parte: sair da prescrição para cadastrar um movimento custa o fio do treino que estava
 * sendo escrito.
 */
function MovementForm({
  creation,
  testID,
  onChange,
  onCancel,
  onSave,
  onKeepOpen
}: {
  creation: MovementCreation;
  testID: string;
  onChange: (patch: Partial<MovementCreation>) => void;
  onCancel: () => void;
  onSave: () => void;
  onKeepOpen: () => void;
}) {
  const saveLabel = creation.isSaving
    ? "Salvando…"
    : creation.isConfirmingWithoutVideo
      ? "Salvar sem vídeo"
      : "Salvar movimento";

  function handleKeyPress(event: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (event.nativeEvent.key !== "Escape") return;
    event.preventDefault?.();
    onCancel();
  }

  return (
    <View style={styles.form} testID={`${testID}-form`}>
      <Text style={styles.formTitle}>Novo movimento no banco</Text>

      <Text style={styles.formLabel}>Nome</Text>
      <TextInput
        accessibilityLabel="Nome do movimento"
        autoFocus
        onChangeText={(name) => onChange({ name, error: null })}
        onKeyPress={handleKeyPress}
        onSubmitEditing={onSave}
        placeholder="Ex.: Back Rack Bulgarian Split Squat"
        placeholderTextColor={colors.textSecondary}
        style={styles.formInput}
        testID={`${testID}-form-name`}
        value={creation.name}
      />

      <Text style={styles.formLabel}>Categoria</Text>
      <View accessibilityRole="radiogroup" style={styles.formChips}>
        {movementCategoryOptions.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            onPress={() => onChange({ category: option.value })}
            selected={option.value === creation.category}
            testID={`${testID}-form-category-${option.value}`}
          />
        ))}
      </View>

      <Text style={styles.formLabel}>Link do vídeo</Text>
      <TextInput
        accessibilityLabel="Link do vídeo do movimento"
        autoCapitalize="none"
        autoCorrect={false}
        inputMode="url"
        // Digitar o link desfaz a confirmação de salvar sem vídeo: a intenção mudou.
        onChangeText={(videoUrl) =>
          onChange({ videoUrl, error: null, isConfirmingWithoutVideo: false })
        }
        onKeyPress={handleKeyPress}
        onSubmitEditing={onSave}
        placeholder="https://youtu.be/…"
        placeholderTextColor={colors.textSecondary}
        style={styles.formInput}
        testID={`${testID}-form-video`}
        value={creation.videoUrl}
      />

      {creation.error && (
        <Text style={styles.formError} testID={`${testID}-form-error`}>
          {creation.error}
        </Text>
      )}

      <View style={styles.formActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          onPressIn={onKeepOpen}
          style={({ pressed }) => [styles.formButton, pressed && styles.suggestionPressed]}
          testID={`${testID}-form-cancel`}
        >
          <Text style={styles.formButtonText}>Cancelar</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: creation.isSaving }}
          disabled={creation.isSaving}
          onPress={onSave}
          onPressIn={onKeepOpen}
          style={({ pressed }) => [
            styles.formButton,
            styles.formButtonPrimary,
            creation.isSaving && styles.formButtonDisabled,
            pressed && styles.suggestionPressed
          ]}
          testID={`${testID}-form-save`}
        >
          <Text style={[styles.formButtonText, styles.formButtonTextPrimary]}>{saveLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A régua: o mesmo texto, até o `@`, desenhado invisível sobre o campo.
 *
 * Ela existe porque nem o React Native nem o `react-native-web` dizem onde está o cursor dentro
 * de um campo de várias linhas. Com a métrica e a largura do espelho, a altura desta cópia é a
 * altura do texto até a linha do `@` — inclusive quando a linha quebrou sozinha.
 */
function MentionRuler({
  prefix,
  testID,
  onMeasure
}: {
  prefix: string;
  testID: string;
  onMeasure: (height: number) => void;
}) {
  return (
    <View pointerEvents="none" style={styles.rulerLayer}>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
        style={[styles.flow, androidMetrics]}
        testID={`${testID}-ruler`}
      >
        {prefix}
        {/* Largura zero, altura de linha: sem ele, um prefixo terminado em quebra mede a menos. */}
        {"\u200B"}
      </Text>
    </View>
  );
}

/**
 * O texto colorido que fica atrás do campo.
 *
 * Precisa ser caractere por caractere o mesmo `value` — inclusive o `@`, que a tela do atleta
 * descarta — senão o espelho escorrega e o coach vê fantasma. Por isso as duas views leem de
 * `styles.flow` e nenhuma acrescenta espaçamento próprio.
 */
function MirroredBody({
  value,
  movements,
  draft,
  testID
}: {
  value: string;
  movements: BlockMovement[];
  draft: { start: number; end: number } | null;
  testID: string;
}) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.flow, androidMetrics, styles.mirror]}
    >
      {renderSegments(draft ? value.slice(0, draft.start) : value, movements, `${testID}-before`)}

      {draft && (
        // A menção ainda em digitação: marcada, mas sem a cor de link, porque ainda não é uma.
        <Text style={styles.draft} testID={`${testID}-draft`}>
          {value.slice(draft.start, draft.end)}
        </Text>
      )}

      {draft && renderSegments(value.slice(draft.end), movements, `${testID}-after`)}

      {/* Largura zero, altura de linha: sustenta a última linha quando o texto termina em quebra. */}
      {"\u200B"}
    </Text>
  );
}

function renderSegments(text: string, movements: BlockMovement[], keyPrefix: string) {
  return splitSegments(text, movements).map((segment, index) => {
    const key = `${keyPrefix}-${index}`;

    if (segment.type === "text") return <Text key={key}>{segment.value}</Text>;

    return (
      <Text
        key={key}
        style={segment.movement.videoUrl ? styles.mentionLinked : styles.mentionWithoutVideo}
        testID={`${keyPrefix}-mention-${segment.movement.slug}`}
      >
        @{segment.value}
      </Text>
    );
  });
}

function MovementSuggestion({
  exercise,
  active,
  testID,
  onPress,
  onPressIn
}: {
  exercise: ExerciseRecord;
  active: boolean;
  testID: string;
  onPress: () => void;
  onPressIn: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Inserir ${exercise.name}${exercise.video_url ? " com vídeo" : ", sem vídeo cadastrado"}`}
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        styles.suggestion,
        active && styles.suggestionActive,
        pressed && styles.suggestionPressed
      ]}
      testID={testID}
    >
      <Ionicons
        color={exercise.video_url ? colors.mentionLink : colors.textSecondary}
        name={exercise.video_url ? "play-circle-outline" : "videocam-off-outline"}
        size={17}
      />
      <Text style={styles.suggestionName}>{exercise.name}</Text>
      {!exercise.video_url && <Text style={styles.suggestionMeta}>sem vídeo</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 168
  },
  /**
   * Some acima da dica de uso, dos movimentos vinculados e dos campos seguintes do bloco
   * enquanto o painel (lista ou formulário) está aberto — sem isto, a parte do painel que
   * ultrapassa `minHeight` pinta atrás do que vem depois dele no documento.
   */
  canvasElevated: {
    zIndex: PANEL_ELEVATION
  },
  /**
   * A métrica compartilhada entre espelho, régua e campo. Mudar qualquer valor aqui sem mudar
   * nos três é impossível por construção — é este o ponto.
   */
  flow: {
    fontFamily: fontFamilies.mono,
    fontSize: FLOW_FONT_SIZE,
    lineHeight: FLOW_LINE_HEIGHT,
    padding: FLOW_PADDING
  },
  mirror: { color: colors.textPrimary },
  input: {
    ...StyleSheet.absoluteFillObject,
    // O texto legível é o do espelho; aqui ficam só o cursor, a seleção e o placeholder.
    color: "transparent",
    textAlignVertical: "top"
  },
  rulerLayer: {
    left: 0,
    opacity: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  focusRing: {
    borderColor: colors.purple400,
    borderRadius: radius.lg + 1,
    borderWidth: 2,
    bottom: -1,
    left: -1,
    position: "absolute",
    right: -1,
    top: -1
  },
  mentionLinked: {
    color: colors.mentionLink,
    fontWeight: "700"
  },
  mentionWithoutVideo: {
    color: colors.mentionDraft,
    fontWeight: "700"
  },
  draft: {
    color: colors.mentionDraft,
    textDecorationLine: "underline",
    textDecorationStyle: "dotted"
  },
  /**
   * O painel flutua sobre o texto, ancorado na linha do `@`. Superfície um degrau acima do
   * campo e borda mais clara fazem o trabalho que uma sombra faria — o sistema é plano.
   */
  panel: {
    backgroundColor: colors.surface03,
    borderColor: colors.borderHover,
    borderRadius: radius.lg,
    borderWidth: 1,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    zIndex: 2
  },
  panelHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    justifyContent: "space-between",
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3]
  },
  panelTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.4
  },
  panelKeys: {
    color: colors.textMutedAccessible,
    fontFamily: fontFamilies.interface,
    fontSize: 11
  },
  panelNote: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18,
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1]
  },
  suggestion: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 46,
    paddingHorizontal: spacing[3]
  },
  suggestionActive: {
    backgroundColor: colors.purple700
  },
  suggestionPressed: {
    backgroundColor: colors.purple700,
    opacity: 0.85
  },
  suggestionName: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 14
  },
  suggestionMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11
  },
  form: {
    gap: spacing[2],
    padding: spacing[3]
  },
  formTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  formLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.4
  },
  formInput: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  formChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  formError: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  formActions: {
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "flex-end",
    paddingTop: spacing[1]
  },
  formButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  formButtonPrimary: {
    backgroundColor: colors.purple500,
    borderColor: colors.purple500
  },
  formButtonDisabled: { opacity: 0.6 },
  formButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  formButtonTextPrimary: { color: colors.white }
});
