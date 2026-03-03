import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState("User");
  const [fullName, setFullName] = useState("");
  const [secretPassword, setSecretPassword] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const { data, error } = await supabase
          .from("login_details")
          .select("full_name")
          .order("full_name", { ascending: true });

        if (error) throw error;

        if (data) {
          const uniqueNames = [...new Set(data.map((item) => item.full_name))].filter(Boolean);
          setNames(uniqueNames as string[]);
        }
      } catch (err) {
        console.error("Failed to fetch names:", err);
      }
    };
    fetchNames();
  }, []);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName) {
      setError("Please select your full name");
      return;
    }
    setShowSecretModal(true);
  };

  const handleFinalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Check credentials
      const { data, error: fetchError } = await supabase
        .from("login_details")
        .select("*")
        .eq("role", role)
        .eq("full_name", fullName)
        .eq("secret_password", secretPassword)
        .single();

      if (fetchError || !data) {
        setError("Invalid login details. Please check your role, name, and password.");
        setShowSecretModal(false);
        setSecretPassword("");
        return;
      }

      // 2. Perform the "delete and re-insert" logic as per backend pattern
      // to update last_login (this is what your backend was doing)
      const userToReinsert = {
        role: data.role,
        full_name: data.full_name,
        secret_password: data.secret_password,
        last_login: new Date().toISOString(),
        work_details: data.work_details,
      };

      await supabase.from("login_details").delete().eq("id", data.id);

      const { data: newData, error: insertError } = await supabase
        .from("login_details")
        .insert([userToReinsert])
        .select()
        .single();

      if (insertError) throw insertError;

      onLoginSuccess({
        id: newData.id,
        full_name: newData.full_name,
        role: newData.role,
      });
    } catch (err) {
      setError("An error occurred during login. Please try again.");
      console.error("Login error:", err);
      setShowSecretModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-red-100 relative">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-red-700">Quality App Login</h2>
          <p className="mt-2 text-gray-600">Please enter your details to access the dashboard</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleInitialSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              className="w-full px-4 py-2 mt-1 border rounded-lg focus:ring-red-500 focus:border-red-500 outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="User">User</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <select
              required
              className="w-full px-4 py-2 mt-1 border rounded-lg focus:ring-red-500 focus:border-red-500 outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            >
              <option value="">Select Full Name</option>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2 mt-4 font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition duration-200"
          >
            Login
          </button>
        </form>

        {/* Secret Password Modal */}
        {showSecretModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-sm p-6 bg-white rounded-xl shadow-2xl border-t-4 border-red-600">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Verification Required</h3>
              <p className="text-sm text-gray-600 mb-4">Please enter your secret password to proceed.</p>
              
              <form onSubmit={handleFinalLogin}>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter Secret Password"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-red-500 focus:border-red-500 outline-none mb-4"
                  value={secretPassword}
                  onChange={(e) => setSecretPassword(e.target.value)}
                />
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSecretModal(false);
                      setSecretPassword("");
                    }}
                    className="flex-1 py-2 font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {loading ? "Verifying..." : "Verify & Login"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
