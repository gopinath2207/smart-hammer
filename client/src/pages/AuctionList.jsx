import { useState, useEffect } from 'react';
import API          from '../config/api';
import AuctionCard  from '../components/common/AuctionCard';
import Loader       from '../components/common/Loader';

const CATEGORIES = [
  'electronics','fashion','art','vehicles',
  'furniture','sports','jewellery','books-music',
];

const AuctionList = () => {
  const [auctions, setAuctions]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [total,    setTotal]      = useState(0);
  const [page,     setPage]       = useState(1);
  const [filters,  setFilters]    = useState({
    status: 'active', category: '',
    search: '', sort: 'created_at',
  });

  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const params = { ...filters, page, limit: 12 };
      const res    = await API.get('/auctions', { params });
      setAuctions(res.data.auctions);
      setTotal(res.data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAuctions(); }, [filters, page]);

  const handleFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Live Auctions</h1>
        <p className="text-gray-500 mt-1">{total} auctions available</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search auctions..."
          value={filters.search}
          onChange={(e) => handleFilter('search', e.target.value)}
          className="w-full md:w-96 px-4 py-3 border border-gray-200
            rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">

        {/* Status */}
        {['active','pending','ended'].map((s) => (
          <button
            key={s}
            onClick={() => handleFilter('status', s)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize
              transition border ${filters.status === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
          >
            {s}
          </button>
        ))}

        {/* Category */}
        <select
          value={filters.category}
          onChange={(e) => handleFilter('category', e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-full text-sm
            text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => handleFilter('sort', e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-full text-sm
            text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="created_at">Newest</option>
          <option value="end_time">Ending soon</option>
          <option value="current_price">Price: Low to High</option>
          <option value="total_bids">Most bids</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <Loader text="Loading auctions..." />
      ) : auctions.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-5xl">🔍</span>
          <p className="text-gray-500 mt-4">No auctions found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
            xl:grid-cols-4 gap-6">
            {auctions.map((a) => (
              <AuctionCard key={a.auction_id} auction={a} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-3 mt-10">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm
                disabled:opacity-40 hover:border-blue-300 transition"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page}</span>
            <button
              disabled={auctions.length < 12}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm
                disabled:opacity-40 hover:border-blue-300 transition"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuctionList;