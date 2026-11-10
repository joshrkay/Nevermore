// The pages kept out of the first download, and a way to start fetching one before it is needed.
//
// The intake (The Chamber) is the largest part of the app: the voice client alone is most of what used to be the
// main bundle, and a visitor reading the landing page needs none of it. It loads when /start opens. So that the
// "Start chatting" button doesn't wait on it, the landing page fetches it once the browser is idle, or as soon as
// the visitor reaches for the button (preloadIntake), and /start fetches it while the guest session is being made.
export const loadChamberPage = () => import("@/pages/ChamberPage");
export const loadProfilePage = () => import("@/pages/ProfilePage");

/** Starts fetching the intake's code. Safe to call any number of times: the browser fetches a module once. */
export function preloadIntake() {
  // A failed fetch is retried, and reported, when the page itself loads.
  loadChamberPage().catch(() => {});
}
