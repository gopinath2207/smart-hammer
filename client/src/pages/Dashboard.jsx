import { useState, useEffect } from 'react';
import { Link }    from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API         from '../config/api';
import Loader      from '../components/common/Loader';
import { formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const { user, isRole }  = useAuth();
  const [tab, setTab]     = useState('bids');
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'bids') {
        const res = await API.get('/bids/my-bids');
        setData(res.data.bids);
      } else if (tab === 'won') {
        const res = await API.get('/bids/won');
        setData(res.data.won_auctions);
      } else if (tab === 'auctions' && isRole('seller', 'admin')) {
        const res = await API.get('/auctions', {
          params: { seller_id: user.user_id, limit: 20 },
        });
        setData(res.data.auctions);
      } else if (tab === 'notifications') {
        const res = await API.get('/bids/notifications');
        setData(res.data.notifications);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tab]);

  const markAllRead = async () => {
    await API.patch('/bids/notifications/read');
    fetchData();
  };

  const statusColor = {
    winning : 'bg-green-100 text-green-700',
    won     : 'bg-blue-100  text-blue-700',
    outbid  : 'bg-red-100   text-red-600',
    lost    : 'bg-gray-100  text-gray-500',
  };

  const tabs = [
    { key: 'bids',          label: 'My Bids'        },
    { key: 'won',           label: 'Won Auctions'   },
    { key: 'notifications', label: 'Notifications'  },
    ...(isRole('seller', 'admin')
      ? [{ key: 'auctions', label: 'My Auctions' }]
      : []),
  ];

  // Admin / employee specific label override
  const roleLabel = isRole('admin') ? 'Administrator'
    : isRole('employee') ? 'Employee'
    : user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100
        shadow-sm p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex
            items-center justify-center text-2xl font-bold text-blue-600">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.full_name || user?.username}
            </h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5
              rounded-full capitalize font-medium">
              {user?.role}
            </span>
          </div>
          {isRole('seller', 'admin') && (
            <Link to="/create-auction"
              className="ml-auto bg-blue-600 hover:bg-blue-700 text-white
                text-sm font-medium px-4 py-2 rounded-xl transition">
              + New Auction
            </Link>
          )}
          {isRole('admin', 'employee') && (
            <div className="ml-auto bg-purple-100 border border-purple-200
              rounded-xl px-4 py-2">
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">
                {isRole('admin') ? '🔑 Admin Panel' : '👔 Staff Portal'}
              </p>
              <p className="text-xs text-purple-500 mt-0.5">
                {isRole('admin') ? 'Full access enabled' : 'Moderation access'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-100 pb-0">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition
              border-b-2 -mb-px ${tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? <Loader /> : (
        <div className="space-y-4">

          {/* Notifications tab */}
          {tab === 'notifications' && (
            <div className="flex justify-end mb-2">
              <button onClick={markAllRead}
                className="text-sm text-blue-600 hover:underline">
                Mark all as read
              </button>
            </div>
          )}

          {data.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl">📭</span>
              <p className="text-gray-500 mt-4">Nothing here yet.</p>
            </div>
          ) : (
            data.map((item) => (
              <div key={item.bid_id || item.auction_id || item.notification_id}
                className="bg-white rounded-2xl border border-gray-100
                  shadow-sm p-5 flex items-center justify-between gap-4">

                {/* Bids tab */}
                {tab === 'bids' && (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100
                        flex items-center justify-center text-xl">🔨</div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {item.auction_title}
                        </p>
                        <p className="text-sm text-gray-400">
                          {formatDistanceToNow(new Date(item.created_at),
                            { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        ${parseFloat(item.amount).toLocaleString()}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full
                        font-medium ${statusColor[item.bid_status]}`}>
                        {item.bid_status}
                      </span>
                    </div>
                  </>
                )}

                {/* Won tab */}
                {tab === 'won' && (
                  <>
                    <div>
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-400">
                        Seller: {item.seller_username}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="font-bold text-blue-600">
                        ${parseFloat(item.winning_amount).toLocaleString()}
                      </p>
                      {item.payment_status === 'completed' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full
                          bg-green-100 text-green-700 font-medium">
                          ✓ Paid
                        </span>
                      ) : (
                        <Link
                          to={`/payment/${item.auction_id}`}
                          className="text-xs bg-green-600 hover:bg-green-700
                            text-white font-semibold px-3 py-1.5 rounded-lg
                            transition"
                        >
                          💳 Pay Now
                        </Link>
                      )}
                    </div>
                  </>
                )}

                {/* My Auctions tab */}
                {tab === 'auctions' && (
                  <>
                    <div>
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-400">
                        {item.total_bids} bids · ends{' '}
                        {formatDistanceToNow(new Date(item.end_time),
                          { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        ${parseFloat(item.current_price).toLocaleString()}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full
                        ${item.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'}`}>
                        {item.status}
                      </span>
                    </div>
                  </>
                )}

                {/* Notifications tab */}
                {tab === 'notifications' && (
                  <div className={`flex items-start gap-3 w-full
                    ${!item.is_read ? 'opacity-100' : 'opacity-60'}`}>
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0
                      ${!item.is_read ? 'bg-blue-500' : 'bg-gray-300'}`}
                    />
                    <div>
                      <p className="text-sm text-gray-800">{item.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(item.created_at),
                          { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;