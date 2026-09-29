import { useRolePermissions, type Role } from "../../hooks/useRolePermissions";

interface User {
  role: Role;
  full_name: string;
}

export default function Cotton({ 
  user,
  onOpenMixing,
  onOpenPlanning, 
  onOpenDistribution 
}: { 
  user: User;
  onOpenMixing: () => void;
  onOpenPlanning: () => void;
  onOpenDistribution: () => void;
}) {
  const permissions = useRolePermissions(user.role);
  
  const buttons = [
    { label: "Cotton Mixing", description: "Analyze and manage cotton mixing details", action: onOpenMixing },
    { label: "Cotton Planning", description: "Plan cotton requirements and usage", action: onOpenPlanning },
    { label: "Cotton Distribution", description: "Track cotton distribution across units", action: onOpenDistribution },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-red-700">Cotton Details & Its Mixing Analysis</h2>
      </div>

      <div className="flex flex-wrap gap-6">
        {buttons.map((btn, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg shadow p-6 w-72 cursor-pointer
                       hover:shadow-lg hover:border-red-300 transition"
            onClick={btn.action}
          >
            <h3 className="text-lg font-bold text-red-700">{btn.label}</h3>
            <p className="text-sm text-gray-600 mt-2">
              {btn.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
