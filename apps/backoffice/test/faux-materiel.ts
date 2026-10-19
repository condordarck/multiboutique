// Imprimantes simulées pour les tests : WebUSB, Web Serial et Web Bluetooth
// réduits à ce que transports.ts appelle. Chaque envoi est enregistré.

export interface FauxMateriel {
  /** Octets reçus, envoi par envoi. */
  recus: Uint8Array[];
  /** Appels faits, dans l'ordre (open, claim, transfer, close…). */
  journal: string[];
  /** Appareils déjà autorisés (getDevices / getPorts). */
  autorises: { usb: number; serie: number };
  /** Prochaine erreur levée par l'appareil. */
  panne: Error | null;
  restaurer(): void;
}

const concat = (morceaux: Uint8Array[]) => Uint8Array.from(morceaux.flatMap((m) => [...m]));

export interface OptionsFauxMateriel {
  /** Ports série présents : USB-série (identifiants USB) et/ou Bluetooth (aucun). */
  ports?: ("usb" | "bluetooth")[];
  /** Imprimante BLE qui n'accepte que l'écriture sans accusé de réception. */
  bleSansReponse?: boolean;
}

export function fauxMateriel(
  modes: ("usb" | "serie" | "bluetooth")[] = ["usb", "serie", "bluetooth"],
  options: OptionsFauxMateriel = {}
): FauxMateriel {
  const etat: FauxMateriel = {
    recus: [],
    journal: [],
    autorises: { usb: 0, serie: 0 },
    panne: null,
    restaurer: () => {
      for (const m of ["usb", "serial", "bluetooth"]) delete (navigator as unknown as Record<string, unknown>)[m];
    },
  };
  const echouer = () => {
    if (etat.panne) {
      const e = etat.panne;
      etat.panne = null;
      throw e;
    }
  };

  const usb = () => ({
    vendorId: 0x0416,
    productId: 0x5011,
    serialNumber: "SN1",
    manufacturerName: "Winbond",
    productName: "POS-80",
    opened: false,
    configuration: null as unknown,
    async open() {
      echouer();
      etat.journal.push("usb:open");
      this.opened = true;
    },
    async close() {
      etat.journal.push("usb:close");
      this.opened = false;
    },
    async selectConfiguration() {
      this.configuration = {
        interfaces: [
          { interfaceNumber: 0, alternate: { endpoints: [{ endpointNumber: 2, direction: "in", type: "bulk" }] } },
          { interfaceNumber: 1, alternate: { endpoints: [{ endpointNumber: 3, direction: "out", type: "bulk" }] } },
        ],
      };
    },
    async claimInterface(n: number) {
      etat.journal.push(`usb:claim:${n}`);
    },
    async releaseInterface(n: number) {
      etat.journal.push(`usb:release:${n}`);
    },
    async transferOut(point: number, donnees: Uint8Array) {
      etat.journal.push(`usb:out:${point}`);
      etat.recus.push(donnees);
    },
  });

  const port = (genre: "usb" | "bluetooth") => {
    const morceaux: Uint8Array[] = [];
    return {
      getInfo: () => (genre === "usb" ? { usbVendorId: 0x1a86, usbProductId: 0x7523 } : {}),
      writable: null as WritableStream<Uint8Array> | null,
      async open(o: { baudRate: number }) {
        echouer();
        etat.journal.push(`serie${genre === "usb" ? "" : "-bt"}:open:${o.baudRate}`);
        this.writable = new WritableStream({ write: (m) => void morceaux.push(m) });
      },
      async close() {
        etat.journal.push(`serie${genre === "usb" ? "" : "-bt"}:close`);
        etat.recus.push(concat(morceaux.splice(0)));
      },
    };
  };

  const ble = () => {
    const morceaux: Uint8Array[] = [];
    const canal = {
      properties: { write: !options.bleSansReponse, writeWithoutResponse: !!options.bleSansReponse },
      async writeValueWithResponse(m: Uint8Array) {
        echouer();
        morceaux.push(m);
        etat.recus.splice(0, etat.recus.length, concat(morceaux));
        etat.journal.push(`ble:ecrit:${m.length}`);
      },
      async writeValueWithoutResponse(m: Uint8Array) {
        echouer();
        morceaux.push(m);
        etat.recus.splice(0, etat.recus.length, concat(morceaux));
        etat.journal.push(`ble:ecrit-sans-reponse:${m.length}@${Date.now()}`);
      },
    };
    const gatt = {
      connected: false,
      async connect() {
        etat.journal.push("ble:connect");
        gatt.connected = true;
        return gatt;
      },
      async getPrimaryServices() {
        return [
          { getCharacteristics: async () => [{ properties: { write: false, writeWithoutResponse: false } }] },
          { getCharacteristics: async () => [canal] },
        ];
      },
    };
    return { id: "ble-1", name: "MPT-II", gatt };
  };

  const def = (nom: string, valeur: unknown) => Object.defineProperty(navigator, nom, { configurable: true, value: valeur });
  if (modes.includes("usb")) {
    const appareil = usb();
    def("usb", {
      requestDevice: async () => {
        echouer();
        etat.autorises.usb = 1;
        return appareil;
      },
      getDevices: async () => (etat.autorises.usb ? [appareil] : []),
    });
  }
  if (modes.includes("serie")) {
    // Le sélecteur rend le dernier port ; getPorts, tous ceux autorisés, dans l'ordre.
    const ports = (options.ports ?? ["usb"]).map(port);
    def("serial", {
      requestPort: async () => {
        echouer();
        etat.autorises.serie = ports.length;
        return ports.at(-1);
      },
      getPorts: async () => (etat.autorises.serie ? ports : []),
    });
  }
  if (modes.includes("bluetooth")) {
    def("bluetooth", {
      requestDevice: async () => {
        echouer();
        etat.journal.push("ble:choix");
        return ble();
      },
    });
  }
  return etat;
}
