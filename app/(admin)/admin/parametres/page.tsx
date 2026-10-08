import { getParametres } from "@/lib/monnaie";
import { ParametresForm } from "@/components/admin/ParametresForm";

export default async function ParametresPage() {
  const params = await getParametres();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres généraux</h1>
        <p className="text-gray-500">
          Configuration générale de l&apos;application appliquée partout.
        </p>
      </div>

      <div className="max-w-2xl">
        <ParametresForm
          monnaie={params["monnaie"] || "$"}
          nomApplication={params["nom_application"] || "MultiBoutique"}
          seuilAlerte={params["seuil_alerte_defaut"] || "10"}
        />
      </div>
    </div>
  );
}