import { useState }          from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth }           from '../context/AuthContext';
import API                   from '../config/api';
import toast                 from 'react-hot-toast';

const DEMO_ACCOUNTS = [
  {
    label    : '🔑 Admin',
    sublabel : 'Full platform access',
    email    : 'admin@smarthammer.com',
    password : 'Admin@123',
    color    : 'border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700',
  },
  {
    label    : '👔 Employee',
    sublabel : 'Auction moderator',
    email    : 'employee1@smarthammer.com',
    password : 'Employee@123',
    color    : 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700',
  },
];

const Login = () => {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const fillDemo = (account) => {
    setForm({ email: account.email, password: account.password });
    toast(`Filled ${account.label} credentials — click Login`, { icon: '✅' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post('/auth/login', form);
      login(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.username}!`);

      const { role } = res.data.user;
      const destination = ['admin', 'employee'].includes(role)
        ? '/dashboard'
        : '/auctions';
      navigate(destination, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <span className="text-4xl">🔨</span>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1">Login to Smart Hammer</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Password
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white
                font-semibold py-3 rounded-xl transition
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>

        {/* Demo credentials */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowDemo((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4
              text-sm font-medium text-gray-600 hover:text-gray-800
              hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">🧪</span> Demo Accounts
            </span>
            <span className="text-gray-400 text-lg leading-none">
              {showDemo ? '▲' : '▼'}
            </span>
          </button>

          {showDemo && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs text-gray-400 mb-3">
                Click to auto-fill credentials, then press Login.
              </p>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className={`w-full text-left border rounded-xl px-4 py-3
                    transition ${acc.color}`}
                >
                  <p className="font-semibold text-sm">{acc.label}</p>
                  <p className="text-xs mt-0.5 opacity-75">{acc.sublabel}</p>
                  <p className="text-xs mt-1 font-mono opacity-60">{acc.email}</p>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Login;