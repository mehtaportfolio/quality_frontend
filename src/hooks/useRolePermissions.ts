export type Role = "Admin" | "Manager" | "User" | "Viewer";

export const useRolePermissions = (role: Role) => {
  const isAdmin = role === "Admin";
  const isManager = role === "Manager";
  const isUser = role === "User";
  const isViewer = role === "Viewer";

  return {
    canView: true, // Everyone can view
    canAdd: isAdmin || isManager || isUser,
    canEdit: isAdmin || isManager || isUser,
    canUpload: isAdmin || isManager || isUser,
    canDelete: isAdmin || isManager, // User and Viewer cannot delete
    canManageUsers: isAdmin, // Only Admin can manage users
    role
  };
};
