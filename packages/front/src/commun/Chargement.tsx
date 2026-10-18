/** Attente du premier chargement d'un écran entier. */
export function Chargement({ message = "Chargement…" }: { message?: string }) {
  return (
    <div role="status" className="flex min-h-[50dvh] items-center justify-center text-courant text-texte-discret">
      {message}
    </div>
  );
}
