import { useState }          from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth }           from '../context/AuthContext';
import API                   from '../config/api';
import toast                 from 'react-hot-toast';

const Register = () => {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm] = useState({
    username: '', email: '', password: '',
    full_name: '', phone: '', role: 'buyer',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/auth/register', form);
      login(res.data.user, res.data.token);
      toast.success('Account created successfully!');
      navigate('/auctions');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100
        p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <span className="text-4xl">🔨</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Join Smart Hammer today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: 'username',  label: 'Username',   type: 'text',     placeholder: 'johndoe'           },
            { name: 'full_name', label: 'Full Name',  type: 'text',     placeholder: 'John Doe'          },
            { name: 'email',     label: 'Email',      type: 'email',    placeholder: 'you@example.com'   },
            { name: 'phone',     label: 'Phone',      type: 'tel',      placeholder: '+91 9876543210'    },
            { name: 'password',  label: 'Password',   type: 'password', placeholder: 'Min 8 characters'  },
          ].map(({ name, label, type, placeholder }) => (
            <div key={name}>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {label}
              </label>
              <input
                name={name}
                type={type}
                value={form[name]}
                onChange={handleChange}
                required={name !== 'phone'}
                placeholder={placeholder}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>
          ))}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              I want to
            </label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            >
              <option value="buyer">Buy items (Buyer)</option>
              <option value="seller">Sell items (Seller)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white
              font-semibold py-3 rounded-xl transition
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;