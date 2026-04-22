import { Link }    from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const AuctionCard = ({ auction }) => {
  const isEnding = new Date(auction.end_time) - new Date() < 15 * 60 * 1000;
  const isEnded  = auction.status === 'ended';

  const statusColor = {
    active    : 'bg-green-100 text-green-700',
    pending   : 'bg-yellow-100 text-yellow-700',
    ended     : 'bg-gray-100 text-gray-600',
    cancelled : 'bg-red-100 text-red-600',
  };

  return (
    <Link to={`/auctions/${auction.auction_id}`}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100
        hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden">

        {/* Image */}
        <div className="relative h-48 bg-gray-100">
          {auction.image_urls?.length > 0 ? (
            <img
              src={auction.image_urls[0]}
              alt={auction.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl">🔨</span>
            </div>
          )}
          <span className={`absolute top-3 right-3 text-xs font-medium
            px-2 py-1 rounded-full ${statusColor[auction.status]}`}>
            {auction.status}
          </span>
          {isEnding && !isEnded && (
            <span className="absolute top-3 left-3 bg-red-500 text-white
              text-xs font-medium px-2 py-1 rounded-full animate-pulse">
              Ending soon
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="text-xs text-gray-400 mb-1">
            {auction.category_name || 'Uncategorised'}
          </p>
          <h3 className="font-semibold text-gray-800 truncate mb-3">
            {auction.title}
          </h3>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-gray-400">Current bid</p>
              <p className="text-xl font-bold text-blue-600">
                ${parseFloat(auction.current_price).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">
                {auction.total_bids} bid{auction.total_bids !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500">
                {isEnded
                  ? 'Ended'
                  : `Ends ${formatDistanceToNow(new Date(auction.end_time),
                      { addSuffix: true })}`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default AuctionCard;