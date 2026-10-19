import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { fauxMateriel, type FauxMateriel } from "../../../test/faux-materiel";
import { lireReglages, oublierReglages } from "../../impression/reglages";
import { oublierBluetooth } from "../../impression/transports";
import { connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
let materiel: FauxMateriel | undefined;
afterEach(() => {
  api.restaurer();
  materiel?.restaurer();
  materiel = undefined;
  oublierBluetooth();
  vi.restoreAllMocks();
});

function preparer(role: "vendeur" | "gerant_stock" = "vendeur") {
  api = fauxApi();
  connecte(api, utilisateur({ role }));
}

describe("réglages d'impression", () => {
  it("par défaut : mode navigateur, aperçu du ticket de test, sans options ESC/POS", async () => {
    preparer();
    const { container } = rendreApp("/impression");
    expect(await screen.findByRole("heading", { level: 1, name: "Impression des tickets" })).toBeTruthy();
    expect((screen.getByLabelText("Mode d'impression") as HTMLSelectElement).value).toBe("navigateur");
    expect(screen.queryByLabelText("Jeu de caractères")).toBeNull();
    expect(screen.queryByLabelText("Couper le papier")).toBeNull();
    expect(screen.getByRole("region", { name: "Reçu TEST-0001" })).toBeTruthy();
    // Sans WebUSB (jsdom, Firefox…), les modes directs sont signalés.
    expect(screen.getByRole("option", { name: "USB direct (non disponible sur ce navigateur)" })).toBeTruthy();
    await sansViolation(container);
  });

  it("ticket de test par le navigateur : la fenêtre d'impression s'ouvre", async () => {
    preparer();
    const imprimer = vi.spyOn(window, "print").mockImplementation(() => {});
    rendreApp("/impression");
    await userEvent.click(await screen.findByRole("button", { name: "Imprimer un ticket de test" }));
    expect(imprimer).toHaveBeenCalledOnce();
  });

  it("USB : associe l'imprimante, règle le ticket, imprime le test en ESC/POS ; tout est gardé sur le poste", async () => {
    preparer();
    materiel = fauxMateriel();
    rendreApp("/impression");
    await userEvent.selectOptions(await screen.findByLabelText("Mode d'impression"), "usb");
    expect(screen.getByText("aucune")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Choisir l'imprimante" }));
    expect(await screen.findByText("Winbond POS-80")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Changer d'imprimante" })).toBeTruthy();

    await userEvent.click(screen.getByRole("radio", { name: "58 mm" }));
    await userEvent.selectOptions(screen.getByLabelText("Jeu de caractères"), "ascii");
    await userEvent.click(screen.getByLabelText("Ouvrir le tiroir-caisse"));
    await userEvent.click(screen.getByLabelText("Imprimer automatiquement après l'encaissement"));
    expect(screen.getByRole("region", { name: "Reçu TEST-0001" }).getAttribute("data-papier")).toBe("58");

    await userEvent.click(screen.getByRole("button", { name: "Imprimer un ticket de test" }));
    expect(await screen.findByText("Ticket de test envoyé à l'imprimante.")).toBeTruthy();
    const texte = Buffer.from(materiel.recus[0]!).toString("latin1");
    expect(texte).toContain("Accents : e e e a c u o E A C");
    expect(texte).toContain("Cafe moulu 250 g");
    // Tiroir ouvert à la fin.
    expect([...materiel.recus[0]!.slice(-5)]).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);

    oublierReglages();
    expect(lireReglages()).toMatchObject({
      mode: "usb",
      largeur: 58,
      jeu: "ascii",
      tiroir: true,
      automatique: true,
      imprimantes: { usb: { nom: "Winbond POS-80", vendorId: 0x0416 } },
    });
  });

  it("port série : vitesse réglable ; imprimante absente → erreur claire", async () => {
    preparer();
    materiel = fauxMateriel(["serie"]);
    rendreApp("/impression");
    await userEvent.selectOptions(await screen.findByLabelText("Mode d'impression"), "serie");
    await userEvent.selectOptions(screen.getByLabelText("Vitesse du port (bauds)"), "115200");
    await userEvent.click(screen.getByRole("button", { name: "Imprimer un ticket de test" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Port série introuvable/);
    expect(lireReglages().vitesse).toBe(115200);
  });

  it("choix d'imprimante annulé : rien n'est associé", async () => {
    preparer();
    materiel = fauxMateriel(["bluetooth"]);
    materiel.panne = Object.assign(new Error("cancelled"), { name: "NotFoundError" });
    rendreApp("/impression");
    await userEvent.selectOptions(await screen.findByLabelText("Mode d'impression"), "bluetooth");
    await userEvent.click(screen.getByRole("button", { name: "Choisir l'imprimante" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Aucune imprimante choisie.");
    expect(lireReglages().imprimantes).toEqual({});
  });

  it("menu du compte : lien vers l'imprimante pour qui encaisse, pas pour le gérant de stock", async () => {
    preparer();
    rendreApp("/impression");
    await userEvent.click(await screen.findByRole("button", { name: /Awa Gérante/ }));
    expect(screen.getByRole("link", { name: "Imprimante de ce poste" }).getAttribute("href")).toBe("/impression");
    cleanup();
    api.restaurer();

    preparer("gerant_stock");
    const { adresse } = rendreApp("/impression");
    await waitFor(() => expect(adresse()).toMatch(/^\/b\//));
    await userEvent.click(await screen.findByRole("button", { name: /Awa Gérante/ }));
    expect(screen.getByText("gerant@exemple.org")).toBeTruthy();
    expect(within(document.body).queryByRole("link", { name: "Imprimante de ce poste" })).toBeNull();
  });
});
