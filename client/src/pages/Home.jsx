import { Link } from 'react-router-dom';

const Home = () => (
  <div className="min-h-screen">
    {/* Hero */}
    <div className="bg-gradient-to-br from-blue-600 to-blue-800
      text-white py-24 px-4 text-center">
      <span className="text-6xl">🔨</span>
      <h1 className="text-5xl font-bold mt-4 mb-4">Smart Hammer</h1>
      <p className="text-xl text-blue-100 max-w-lg mx-auto mb-8">
        Bid smart. Win big. The online auction platform built for everyone.
      </p>
      <div className="flex gap-4 justify-center">
        <Link to="/auctions"
          className="bg-white text-blue-600 font-semibold
            px-8 py-3 rounded-xl hover:bg-blue-50 transition">
          Browse Auctions
        </Link>
        <Link to="/register"
          className="border border-white text-white font-semibold
            px-8 py-3 rounded-xl hover:bg-blue-700 transition">
          Get Started
        </Link>
      </div>
    </div>

    {/* Features */}
    <div className="max-w-5xl mx-auto px-4 py-16 grid
      grid-cols-1 md:grid-cols-3 gap-8 text-center">
      {[
        { icon: '⚡', title: 'Real-time Bidding',
          desc: 'Live bid updates instantly with Socket.io'     },
        { icon: '🔒', title: 'Secure & Trusted',
          desc: 'JWT auth and role-based access control'        },
        { icon: '🏆', title: 'Win Amazing Items',
          desc: 'Electronics, art, vehicles and much more'      },
      ].map(({ icon, title, desc }) => (
        <div key={title}
          className="bg-white rounded-2xl border border-gray-100
            shadow-sm p-8">
          <span className="text-4xl">{icon}</span>
          <h3 className="font-bold text-gray-900 mt-4 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm">{desc}</p>
        </div>
      ))}
    </div>
  </div>
);

export default Home;