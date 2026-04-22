import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API   from '../config/api';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 1, name: 'Electronics'        },
  { id: 2, name: 'Fashion'            },
  { id: 3, name: 'Art & Collectibles' },
  { id: 4, name: 'Vehicles'           },
  { id: 5, name: 'Furniture'          },
  { id: 6, name: 'Sports'             },
  { id: 7, name: 'Jewellery'          },
  { id: 8, name: 'Books & Music'      },
];

const MAX_FILES  = 5;
const MAX_MB     = 5;
const MAX_BYTES  = MAX_MB * 1024 * 1024;

// ── Image preview item ────────────────────────
const ImageThumb = ({ src, index, onRemove }) => (
  <div className="relative group">
    <img
      src={src}
      alt={`preview-${index}`}
      className="w-full h-28 object-cover rounded-xl border border-gray-200"
    />
    {index === 0 && (
      <span className="absolute top-1.5 left-1.5 text-xs bg-blue-600
        text-white px-1.5 py-0.5 rounded-md font-medium leading-none">
        Main
      </span>
    )}
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600
        text-white rounded-full opacity-0 group-hover:opacity-100 transition
        flex items-center justify-center text-xs font-bold leading-none"
    >
      ✕
    </button>
  </div>
);

const CreateAuction = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title         : '',
    description   : '',
    category_id   : '',
    starting_price: '',
    reserve_price : '',
    bid_increment : '10',
    start_time    : '',
    end_time      : '',
  });

  const [files,    setFiles]    = useState([]);   // File objects
  const [previews, setPreviews] = useState([]);   // data-URL strings
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const inputRef = useRef(null);

  // ── Field change ──────────────────────────────
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // ── Add files (dedup by name+size) ───────────
  const addFiles = useCallback((incoming) => {
    const newFiles = Array.from(incoming).filter((f) => {
      if (!f.type.startsWith('image/')) {
        toast.error(`"${f.name}" is not an image.`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" exceeds ${MAX_MB} MB.`);
        return false;
      }
      return true;
    });

    setFiles((prev) => {
      const combined = [...prev, ...newFiles].slice(0, MAX_FILES);
      if (prev.length + newFiles.length > MAX_FILES) {
        toast(`Max ${MAX_FILES} images allowed.`, { icon: 'ℹ️' });
      }

      // Build previews for any new files
      const toPreview = combined.slice(prev.length);
      toPreview.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          setPreviews((p) => [...p, reader.result].slice(0, MAX_FILES));
        reader.readAsDataURL(file);
      });

      return combined;
    });
  }, []);

  const removeFile = (idx) => {
    setFiles((f)    => f.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  // ── Drag & drop handlers ──────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = ()  => setDragging(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Submit ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();

      // Append text fields
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '') formData.append(k, v);
      });

      // Append image files
      files.forEach((file) => formData.append('images', file));

      const res = await API.post('/auctions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Auction created!');
      navigate(`/auctions/${res.data.auction.auction_id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create auction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Auction</h1>
        <p className="text-gray-500 text-sm mt-1">
          List your item for auction — add photos to attract more buyers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── IMAGE UPLOAD ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Product Photos</h2>
          <p className="text-xs text-gray-400 mb-4">
            Up to {MAX_FILES} images · Max {MAX_MB} MB each · First image is the main photo
          </p>

          {/* Drop zone — only show when slots available */}
          {files.length < MAX_FILES && (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center
                cursor-pointer transition
                ${dragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">🖼️</span>
                <p className="text-sm font-medium text-gray-700">
                  {dragging ? 'Drop images here…' : 'Drag & drop images or click to browse'}
                </p>
                <p className="text-xs text-gray-400">
                  JPG, PNG, WEBP, GIF supported
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>
          )}

          {/* Previews grid */}
          {previews.length > 0 && (
            <div className={`grid grid-cols-3 sm:grid-cols-5 gap-3
              ${files.length < MAX_FILES ? 'mt-4' : ''}`}>
              {previews.map((src, i) => (
                <ImageThumb key={i} src={src} index={i} onRemove={removeFile} />
              ))}
            </div>
          )}

          {/* If at max, show replace hint */}
          {files.length >= MAX_FILES && (
            <p className="text-xs text-amber-600 mt-3">
              ℹ️ Max {MAX_FILES} images reached. Remove one to add another.
            </p>
          )}
        </div>

        {/* ── ITEM DETAILS ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Item Details</h2>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              placeholder="What are you selling?"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe your item — condition, dimensions, history…"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500
                resize-none text-gray-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Category
            </label>
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── PRICING ──────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'starting_price', label: 'Starting Price', required: true  },
              { name: 'reserve_price',  label: 'Reserve Price',  required: false },
              { name: 'bid_increment',  label: 'Bid Increment',  required: true,  span: true },
            ].map(({ name, label, required, span }) => (
              <div key={name} className={span ? 'col-span-2' : ''}>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {label}
                  {required && <span className="text-red-500 ml-0.5">*</span>}
                  {!required && <span className="text-gray-400 ml-1 text-xs">(optional)</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2
                    text-gray-400 font-medium">$</span>
                  <input
                    name={name}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form[name]}
                    onChange={handleChange}
                    required={required}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TIMING ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Timing</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'start_time', label: 'Start Time' },
              { name: 'end_time',   label: 'End Time'   },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {label} <span className="text-red-500">*</span>
                </label>
                <input
                  name={name}
                  type="datetime-local"
                  value={form[name]}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── SUBMIT ───────────────────────────── */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white
            font-semibold py-4 rounded-xl transition text-lg shadow-md
            hover:shadow-lg active:scale-[0.99]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? `Uploading${files.length > 0 ? ` ${files.length} photo${files.length > 1 ? 's' : ''}` : ''}…`
            : '🔨 Create Auction'}
        </button>

      </form>
    </div>
  );
};

export default CreateAuction;