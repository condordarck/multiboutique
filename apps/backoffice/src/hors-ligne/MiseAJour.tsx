import { Bandeau } from "@multiboutique/ui";
import { useRegisterSW } from "virtual:pwa-register/react";

/** Une nouvelle version est prête : on la propose, sans recharger d'office une vente en cours. */
export function MiseAJour() {
  const {
    needRefresh: [besoin],
    updateServiceWorker,
  } = useRegisterSW();
  if (!besoin) return null;
  return (
    <Bandeau ton="info" action={{ libelle: "Recharger", onClick: () => void updateServiceWorker(true) }}>
      Nouvelle version disponible
    </Bandeau>
  );
}
