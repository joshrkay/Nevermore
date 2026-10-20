import ravenImage from "@/assets/raven-logo.png";

export const RavenLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <img
    src={ravenImage}
    alt="Edgar Allan Advisory raven logo"
    className={`${className} raven-logo-tint`}
    width={32}
    height={32}
  />
);

export const RavenIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <img
    src={ravenImage}
    alt="Raven"
    className={`${className} raven-logo-tint`}
    width={20}
    height={20}
  />
);
