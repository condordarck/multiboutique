export type StatutErreur = 400 | 401 | 403 | 404 | 409;

/**
 * Erreur destinée à l'utilisateur : son message est affiché tel quel. Elle hérite
 * d'Error pour que le monolithe la montre comme ses erreurs d'avant ; l'API en
 * tire le statut HTTP.
 */
export class ErreurMetier extends Error {
  constructor(
    message: string,
    readonly statut: StatutErreur = 400
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}
