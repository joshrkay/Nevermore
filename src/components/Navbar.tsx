import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RavenLogo } from "./RavenLogo";
import { motion } from "framer-motion";
import { User, Menu, X } from "lucide-react";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "How It Works", href: isLanding ? "#how-it-works" : "/#how-it-works", isAnchor: true },
    { label: "For PEO Partners", href: isLanding ? "#peo-partners" : "/#peo-partners", isAnchor: true },
    { label: "The Manuscript", href: "/manuscript", isAnchor: false },
  ];

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled || !isLanding ? "bg-background/95 backdrop-blur-md border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <RavenLogo className="w-8 h-8 text-primary" />
          <span className="font-display text-lg text-foreground">Edgar Allan Advisory</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) =>
            link.isAnchor ? (
              <a key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </a>
            ) : (
              <Link key={link.label} to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </Link>
            )
          )}
          {user ? (
            <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <User className="w-4 h-4" /> Profile
            </Link>
          ) : null}
          <Link
            to="/login"
            className="text-sm font-medium bg-primary text-primary-foreground px-5 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Begin →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border px-6 py-4 space-y-3">
          {navLinks.map((link) =>
            link.isAnchor ? (
              <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground">
                {link.label}
              </a>
            ) : (
              <Link key={link.label} to={link.href} onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            )
          )}
          <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-primary">
            Begin →
          </Link>
        </div>
      )}
    </motion.nav>
  );
};

export default Navbar;
