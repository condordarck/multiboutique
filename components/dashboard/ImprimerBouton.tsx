"use client";

export function ImprimerBouton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      Imprimer / PDF
    </button>
  );
}