// Icônes au trait, décoratives : le libellé voisin porte le sens.
function Icone({ d }: { d: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const IconeAccueil = () => <Icone d="M3 11l9-7 9 7M5 10v10h14V10" />;
export const IconeVentes = () => <Icone d="M2 3h3l2.5 12h12L22 7H6M9 20h.01M18 20h.01" />;
export const IconeStock = () => <Icone d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />;
export const IconeClients = () => <Icone d="M9 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />;
export const IconeRapports = () => <Icone d="M4 20V10M10 20V4M16 20v-7M22 20H2" />;
export const IconeAchats = () => <Icone d="M3 7h18l-2 13H5L3 7zM8 7a4 4 0 018 0" />;
export const IconeReglages = () => <Icone d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 15H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0021 10h.1a2 2 0 110 4z" />;
export const IconeSac = () => <Icone d="M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 016 0v2" />;
