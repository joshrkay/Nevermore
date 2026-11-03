import { Link } from "react-router-dom";

interface LegalLinksProps {
  /** Adds the © line after the links. */
  copyright?: boolean;
  /** Short labels ("Privacy", "Terms") for a tight space such as the Chamber's top bar. */
  compact?: boolean;
  /** Spacing and alignment for where it sits (a footer, a top bar). */
  className?: string;
}

const linkClass = "hover:text-foreground underline-offset-2 hover:underline transition-colors";

/**
 * The Privacy Policy and Terms of Use, reachable from every page (US-6.2). Every page component renders this
 * somewhere; src/copy.guard.test.ts checks that each one does.
 */
const LegalLinks = ({ copyright = false, compact = false, className = "" }: LegalLinksProps) => (
  <nav aria-label="Legal" className={`text-xs text-muted-foreground ${className}`}>
    <Link to="/privacy" className={linkClass} aria-label={compact ? "Privacy Policy" : undefined}>
      {compact ? "Privacy" : "Privacy Policy"}
    </Link>
    <span aria-hidden="true" className="mx-2">
      ·
    </span>
    <Link to="/terms" className={linkClass} aria-label={compact ? "Terms of Use" : undefined}>
      {compact ? "Terms" : "Terms of Use"}
    </Link>
    {copyright && (
      <>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <span>© Edgar Allan Advisory</span>
      </>
    )}
  </nav>
);

export default LegalLinks;
