import type { ReactNode } from "react";

export interface CalendarGridEvent {
  /** Day the event falls on, in `YYYY-MM-DD` form. */
  date: string;
  /** Short label shown inside the day cell. */
  label: string;
}

export interface CalendarGridProps {
  /** Year of the month to render, e.g. `2025`. */
  year: number;
  /** 1-based month to render (1–12). */
  month: number;
  /** Events to plot on the grid, keyed by their `date`. */
  events?: CalendarGridEvent[];
  /** Rendered when a day cell has events; defaults to the event label. */
  renderEvent?: (event: CalendarGridEvent) => ReactNode;
  /** Today's date, used to highlight the current day. Defaults to `new Date()`. */
  today?: Date;
  className?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDayString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

/**
 * A 7-column month grid. Leading/trailing days from the adjacent months are
 * shown dimmed so the grid is always a complete rectangle of weeks.
 */
export function CalendarGrid({
  year,
  month,
  events = [],
  renderEvent,
  today = new Date(),
  className,
}: CalendarGridProps): JSX.Element {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];

  // Leading days from the previous month.
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 2, daysInPrevMonth - i), inMonth: false });
  }
  // Current month.
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month - 1, day), inMonth: true });
  }
  // Trailing days to complete the final week.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    if (!last) break;
    const next = new Date(last.date);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }

  const eventsByDate = new Map<string, CalendarGridEvent[]>();
  for (const event of events) {
    const bucket = eventsByDate.get(event.date) ?? [];
    bucket.push(event);
    eventsByDate.set(event.date, bucket);
  }

  const todayKey = toDayString(today);

  return (
    <div className={["farm-calendar", className].filter(Boolean).join(" ")}>
      {WEEKDAYS.map((day) => (
        <div key={day} className="farm-calendar__head">
          {day}
        </div>
      ))}
      {cells.map((cell, index) => {
        const key = toDayString(cell.date);
        const dayEvents = eventsByDate.get(key) ?? [];
        const classes = ["farm-calendar__cell"];
        if (!cell.inMonth) classes.push("farm-calendar__cell--outside");
        if (key === todayKey) classes.push("farm-calendar__cell--today");

        return (
          <div key={`${key}-${index}`} className={classes.join(" ")}>
            <div className="farm-calendar__date">{cell.date.getDate()}</div>
            {dayEvents.map((event, eventIndex) => (
              <span
                key={`${event.date}-${eventIndex}`}
                className="farm-calendar__event"
                title={event.label}
              >
                {renderEvent ? renderEvent(event) : event.label}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
