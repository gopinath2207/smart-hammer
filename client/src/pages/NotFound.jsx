import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center
    justify-center text-center px-4">
    <span className="text-8xl">🔨</span>
    <h1 className="text-6xl font-bold text-gray-900 mt-6">404</h1>
    <p className="text-gray-500 mt-3 mb-8">
      This page got outbid and no longer exists.
    </p>
    <Link to="/"
      className="bg-blue-600 hover:bg-blue-700 text-white
        font-semibold px-6 py-3 rounded-xl transition">
      Back to Home
    </Link>
  </div>
);

export default NotFound;