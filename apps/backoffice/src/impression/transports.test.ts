import { afterEach, describe, expect, it } from "vitest";
import { fauxMateriel, type FauxMateriel } from "./faux-materiel";
import { choisirImprimante, envoyer, ErreurImpression, modeDisponible, oublierBluetooth } from "./transports";

let materiel: FauxMateriel;
afterEach(() => {
  materiel?.restaurer();
  oublierBluetooth();
});
const OCTETS = Uint8Array.from({ length: 250 }, (_, i) => i % 256);

describe("transports", () => {
  it("sans API matérielle (Firefox, Safari) : modes indisponibles, envoi refusé clairement", async () => {
    expect(["usb", "bluetooth", "serie"].map((m) => modeDisponible(m as "usb"))).toEqual([false, false, false]);
    await expect(envoyer("usb", { nom: "x" }, OCTETS, 9600)).rejects.toThrow(/Chrome ou Edge/);
  });

  it("USB : associe, puis envoie sur le point de sortie bulk et libère l'appareil", async () => {
    materiel = fauxMateriel();
    const associee = await choisirImprimante("usb");
    expect(associee).toEqual({ nom: "Winbond POS-80", vendorId: 0x0416, productId: 0x5011, serialNumber: "SN1" });
    await envoyer("usb", associee, OCTETS, 9600);
    expect(materiel.recus).toEqual([OCTETS]);
    expect(materiel.journal).toEqual(["usb:open", "usb:claim:1", "usb:out:3", "usb:release:1", "usb:close"]);
  });

  it("USB : imprimante débranchée, autre appareil, ou occupée → message compréhensible", async () => {
    materiel = fauxMateriel();
    await expect(envoyer("usb", { nom: "POS-80", vendorId: 0x0416, productId: 0x5011 }, OCTETS, 9600)).rejects.toThrow(/introuvable/);
    const associee = await choisirImprimante("usb");
    await expect(envoyer("usb", { ...associee, serialNumber: "AUTRE" }, OCTETS, 9600)).rejects.toThrow(/introuvable/);
    materiel.panne = Object.assign(new Error("Access denied"), { name: "SecurityError" });
    const erreur = await envoyer("usb", associee, OCTETS, 9600).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurImpression);
    expect(erreur.message).toMatch(/libre/);
  });

  it("choix annulé par le vendeur", async () => {
    materiel = fauxMateriel();
    materiel.panne = Object.assign(new Error("No device selected."), { name: "NotFoundError" });
    await expect(choisirImprimante("usb")).rejects.toThrow("Aucune imprimante choisie.");
  });

  it("port série : ouvert à la vitesse réglée, refermé après l'envoi", async () => {
    materiel = fauxMateriel();
    const associee = await choisirImprimante("serie");
    expect(associee).toMatchObject({ vendorId: 0x1a86, productId: 0x7523 });
    await envoyer("serie", associee, OCTETS, 115200);
    expect(materiel.journal).toEqual(["serie:open:115200", "serie:close"]);
    expect(materiel.recus).toEqual([OCTETS]);
  });

  it("Bluetooth : canal d'écriture trouvé, envoi par morceaux ; redemandé après un rechargement", async () => {
    materiel = fauxMateriel();
    expect(await choisirImprimante("bluetooth")).toEqual({ nom: "MPT-II" });
    await envoyer("bluetooth", { nom: "MPT-II" }, OCTETS, 9600);
    expect(materiel.recus).toEqual([OCTETS]);
    expect(materiel.journal).toEqual(["ble:choix", "ble:connect", "ble:ecrit:100", "ble:ecrit:100", "ble:ecrit:50"]);

    oublierBluetooth();
    materiel.journal = [];
    await envoyer("bluetooth", { nom: "MPT-II" }, OCTETS, 9600);
    expect(materiel.journal[0]).toBe("ble:choix");

    // Imprimante perdue en cours d'envoi : le prochain essai la redemande.
    materiel.journal = [];
    materiel.panne = Object.assign(new Error("GATT Server is disconnected."), { name: "NetworkError" });
    await expect(envoyer("bluetooth", { nom: "MPT-II" }, OCTETS, 9600)).rejects.toThrow(/allumée/);
    await envoyer("bluetooth", { nom: "MPT-II" }, OCTETS, 9600);
    expect(materiel.journal.filter((j) => j === "ble:choix")).toHaveLength(1);
  });
});
