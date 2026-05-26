"use client";

import { useMemo, useState } from "react";

type DateTimeRangeFieldsProps = {
  startName?: string;
  endName?: string;
  startLabel?: string;
  endLabel?: string;
  defaultStart?: string;
  defaultEnd?: string;
  className?: string;
  enforceFutureStart?: boolean;
};

const stepMinutes = 15;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function roundUpToStep(date: Date) {
  const rounded = new Date(date);
  const step = stepMinutes * 60 * 1000;

  rounded.setTime(Math.ceil(rounded.getTime() / step) * step);
  rounded.setSeconds(0, 0);

  return rounded;
}

function addStep(value: string) {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "";
  }

  return toLocalInputValue(new Date(parsed + stepMinutes * 60 * 1000));
}

function normaliseEnd(start: string, end: string) {
  if (!start || !end || Date.parse(end) > Date.parse(start)) {
    return end;
  }

  return addStep(start);
}

export function DateTimeRangeFields({
  startName = "preferred_start_at",
  endName = "preferred_end_at",
  startLabel = "Start",
  endLabel = "Finish",
  defaultStart = "",
  defaultEnd = "",
  className = "form-two-col",
  enforceFutureStart = false,
}: DateTimeRangeFieldsProps) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(() => normaliseEnd(defaultStart, defaultEnd));
  const futureMin = useMemo(() => toLocalInputValue(roundUpToStep(new Date())), []);
  const endMin = start ? addStep(start) : enforceFutureStart ? futureMin : "";

  function handleStartChange(nextStart: string) {
    setStart(nextStart);

    if (end && nextStart && Date.parse(end) <= Date.parse(nextStart)) {
      setEnd(addStep(nextStart));
    }
  }

  return (
    <div className={className}>
      <label className="field">
        {startLabel}
        <input
          min={enforceFutureStart ? futureMin : undefined}
          name={startName}
          onChange={(event) => handleStartChange(event.target.value)}
          required
          step={stepMinutes * 60}
          type="datetime-local"
          value={start}
        />
      </label>
      <label className="field">
        {endLabel}
        <input
          min={endMin || undefined}
          name={endName}
          onChange={(event) => setEnd(event.target.value)}
          required
          step={stepMinutes * 60}
          type="datetime-local"
          value={end}
        />
      </label>
    </div>
  );
}
