import { formatDistanceToNow } from 'date-fns';

const BidHistory = ({ bids, typingUser }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="font-semibold text-gray-800 mb-4">
        Bid History
        <span className="ml-2 text-sm text-gray-400 font-normal">
          ({bids.length} bids)
        </span>
      </h3>

      {typingUser && (
        <p className="text-sm text-blue-500 italic mb-3 animate-pulse">
          {typingUser} is placing a bid...
        </p>
      )}

      {bids.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">
          No bids yet. Be the first!
        </p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {bids.map((bid, idx) => (
            <div key={bid.bid_id}
              className={`flex items-center justify-between p-3 rounded-xl
                ${idx === 0
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex
                  items-center justify-center text-sm font-semibold text-blue-600">
                  {bid.bidder_username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {bid.bidder_username}
                    {idx === 0 && (
                      <span className="ml-2 text-xs bg-green-500 text-white
                        px-2 py-0.5 rounded-full">
                        Winning
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(bid.created_at),
                      { addSuffix: true })}
                  </p>
                </div>
              </div>
              <p className="font-bold text-gray-800">
                ${parseFloat(bid.amount).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BidHistory;