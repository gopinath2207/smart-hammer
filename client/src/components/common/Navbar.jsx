import { useState }           from 'react';
import { Link, useNavigate }  from 'react-router-dom';
import { useAuth }            from '../../context/AuthContext';
import toast                  from 'react-hot-toast';

const Navbar = () => {
  const { user, logout, isRole } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out.');
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🔨</span>
            <span className="font-bold text-xl text-gray-900">
              Smart<span className="text-blue-600">Hammer</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/auctions"
              className="text-gray-600 hover:text-blue-600 transition text-sm font-medium">
              Auctions
            </Link>

            {isRole('seller', 'admin') && (
              <Link to="/create-auction"
                className="text-gray-600 hover:text-blue-600 transition text-sm font-medium">
                Sell Item
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/dashboard"
                  className="text-gray-600 hover:text-blue-600 transition text-sm font-medium">
                  Dashboard
                </Link>
                <div className="flex items-center gap-2 bg-gray-50
                  border border-gray-200 rounded-full px-3 py-1.5">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex
                    items-center justify-center text-sm font-semibold text-blue-600">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user.username}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-600
                    px-2 py-0.5 rounded-full capitalize">
                    {user.role}
                  </span>
                </div>
                <button onClick={handleLogout}
                  className="text-sm text-red-500 hover:text-red-600
                    font-medium transition">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login"
                  className="text-sm font-medium text-gray-600
                    hover:text-blue-600 transition">
                  Login
                </Link>
                <Link to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white
                    text-sm font-medium px-4 py-2 rounded-xl transition">
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-gray-600">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 space-y-3">
            <Link to="/auctions" onClick={() => setMenuOpen(false)}
              className="block text-gray-600 text-sm py-2">Auctions</Link>
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                  className="block text-gray-600 text-sm py-2">Dashboard</Link>
                <button onClick={handleLogout}
                  className="block text-red-500 text-sm py-2">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)}
                  className="block text-gray-600 text-sm py-2">Login</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)}
                  className="block text-gray-600 text-sm py-2">Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;