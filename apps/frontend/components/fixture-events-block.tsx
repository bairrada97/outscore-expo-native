import type { Fixture, FixtureEvent } from "@outscore/shared-types";
import { useMemo } from "react";
import { View } from "react-native";

import { CardEvent, type EventSide, type RunningScore } from "@/components/card-event";
import { CardsBlock } from "@/components/cards-block";

type EnrichedEvent = FixtureEvent & {
  __side: EventSide;
  __minuteLabel: string;
  __extraLabel: string | null;
  __runningScore?: RunningScore;
};

function minuteLabel(time: FixtureEvent["time"]): { minute: string; extra: string | null } {
  const base = `${time.elapsed}'`;
  const extra = time.extra != null ? `+${time.extra}` : null;
  return { minute: base, extra };
}

function sortChronological(a: FixtureEvent, b: FixtureEvent) {
  const ea = a.time.elapsed ?? 0;
  const eb = b.time.elapsed ?? 0;
  if (ea !== eb) return ea - eb;
  const xa = a.time.extra ?? 0;
  const xb = b.time.extra ?? 0;
  return xa - xb;
}

function sortNewestFirst(a: EnrichedEvent, b: EnrichedEvent) {
  const ea = a.time.elapsed ?? 0;
  const eb = b.time.elapsed ?? 0;
  if (ea !== eb) return eb - ea;
  const xa = a.time.extra ?? 0;
  const xb = b.time.extra ?? 0;
  return xb - xa;
}

function isPenaltyShootout(event: FixtureEvent) {
  return event.comments === "Penalty Shootout";
}

function isGoalThatCounts(event: FixtureEvent) {
  if (event.type !== "Goal") return false;
  if (isPenaltyShootout(event)) return false;
  if (event.detail === "Missed Penalty") return false;
  // Count normal/penalty/own-goal as goals.
  return (
    event.detail === "Normal Goal" ||
    event.detail === "Penalty" ||
    event.detail === "Penalty Goal" ||
    event.detail === "Own Goal"
  );
}

function sideFromEvent(fixture: Fixture, event: FixtureEvent): EventSide {
  return event.team.id === fixture.teams.home.id ? "home" : "away";
}

function benefittingSide(event: FixtureEvent, eventSide: EventSide): EventSide {
  // Own goals count for the opposite side.
  if (event.type === "Goal" && event.detail === "Own Goal") {
    return eventSide === "home" ? "away" : "home";
  }
  return eventSide;
}

function halfKey(event: FixtureEvent): "First Half" | "Second Half" {
  // Simple split per plan. Extra time/penalties fall into Second Half.
  return event.time.elapsed <= 45 ? "First Half" : "Second Half";
}

function eventStableKey(e: FixtureEvent): string {
  const p = e.player?.id ?? e.player?.name ?? "unknown";
  const a = e.assist?.id ?? e.assist?.name ?? "none";
  const extra = e.time.extra ?? 0;
  return `${e.type}:${e.team.id}:${p}:${a}:${e.time.elapsed}:${extra}:${e.detail}`;
}

export function FixtureEventsBlock({ fixture }: { fixture: Fixture }) {
  const events = fixture.events ?? [];

  const { firstHalf, secondHalf } = useMemo(() => {
    if (!events.length) return { firstHalf: [] as EnrichedEvent[], secondHalf: [] as EnrichedEvent[] };

    // Enrich with side/minute labels first (cheap).
    const baseEnriched: EnrichedEvent[] = events.map((e) => {
      const side = sideFromEvent(fixture, e);
      const { minute, extra } = minuteLabel(e.time);
      return {
        ...e,
        __side: side,
        __minuteLabel: minute,
        __extraLabel: extra,
      };
    });

    // Compute running score snapshots for qualifying goals in chronological order.
    const chronological = [...baseEnriched].sort(sortChronological);
    let home = 0;
    let away = 0;

    const withScore = chronological.map((e) => {
      if (!isGoalThatCounts(e)) return e;
      const scoringSide = benefittingSide(e, e.__side);
      if (scoringSide === "home") home += 1;
      else away += 1;
      return {
        ...e,
        __runningScore: { home, away, whoScored: scoringSide },
      };
    });

    // Split into halves and sort newest-first for display.
    const first: EnrichedEvent[] = [];
    const second: EnrichedEvent[] = [];
    for (const e of withScore) {
      if (halfKey(e) === "First Half") first.push(e);
      else second.push(e);
    }
    first.sort(sortNewestFirst);
    second.sort(sortNewestFirst);

    return { firstHalf: first, secondHalf: second };
  }, [events, fixture]);

  if (!events.length) return null;

  return (
    <View className="mt-16">
      <CardsBlock title="Second Half" cardsClassName="px-0 pb-0">
        {secondHalf.length ? (
          secondHalf.map((e) => (
            <CardEvent
              key={eventStableKey(e)}
              event={e}
              side={e.__side}
              minuteLabel={e.__minuteLabel}
              extraLabel={e.__extraLabel}
              runningScore={e.__runningScore}
            />
          ))
        ) : (
          <View className="px-16 py-12">
            {/* keep empty state simple for now */}
          </View>
        )}
      </CardsBlock>

      <CardsBlock title="First Half" cardsClassName="px-0 pb-0">
        {firstHalf.length ? (
          firstHalf.map((e) => (
            <CardEvent
              key={eventStableKey(e)}
              event={e}
              side={e.__side}
              minuteLabel={e.__minuteLabel}
              extraLabel={e.__extraLabel}
              runningScore={e.__runningScore}
            />
          ))
        ) : (
          <View className="px-16 py-12">
            {/* keep empty state simple for now */}
          </View>
        )}
      </CardsBlock>
    </View>
  );
}


