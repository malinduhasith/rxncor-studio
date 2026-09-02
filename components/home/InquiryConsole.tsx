"use client";

import { useState } from "react";
import { submitContactAction } from "@/app/actions";
import { CompositionMark } from "@/components/home/CompositionMark";

const requiredFields = ["name", "email", "message"] as const;

export function InquiryConsole() {
  const [activeField, setActiveField] = useState("name");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  const completeCount = requiredFields.filter((field) => completed[field]).length;
  const isReady = completeCount === requiredFields.length;

  function updateCompletion(form: HTMLFormElement) {
    const data = new FormData(form);
    setCompleted({
      name: String(data.get("name") ?? "").trim().length > 0,
      email: String(data.get("email") ?? "").includes("@"),
      message: String(data.get("message") ?? "").trim().length >= 10
    });
  }

  return (
    <div className="rr-inquiry-console">
      <div aria-hidden="true" className="rr-inquiry-vector-field">
        <div className="rr-inquiry-vector rr-inquiry-vector-focus">
          <CompositionMark variant="focus" />
        </div>
        <div className="rr-inquiry-vector rr-inquiry-vector-sensor">
          <CompositionMark variant="sensor" />
        </div>
        <div className="rr-inquiry-vector rr-inquiry-vector-waveform">
          <CompositionMark variant="waveform" />
        </div>
        <div className="rr-inquiry-vector rr-inquiry-vector-meter">
          <CompositionMark variant="meter" />
        </div>
        <span className="rr-inquiry-scan" />
      </div>

      <div className="rr-inquiry-status" aria-live="polite">
        <div>
          <span>Brief signal</span>
          <strong>{String(completeCount).padStart(2, "0")} / 03</strong>
        </div>
        <div className="rr-inquiry-progress" aria-hidden="true">
          {requiredFields.map((field) => (
            <i data-complete={completed[field] ? "true" : "false"} key={field} />
          ))}
        </div>
        <p data-ready={isReady ? "true" : "false"}>
          <i /> {isReady ? "Signal ready / transmit" : "Building shoot brief"}
        </p>
      </div>

      <form
        action={submitContactAction}
        className="rr-contact-form"
        data-active-field={activeField}
        onChange={(event) => updateCompletion(event.currentTarget)}
      >
        <label data-active={activeField === "name" ? "true" : "false"} data-complete={completed.name ? "true" : "false"}>
          <span>01 / Your name <i>{completed.name ? "Locked" : "Required"}</i></span>
          <input
            autoComplete="name"
            name="name"
            onFocus={() => setActiveField("name")}
            placeholder="Name"
            required
          />
        </label>
        <label data-active={activeField === "email" ? "true" : "false"} data-complete={completed.email ? "true" : "false"}>
          <span>02 / Email <i>{completed.email ? "Locked" : "Required"}</i></span>
          <input
            autoComplete="email"
            name="email"
            onFocus={() => setActiveField("email")}
            placeholder="you@email.com"
            required
            type="email"
          />
        </label>
        <label data-active={activeField === "phone" ? "true" : "false"}>
          <span>03 / Phone <i>Optional</i></span>
          <input
            autoComplete="tel"
            name="phone"
            onFocus={() => setActiveField("phone")}
            placeholder="+61"
          />
        </label>
        <label data-active={activeField === "message" ? "true" : "false"} data-complete={completed.message ? "true" : "false"}>
          <span>04 / What are we making? <i>{completed.message ? "Locked" : "Required"}</i></span>
          <textarea
            data-native-scroll
            name="message"
            onFocus={() => setActiveField("message")}
            placeholder="The idea, date, location, or gallery question…"
            required
          />
        </label>
        <button data-cursor="Send" data-ready={isReady ? "true" : "false"} type="submit">
          <span>{isReady ? "Transmit shoot brief" : "Send inquiry"}</span>
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </div>
  );
}
