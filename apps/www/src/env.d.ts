/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BACKOFFICE_URL: string;
}

/** Version du build (date et commit), injectée par Vite. */
declare const __VERSION__: string;
