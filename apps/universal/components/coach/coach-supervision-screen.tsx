import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { createCoachSupervisionRepository, type CoachSupervisionSessionRecord, type CoachSupervisionWorkout } from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import { filterSupervisionItems, groupSupervisionRoster, type SupervisionAthlete, type SupervisionTeam } from "@/data/coach-supervision";
import { getSessionTitle, readSessionBlocks } from "@/data/coach-hibrido/session-snapshot";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type Tab = "athletes" | "teams";

function useRoster() {
  const [athletes, setAthletes] = useState<SupervisionAthlete[]>([]);
  const [teams, setTeams] = useState<SupervisionTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError(getSupabaseConfigurationError() ?? "Acompanhamento indisponível.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true); setError(null);
    try {
      const roster = await createCoachSupervisionRepository(supabase).listRoster();
      const grouped = groupSupervisionRoster(roster);
      setAthletes(grouped.athletes); setTeams(grouped.teams);
    } catch (cause) {
      setError(describeBackendError(cause)); setAthletes([]); setTeams([]);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { athletes, teams, isLoading, error, refresh };
}

export function CoachSupervisionScreen() {
  const router = useRouter();
  const { athletes, teams, isLoading, error, refresh } = useRoster();
  const [tab, setTab] = useState<Tab>("athletes");
  const [query, setQuery] = useState("");
  const shownAthletes = useMemo(() => filterSupervisionItems(athletes, query), [athletes, query]);
  const shownTeams = useMemo(() => filterSupervisionItems(teams, query), [teams, query]);

  return <View style={styles.page} testID="coach-supervision-screen">
    <View><Text style={styles.eyebrow}>ÁREA DO COACH</Text><Text style={styles.title}>Acompanhe seus atletas.</Text><Text style={styles.description}>Consulte prescrições e progresso sem acessar a conta do aluno.</Text></View>
    <View style={styles.search}><Ionicons name="search-outline" color={colors.textSecondary} size={20} /><TextInput accessibilityLabel="Buscar atletas e equipes" placeholder="Buscar atletas e equipes" placeholderTextColor={colors.textSecondary} value={query} onChangeText={setQuery} style={styles.searchInput} /></View>
    <View accessibilityRole="tablist" style={styles.tabs}>
      <TabButton active={tab === "athletes"} label="Atletas" onPress={() => setTab("athletes")} />
      <TabButton active={tab === "teams"} label="Equipes" onPress={() => setTab("teams")} />
    </View>
    {isLoading && <Text style={styles.state}>Carregando acompanhamento…</Text>}
    {!isLoading && error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Tentar carregar acompanhamento novamente" onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>}
    {!isLoading && !error && tab === "athletes" && <RosterList athletes={shownAthletes} onAthlete={(id) => router.push(`/app/coach/acompanhamento/atletas/${id}`)} />}
    {!isLoading && !error && tab === "teams" && <TeamList teams={shownTeams} onTeam={(id) => router.push(`/app/coach/acompanhamento/equipes/${id}`)} />}
  </View>;
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={`Ver ${label}`} onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function RosterList({ athletes, onAthlete }: { athletes: SupervisionAthlete[]; onAthlete: (id: string) => void }) {
  if (!athletes.length) return <Text style={styles.state} testID="coach-supervision-empty">Nenhum atleta encontrado neste escopo.</Text>;
  return <View style={styles.list}>{athletes.map((athlete) => <Pressable key={athlete.id} accessibilityRole="button" accessibilityLabel={`Abrir acompanhamento de ${athlete.name}`} onPress={() => onAthlete(athlete.id)} style={styles.row}><Avatar name={athlete.name} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{athlete.name}</Text><Text style={styles.rowMeta}>{athlete.teams.map((team) => team.name).join(" · ")}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></Pressable>)}</View>;
}

function TeamList({ teams, onTeam }: { teams: SupervisionTeam[]; onTeam: (id: string) => void }) {
  if (!teams.length) return <Text style={styles.state} testID="coach-supervision-empty">Nenhuma equipe encontrada neste escopo.</Text>;
  return <View style={styles.list}>{teams.map((team) => <Pressable key={team.id} accessibilityRole="button" accessibilityLabel={`Abrir equipe ${team.name}`} onPress={() => onTeam(team.id)} style={styles.row}><View style={styles.teamIcon}><Ionicons name="people-outline" size={21} color={colors.purple400} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{team.name}</Text><Text style={styles.rowMeta}>{team.athletes.length} {team.athletes.length === 1 ? "atleta" : "atletas"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></Pressable>)}</View>;
}

export function CoachSupervisionAthleteScreen() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const { athletes, isLoading: rosterLoading, error } = useRoster();
  const [sessions, setSessions] = useState<CoachSupervisionSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const router = useRouter();
  const athlete = athletes.find((item) => item.id === athleteId);

  useEffect(() => {
    if (!athleteId || !supabase) { setIsLoading(false); return; }
    const now = new Date(); const from = new Date(now); from.setDate(now.getDate() - 7); const to = new Date(now); to.setDate(now.getDate() + 30);
    setIsLoading(true); setSessionError(null);
    void createCoachSupervisionRepository(supabase).listAthleteSessions(athleteId, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)).then(setSessions).catch((cause) => setSessionError(describeBackendError(cause))).finally(() => setIsLoading(false));
  }, [athleteId]);

  if (rosterLoading) return <Text style={styles.state}>Carregando atleta…</Text>;
  if (error || !athlete) return <Text accessibilityRole="alert" style={styles.state}>{error ?? "Atleta não encontrado no seu escopo."}</Text>;
  return <View style={styles.page} testID="coach-supervision-athlete-screen"><Pressable accessibilityRole="button" accessibilityLabel="Voltar para acompanhamento" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" color={colors.textPrimary} size={18} /><Text style={styles.backText}>Acompanhamento</Text></Pressable><View><Text style={styles.eyebrow}>ATLETA</Text><Text style={styles.title}>{athlete.name}</Text><Text style={styles.description}>{athlete.teams.map((team) => team.name).join(" · ")}</Text></View>{isLoading && <Text style={styles.state}>Carregando prescrições…</Text>}{sessionError && <Text accessibilityRole="alert" style={styles.state}>{sessionError}</Text>}{!isLoading && !sessionError && <SessionList sessions={sessions} onSession={(id) => router.push(`/app/coach/acompanhamento/atletas/${athlete.id}/sessoes/${id}`)} />}</View>;
}

export function CoachSupervisionTeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>(); const { teams, isLoading, error } = useRoster(); const router = useRouter(); const team = teams.find((item) => item.id === teamId);
  if (isLoading) return <Text style={styles.state}>Carregando equipe…</Text>;
  if (error || !team) return <Text accessibilityRole="alert" style={styles.state}>{error ?? "Equipe não encontrada no seu escopo."}</Text>;
  return <View style={styles.page}><Pressable accessibilityRole="button" accessibilityLabel="Voltar para acompanhamento" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" color={colors.textPrimary} size={18} /><Text style={styles.backText}>Acompanhamento</Text></Pressable><View><Text style={styles.eyebrow}>EQUIPE</Text><Text style={styles.title}>{team.name}</Text><Text style={styles.description}>Selecione um atleta para consultar suas prescrições.</Text></View><RosterList athletes={team.athletes} onAthlete={(id) => router.push(`/app/coach/acompanhamento/atletas/${id}`)} /></View>;
}

function SessionList({ sessions, onSession }: { sessions: CoachSupervisionSessionRecord[]; onSession: (id: string) => void }) {
  if (!sessions.length) return <Text style={styles.state}>Nenhuma sessão publicada nos próximos 30 dias.</Text>;
  return <View style={styles.list}>{sessions.map((session) => <Pressable key={session.id} accessibilityRole="button" accessibilityLabel={`Consultar sessão ${getSessionTitle(session)}`} onPress={() => onSession(session.id)} style={styles.row}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{getSessionTitle(session)}</Text><Text style={styles.rowMeta}>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${session.scheduled_date}T12:00:00`))} · {session.team_name} · {session.progress_state ?? "não iniciada"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></Pressable>)}</View>;
}

export function CoachSupervisionSessionScreen() {
  const { athleteId, sessionId } = useLocalSearchParams<{ athleteId: string; sessionId: string }>(); const router = useRouter(); const [workout, setWorkout] = useState<CoachSupervisionWorkout | null>(null); const [error, setError] = useState<string | null>(null); const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { if (!supabase || !athleteId || !sessionId) { setError(getSupabaseConfigurationError() ?? "Sessão inválida."); setIsLoading(false); return; } void createCoachSupervisionRepository(supabase).getAthleteSession(athleteId, sessionId).then(setWorkout).catch((cause) => setError(describeBackendError(cause))).finally(() => setIsLoading(false)); }, [athleteId, sessionId]);
  if (isLoading) return <Text style={styles.state}>Carregando sessão…</Text>;
  if (error || !workout?.session) return <Text accessibilityRole="alert" style={styles.state}>{error ?? "Sessão indisponível."}</Text>;
  const blocks = readSessionBlocks(workout.session); const completed = workout.progress?.completed_block_ids.length ?? 0;
  return <View style={styles.page} testID="coach-supervision-session-screen"><Pressable accessibilityRole="button" accessibilityLabel="Voltar para prescrições do atleta" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" color={colors.textPrimary} size={18} /><Text style={styles.backText}>Prescrições</Text></Pressable><View><Text style={styles.eyebrow}>CONSULTA SOMENTE LEITURA</Text><Text style={styles.title}>{getSessionTitle(workout.session)}</Text><Text style={styles.description}>{workout.session.scheduled_date} · {workout.progress?.state ?? "não iniciada"} · {completed} de {blocks.length} blocos concluídos</Text></View>{workout.session.coach_note ? <View style={styles.note}><Text style={styles.noteText}>{workout.session.coach_note}</Text></View> : null}<View style={styles.list}>{blocks.map((block) => <View key={block.id} style={styles.block}><Text style={styles.rowTitle}>{block.name}</Text>{block.body ? <Text style={styles.rowMeta}>{block.body}</Text> : null}{block.movements.length ? <Text style={styles.blockMovements}>{block.movements.map((movement) => movement.name).join(" · ")}</Text> : null}</View>)}</View><View style={styles.results} testID="coach-supervision-results"><Text style={styles.rowTitle}>Resultados registrados</Text>{workout.results.length ? workout.results.map((result) => <Text key={result.id} style={styles.rowMeta}>Série {result.set_number}: {result.reps ?? "—"} reps · {result.load_kg ?? "—"} kg · {result.completed ? "concluída" : "pendente"}</Text>) : <Text style={styles.rowMeta}>Nenhum resultado registrado pelo atleta.</Text>}</View><Text style={styles.readOnly}>Esta visualização não altera o treino ou o progresso do atleta.</Text></View>;
}

function Avatar({ name }: { name: string }) { return <View style={styles.avatar}><Text style={styles.avatarText}>{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</Text></View>; }

const styles = StyleSheet.create({
  page: { gap: spacing[5], maxWidth: 780 }, eyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 11, letterSpacing: 1.4 }, title: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 43, marginTop: spacing[1] }, description: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 16, lineHeight: 23, marginTop: spacing[2] }, search: { alignItems: "center", backgroundColor: colors.surface03, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", gap: spacing[2], minHeight: 48, paddingHorizontal: spacing[4] }, searchInput: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 16, minHeight: 44 }, tabs: { borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row" }, tab: { alignItems: "center", flex: 1, minHeight: 48, justifyContent: "center" }, tabActive: { borderBottomColor: colors.textPrimary, borderBottomWidth: 3 }, tabText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 16 }, tabTextActive: { color: colors.textPrimary }, list: { backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" }, row: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing[3], minHeight: 68, padding: spacing[4] }, rowCopy: { flex: 1, gap: 2 }, rowTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 16 }, rowMeta: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 18 }, avatar: { alignItems: "center", backgroundColor: colors.purple700, borderRadius: radius.pill, height: 38, justifyContent: "center", width: 38 }, avatarText: { color: colors.white, fontFamily: fontFamilies.interfaceBold, fontSize: 12 }, teamIcon: { alignItems: "center", backgroundColor: colors.surface04, borderRadius: radius.md, height: 38, justifyContent: "center", width: 38 }, state: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 15, lineHeight: 22 }, error: { backgroundColor: colors.surface03, borderColor: colors.danger, borderRadius: radius.md, borderWidth: 1, gap: spacing[3], padding: spacing[4] }, errorText: { color: colors.textPrimary, fontFamily: fontFamilies.interface, fontSize: 14 }, retry: { alignItems: "center", backgroundColor: colors.surface04, borderRadius: radius.pill, minHeight: 44, paddingHorizontal: spacing[4], justifyContent: "center", alignSelf: "flex-start" }, retryText: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 13 }, back: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing[2], minHeight: 44 }, backText: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 14 }, note: { backgroundColor: colors.surface03, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing[4] }, noteText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 15, lineHeight: 22 }, block: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing[2], padding: spacing[4] }, blockMovements: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 13 }, results: { backgroundColor: colors.surface03, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing[2], padding: spacing[4] }, readOnly: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 20 }
});
