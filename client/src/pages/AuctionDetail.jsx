import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate }           from 'react-router-dom';
import { useAuth }      from '../context/AuthContext';
import { getSocket }    from '../config/socket';
import API              from '../config/api';
import BidForm          from '../components/auction/BidForm';
import BidHistory       from '../components/auction/BidHistory';
import CountdownTimer   from '../components/auction/CountdownTimer';
import Loader           from '../components/common/Loader';
import toast            from 'react-hot-toast';
import { format }       from 'date-fns';

const AuctionDetail = () => {
  const { id }       = useParams();
  const { user }     = useAuth();
  const navigate     = useNavigate();

  const [auction,     setAuction]     = useState(null);
  const [bids,        setBids]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [viewers,     setViewers]     = useState(0);
  const [typingUser,  setTypingUser]  = useState('');
  const [watched,     setWatched]     = useState(false);

  // ── Fetch auction ──────────────────────────
  useEffect(() => {
    const fetchAuction = async () => {
      try {
        setError(null);
        const res = await API.get(`/auctions/${id}`);
        setAuction(res.data.auction);
        setBids(res.data.top_bids);
        setWatched(res.data.auction.is_watched);
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) {
          // Auction genuinely doesn't exist — go back to list
          navigate('/auctions');
        } else {
          // Any other error (network blip, 500, etc.) — show inline error
          setError(err.response?.data?.message || 'Failed to load auction. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAuction();
  }, [id]);

  // ── Socket.io ──────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;

    socket.emit('auction:join', id);

    // New bid received
    socket.on('bid:new', (bid) => {
      if (bid.auction_id !== id) return;
      setBids((prev) => [bid, ...prev]);
      setAuction((prev) => ({
        ...prev,
        current_price : bid.amount,
        total_bids    : bid.total_bids,
      }));
      setTypingUser('');
      toast(`${bid.bidder_username} bid $${bid.amount}`, { icon: '🔨' });
    });

    // Outbid notification
    socket.on('bid:outbid', (data) => {
      if (data.auction_id !== id) return;
      toast.error(`You were outbid! New bid: $${data.new_bid}`);
    });

    // Viewer count
    socket.on('auction:viewers', (data) => {
      if (data.auction_id !== id) return;
      setViewers(data.viewers);
    });

    // Typing indicator
    socket.on('bid:typing', ({ username }) => {
      setTypingUser(username);
      setTimeout(() => setTypingUser(''), 3000);
    });

    // Auction ended
    socket.on('auction:ended', (data) => {
      if (data.auction_id !== id) return;
      setAuction((prev) => ({ ...prev, status: 'ended' }));
      toast(`Auction ended! Final price: $${data.final_price}`, { icon: '🏁' });
    });

    // Ending soon
    socket.on('auction:ending_soon', (data) => {
      if (data.auction_id !== id) return;
      toast(data.message, { icon: '⏰' });
    });

    return () => {
      socket.emit('auction:leave', id);
      socket.off('bid:new');
      socket.off('bid:outbid');
      socket.off('auction:viewers');
      socket.off('bid:typing');
      socket.off('auction:ended');
      socket.off('auction:ending_soon');
    };
  }, [id]);

  const handleBidPlaced = useCallback((bid) => {
    setBids((prev) => [bid, ...prev]);
    setAuction((prev) => ({
      ...prev,
      current_price : bid.amount,
      total_bids    : bid.total_bids,
    }));
  }, []);

  const toggleWatchlist = async () => {
    try {
      await API.post(`/auctions/${id}/watchlist`);
      setWatched((w) => !w);
      toast.success(watched ? 'Removed from watchlist' : 'Added to watchlist');
    } catch {
      toast.error('Please login to use watchlist');
    }
  };

  if (loading) return <Loader text="Loading auction..." />;

  // Inline error state (don't redirect blindly)
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <span className="text-6xl">⚠️</span>
        <h2 className="text-2xl font-bold text-gray-800 mt-4">Something went wrong</h2>
        <p className="text-gray-500 mt-2">{error}</p>
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5
              rounded-xl font-medium transition"
          >
            Try Again
          </button>
          <a href="/auctions"
            className="border border-gray-200 text-gray-600 hover:border-blue-300
              px-5 py-2.5 rounded-xl font-medium transition"
          >
            Back to Auctions
          </a>
        </div>
      </div>
    );
  }

  if (!auction) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <p className="text-sm text-gray-400 mb-6">
        <a href="/auctions" className="hover:text-blue-600">Auctions</a>
        {' / '}
        <span className="text-gray-600">{auction.title}</span>
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left — Image + Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Image */}
          <div className="bg-gray-100 rounded-2xl overflow-hidden h-80 md:h-96">
            {auction.image_urls?.length > 0 ? (
              <img
                src={auction.image_urls[0]}
                alt={auction.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-8xl">🔨</span>
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div className="bg-white rounded-2xl border border-gray-100
            shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs bg-blue-100 text-blue-600
                  px-2 py-1 rounded-full">
                  {auction.category_name || 'General'}
                </span>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">
                  {auction.title}
                </h1>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Viewers */}
                <span className="text-sm text-gray-400">
                  👁 {viewers} watching
                </span>
                {/* Watchlist */}
                <button
                  onClick={toggleWatchlist}
                  className={`text-sm px-3 py-1.5 rounded-xl border transition
                    ${watched
                      ? 'bg-yellow-50 border-yellow-300 text-yellow-600'
                      : 'border-gray-200 text-gray-500 hover:border-yellow-300'}`}
                >
                  {watched ? '★ Watching' : '☆ Watch'}
                </button>
              </div>
            </div>

            <p className="text-gray-600 mt-4 leading-relaxed">
              {auction.description || 'No description provided.'}
            </p>

            {/* Auction stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { label: 'Starting price', val: `$${parseFloat(auction.starting_price).toLocaleString()}` },
                { label: 'Total bids',     val: auction.total_bids },
                { label: 'Bid increment',  val: `$${parseFloat(auction.bid_increment).toFixed(2)}` },
                { label: 'Views',          val: auction.views_count },
              ].map(({ label, val }) => (
                <div key={label}
                  className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="font-semibold text-gray-800">{val}</p>
                </div>
              ))}
            </div>

            {/* Seller */}
            <div className="flex items-center gap-3 mt-6 pt-6
              border-t border-gray-100">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex
                items-center justify-center font-semibold text-blue-600">
                {auction.seller_username?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {auction.seller_username}
                  {auction.seller_verified && (
                    <span className="ml-1 text-blue-500">✓</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">Seller</p>
              </div>
            </div>
          </div>

          {/* Bid history */}
          <BidHistory bids={bids} typingUser={typingUser} />
        </div>

        {/* Right — Bid panel */}
        <div className="space-y-6">

          {/* Countdown */}
          <div className="bg-white rounded-2xl border border-gray-100
            shadow-sm p-6">
            <p className="text-sm text-gray-500 text-center mb-4">
              {auction.status === 'ended' ? 'Ended on' : 'Ends on'}{' '}
              {format(new Date(auction.end_time), 'PPP p')}
            </p>
            <CountdownTimer
              endTime={auction.end_time}
              onEnd={() => setAuction((a) => ({ ...a, status: 'ended' }))}
            />
          </div>

          {/* Bid form — show for active auctions */}
          {auction.status === 'active' && (
            <BidForm auction={auction} onBidPlaced={handleBidPlaced} />
          )}

          {/* Auction ended state */}
          {auction.status === 'ended' && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6
              text-center">
              <span className="text-4xl">🏁</span>
              <p className="font-semibold text-gray-800 mt-3">Auction Ended</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                ${parseFloat(auction.current_price).toLocaleString()}
              </p>
              <p className="text-sm text-gray-400 mt-1">Final price</p>
              {/* Show pay now if current user is winner */}
              {user && auction.winner_id === user.user_id && (
                <a
                  href={`/payment/${auction.auction_id}`}
                  className="mt-4 inline-block bg-green-600 hover:bg-green-700
                    text-white font-semibold px-6 py-2.5 rounded-xl transition"
                >
                  💳 Pay Now
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionDetail;