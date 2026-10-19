import type { ImprimanteAssociee, ModeImpression } from "./reglages";

// Accès direct au matériel depuis le navigateur : WebUSB, Web Bluetooth, Web
// Serial. Chrome et Edge seulement (et Chrome Android, sans Web Serial). Les
// types ne décrivent que ce qui sert ici.

interface PointUsb {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
}
interface AppareilUsb {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  productName?: string;
  manufacturerName?: string;
  opened: boolean;
  configuration: { interfaces: { interfaceNumber: number; alternate: { endpoints: PointUsb[] } }[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(valeur: number): Promise<void>;
  claimInterface(numero: number): Promise<void>;
  releaseInterface(numero: number): Promise<void>;
  transferOut(point: number, donnees: Uint8Array): Promise<unknown>;
}
interface CaracteristiqueBle {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(donnees: Uint8Array): Promise<void>;
  writeValueWithoutResponse(donnees: Uint8Array): Promise<void>;
}
interface AppareilBle {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<AppareilBle["gatt"]>;
    getPrimaryServices(): Promise<{ getCharacteristics(): Promise<CaracteristiqueBle[]> }[]>;
  };
}
interface PortSerie {
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}
export interface NavigateurMateriel {
  usb?: { requestDevice(o: { filters: object[] }): Promise<AppareilUsb>; getDevices(): Promise<AppareilUsb[]> };
  bluetooth?: {
    requestDevice(o: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<AppareilBle>;
    getDevices?(): Promise<AppareilBle[]>;
  };
  serial?: { requestPort(): Promise<PortSerie>; getPorts(): Promise<PortSerie[]> };
}

const materiel = () => navigator as unknown as NavigateurMateriel;

export type ModeDirect = Exclude<ModeImpression, "navigateur">;

/** Le navigateur de ce poste sait-il parler à une imprimante dans ce mode ? */
export function modeDisponible(mode: ModeDirect): boolean {
  const n = materiel();
  return mode === "usb" ? !!n.usb : mode === "bluetooth" ? !!n.bluetooth : !!n.serial;
}

/** Erreur à montrer telle quelle au vendeur. */
export class ErreurImpression extends Error {}

function traduire(erreur: unknown): ErreurImpression {
  if (erreur instanceof ErreurImpression) return erreur;
  const nom = (erreur as { name?: string })?.name;
  if (nom === "NotFoundError") return new ErreurImpression("Aucune imprimante choisie.");
  if (nom === "SecurityError" || nom === "NetworkError" || nom === "InvalidStateError") {
    return new ErreurImpression(
      "Impossible d'accéder à l'imprimante : est-elle allumée, branchée, et libre (pas utilisée par un autre programme ou un pilote) ?"
    );
  }
  return new ErreurImpression(`L'imprimante n'a pas répondu (${(erreur as Error)?.message ?? "erreur inconnue"}).`);
}

// ---- USB ----

function pointDeSortie(appareil: AppareilUsb): { interfaceNumber: number; endpointNumber: number } | null {
  for (const iface of appareil.configuration?.interfaces ?? []) {
    const point = iface.alternate.endpoints.find((p) => p.direction === "out" && p.type === "bulk");
    if (point) return { interfaceNumber: iface.interfaceNumber, endpointNumber: point.endpointNumber };
  }
  return null;
}

async function envoyerUsb(appareil: AppareilUsb, octets: Uint8Array) {
  if (!appareil.opened) await appareil.open();
  try {
    if (!appareil.configuration) await appareil.selectConfiguration(1);
    const sortie = pointDeSortie(appareil);
    if (!sortie) throw new ErreurImpression("Cet appareil USB n'accepte pas de données à imprimer : est-ce bien l'imprimante ?");
    await appareil.claimInterface(sortie.interfaceNumber);
    try {
      await appareil.transferOut(sortie.endpointNumber, octets);
    } finally {
      await appareil.releaseInterface(sortie.interfaceNumber).catch(() => {});
    }
  } finally {
    // Fermée après chaque ticket : rien ne la retient entre deux ventes.
    await appareil.close().catch(() => {});
  }
}

const decrireUsb = (a: AppareilUsb): ImprimanteAssociee => ({
  nom: [a.manufacturerName, a.productName].filter(Boolean).join(" ") || `USB ${a.vendorId.toString(16)}:${a.productId.toString(16)}`,
  vendorId: a.vendorId,
  productId: a.productId,
  ...(a.serialNumber ? { serialNumber: a.serialNumber } : {}),
});

// ---- Bluetooth (BLE) ----

/**
 * Services des imprimantes thermiques Bluetooth courantes : Web Bluetooth
 * n'ouvre que les services déclarés au moment du choix.
 */
export const SERVICES_BLE = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];
/** Taille des envois : sous la limite des petites imprimantes BLE. */
const MORCEAU_BLE = 100;
/**
 * Pause entre deux envois sans accusé de réception : sans elle, la mémoire
 * tampon des petites imprimantes déborde et le ticket sort tronqué.
 */
export const PAUSE_BLE_MS = 20;
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Chrome ne retrouve pas un appareil Bluetooth après un rechargement :
// celui choisi pendant la session est gardé ici.
let appareilBle: AppareilBle | null = null;

async function caracteristiqueBle(appareil: AppareilBle): Promise<CaracteristiqueBle> {
  if (!appareil.gatt) throw new ErreurImpression("Cet appareil Bluetooth n'est pas une imprimante reconnue.");
  const serveur = appareil.gatt.connected ? appareil.gatt : await appareil.gatt.connect();
  for (const service of (await serveur?.getPrimaryServices()) ?? []) {
    const ecriture = (await service.getCharacteristics()).find((c) => c.properties.writeWithoutResponse || c.properties.write);
    if (ecriture) return ecriture;
  }
  throw new ErreurImpression("Cette imprimante Bluetooth n'offre pas de canal d'impression connu.");
}

async function envoyerBle(appareil: AppareilBle, octets: Uint8Array) {
  const canal = await caracteristiqueBle(appareil);
  for (let debut = 0; debut < octets.length; debut += MORCEAU_BLE) {
    const morceau = octets.slice(debut, debut + MORCEAU_BLE);
    if (canal.properties.writeWithoutResponse) {
      await canal.writeValueWithoutResponse(morceau);
      if (debut + MORCEAU_BLE < octets.length) await attendre(PAUSE_BLE_MS);
    } else await canal.writeValueWithResponse(morceau);
  }
}

// ---- Port série ----

async function envoyerSerie(port: PortSerie, octets: Uint8Array, vitesse: number) {
  await port.open({ baudRate: vitesse });
  try {
    const ecrivain = port.writable!.getWriter();
    try {
      await ecrivain.write(octets);
    } finally {
      ecrivain.releaseLock();
    }
  } finally {
    await port.close().catch(() => {});
  }
}

const decrireSerie = (p: PortSerie): ImprimanteAssociee => {
  const info = p.getInfo();
  return info.usbVendorId !== undefined
    ? { nom: `Port série USB ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)}`, vendorId: info.usbVendorId, productId: info.usbProductId }
    : { nom: "Port série (Bluetooth ou intégré)" };
};

// ---- Choix et envoi ----

/** Ouvre le sélecteur du navigateur : à appeler depuis un clic. */
export async function choisirImprimante(mode: ModeDirect): Promise<ImprimanteAssociee> {
  const n = materiel();
  try {
    if (mode === "usb") return decrireUsb(await n.usb!.requestDevice({ filters: [] }));
    if (mode === "serie") return decrireSerie(await n.serial!.requestPort());
    appareilBle = await n.bluetooth!.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES_BLE });
    return { nom: appareilBle.name || "Imprimante Bluetooth" };
  } catch (erreur) {
    throw traduire(erreur);
  }
}

/**
 * L'appareil autorisé est-il celui associé ? Associé sans identifiant USB (port
 * série Bluetooth ou intégré) : seul un port sans identifiant USB convient.
 */
const correspond = (associee: ImprimanteAssociee, vendorId?: number, productId?: number, serie?: string) =>
  associee.vendorId === undefined
    ? vendorId === undefined
    : associee.vendorId === vendorId && associee.productId === productId && (!associee.serialNumber || associee.serialNumber === serie);

/** Envoie les octets à l'imprimante associée à ce poste pour ce mode. */
export async function envoyer(mode: ModeDirect, associee: ImprimanteAssociee | undefined, octets: Uint8Array, vitesse: number): Promise<void> {
  if (!modeDisponible(mode)) throw new ErreurImpression("Ce navigateur ne permet pas ce mode d'impression : utilisez Chrome ou Edge, ou le mode Navigateur.");
  const n = materiel();
  try {
    if (mode === "usb") {
      const appareil = (await n.usb!.getDevices()).find((a) => associee && correspond(associee, a.vendorId, a.productId, a.serialNumber));
      if (!appareil) throw new ErreurImpression("Imprimante USB introuvable : branchez-la, ou associez-la dans les réglages d'impression.");
      return await envoyerUsb(appareil, octets);
    }
    if (mode === "serie") {
      const ports = await n.serial!.getPorts();
      const port = ports.find((p) => associee && correspond(associee, p.getInfo().usbVendorId, p.getInfo().usbProductId));
      if (!port) throw new ErreurImpression("Port série introuvable : branchez l'imprimante, ou associez-la dans les réglages d'impression.");
      return await envoyerSerie(port, octets, vitesse);
    }
    if (!appareilBle && associee && n.bluetooth!.getDevices) {
      appareilBle = (await n.bluetooth!.getDevices()).find((a) => a.name === associee?.nom) ?? null;
    }
    // Après un rechargement, Chrome redemande l'imprimante (le clic sur
    // « Imprimer » suffit à ouvrir le sélecteur).
    if (!appareilBle) await choisirImprimante("bluetooth");
    try {
      return await envoyerBle(appareilBle!, octets);
    } catch (erreur) {
      // Hors de portée ou éteinte : le prochain essai propose de la rechoisir.
      appareilBle = null;
      throw erreur;
    }
  } catch (erreur) {
    throw traduire(erreur);
  }
}

/** Pour les tests. */
export function oublierBluetooth(): void {
  appareilBle = null;
}
