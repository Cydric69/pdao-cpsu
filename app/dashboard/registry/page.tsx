import { getUsers } from "@/actions/registry";
import { RegistryTable } from "@/components/registry/table";

export const dynamic = "force-dynamic";

export default async function RegistryPage() {
  const result = await getUsers();

  return (
    <div className="container mx-auto py-10">
      {!result.success ? (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          Error: {result.error}
        </div>
      ) : (
        <div className="space-y-4">
          <RegistryTable initialUsers={result.data || []} />
        </div>
      )}
    </div>
  );
}
