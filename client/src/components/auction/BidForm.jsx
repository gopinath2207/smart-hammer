import { useState }  from 'react';
import { useAuth }   from '../../context/AuthContext';
import { getSocket } from '../../config/socket';
import API           from '../../config/api';
import toast         from 'react-hot-toast';

const BidForm = ({ auction, onBidPlaced }) => {
  const { user }    = useAuth();
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);

  const minBid = parseFloat(auction.current_price) === 0
    ? parseFloat(auction.starting_price)
    : parseFloat(auction.current_price) + parseFloat(auction.bid_increment);

  const handleTyping = () => {
    const socket = getSocket();
    socket?.emit('bid:typing', auction.auction_id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please login to place a bid.');
      return;
    }

    if (parseFloat(amount) < minBid) {
      toast.error(`Minimum bid is $${minBid.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/bids', {
        auction_id : auction.auction_id,
        amount     : parseFloat(amount),
      });

      toast.success('Bid placed successfully!');
      setAmount('');
      onBidPlaced?.(res.data.bid);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place bid.');
    } finally {
      setLoading(false);
    }
  };

  const isEnded    = auction.status === 'ended';
  const isSeller   = user?.user_id === auction.seller_id;
  const isNotBuyer = user && user.role !== 'buyer';
  const disabled   = isEnded || isSeller || !user || isNotBuyer;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="font-semibold text-gray-800 mb-4 text-lg">Place a Bid</h3>

      {/* Current price */}
      <div className="bg-blue-50 rounded-xl p-4 mb-4 text-center">
        <p className="text-sm text-blue-600 mb-1">Current bid</p>
        <p className="text-3xl font-bold text-blue-700">
          ${parseFloat(auction.current_price).toLocaleString()}
        </p>
        <p className="text-xs text-blue-500 mt-1">
          Min next bid: ${minBid.toFixed(2)}
        </p>
      </div>

      {/* Status messages */}
      {!user && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm text-gray-600">
            <a href="/login" className="text-blue-600 font-medium underline">Login</a>{' '}
            to place a bid
          </p>
        </div>
      )}
      {isSeller && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm text-orange-600 font-medium">
            🚫 You cannot bid on your own auction
          </p>
        </div>
      )}
      {isNotBuyer && !isSeller && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm text-yellow-700 font-medium">
            ⚠️ Only <strong>Buyer</strong> accounts can place bids.
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            You're logged in as <span className="capitalize font-semibold">{user.role}</span>.
            Register a buyer account to bid.
          </p>
        </div>
      )}
      {isEnded && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm text-gray-500">This auction has ended</p>
        </div>
      )}

      {/* Bid form */}
      <form onSubmit={handleSubmit}>
        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2
            text-gray-400 font-medium">$</span>
          <input
            type="number"
            step="0.01"
            min={minBid}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); handleTyping(); }}
            placeholder={`${minBid.toFixed(2)} or more`}
            disabled={disabled}
            className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-800"
          />
        </div>

        {/* Quick bid buttons */}
        {!disabled && (
          <div className="flex gap-2 mb-3">
            {[1, 2, 5].map((mult) => (
              <button
                key={mult}
                type="button"
                onClick={() => setAmount(
                  (minBid + parseFloat(auction.bid_increment) * (mult - 1)).toFixed(2)
                )}
                className="flex-1 py-2 text-sm border border-blue-200
                  text-blue-600 rounded-lg hover:bg-blue-50 transition"
              >
                +${(parseFloat(auction.bid_increment) * mult).toFixed(0)}
              </button>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white
            font-semibold py-3 rounded-xl transition
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Placing bid...' : 'Place Bid'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-3">
        Bid increment: ${parseFloat(auction.bid_increment).toFixed(2)}
      </p>
    </div>
  );
};

export default BidForm;