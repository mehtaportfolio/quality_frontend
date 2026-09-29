import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config";
import { useRolePermissions, type Role } from "../hooks/useRolePermissions";

interface User {
  id: string;
  role: string;
  full_name: string;
  secret_password?: string;
  work_details: string | null;
}

interface UsersProps {
  user: {
    role: Role;
    full_name: string;
  };
}

const Users: React.FC<UsersProps> = ({ user }) => {
  const permissions = useRolePermissions(user.role);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    role: "User",
    full_name: "",
    secret_password: "",
    work_details: ""
  });

  useEffect(() => {
    if (permissions.canManageUsers) {
      fetchUsers();
    }
  }, [permissions.canManageUsers]);

  if (!permissions.canManageUsers) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-700 mb-4">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to manage users.</p>
      </div>
    );
  }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError("Failed to fetch users");
      }
    } catch (err) {
      setError("An error occurred while fetching users");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      role: "User",
      full_name: "",
      secret_password: "",
      work_details: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      role: user.role,
      full_name: user.full_name,
      secret_password: user.secret_password || "",
      work_details: user.work_details || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${id}?deleted_by=${encodeURIComponent(user.full_name)}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      alert("An error occurred during deletion");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser 
      ? `${API_BASE_URL}/api/users/${editingUser.id}` 
      : `${API_BASE_URL}/api/users`;
    const method = editingUser ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        alert(data.message || "Failed to save user");
      }
    } catch (err) {
      alert("An error occurred while saving user");
    }
  };

  if (loading && users.length === 0) return <div className="p-8">Loading users...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-red-700">User Management</h2>
        <button
          onClick={handleOpenAdd}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Add New User
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.full_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                    ${user.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 
                      user.role === 'Manager' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleOpenEdit(user)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingUser ? "Edit User" : "Add New User"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Secret Password</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                    value={formData.secret_password}
                    onChange={(e) => setFormData({...formData, secret_password: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="User">User</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Work Details</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                  rows={2}
                  value={formData.work_details}
                  onChange={(e) => setFormData({...formData, work_details: e.target.value})}
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {editingUser ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
