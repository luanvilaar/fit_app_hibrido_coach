import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { CalendarSessionRecord, TrainingGroupRecord } from "@fitblock/backend";
import { parseCalendarDate } from "@/data/calendar";
import { WeekBoard } from "@/components/coach-hibrido/week-board";

const team: TrainingGroupRecord = {
  id: "team-1",
  name: "Strength Base",
  description: "",
  level: "intermediário",
  objective: "Força",
  created_by: "coach-1",
  created_at: "2026-08-01T00:00:00.000Z"
};

const scheduledDate = "2026-08-10";

const session = {
  id: "session-1",
  team_id: "team-1",
  scheduled_date: scheduledDate,
  status: "published",
  state: "available",
  coach_note: "",
  snapshot: {
    title: "Segunda pesada",
    blocks: [
      {
        id: "block-1",
        name: "Força & Acessórios",
        kind: "strength",
        details: { schema_version: 3, body: "@Front Squat\n4 x 5" },
        items: []
      },
      {
        id: "block-2",
        name: "Metcon",
        kind: "metcon",
        details: { schema_version: 3, body: "21-15-9\n@Thruster\n@Pull Up" },
        items: []
      }
    ]
  },
  updated_at: "2026-08-09T00:00:00.000Z"
} as unknown as CalendarSessionRecord;

const noop = () => {};

function renderBoard() {
  return render(
    <WeekBoard
      anchor={parseCalendarDate(scheduledDate)}
      copiedSessionId={null}
      isLoading={false}
      onCopy={noop}
      onCreate={noop}
      onPaste={noop}
      onSelectSession={noop}
      onSelectTeam={noop}
      onShift={noop}
      selectedSessionId={null}
      selectedTeamId="team-1"
      sessions={[session]}
      teams={[team]}
    />
  );
}

describe("WeekBoard", () => {
  it("esconde o preview da sessão até o mouse passar em cima", () => {
    renderBoard();

    expect(screen.queryByTestId("session-preview-session-1")).toBeNull();

    fireEvent(screen.getByTestId("session-session-1"), "hoverIn");

    const preview = screen.getByTestId("session-preview-session-1");
    expect(within(preview).getByText("Segunda pesada")).toBeTruthy();
    expect(within(preview).getByText("Publicado")).toBeTruthy();
    expect(screen.getByText("Força & Acessórios")).toBeTruthy();
    expect(screen.getByText("Metcon")).toBeTruthy();
  });

  it("fecha o preview automaticamente quando o mouse sai", async () => {
    renderBoard();

    fireEvent(screen.getByTestId("session-session-1"), "hoverIn");
    expect(screen.getByTestId("session-preview-session-1")).toBeTruthy();

    fireEvent(screen.getByTestId("session-session-1"), "hoverOut");

    await waitFor(() => expect(screen.queryByTestId("session-preview-session-1")).toBeNull(), {
      timeout: 5000
    });
  });
});
