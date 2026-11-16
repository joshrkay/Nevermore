import { createContext, useContext, type ReactNode } from "react";
import { useLocation, Routes, type Location } from "react-router-dom";

// The route table, with the page a dialog was opened from kept on screen (D-1709). A link that opens a dialog carries `state.backgroundLocation`; the routes are
// matched against that location while the dialog is drawn from the real one, which is what `useRealLocation` answers (inside these routes `useLocation` answers
// the page beneath, because that is the location the routes were matched with).

const RealLocationContext = createContext<Location | null>(null);

/** The address the browser is really at, even while the page beneath a dialog is drawn from the address it was opened from. */
export function useRealLocation(): Location {
  const real = useContext(RealLocationContext);
  const location = useLocation();
  return real ?? location;
}

/** The page a dialog was opened from, when this location is a dialog drawn over one. */
export const backgroundOf = (location: Location): Location | null => (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation ?? null;

export function BackgroundRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RealLocationContext.Provider value={location}>
      <Routes location={backgroundOf(location) ?? location}>{children}</Routes>
    </RealLocationContext.Provider>
  );
}
