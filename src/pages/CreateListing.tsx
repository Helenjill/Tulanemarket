import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Sparkles, X, Loader2 } from 'lucide-react';

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

  // FETCH EXISTING LISTING (EDIT MODE)
  useEffect(() => {
    if (!id) return;

    const fetchListing = async () => {
      setIsFetchingInitial(true);
      try {
        const docRef = doc(db, 'listings', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setSubmitError("Listing not found.");
          return;
        }

        const data = docSnap.data();

        if (user?.uid !== data.sellerId) {
          setSubmitError("You do not have permission to edit this listing.");
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
      } catch (err) {
        setSubmitError("Failed to fetch listing data.");
      } finally {
        setIsFetchingInitial(false);
      }
    };

    fetchListing();
  }, [id, user]);

  // IMAGE UPLOAD
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const MAX = 800;
          let { width, height } = img;

          if (width > height && width > MAX) {
            height *= MAX / width;
            width = MAX;
          } else if (height > MAX) {
            width *= MAX / height;
            height = MAX;
          }

          canvas.width = width;
          canvas.height = height;

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.6);
            setImages(prev => [...prev, compressed]);
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

  // ✅ NEW AI FUNCTION (FIXED)
  const generateWithAI = async () => {
    if (images.length === 0) {
      alert("Upload a photo first.");
      return;
    }

    setIsGenerating(true);

    try {
      const base64Image = images[0].split(",")[1];

      const res = await fetch("/api/generate-listing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: base64Image,
        }),
      });

      const data = await res.json();

      if (data.result) {
        setFormData(prev => ({
          ...prev,
          description: data.result,
        }));
      }
    } catch (err) {
      alert("AI failed. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // SUBMIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return setSubmitError("Login required.");
    if (images.length === 0) return setSubmitError("Add an image.");

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
        status: originalListing?.status || 'available',
        meetupLocations: [formData.meetupLocation].filter(Boolean),
        paymentMethods: [
          formData.acceptsVenmo && 'Venmo',
          formData.acceptsCash && 'Cash',
          formData.acceptsOther && 'Other'
        ].filter(Boolean),
        updatedAt: serverTimestamp(),
        ...(id ? {} : { createdAt: serverTimestamp() })
      };

      if (id) {
        await updateDoc(doc(db, 'listings', id), listingData);
        navigate(`/listing/${id}`);
      } else {
        const docRef = await addDoc(collection(db, 'listings'), listingData);
        navigate(`/listing/${docRef.id}`);
      }

    } catch (err: any) {
      setSubmitError(err.message || "Error saving listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetchingInitial) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">

      <h1 className="text-2xl font-bold mb-8">
        {id ? 'Edit Listing' : 'Create Listing'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* PHOTOS */}
        <div className="bg-white p-6 border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">

            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)}>
                  <X />
                </button>
              </div>
            ))}

            {images.length < 4 && (
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload />
              </button>
            )}

          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            multiple
            className="hidden"
          />

          {images.length > 0 && (
            <button type="button" onClick={generateWithAI}>
              {isGenerating ? "Generating..." : "Auto-fill with AI"}
            </button>
          )}
        </div>

        {/* TITLE */}
        <input
          value={formData.title}
          onChange={e => setFormData({...formData, title: e.target.value})}
          placeholder="Title"
        />

        {/* DESCRIPTION */}
        <textarea
          value={formData.description}
          onChange={e => setFormData({...formData, description: e.target.value})}
          placeholder="Description"
        />

        <button type="submit">
          {isSubmitting ? "Saving..." : "Post Listing"}
        </button>

      </form>
    </div>
  );
};
