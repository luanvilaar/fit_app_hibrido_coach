import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import type { ExerciseRecord } from "@fitblock/backend";
import {
  blockKindHints,
  blockKindLabels,
  blockKinds,
  blockLayout,
  blockScoreTypeLabels,
  blockScoreTypes,
  enduranceModalityLabels,
  exerciseCategories,
  exerciseCategoryIsQualitative,
  exerciseCategoryLabels,
  filterExerciseSuggestions,
  findExerciseByName,
  loadTypeLabels,
  supportsRanking,
  volumeUnits,
  type BlockForm,
  type BlockKind,
  type BlockPatch,
  type BlockRankingForm,
  type EnduranceModality,
  type EnduranceVolumeForm,
  type ExerciseCategory,
  type ItemPatch,
  type LoadType,
  type PrescriptionSetForm,
  type SetPatch,
  type VolumeUnit
} from "@/data/coach-calendar";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type BlockEditorProps = {
  block: BlockForm;
  blockIndex: number;
  exercises: ExerciseRecord[];
  canRemove: boolean;
  /** "" no editor de calendário, "library-" no editor de biblioteca. */
  testIDPrefix?: string;
  onRemoveBlock: () => void;
  onChangeBlock: (patch: BlockPatch) => void;
  onChangeRanking: (patch: Partial<BlockRankingForm>) => void;
  onChangeVolume: (modality: EnduranceModality, patch: Partial<Omit<EnduranceVolumeForm, "modality">>) => void;
  onAddBlockSet: () => void;
  onRemoveBlockSet: (setId: string) => void;
  onChangeBlockSet: (setId: string, patch: SetPatch) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onChangeItem: (itemId: string, patch: ItemPatch) => void;
  onAddSet: (itemId: string) => void;
  onRemoveSet: (itemId: string, setId: string) => void;
  onChangeSet: (itemId: string, setId: string, patch: SetPatch) => void;
};

const freeTextPlaceholders: Partial<Record<BlockKind, string>> = {
  conditioning: "Ex.: AMRAP 12min — 10 thrusters, 8 burpees, 200m run",
  lpo: "Ex.: Snatch técnico, foco na primeira puxada",
  endurance: "Ex.: Ritmo confortável, manter cadência constante"
};

export function BlockEditor({
  block,
  blockIndex,
  exercises,
  canRemove,
  testIDPrefix = "",
  onRemoveBlock,
  onChangeBlock,
  onChangeRanking,
  onChangeVolume,
  onAddBlockSet,
  onRemoveBlockSet,
  onChangeBlockSet,
  onAddItem,
  onRemoveItem,
  onChangeItem,
  onAddSet,
  onRemoveSet,
  onChangeSet
}: BlockEditorProps) {
  const id = (suffix: string) => `${testIDPrefix}${suffix}`;
  const isFreeText = blockLayout(block.kind) === "free-text";

  return (
    // zIndex decrescente: um bloco antes na lista precisa ficar por cima do bloco seguinte
    // quando o dropdown "Categoria do bloco" transborda o card (ambos são irmãos no DOM).
    <View style={[styles.blockCard, { zIndex: 1000 - blockIndex }]} testID={id(`block-${blockIndex}`)}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockBadge}>BLOCO {String(blockIndex + 1).padStart(2, "0")}</Text>
        {canRemove && (
          <IconAction
            icon="trash-outline"
            label={`Remover bloco ${blockIndex + 1}`}
            testID={id(`remove-block-${blockIndex}`)}
            onPress={onRemoveBlock}
          />
        )}
      </View>

      <FieldLabel label="Nome do bloco" />
      <TextInput
        accessibilityLabel={`Nome do bloco ${blockIndex + 1}`}
        onChangeText={(value) => onChangeBlock({ name: value })}
        placeholder="Força principal"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID={id(`block-name-${blockIndex}`)}
        value={block.name}
      />

      <BlockKindSelect
        blockIndex={blockIndex}
        testIDPrefix={testIDPrefix}
        value={block.kind}
        onSelect={(kind) => onChangeBlock({ kind })}
      />

      {isFreeText && (
        <View style={styles.section}>
          <FieldLabel label="Descrição do bloco" />
          <TextInput
            accessibilityLabel={`Descrição do bloco ${blockIndex + 1}`}
            autoCapitalize="sentences"
            multiline
            numberOfLines={4}
            onChangeText={(value) => onChangeBlock({ description: value })}
            placeholder={freeTextPlaceholders[block.kind]}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textArea]}
            testID={id(`block-description-${blockIndex}`)}
            value={block.description}
          />
        </View>
      )}

      {supportsRanking(block.kind) && (
        <RankingField
          blockIndex={blockIndex}
          testIDPrefix={testIDPrefix}
          ranking={block.ranking}
          onChange={onChangeRanking}
        />
      )}

      {block.kind === "lpo" && (
        <View style={styles.section}>
          <FieldLabel label="Séries" hint="repetições e carga" />
          <SetHeader />
          {block.sets.map((set, setIndex) => (
            <SetRow
              key={set.id}
              set={set}
              setIndex={setIndex}
              canRemove={block.sets.length > 1}
              accessibilityPrefix={`Série ${setIndex + 1} do bloco ${blockIndex + 1}`}
              testID={id(`block-set-${blockIndex}-${setIndex}`)}
              testIDPrefix={id("block-set")}
              testIDSuffix={`${blockIndex}-${setIndex}`}
              removeTestID={id(`remove-block-set-${blockIndex}-${setIndex}`)}
              onChange={(patch) => onChangeBlockSet(set.id, patch)}
              onRemove={() => onRemoveBlockSet(set.id)}
            />
          ))}
          <TextButton
            icon="add"
            label="Adicionar série"
            testID={id(`add-block-set-${blockIndex}`)}
            onPress={onAddBlockSet}
          />
        </View>
      )}

      {block.kind === "endurance" && (
        <View style={styles.section}>
          <FieldLabel label="Volume por modalidade" />
          {block.volumes.map((volume) => (
            <VolumeRow
              key={volume.modality}
              blockIndex={blockIndex}
              testIDPrefix={testIDPrefix}
              volume={volume}
              onChange={(patch) => onChangeVolume(volume.modality, patch)}
            />
          ))}
        </View>
      )}

      {!isFreeText && (
        <>
          {block.items.map((item, itemIndex) => {
            const matchedExercise = findExerciseByName(exercises, item.exerciseName);
            const isNewMovement = !matchedExercise && item.exerciseName.trim().length > 0;
            const isQualitative = exerciseCategoryIsQualitative(item.category);

            return (
              // Mesma lógica do bloco: exercício anterior por cima do seguinte, e sempre
              // abaixo do dropdown de categoria (zIndex 30) do próprio bloco.
              <View
                key={item.id}
                style={[styles.itemCard, { zIndex: 25 - itemIndex }]}
                testID={id(`item-${blockIndex}-${itemIndex}`)}
              >
                <View style={styles.fieldRowTight}>
                  <View style={styles.fieldGrow}>
                    <FieldLabel label="Exercício" />
                    <ExerciseNameField
                      accessibilityLabel={`Exercício ${itemIndex + 1} do bloco ${blockIndex + 1}`}
                      exercises={exercises}
                      onChangeText={(value) => onChangeItem(item.id, { exerciseName: value })}
                      onSelect={(exercise) =>
                        onChangeItem(item.id, { exerciseName: exercise.name, category: exercise.category })
                      }
                      testID={id(`exercise-name-${blockIndex}-${itemIndex}`)}
                      value={item.exerciseName}
                    />
                  </View>
                  {!isQualitative && (
                    <View style={styles.fieldRest}>
                      <FieldLabel label="Descanso" hint="seg" />
                      <TextInput
                        accessibilityLabel={`Descanso do exercício ${itemIndex + 1} do bloco ${blockIndex + 1}`}
                        keyboardType="number-pad"
                        onChangeText={(value) => onChangeItem(item.id, { restSeconds: value })}
                        style={styles.input}
                        testID={id(`rest-seconds-${blockIndex}-${itemIndex}`)}
                        value={item.restSeconds}
                      />
                    </View>
                  )}
                  {block.items.length > 1 && (
                    <View style={styles.itemRemove}>
                      <IconAction
                        icon="close"
                        label={`Remover exercício ${itemIndex + 1} do bloco ${blockIndex + 1}`}
                        testID={id(`remove-item-${blockIndex}-${itemIndex}`)}
                        onPress={() => onRemoveItem(item.id)}
                      />
                    </View>
                  )}
                </View>

                {matchedExercise?.category && (
                  <Text style={styles.categoryHint} testID={id(`exercise-category-hint-${blockIndex}-${itemIndex}`)}>
                    Categoria do catálogo: {exerciseCategoryLabels[matchedExercise.category]}
                  </Text>
                )}

                {isNewMovement && (
                  <ExerciseCategoryPicker
                    blockIndex={blockIndex}
                    itemIndex={itemIndex}
                    testIDPrefix={testIDPrefix}
                    value={item.category}
                    onSelect={(category) => onChangeItem(item.id, { category })}
                  />
                )}

                {isQualitative ? (
                  <View style={styles.section}>
                    <FieldLabel label="Descrição do movimento" hint="texto livre, sem séries" />
                    <TextInput
                      accessibilityLabel={`Descrição do exercício ${itemIndex + 1} do bloco ${blockIndex + 1}`}
                      multiline
                      numberOfLines={3}
                      onChangeText={(value) => onChangeItem(item.id, { notes: value })}
                      placeholder="Ex.: 3 tentativas de bar muscle-up, foco na transição"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, styles.textArea]}
                      testID={id(`item-notes-${blockIndex}-${itemIndex}`)}
                      value={item.notes}
                    />
                  </View>
                ) : (
                  <>
                    <SetHeader />

                    {item.sets.map((set, setIndex) => (
                      <SetRow
                        key={set.id}
                        set={set}
                        setIndex={setIndex}
                        canRemove={item.sets.length > 1}
                        accessibilityPrefix={`Série ${setIndex + 1}`}
                        testID={id(`set-${blockIndex}-${itemIndex}-${setIndex}`)}
                        testIDPrefix={id("set")}
                        testIDSuffix={`${blockIndex}-${itemIndex}-${setIndex}`}
                        removeTestID={id(`remove-set-${blockIndex}-${itemIndex}-${setIndex}`)}
                        onChange={(patch) => onChangeSet(item.id, set.id, patch)}
                        onRemove={() => onRemoveSet(item.id, set.id)}
                      />
                    ))}

                    <TextButton
                      icon="add"
                      label="Adicionar série"
                      testID={id(`add-set-${blockIndex}-${itemIndex}`)}
                      onPress={() => onAddSet(item.id)}
                    />
                  </>
                )}
              </View>
            );
          })}

          <TextButton
            icon="barbell-outline"
            label="Adicionar exercício"
            testID={id(`add-item-${blockIndex}`)}
            onPress={onAddItem}
          />
        </>
      )}
    </View>
  );
}

/** Seletor da categoria: lista suspensa com as modalidades disponíveis. */
function BlockKindSelect({
  blockIndex,
  testIDPrefix,
  value,
  onSelect
}: {
  blockIndex: number;
  testIDPrefix: string;
  value: BlockKind;
  onSelect: (kind: BlockKind) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const id = (suffix: string) => `${testIDPrefix}${suffix}`;

  return (
    <View style={styles.blockKindSection}>
      <FieldLabel label="Categoria do bloco" />
      <View style={styles.selectWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Categoria do bloco ${blockIndex + 1}: ${blockKindLabels[value]}`}
          accessibilityState={{ expanded: isOpen }}
          testID={id(`block-kind-${blockIndex}`)}
          onPress={() => setIsOpen((current) => !current)}
          style={({ pressed }) => [styles.selectTrigger, pressed && styles.pressed]}
        >
          <View style={styles.selectTriggerCopy}>
            <Text style={styles.selectTriggerLabel}>{blockKindLabels[value]}</Text>
            <Text style={styles.selectTriggerHint}>{blockKindHints[value]}</Text>
          </View>
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
        </Pressable>

        {isOpen && (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`Categorias do bloco ${blockIndex + 1}`}
            style={styles.selectList}
            testID={id(`block-kind-${blockIndex}-options`)}
          >
            {blockKinds.map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="radio"
                accessibilityLabel={blockKindLabels[kind]}
                accessibilityState={{ selected: value === kind }}
                testID={id(`block-kind-${blockIndex}-${kind}`)}
                onPress={() => {
                  onSelect(kind);
                  setIsOpen(false);
                }}
                style={({ pressed }) => [
                  styles.selectOption,
                  value === kind && styles.selectOptionActive,
                  pressed && styles.pressed
                ]}
              >
                <View style={styles.selectTriggerCopy}>
                  <Text style={[styles.selectOptionLabel, value === kind && styles.selectOptionLabelActive]}>
                    {blockKindLabels[kind]}
                  </Text>
                  <Text style={styles.selectTriggerHint}>{blockKindHints[kind]}</Text>
                </View>
                {value === kind && <Ionicons name="checkmark" size={16} color={colors.fitblockPurple} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/** Ranking interno do bloco: o envio de score pelo atleta chega numa etapa seguinte. */
function RankingField({
  blockIndex,
  testIDPrefix,
  ranking,
  onChange
}: {
  blockIndex: number;
  testIDPrefix: string;
  ranking: BlockRankingForm;
  onChange: (patch: Partial<BlockRankingForm>) => void;
}) {
  const id = (suffix: string) => `${testIDPrefix}${suffix}`;

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`Ranking interno do bloco ${blockIndex + 1}`}
        accessibilityState={{ checked: ranking.enabled }}
        testID={id(`block-ranking-${blockIndex}`)}
        onPress={() => onChange({ enabled: !ranking.enabled })}
        style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
      >
        <Ionicons
          name={ranking.enabled ? "checkbox-outline" : "square-outline"}
          size={20}
          color={ranking.enabled ? colors.fitblockPurple : colors.textMuted}
        />
        <View style={styles.selectTriggerCopy}>
          <Text style={styles.toggleLabel}>Ranking interno do bloco</Text>
          <Text style={styles.selectTriggerHint}>Os atletas comparam o score entre si neste bloco</Text>
        </View>
      </Pressable>

      {ranking.enabled && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={`Tipo de score do bloco ${blockIndex + 1}`}
          style={styles.chipRow}
        >
          {blockScoreTypes.map((scoreType) => (
            <Pressable
              key={scoreType}
              accessibilityRole="radio"
              accessibilityLabel={blockScoreTypeLabels[scoreType]}
              accessibilityState={{ selected: ranking.scoreType === scoreType }}
              testID={id(`block-score-type-${blockIndex}-${scoreType}`)}
              onPress={() => onChange({ scoreType })}
              style={({ pressed }) => [
                styles.chip,
                ranking.scoreType === scoreType && styles.chipActive,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.chipText, ranking.scoreType === scoreType && styles.chipTextActive]}>
                {blockScoreTypeLabels[scoreType]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function VolumeRow({
  blockIndex,
  testIDPrefix,
  volume,
  onChange
}: {
  blockIndex: number;
  testIDPrefix: string;
  volume: EnduranceVolumeForm;
  onChange: (patch: Partial<Omit<EnduranceVolumeForm, "modality">>) => void;
}) {
  const id = (suffix: string) => `${testIDPrefix}${suffix}`;
  const label = enduranceModalityLabels[volume.modality];

  return (
    <View style={styles.volumeRow}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`${label} no bloco ${blockIndex + 1}`}
        accessibilityState={{ checked: volume.enabled }}
        testID={id(`block-volume-${blockIndex}-${volume.modality}`)}
        onPress={() => onChange({ enabled: !volume.enabled })}
        style={({ pressed }) => [styles.volumeToggle, pressed && styles.pressed]}
      >
        <Ionicons
          name={volume.enabled ? "checkbox-outline" : "square-outline"}
          size={18}
          color={volume.enabled ? colors.fitblockPurple : colors.textMuted}
        />
        <Text style={styles.toggleLabel}>{label}</Text>
      </Pressable>

      {volume.enabled && (
        <>
          <TextInput
            accessibilityLabel={`Volume de ${label.toLowerCase()} no bloco ${blockIndex + 1}`}
            keyboardType="decimal-pad"
            onChangeText={(value) => onChange({ volume: value })}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.volumeInput]}
            testID={id(`block-volume-value-${blockIndex}-${volume.modality}`)}
            value={volume.volume}
          />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`Unidade de ${label.toLowerCase()} no bloco ${blockIndex + 1}`}
            style={styles.unitRow}
          >
            {volumeUnits.map((unit) => (
              <Pressable
                key={unit}
                accessibilityRole="radio"
                accessibilityLabel={`${label} em ${unit}`}
                accessibilityState={{ selected: volume.unit === unit }}
                testID={id(`block-volume-unit-${blockIndex}-${volume.modality}-${unit}`)}
                onPress={() => onChange({ unit: unit as VolumeUnit })}
                style={({ pressed }) => [
                  styles.unitChip,
                  volume.unit === unit && styles.chipActive,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.chipText, volume.unit === unit && styles.chipTextActive]}>{unit}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function SetHeader() {
  return (
    <View style={styles.setHeader}>
      <Text style={styles.setHeaderIndex}>#</Text>
      <Text style={styles.setHeaderLabel}>Reps (3 ou 3-5)</Text>
      <Text style={styles.setHeaderLabel}>Carga</Text>
      <View style={styles.setHeaderSpacer} />
    </View>
  );
}

function SetRow({
  set,
  setIndex,
  canRemove,
  accessibilityPrefix,
  testID,
  testIDPrefix,
  testIDSuffix,
  removeTestID,
  onChange,
  onRemove
}: {
  set: PrescriptionSetForm;
  setIndex: number;
  canRemove: boolean;
  accessibilityPrefix: string;
  testID: string;
  testIDPrefix: string;
  testIDSuffix: string;
  removeTestID: string;
  onChange: (patch: SetPatch) => void;
  onRemove: () => void;
}) {
  const nextLoadType: LoadType = set.loadType === "percentage-1rm" ? "fixed" : "percentage-1rm";

  return (
    <View style={styles.setRow} testID={testID}>
      <Text style={styles.setIndex}>{setIndex + 1}</Text>
      <TextInput
        accessibilityLabel={`Repetições da série ${setIndex + 1}`}
        keyboardType="numbers-and-punctuation"
        onChangeText={(value) => onChange({ reps: value })}
        style={[styles.input, styles.setInput]}
        testID={`${testIDPrefix}-reps-${testIDSuffix}`}
        value={set.reps}
      />
      <View style={styles.loadField}>
        <TextInput
          accessibilityLabel={`Carga da série ${setIndex + 1}`}
          keyboardType="decimal-pad"
          onChangeText={(value) => onChange({ load: value })}
          placeholder="opcional"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.setInput]}
          testID={`${testIDPrefix}-load-${testIDSuffix}`}
          value={set.load}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityPrefix}: alternar unidade da carga para ${loadTypeLabels[nextLoadType]}`}
          testID={`${testIDPrefix}-load-type-${testIDSuffix}`}
          onPress={() => onChange({ loadType: nextLoadType })}
          style={({ pressed }) => [styles.loadTypeButton, pressed && styles.pressed]}
        >
          <Text style={styles.loadTypeText}>{loadTypeLabels[set.loadType]}</Text>
        </Pressable>
      </View>
      <View style={styles.setRemove}>
        {canRemove && (
          <IconAction
            icon="remove-circle-outline"
            label={`Remover série ${setIndex + 1}`}
            testID={removeTestID}
            onPress={onRemove}
          />
        )}
      </View>
    </View>
  );
}

/** Campo de exercício com sugestões dos movimentos já cadastrados no banco (catálogo + criados por coaches). */
function ExerciseNameField({
  value,
  exercises,
  accessibilityLabel,
  testID,
  onChangeText,
  onSelect
}: {
  value: string;
  exercises: ExerciseRecord[];
  accessibilityLabel: string;
  testID: string;
  onChangeText: (value: string) => void;
  onSelect: (exercise: ExerciseRecord) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  // Atraso no blur: dá tempo do toque na sugestão ser processado antes da lista sumir.
  const suggestions = isFocused ? filterExerciseSuggestions(exercises, value) : [];

  return (
    <View style={styles.exerciseFieldWrap}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="words"
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        placeholder="Back Squat"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID={testID}
        value={value}
      />
      {suggestions.length > 0 && (
        <View style={styles.suggestionList} testID={`${testID}-suggestions`}>
          {suggestions.map((exercise) => (
            <Pressable
              key={exercise.id}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${exercise.name} do catálogo${
                exercise.category ? `, categoria ${exerciseCategoryLabels[exercise.category]}` : ""
              }`}
              testID={`${testID}-suggestion-${exercise.slug}`}
              onPress={() => onSelect(exercise)}
              style={({ pressed }) => [styles.suggestionItem, pressed && styles.pressed]}
            >
              <View style={styles.suggestionCopy}>
                <Text style={styles.suggestionText}>{exercise.name}</Text>
                {exercise.category && (
                  <Text style={styles.suggestionCategory}>{exerciseCategoryLabels[exercise.category]}</Text>
                )}
              </View>
              {exercise.video_url && <Ionicons name="play-circle-outline" size={14} color={colors.textMuted} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Aparece só quando o nome digitado ainda não bate com nenhum movimento do catálogo. */
function ExerciseCategoryPicker({
  blockIndex,
  itemIndex,
  testIDPrefix,
  value,
  onSelect
}: {
  blockIndex: number;
  itemIndex: number;
  testIDPrefix: string;
  value: ExerciseCategory | null;
  onSelect: (category: ExerciseCategory) => void;
}) {
  const id = (suffix: string) => `${testIDPrefix}${suffix}`;

  return (
    <View style={styles.section}>
      <FieldLabel label="Categoria do movimento" hint="movimento novo, ainda não está no catálogo" />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`Categoria do exercício ${itemIndex + 1} do bloco ${blockIndex + 1}`}
        style={styles.chipRow}
      >
        {exerciseCategories.map((category) => (
          <Pressable
            key={category}
            accessibilityRole="radio"
            accessibilityLabel={exerciseCategoryLabels[category]}
            accessibilityState={{ selected: value === category }}
            testID={id(`exercise-category-${blockIndex}-${itemIndex}-${category}`)}
            onPress={() => onSelect(category)}
            style={({ pressed }) => [styles.chip, value === category && styles.chipActive, pressed && styles.pressed]}
          >
            <Text style={[styles.chipText, value === category && styles.chipTextActive]}>
              {exerciseCategoryLabels[category]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

export function IconAction({
  icon,
  label,
  testID,
  onPress
}: {
  icon: IconName;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

export function TextButton({
  icon,
  label,
  testID,
  onPress
}: {
  icon: IconName;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={15} color={colors.fitblockPurple} />
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blockCard: {
    borderColor: colors.hairline,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[5],
    padding: spacing[4]
  },
  blockHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[3]
  },
  blockBadge: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2
  },
  section: { marginTop: spacing[4] },
  // z-index próprio (não só no selectWrap interno): sem isso, o dropdown perde para o
  // item-card seguinte, que é irmão deste bloco e vem depois no DOM.
  blockKindSection: { marginTop: spacing[4], zIndex: 30 },
  fieldLabelRow: { alignItems: "baseline", flexDirection: "row", gap: spacing[2], marginBottom: spacing[2] },
  fieldLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  fieldHint: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11 },
  input: {
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  textArea: { minHeight: 96, paddingTop: spacing[3], textAlignVertical: "top" },
  selectWrap: { position: "relative", zIndex: 30, overflow: "visible" },
  selectTrigger: {
    alignItems: "center",
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing[3]
  },
  selectTriggerCopy: { flex: 1, minWidth: 0 },
  selectTriggerLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  selectTriggerHint: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11, marginTop: 2 },
  selectList: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    elevation: 4,
    left: 0,
    marginTop: spacing[1],
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    top: "100%",
    zIndex: 1000
  },
  selectOption: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 52,
    paddingHorizontal: spacing[3]
  },
  selectOptionActive: { backgroundColor: "#F8F6FF" },
  selectOptionLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  selectOptionLabelActive: { color: colors.fitblockPurple },
  toggleRow: { alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44 },
  toggleLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[2] },
  chip: {
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing[3]
  },
  chipActive: { backgroundColor: colors.fitblockPurple, borderColor: colors.fitblockPurple },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: colors.canvas },
  volumeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    marginTop: spacing[2]
  },
  volumeToggle: { alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44, minWidth: 108 },
  volumeInput: { flexGrow: 1, minWidth: 80 },
  unitRow: { flexDirection: "row", gap: spacing[1] },
  unitChip: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 40
  },
  itemCard: {
    backgroundColor: colors.softCloud,
    borderRadius: radius.sm,
    marginTop: spacing[4],
    padding: spacing[3]
  },
  fieldRowTight: { alignItems: "flex-end", flexDirection: "row", gap: spacing[2], zIndex: 20 },
  fieldGrow: { flex: 2, minWidth: 0 },
  fieldRest: { flex: 1, minWidth: 0 },
  itemRemove: { paddingBottom: 4 },
  exerciseFieldWrap: { position: "relative", zIndex: 20 },
  suggestionList: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    elevation: 4,
    left: 0,
    marginTop: spacing[1],
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    top: "100%",
    zIndex: 20
  },
  suggestionItem: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
    minHeight: 40,
    paddingHorizontal: spacing[3]
  },
  suggestionCopy: { flex: 1, minWidth: 0 },
  suggestionText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  suggestionCategory: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11, marginTop: 2 },
  categoryHint: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "700",
    marginTop: spacing[2]
  },
  setHeader: { flexDirection: "row", gap: spacing[2], marginTop: spacing[4] },
  setHeaderIndex: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    width: 20
  },
  setHeaderLabel: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800"
  },
  setHeaderSpacer: { width: 32 },
  // flexWrap como rede de segurança: mesmo com as caixas compactas, se a coluna ficar
  // estreita demais (grade em duas colunas), o botão de unidade quebra para a linha
  // seguinte em vez de estourar a borda do card.
  setRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] },
  setIndex: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "800",
    width: 20
  },
  // Largura fixa e compacta: cabe "8-12" ou "82.5" sem esticar para preencher a linha
  // toda, o que empurrava o botão de unidade para fora do card.
  setInput: { backgroundColor: colors.canvas, paddingHorizontal: spacing[2], width: 64 },
  loadField: { alignItems: "center", flexDirection: "row", gap: spacing[1] },
  loadTypeButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: spacing[2]
  },
  loadTypeText: { color: colors.fitblockPurple, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "800" },
  setRemove: { alignItems: "center", width: 32 },
  iconAction: { alignItems: "center", borderRadius: radius.pill, height: 44, justifyContent: "center", width: 44 },
  textButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[3],
    minHeight: 44,
    paddingHorizontal: spacing[2]
  },
  textButtonLabel: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "800"
  },
  pressed: { opacity: 0.72 }
});
