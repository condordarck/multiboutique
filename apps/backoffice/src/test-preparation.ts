import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { oublierReglages } from "./impression/reglages";

// Sans globals Vitest, Testing Library ne nettoie pas le DOM entre deux tests.
afterEach(cleanup);

// Réglages d'impression du poste : chaque test repart des valeurs par défaut.
// (Sous Node sans DOM, localStorage existe parfois sans ses méthodes.)
afterEach(() => {
  if (typeof globalThis.localStorage?.removeItem === "function") localStorage.removeItem("mb-impression");
  oublierReglages();
});

// jsdom connaît <dialog> mais pas showModal() : même simulation que packages/ui.
// Les tests en environnement node (garde de complétude) n'ont pas de DOM.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
