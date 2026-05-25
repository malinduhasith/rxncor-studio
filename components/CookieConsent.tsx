"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rxncor_cookie_preferences_v1";
const OPEN_EVENT = "rxncor:open-cookie-preferences";

type CookiePreference = {
  necessary: true;
  analytics: boolean;
  savedAt: string;
};

function readPreference() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CookiePreference>;

    if (parsed.necessary !== true || typeof parsed.analytics !== "boolean") {
      return null;
    }

    return parsed as CookiePreference;
  } catch {
    return null;
  }
}

function savePreference(analytics: boolean) {
  const preference: CookiePreference = {
    necessary: true,
    analytics,
    savedAt: new Date().toISOString()
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  window.dispatchEvent(
    new CustomEvent("rxncor:cookie-preferences-changed", {
      detail: preference
    })
  );

  return preference;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const preference = readPreference();

      if (preference) {
        setAnalytics(preference.analytics);
        return;
      }

      setVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function openSettings() {
      const preference = readPreference();
      setAnalytics(preference?.analytics ?? false);
      setSettingsOpen(true);
      setVisible(true);
    }

    window.addEventListener(OPEN_EVENT, openSettings);

    return () => window.removeEventListener(OPEN_EVENT, openSettings);
  }, []);

  function acceptOptional() {
    savePreference(true);
    setAnalytics(true);
    setVisible(false);
    setSettingsOpen(false);
  }

  function rejectOptional() {
    savePreference(false);
    setAnalytics(false);
    setVisible(false);
    setSettingsOpen(false);
  }

  function saveSettings() {
    savePreference(analytics);
    setVisible(false);
    setSettingsOpen(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <aside
      aria-label="Cookie preferences"
      className="cookie-consent"
      data-settings={settingsOpen ? "true" : "false"}
    >
      <div className="cookie-card">
        <p className="eyebrow">Privacy controls</p>
        <h2>Cookies, kept practical.</h2>
        <p>
          Essential cookies keep admin login, client login, gallery unlocks, and
          security working. Optional analytics stay off unless you allow them.
        </p>

        {settingsOpen ? (
          <div className="cookie-settings" aria-label="Cookie settings">
            <label className="cookie-option locked">
              <span>
                <strong>Necessary</strong>
                <small>Required for secure sessions and private galleries.</small>
              </span>
              <input checked disabled type="checkbox" />
            </label>
            <label className="cookie-option">
              <span>
                <strong>Analytics</strong>
                <small>
                  Optional performance and usage measurement. No marketing pixels
                  are active right now.
                </small>
              </span>
              <input
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                type="checkbox"
              />
            </label>
          </div>
        ) : null}

        <div className="cookie-actions">
          {settingsOpen ? (
            <>
              <button className="button" onClick={saveSettings} type="button">
                Save settings
              </button>
              <button
                className="button secondary"
                onClick={rejectOptional}
                type="button"
              >
                Reject optional
              </button>
            </>
          ) : (
            <>
              <button className="button" onClick={acceptOptional} type="button">
                Accept optional
              </button>
              <button
                className="button secondary"
                onClick={rejectOptional}
                type="button"
              >
                Reject optional
              </button>
              <button
                className="button ghost"
                onClick={() => setSettingsOpen(true)}
                type="button"
              >
                Manage
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export function CookieSettingsButton() {
  function openSettings() {
    window.dispatchEvent(new Event(OPEN_EVENT));
  }

  return (
    <button
      className="footer-link-button"
      data-no-pending="true"
      onClick={openSettings}
      type="button"
    >
      Cookie settings
    </button>
  );
}
