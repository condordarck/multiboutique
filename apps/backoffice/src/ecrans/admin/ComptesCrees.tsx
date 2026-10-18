import type { CompteCree } from "@multiboutique/shared";

/** Accès des profils par défaut : affichés une seule fois, le temps de les noter. */
export function ComptesCrees({ comptes }: { comptes: CompteCree[] }) {
  if (!comptes.length) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-bouton bg-alerte-fond px-4 py-3 text-alerte">
      <p className="m-0 font-semibold">Profils créés — notez ces accès maintenant (ils ne seront plus affichés), puis changez les mots de passe :</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-libelle">
        {comptes.map((c) => (
          <li key={c.email}>
            <strong>{c.label}</strong> — {c.email} / <code className="font-bold">{c.password}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
