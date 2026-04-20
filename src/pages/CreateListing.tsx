import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Upload, Sparkles, X, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CATEGORIES = [
  'Furniture', 'Clothing', 'Textbooks', 'Dorm Essentials', 
  'Electronics', 'Home Goods', 'Bikes / Transportation', 
  'Tickets / Extras', 'Free Stuff', 'Miscellaneous'
];

const CONDITIONS = ['Brand New', 'Like New', 'Good', 'Fair', 'Poor'];

const MEETUP_SPOTS = [
  'LBC (Lavin-Bernick Center)',
  'Howard-Tilton Memorial Library',
  'Reily Student Recreation Center',
  'Monroe Hall (Outside)',
  'The Boot Area',
  'Other (Specify in messages)'
];

export const CreateListing: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // To check if edit mode
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
    if (id) {
      const fetchListing = async () => {
        setIsFetchingInitial(true);
        try {
          const docRef = doc(db, 'listings', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Security check: Only allow the seller to edit
            if (user?.uid !== data.sellerId) {
              setSubmitError("You do not have permission to edit this listing.");
              setIsFetchingInitial(false);
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
          } else {
            setSubmitError("Listing not found.");
          }
        } catch (err) {
          console.error(err);
          setSubmitError("Failed to fetch listing data.");
        } finally {
          setIsFetchingInitial(false);
        }
      };
      fetchListing();
    }
  }, [id, user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      // Basic image compression max constraints
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          
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

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress heavily to ensure multiple images slip under 1MB DB limit
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
            setImages(prev => [...prev, compressedBase64]);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const generateWithAI = async () => {
    if (images.length === 0) {
      alert("Please upload at least one image first.");
      return;
    }

    setIsGenerating(true);
    try {
      // Extract base64 data
      const base64Image = images[0].split(',')[1];
      const mimeType = images[0].split(';')[0].split(':')[1];

      const prompt = `
        Analyze this image of an item being sold by a college student.
        Generate a JSON object with the following fields:
        - title: A catchy, concise title for the item.
        - description: A casual, useful, and realistic description for a college student selling this.
        - category: Choose ONE from this exact list: ${CATEGORIES.join(', ')}. If none fit perfectly, choose 'Miscellaneous'.
        - condition: Choose ONE from this exact list: ${CONDITIONS.join(', ')}. Guess based on visual wear.
        - tags: A comma-separated string of 3-5 relevant tags (e.g., "dorm, fridge, appliance").
        
        Return ONLY valid JSON.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          { inlineData: { data: base64Image, mimeType } }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (text) {
        const result = JSON.parse(text);
        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          description: result.description || prev.description,
          category: CATEGORIES.includes(result.category) ? result.category : prev.category,
          condition: CONDITIONS.includes(result.condition) ? result.condition : prev.condition,
          tags: result.tags || prev.tags,
        }));
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("Failed to generate details. Please try again or fill manually.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!user) {
       setSubmitError("You must be logged in to publish a listing.");
       return;
    }
    if (images.length === 0) {
      setSubmitError("Please add at least one image.");
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
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: originalListing?.status || 'available', // Keep original status if editing
        meetupLocations: [formData.meetupLocation].filter(Boolean),
        paymentMethods: [
          formData.acceptsVenmo ? 'Venmo' : null,
          formData.acceptsCash ? 'Cash' : null,
          formData.acceptsOther ? 'Other' : null
        ].filter(Boolean),
        updatedAt: serverTimestamp(),
        // Only set createdAt on new documents, otherwise omit
        ...(id ? {} : { createdAt: serverTimestamp() })
      };

      // Check byte size of payload
      const payloadSize = new Blob([JSON.stringify(listingData)]).size;
      if (payloadSize > 900000) { 
         setSubmitError("Your listing data is too large. Please remove some images or select smaller photos before publishing.");
         setIsSubmitting(false);
         return;
      }

      if (id) {
        // Update existing
        const docRef = doc(db, 'listings', id);
        await updateDoc(docRef, listingData);
        navigate(`/listing/${id}`);
      } else {
        // Create new
        const docRef = await addDoc(collection(db, 'listings'), listingData);
        navigate(`/listing/${docRef.id}`);
      }
    } catch (error: any) {
      console.error("Firestore Publish Error:", error);
      setSubmitError(error?.message || "Permission Denied or Network Error. Make sure you are using a @tulane.edu account or try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetchingInitial) {
    return <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-border-ink" />Loading listing...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{id ? 'Edit Listing' : 'Create a Listing'}</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Photos Section */}
        <div className="bg-white p-6 border border-border-ink">
          <h2 className="text-lg font-bold text-text-primary mb-4 uppercase tracking-wider text-sm">Photos</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square border border-border-ink">
                <img src={img} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-white p-1 border border-border-ink hover:bg-bg-muted"
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
                <span className="text-xs font-bold uppercase tracking-wider">Add Photo</span>
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
                <span className="text-white bg-border-ink px-1 py-0.5 text-[10px]">AI</span> Listing Assistant
              </div>
              <p className="text-xs leading-relaxed mb-3 text-border-ink">Upload a photo of your item and we'll generate the title, tags, and description for you.</p>
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

        {/* Details Section */}
        <div className="bg-white p-6 border border-border-ink space-y-6">
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider text-sm">Details</h2>
          
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Title</label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              placeholder="e.g. Mini Fridge, barely used"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Price ($)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Condition</label>
              <select
                required
                value={formData.condition}
                onChange={e => setFormData({...formData, condition: e.target.value})}
                className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              >
                <option value="">Select condition</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Category</label>
            <select
              required
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
            >
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Description</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              placeholder="Describe the item, reason for selling, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={e => setFormData({...formData, tags: e.target.value})}
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
              placeholder="e.g. dorm, fridge, clean"
            />
          </div>
        </div>

        {/* Logistics Section */}
        <div className="bg-white p-6 border border-border-ink space-y-6">
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider text-sm">Logistics</h2>
          
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Preferred Meetup Location</label>
            <select
              required
              value={formData.meetupLocation}
              onChange={e => setFormData({...formData, meetupLocation: e.target.value})}
              className="w-full border border-border-ink px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
            >
              <option value="">Select a campus spot</option>
              {MEETUP_SPOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Accepted Payment Methods</label>
            <div className="flex space-x-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptsVenmo}
                  onChange={e => setFormData({...formData, acceptsVenmo: e.target.checked})}
                  className="h-4 w-4 text-border-ink focus:ring-border-ink border-border-ink rounded-none bg-bg-page"
                />
                <span className="ml-2 text-sm text-text-primary font-medium">Venmo</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptsCash}
                  onChange={e => setFormData({...formData, acceptsCash: e.target.checked})}
                  className="h-4 w-4 text-border-ink focus:ring-border-ink border-border-ink rounded-none bg-bg-page"
                />
                <span className="ml-2 text-sm text-text-primary font-medium">Cash</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptsOther}
                  onChange={e => setFormData({...formData, acceptsOther: e.target.checked})}
                  className="h-4 w-4 text-border-ink focus:ring-border-ink border-border-ink rounded-none bg-bg-page"
                />
                <span className="ml-2 text-sm text-text-primary font-medium">Other</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end pt-4 gap-4 items-center">
          {submitError && (
            <div className="text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-xs font-semibold mr-auto">
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
