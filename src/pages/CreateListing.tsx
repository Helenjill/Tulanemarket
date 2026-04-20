import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Sparkles, X, Loader2 } from 'lucide-react';

const CATEGORIES = [
  'Furniture',
  'Clothing',
  'Textbooks',
  'Dorm Essentials',
  'Electronics',
  'Home Goods',
  'Bikes / Transportation',
  'Tickets / Extras',
  'Free Stuff',
  'Miscellaneous',
];

const CONDITIONS = ['Brand New', 'Like New', 'Good', 'Fair', 'Poor'];

const MEETUP_SPOTS = [
  'LBC (Lavin-Bernick Center)',
  'Howard-Tilton Memorial Library',
  'Reily Student Recreation Center',
  'Monroe Hall (Outside)',
  'The Boot Area',
  'Other (Specify in messages)',
];

export const CreateListing: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [originalListing, setOriginalListing] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
    tags: '',
    meetupLocation: '',
    acceptsVenmo: true,
    acceptsCash: true,
    acceptsOther: false,
  });

  useEffect(() => {
    if (!id) return;

    const fetchListing = async () => {
      setIsFetchingInitial(true);
      try {
        const docRef = doc(db, 'listings', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setSubmitError('Listing not found.');
          return;
        }

        const data = docSnap.data();

        if (user?.uid !== data.sellerId) {
          setSubmitError('You do not have permission to edit this listing.');
          return;
        }

        setOriginalListing(data);
        setImages(data.images || []);
        setFormData({
          title: data.title || '',
          description: data.description || '',
          price: data.price?.toString() || '',
          category: data.category || '',
          condition: data.condition || '',
          tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
          meetupLocation: data.meetupLocations?.[0] || '',
          acceptsVenmo: data.paymentMethods?.includes('Venmo') || false,
          acceptsCash: data.paymentMethods?.includes('Cash') || false,
          acceptsOther: data.paymentMethods?.includes('Other') || false,
        });
      } catch (error) {
        console.error(error);
        setSubmitError('Failed to fetch listing data.');
      } finally {
        setIsFetchingInitial(false);
      }
    };

    fetchListing();
  }, [id, user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let { width, height } = img;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.6);
            setImages((prev) => [...prev, compressed].slice(0, 4));
          }
        };

        img.src = reader.result as string;
      };

      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const generateWithAI = async () => {
    if (images.length === 0) {
      alert('Please upload at least one image first.');
      return;
    }

    setIsGenerating(true);

    try {
      const base64Image = images[0].split(',')[1];

      if (!base64Image) {
        throw new Error('Invalid image data');
      }

      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Image,
        }),
      });

      const data = await res.json();
      console.log('AI response:', data);

      if (!res.ok) {
        throw new Error(data?.error || 'AI request failed');
      }

      if (!data?.result) {
        throw new Error('No result returned');
      }

      setFormData((prev) => ({
        ...prev,
        title: data.result.title || prev.title,
        description: data.result.description || prev.description,
        category: CATEGORIES.includes(data.result.category)
          ? data.result.category
          : prev.category,
        condition: CONDITIONS.includes(data.result.condition)
          ? data.result.condition
          : prev.condition,
        tags: Array.isArray(data.result.tags)
          ? data.result.tags.join(', ')
          : prev.tags,
      }));
    } catch (error) {
      console.error('AI Generation failed:', error);
      alert('Failed to generate details. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!user) {
      setSubmitError('You must be logged in to publish a listing.');
      return;
    }

    if (images.length === 0) {
      setSubmitError('Please add at least one image.');
      return;
    }

    setIsSubmitting(true);

    try {
      const listingData = {
        sellerId: user.uid,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        condition: formData.condition,
        images: images.slice(0, 4),
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        status: originalListing?.status || 'available',
        meetupLocations: [formData.meetupLocation].filter(Boolean),
        paymentMethods: [
          formData.acceptsVenmo ? 'Venmo' : null,
          formData.acceptsCash ? 'Cash' : null,
          formData.acceptsOther ? 'Other' : null,
        ].filter(Boolean),
        updatedAt: serverTimestamp(),
        ...(id ? {} : { createdAt: serverTimestamp() }),
      };

      if (id) {
        await updateDoc(doc(db, 'listings', id), listingData);
        navigate(`/listing/${id}`);
      } else {
        const docRef = await addDoc(collection(db, 'listings'), listingData);
        navigate(`/listing/${docRef.id}`);
      }
    } catch (error: any) {
      console.error('Error saving listing:', error);
      setSubmitError(error?.message || 'Error saving listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetchingInitial) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-border-ink" />
        Loading listing...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-8">
        {id ? 'Edit Listing' : 'Create a Listing'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white p-6 border border-border-ink">
          <h2 className="text-lg font-bold text-text-primary mb-6 uppercase tracking-wider text-sm">
            Photos
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square border border-border-ink bg-bg-page"
              >
                <img
                  src={img}
                  alt={`Upload ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-2 right-2 bg-white border border-border-ink p-1 hover:bg-bg-muted transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4 text-border-ink" />
                </button>
              </div>
            ))}

            {images.length < 4 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square border border-dashed border-border-ink flex flex-col items-center justify-center text-text-secondary hover:bg-bg-muted transition-colors"
              >
                <Upload className="w-6 h-6 mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Add Photo
                </span>
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            multiple
            className="hidden"
          />

          {images.length > 0 && (
            <div className="mt-6 bg-accent-blue border border-border-ink p-4">
              <div className="text-sm font-bold mb-2 flex items-center gap-1.5 text-border-ink">
                <span className="text-white bg-border-ink px-1 py-0.5 text-[10px]">
                  AI
                </span>
                Listing Assistant
              </div>
              <p className="text-xs leading-relaxed mb-3 text-border-ink">
                Upload a photo of your item and we&apos;ll generate the title,
                description, category, condition, and tags for you.
              </p>
              <button
                type="button"
                onClick={generateWithAI}
                disabled={isGenerating}
                className="w-full flex items-center justify-center py-3 px-4 border border-border-ink bg-border-ink text-white font-semibold text-[13px] uppercase tracking-wider hover:bg-black transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? 'Analyzing image...' : 'Auto-fill with AI'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white p-6 border border-border-ink space-y-6">
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider text-sm">
            Details
          </h2>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              placeholder="e.g. Mini Fridge, barely used"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                Price ($)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                Condition
              </label>
              <select
                required
                value={formData.condition}
                onChange={(e) =>
                  setFormData({ ...formData, condition: e.target.value })
                }
                className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              >
                <option value="">Select condition</option>
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
              Category
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
            >
              <option value="">Select category</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              placeholder="Describe the item, reason for selling, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              placeholder="e.g. dorm, fridge, clean"
            />
          </div>
        </div>

        <div className="bg-white p-6 border border-border-ink space-y-6">
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider text-sm">
            Logistics
          </h2>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
              Preferred Meetup Location
            </label>
            <select
              required
              value={formData.meetupLocation}
              onChange={(e) =>
                setFormData({ ...formData, meetupLocation: e.target.value })
              }
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
            >
              <option value="">Select a campus spot</option>
              {MEETUP_SPOTS.map((spot) => (
                <option key={spot} value={spot}>
                  {spot}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              Accepted Payment Methods
            </label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptsVenmo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      acceptsVenmo: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-border-ink focus:ring-border-ink border-border-ink rounded-none bg-bg-page"
                />
                <span className="ml-2 text-sm text-text-primary font-medium">
                  Venmo
                </span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptsCash}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      acceptsCash: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-border-ink focus:ring-border-ink border-border-ink rounded-none bg-bg-page"
                />
                <span className="ml-2 text-sm text-text-primary font-medium">
                  Cash
                </span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptsOther}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      acceptsOther: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-border-ink focus:ring-border-ink border-border-ink rounded-none bg-bg-page"
                />
                <span className="ml-2 text-sm text-text-primary font-medium">
                  Other
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end pt-2 gap-4 items-center">
          {submitError && (
            <div className="text-red-600 bg-red-50 border border-red-200 px-4 py-2 text-xs font-semibold mr-auto w-full sm:w-auto">
              {submitError}
            </div>
          )}

          <div className="flex w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-6 py-3 border border-border-ink text-border-ink font-semibold text-[13px] uppercase tracking-wider hover:bg-bg-muted mr-4 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 bg-border-ink text-white font-semibold text-[13px] uppercase tracking-wider hover:bg-black disabled:opacity-50 transition-colors flex items-center justify-center whitespace-nowrap"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {id ? 'Save Changes' : 'Publish Listing'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
