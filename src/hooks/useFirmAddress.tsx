import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firmAddressFromHost } from "@/lib/firmHost";
import { fetchFirmName } from "@/lib/firmApi";

// The firm the host names (story CRM-P1.3a, D-17). It only chooses what a screen shows; who may read what is the
// database's decision (D-18), and no firm is ever put in a token.
export type FirmAddress =
  /** The bare domain, www, or any host that is not a firm's: today's behaviour. */
  | { status: "none" }
  | { status: "checking"; address: string }
  /** An approved firm holds the address; `name` is all that may be shown before sign-in. */
  | { status: "known"; address: string; name: string }
  /** No approved firm holds it (an unapproved firm looks the same). */
  | { status: "unknown"; address: string }
  | { status: "error"; address: string; retry: () => void };

const FirmAddressContext = createContext<FirmAddress>({ status: "none" });

export const FirmAddressProvider = ({ hostname, children }: { hostname?: string; children: ReactNode }) => {
  const address = firmAddressFromHost(hostname ?? window.location.hostname);
  const [result, setResult] = useState<{ address: string; name: string | null } | "error" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setResult(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchFirmName(address).then(
      (name) => !cancelled && setResult({ address, name }),
      () => !cancelled && setResult("error"),
    );
    return () => { cancelled = true; };
  }, [address, attempt]);

  const value = useMemo<FirmAddress>(() => {
    if (!address) return { status: "none" };
    if (result === "error") return { status: "error", address, retry };
    if (!result || result.address !== address) return { status: "checking", address };
    return result.name === null ? { status: "unknown", address } : { status: "known", address, name: result.name };
  }, [address, result, retry]);

  return <FirmAddressContext.Provider value={value}>{children}</FirmAddressContext.Provider>;
};

export const useFirmAddress = () => useContext(FirmAddressContext);
