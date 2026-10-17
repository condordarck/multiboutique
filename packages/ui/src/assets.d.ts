// Les SVG importés deviennent des URL : Vite (apps) et Vitest (tests) les servent.
declare module "*.svg" {
  const url: string;
  export default url;
}
