import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; "error-callback": () => void; "expired-callback"?: () => void },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Loads Cloudflare's script once, resolving when `window.turnstile` is ready.
let scriptPromise: Promise<void> | null = null;
const loadTurnstile = (): Promise<void> => {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptPromise = null; reject(new Error("Turnstile failed to load")); };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string) => void;
  onError: () => void;
}

/** Cloudflare Turnstile challenge; reports a one-time token when the visitor passes. */
const TurnstileWidget = ({ siteKey, onToken, onError }: TurnstileWidgetProps) => {
  const container = useRef<HTMLDivElement>(null);
  // Latest callbacks, without re-rendering the widget when the parent re-renders.
  const handlers = useRef({ onToken, onError });
  handlers.current = { onToken, onError };

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => handlers.current.onToken(token),
          "error-callback": () => handlers.current.onError(),
        });
      })
      .catch(() => { if (!cancelled) handlers.current.onError(); });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={container} />;
};

export default TurnstileWidget;
