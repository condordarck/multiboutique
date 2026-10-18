// Remplace le module virtuel de vite-plugin-pwa dans les tests.
import { useState } from "react";

export const etatPwa = { besoinDeMiseAJour: false, mettreAJour: (_recharger?: boolean) => Promise.resolve() };

export function useRegisterSW() {
  const besoin = useState(etatPwa.besoinDeMiseAJour);
  return {
    needRefresh: besoin,
    offlineReady: useState(false),
    updateServiceWorker: (recharger?: boolean) => etatPwa.mettreAJour(recharger),
  };
}
