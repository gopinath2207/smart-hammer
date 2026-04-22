import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API         from '../config/api';
import toast       from 'react-hot-toast';

// ── Fake card formatter helpers ──────────────
const formatCardNumber = (val) =>
  val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (val) => {
  const d = val.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// ── Animated spinner ─────────────────────────
const Spinner = () => (
  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Mini confetti component ───────────────────
const Confetti = () => {
  const bits = Array.from({ length: 18 });
  const colors = ['bg-blue-400','bg-green-400','bg-yellow-400','bg-pink-400','bg-purple-400'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {bits.map((_, i) => (
        <div
          key={i}
          className={`absolute w-2.5 h-2.5 rounded-sm opacity-80 ${colors[i % colors.length]}`}
          style={{
            left    : `${5 + (i * 5.5) % 90}%`,
            top     : `${10 + (i * 13) % 60}%`,
            transform: `rotate(${i * 20}deg)`,
            animation: `confettiFall ${0.8 + (i % 5) * 0.15}s ease-out ${i * 0.07}s both`,
          }}
        />
      ))}
    </div>
  );
};

const CARD_BRANDS = {
  '4': { name: 'Visa',       icon: '💳' },
  '5': { name: 'Mastercard', icon: '💳' },
  '3': { name: 'Amex',       icon: '💳' },
};

const Payment = () => {
  const { auctionId } = useParams();
  const { user }      = useNavigate ? { user: null } : {};
  const navigate      = useNavigate();

  const [pageData,   setPageData]   = useState(null);   // auction info
  const [loading,    setLoading]    = useState(true);
  const [step,       setStep]       = useState('form'); // 'form' | 'processing' | 'success'
  const [error,      setError]      = useState(null);

  const [card, setCard] = useState({
    number  : '',
    name    : '',
    expiry  : '',
    cvv     : '',
  });

  // Fetch payment / auction info
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get(`/payments/${auctionId}`);
        if (res.data.payment_status === 'completed') {
          setStep('success');
          setPageData(res.data.payment);
        } else {
          setPageData(res.data.auction);
        }
      } catch (err) {
        const msg = err.response?.data?.message;
        if (err.response?.status === 403) {
          toast.error('You are not the winner of this auction.');
          navigate('/dashboard');
        } else {
          setError(msg || 'Failed to load payment information.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [auctionId]);

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    if (name === 'number') {
      setCard((c) => ({ ...c, number: formatCardNumber(value) }));
    } else if (name === 'expiry') {
      setCard((c) => ({ ...c, expiry: formatExpiry(value) }));
    } else if (name === 'cvv') {
      setCard((c) => ({ ...c, cvv: value.replace(/\D/g, '').slice(0, 4) }));
    } else {
      setCard((c) => ({ ...c, [name]: value }));
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();

    // Basic validation
    const rawNum = card.number.replace(/\s/g, '');
    if (rawNum.length < 13) { toast.error('Enter a valid card number.'); return; }
    if (!card.name.trim())  { toast.error('Enter the cardholder name.'); return; }
    if (card.expiry.length < 5) { toast.error('Enter a valid expiry date.'); return; }
    if (card.cvv.length < 3)    { toast.error('Enter a valid CVV.'); return; }

    setStep('processing');

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 2200));

    try {
      await API.post('/payments/create', {
        auction_id : auctionId,
        card_name  : card.name,
      });
      setStep('success');
      toast.success('Payment confirmed! 🎉');
    } catch (err) {
      setStep('form');
      toast.error(err.response?.data?.message || 'Payment failed. Please try again.');
    }
  };

  const brandKey = card.number[0];
  const brand    = CARD_BRANDS[brandKey] || { name: 'Card', icon: '💳' };

  // ─────────────── LOADING ────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent
            rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4 text-sm">Loading checkout…</p>
        </div>
      </div>
    );
  }

  // ─────────────── ERROR ───────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-md">
          <span className="text-5xl">⚠️</span>
          <h2 className="text-xl font-bold text-gray-800 mt-4">Checkout Error</h2>
          <p className="text-gray-500 mt-2 text-sm">{error}</p>
          <Link to="/dashboard"
            className="mt-6 inline-block bg-blue-600 hover:bg-blue-700
              text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────── SUCCESS ─────────────────────
  if (step === 'success') {
    const title  = pageData?.auction_title || pageData?.title || 'Your auction item';
    const amount = pageData?.amount        || pageData?.current_price || 0;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <style>{`
          @keyframes confettiFall {
            from { transform: translateY(-30px) rotate(0deg); opacity: 1; }
            to   { transform: translateY(60px)  rotate(180deg); opacity: 0; }
          }
          @keyframes popIn {
            from { transform: scale(0.6); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
        `}</style>
        <div className="relative bg-white rounded-2xl shadow-lg border border-gray-100
          p-10 text-center max-w-md w-full overflow-hidden">
          <Confetti />
          <div className="relative z-10">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center
              justify-center mx-auto mb-4"
              style={{ animation: 'popIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards' }}>
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Your payment for <strong>{title}</strong> has been confirmed.
            </p>

            <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 mt-6">
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide">
                Amount Paid
              </p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mt-4 text-left text-xs space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>Status</span>
                <span className="text-green-600 font-semibold">✓ Completed</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Method</span>
                <span className="font-medium">Card ending {card.number.slice(-4) || '****'}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Transaction</span>
                <span className="font-mono text-gray-600">
                  SMRT-{Math.random().toString(36).toUpperCase().slice(2, 10)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Link to="/dashboard"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white
                  font-semibold py-2.5 rounded-xl transition text-sm">
                Go to Dashboard
              </Link>
              <Link to="/auctions"
                className="flex-1 border border-gray-200 text-gray-600
                  hover:border-blue-300 font-medium py-2.5 rounded-xl transition text-sm">
                Browse Auctions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────── PROCESSING ──────────────────
  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100
          p-12 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center
            justify-center mx-auto mb-6">
            <Spinner />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Processing Payment…</h2>
          <p className="text-gray-500 text-sm mt-2">
            Please do not close this window.
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-6 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // ─────────────── CHECKOUT FORM ───────────────
  const amount = parseFloat(pageData?.current_price || 0);
  const title  = pageData?.title || 'Auction Item';
  const image  = pageData?.image_urls?.[0] || null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeSlideUp 0.35s ease both; }
      `}</style>

      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8 fade-in">
          <Link to="/dashboard" className="text-sm text-gray-400 hover:text-blue-600 transition">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Complete Your Purchase</h1>
          <p className="text-gray-500 text-sm mt-1">Secure checkout powered by Smart Hammer</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left — Card form */}
          <div className="lg:col-span-3 fade-in" style={{ animationDelay: '0.05s' }}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

              {/* Visual card preview */}
              <div className="relative h-44 rounded-2xl mb-6 overflow-hidden
                bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800
                shadow-lg p-6 flex flex-col justify-between select-none">
                {/* Chip + brand */}
                <div className="flex justify-between items-start">
                  <div className="w-10 h-7 bg-yellow-300 rounded-md opacity-90" />
                  <span className="text-white text-sm font-medium opacity-80">{brand.name}</span>
                </div>
                {/* Card number */}
                <div>
                  <p className="text-white text-lg font-mono tracking-widest">
                    {card.number || '•••• •••• •••• ••••'}
                  </p>
                  <div className="flex justify-between mt-2">
                    <div>
                      <p className="text-blue-200 text-xs uppercase">Cardholder</p>
                      <p className="text-white text-sm font-medium mt-0.5 truncate max-w-[140px]">
                        {card.name || 'YOUR NAME'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-200 text-xs uppercase">Expires</p>
                      <p className="text-white text-sm font-medium mt-0.5">
                        {card.expiry || 'MM/YY'}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Decorative circles */}
                <div className="absolute -right-8 -top-8 w-36 h-36 bg-white
                  opacity-5 rounded-full" />
                <div className="absolute -right-4 -top-20 w-52 h-52 bg-white
                  opacity-5 rounded-full" />
              </div>

              {/* Form */}
              <form onSubmit={handlePay} className="space-y-4">
                {/* Card number */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Card Number
                  </label>
                  <input
                    name="number"
                    type="text"
                    inputMode="numeric"
                    value={card.number}
                    onChange={handleCardChange}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      font-mono text-gray-800 tracking-wider"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Cardholder Name
                  </label>
                  <input
                    name="name"
                    type="text"
                    value={card.name}
                    onChange={handleCardChange}
                    placeholder="John Smith"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  />
                </div>

                {/* Expiry + CVV */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Expiry Date
                    </label>
                    <input
                      name="expiry"
                      type="text"
                      inputMode="numeric"
                      value={card.expiry}
                      onChange={handleCardChange}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        font-mono text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      CVV
                    </label>
                    <input
                      name="cvv"
                      type="text"
                      inputMode="numeric"
                      value={card.cvv}
                      onChange={handleCardChange}
                      placeholder="•••"
                      maxLength={4}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        font-mono text-gray-800"
                    />
                  </div>
                </div>

                {/* Demo hint */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3
                  flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">ℹ️</span>
                  <p className="text-xs text-amber-700">
                    <strong>Demo mode:</strong> Enter any card details. No real charge will occur.
                    Try: <span className="font-mono">4242 4242 4242 4242</span>
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white
                    font-bold py-3.5 rounded-xl transition text-base shadow-md
                    hover:shadow-lg active:scale-[0.98]"
                >
                  💳 Pay ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </button>
              </form>

              {/* Security badges */}
              <div className="flex items-center justify-center gap-4 mt-5">
                {['🔒 SSL Encrypted', '🛡️ Buyer Protected', '✅ Safe Checkout'].map((b) => (
                  <span key={b} className="text-xs text-gray-400">{b}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Order summary */}
          <div className="lg:col-span-2 space-y-4 fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Order Summary</h3>

              {/* Item */}
              <div className="flex gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {image ? (
                    <img src={image} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      🔨
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Seller: {pageData?.seller_username || '—'}
                  </p>
                  <span className="text-xs bg-green-100 text-green-700
                    px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                    🏆 Winning Bid
                  </span>
                </div>
              </div>

              {/* Amounts */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Hammer price</span>
                  <span>${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Buyer's premium</span>
                  <span className="text-green-600">FREE</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="text-green-600">FREE</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-3
                  border-t border-gray-100 text-base">
                  <span>Total</span>
                  <span className="text-green-700">
                    ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-blue-800 mb-3">
                Smart Hammer Guarantee
              </h4>
              {[
                { icon: '✅', text: 'Buyer protection on all items' },
                { icon: '🔄', text: 'Free returns within 30 days' },
                { icon: '📦', text: 'Insured shipping worldwide' },
                { icon: '🤝', text: 'Verified sellers only' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2 mb-2">
                  <span>{icon}</span>
                  <p className="text-xs text-blue-700">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
