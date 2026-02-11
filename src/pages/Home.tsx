

import { type Role } from "../hooks/useRolePermissions";

interface User {
  role: Role;
  full_name: string;
}

export default function Home({
  user,
  onOpenComplaint,
  onOpenDispatch,
  onOpenResults,
  onOpenCotton,
}: {
  user: User;
  onOpenComplaint: () => void;
  onOpenDispatch: () => void;
  onOpenResults: () => void;
  onOpenCotton: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-6">
      {/* Cotton Details Card */}
      <div
        onClick={onOpenCotton}
        className="bg-white border border-gray-200 rounded-lg shadow p-6 w-72 cursor-pointer
                   hover:shadow-lg hover:border-red-300 transition"
      >
        <h3 className="text-lg font-bold text-red-700">Cotton Details & Its Mixing Analysis</h3>
        <p className="text-sm text-gray-600 mt-2">
          View cotton mixing, planning & distribution
        </p>
      </div>

      {/* Complaint Analysis Card */}
      <div
        onClick={onOpenComplaint}
        className="bg-white border border-gray-200 rounded-lg shadow p-6 w-72 cursor-pointer
                   hover:shadow-lg hover:border-red-300 transition"
      >
        <h3 className="text-lg font-bold text-red-700">Complaint Analysis</h3>
        <p className="text-sm text-gray-600 mt-2">
          View yarn & fabric complaint details
        </p>
      </div>

      {/* Dispatch Details Card */}
      <div
        onClick={onOpenDispatch}
        className="bg-white border border-gray-200 rounded-lg shadow p-6 w-72 cursor-pointer
                   hover:shadow-lg hover:border-red-300 transition"
      >
        <h3 className="text-lg font-bold text-red-700">Dispatch Details</h3>
        <p className="text-sm text-gray-600 mt-2">
          View all dispatch details by division
        </p>
      </div>

      {/* Dispatch Results Card */}
      <div
        onClick={onOpenResults}
        className="bg-white border border-gray-200 rounded-lg shadow p-6 w-72 cursor-pointer
                   hover:shadow-lg hover:border-red-300 transition"
      >
        <h3 className="text-lg font-bold text-red-700">Dispatch Results</h3>
        <p className="text-sm text-gray-600 mt-2">
          View quality results for dispatch
        </p>
      </div>

      {/* Uster Quantum Daily Report Card */}
      <div
        onClick={() => window.open("https://uster-quantum-daily-report.smpl-qa-manthan.workers.dev/", "_blank")}
        className="bg-white border border-gray-200 rounded-lg shadow p-6 w-72 cursor-pointer
                   hover:shadow-lg hover:border-red-300 transition"
      >
        <h3 className="text-lg font-bold text-red-700">Uster Quantum Daily Report</h3>
        <p className="text-sm text-gray-600 mt-2">
          View Uster Quantum daily reports
        </p>
      </div>
    </div>
  );
}
