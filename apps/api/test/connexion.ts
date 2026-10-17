// URL du serveur PostgreSQL de test (super-utilisateur, base « postgres »).
// Sans elle, les tests d'intégration échouent : un test sauté passerait pour vert.
export function urlServeurDeTest(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST est requis pour les tests de l'API. En local :\n" +
        "  docker run -d --name mb-test-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16-alpine\n" +
        "  export DATABASE_URL_TEST=postgres://postgres:test@127.0.0.1:55432/postgres"
    );
  }
  return url;
}

export function urlBase(urlServeur: string, nom: string): string {
  const url = new URL(urlServeur);
  url.pathname = `/${nom}`;
  return url.toString();
}

export const BASE_MODELE = "mb_modele";
export const PREFIXE_BASES = "mb_t_";
