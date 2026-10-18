import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sans globals Vitest, Testing Library ne nettoie pas le DOM entre deux tests.
afterEach(cleanup);

// jsdom connaît <dialog> mais pas showModal() : on simule l'ouverture, la
// fermeture et l'événement close. Le piège du focus et le fond inerte restent
// ceux du navigateur.
// Les tests en environnement node (tokens) n'ont pas de DOM.
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
