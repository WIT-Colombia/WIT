declare module "*.png" {
  const source: string;
  export default source;
}
declare module "*.avif" {
  const source: string;
  export default source;
}

interface ImportMeta { readonly env: Record<string, string | undefined>; }
