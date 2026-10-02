type LogoProps = { name?: string };

export function Logo({ name = "WIT" }: LogoProps) {
  return <span className="wit-logo" aria-label={name}>{name}</span>;
}
