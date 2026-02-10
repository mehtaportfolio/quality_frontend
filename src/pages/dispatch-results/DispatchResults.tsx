import DispatchResultsTable from "./DispatchResultsTable";

export default function DispatchResults({ user }: { user: any }) {
  return (
    <div className="flex flex-col gap-6">
      <DispatchResultsTable user={user} />
    </div>
  );
}
