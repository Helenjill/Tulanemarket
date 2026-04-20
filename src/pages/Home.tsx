import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, where, addDoc, serverTimestamp, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Heart, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q')?.toLowerCase() || '';

  const [listings, setListings] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<{ [listingId: string]: string }>({}); // mapping of listingId -> favoriteDocId
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Filtering & Sorting State
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'price-asc', 'price-desc'
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All');

  useEffect(() => {
    // We fetch broadly and handle complex sorting/filtering client-side to avoid composite index requirements
    let q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    if (selectedCategory !== 'All') {
      q = query(collection(db, 'listings'), where('category', '==', selectedCategory), orderBy('createdAt', 'desc'));
    }
    
    // Instead of onSnapshot which re-downloads the heavy array on every DB change anywhere,
    // we use a one-time getDocs so the UI doesn't freeze downloading huge base64 strings repeatedly.
    const fetchListings = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(q);
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Client-side search filtering
        if (searchQuery) {
          items = items.filter((item: any) => 
            (item.title && item.title.toLowerCase().includes(searchQuery)) ||
            (item.description && item.description.toLowerCase().includes(searchQuery)) ||
            (item.tags && item.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery)))
          );
        }
        
        setListings(items);
      } catch (error) {
        console.error("Error fetching listings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [selectedCategory, searchQuery]);

  // Fetch favorites mapping for the current user
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'favorites'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const favMap: { [listingId: string]: string } = {};
      snapshot.docs.forEach(doc => {
        favMap[doc.data().listingId] = doc.id;
      });
      setFavorites(favMap);
    });
    return () => unsubscribe();
  }, [user]);

  const toggleFavorite = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault(); // Prevent navigating to the listing detail page
    if (!user) {
      alert("Please log in to save items.");
      return;
    }
    
    const favoriteDocId = favorites[listingId];
    try {
      if (favoriteDocId) {
        // Remove from favorites
        await deleteDoc(doc(db, 'favorites', favoriteDocId));
      } else {
        // Add to favorites
        await addDoc(collection(db, 'favorites'), {
          userId: user.uid,
          listingId: listingId,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const CATEGORIES = [
    'All', 'Furniture', 'Clothing', 'Textbooks', 'Dorm Essentials', 
    'Electronics', 'Home Goods', 'Bikes / Transportation', 
    'Tickets / Extras', 'Free Stuff', 'Miscellaneous'
  ];

  const CONDITIONS = ['All', 'New', 'Like New', 'Good', 'Fair', 'Poor'];

  // Apply Client-Side Filters and Sorting
  const filteredAndSortedListings = React.useMemo(() => {
    let result = [...listings];

    // Filter out logically deleted or unavailable items if needed, mostly just enforcing structure
    result = result.filter(item => item && item.status !== 'deleted');

    // Filter by Min Price
    if (minPrice !== '') {
      result = result.filter(item => item.price >= parseFloat(minPrice));
    }
    // Filter by Max Price
    if (maxPrice !== '') {
      result = result.filter(item => item.price <= parseFloat(maxPrice));
    }
    // Filter by Condition
    if (selectedCondition !== 'All') {
      result = result.filter(item => item.condition === selectedCondition);
    }

    // Sort
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else {
      // 'newest' - Already sorted by createdAt desc from Firestore, but just in case
      result.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
    }

    return result;
  }, [listings, minPrice, maxPrice, selectedCondition, sortBy]);

  return (
    <div className="space-y-8">
      {/* Categories */}
      <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap px-4 py-2 text-[11px] font-bold uppercase tracking-wider border rounded-xl ${
              cat === selectedCategory 
                ? 'bg-border-ink text-white border-border-ink' 
                : 'bg-white text-text-secondary border-border-ink hover:text-text-primary'
            } transition-colors`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feed Area */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-serif italic text-text-primary">
              {searchQuery ? `Search results for "${searchQuery}"` : 'Recommended for you'}
            </h2>
            <div className="text-xs text-text-secondary mt-1">
              {loading ? (
                <span>Loading items...</span>
              ) : (
                <span>Showing {filteredAndSortedListings.length} item{filteredAndSortedListings.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider border rounded-xl transition-colors ${showFilters ? 'bg-light-blue text-accent-blue border-accent-blue' : 'bg-white text-text-secondary border-border-ink hover:text-text-primary hover:bg-bg-muted'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter & Sort
            {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>
        </div>
        
        {/* Expanded Filters Panel */}
        {showFilters && (
          <div className="bg-white border text-sm font-bold border-border-ink p-5 rounded-2xl mb-8 shadow-sm flex flex-col md:flex-row gap-8">
            {/* Sort */}
            <div className="flex-1 space-y-3">
              <label className="block text-[11px] uppercase tracking-wider text-text-secondary">Sort By</label>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border border-border-ink p-2 outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue bg-bg-muted"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
            
            {/* Price Filter */}
            <div className="flex-1 space-y-3">
              <label className="block text-[11px] uppercase tracking-wider text-text-secondary">Price Range</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  placeholder="Min $" 
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full border border-border-ink p-2 outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue bg-bg-muted"
                  min="0"
                />
                <span className="text-text-secondary">-</span>
                <input 
                  type="number" 
                  placeholder="Max $" 
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full border border-border-ink p-2 outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue bg-bg-muted"
                  min="0"
                />
              </div>
            </div>
            
            {/* Condition Filter */}
            <div className="flex-1 space-y-3">
              <label className="block text-[11px] uppercase tracking-wider text-text-secondary">Condition</label>
              <select 
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full border border-border-ink p-2 outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue bg-bg-muted"
              >
                {CONDITIONS.map(cond => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>
            </div>
            
            {/* Reset Button */}
            <div className="flex items-end">
              <button 
                onClick={() => {
                  setSortBy('newest');
                  setMinPrice('');
                  setMaxPrice('');
                  setSelectedCondition('All');
                }}
                className="w-full md:w-auto px-4 py-2 text-[11px] font-bold uppercase tracking-wider bg-bg-muted text-text-secondary border border-border-ink hover:text-text-primary hover:bg-slate-200"
              >
                Reset
              </button>
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col space-y-2 border border-border-ink rounded-2xl overflow-hidden p-0">
                <div className="bg-slate-200 aspect-square w-full border-b border-border-ink"></div>
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-slate-200 w-3/4 rounded"></div>
                  <div className="h-4 bg-slate-200 w-1/4 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedListings.length === 0 ? (
          <div className="text-center py-12 text-text-secondary border border-border-ink bg-white rounded-2xl">
            {searchQuery 
              ? `No items found matching "${searchQuery}". Try different keywords.` 
              : `No listings found for ${selectedCategory}.`
            }
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {filteredAndSortedListings.map((listing) => {
              const isFavorited = !!favorites[listing.id];
              return (
              <Link key={listing.id} to={`/listing/${listing.id}`} className="group flex flex-col border border-border-ink rounded-2xl overflow-hidden bg-white relative hover:shadow-lg transition-all duration-300">
                <div className="relative aspect-square w-full bg-slate-100 overflow-hidden border-b border-border-ink flex items-center justify-center text-xs text-text-secondary">
                  {listing.images && listing.images.length > 0 ? (
                    <img 
                       src={listing.images[0]} 
                      alt={listing.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 rounded-none"
                    />
                  ) : (
                    <span>No image</span>
                  )}
                  <button 
                    onClick={(e) => toggleFavorite(e, listing.id)}
                    className="absolute top-2.5 right-2.5 w-8 h-8 bg-white border border-border-ink flex items-center justify-center hover:bg-bg-muted transition-colors z-10 rounded-full shadow-sm"
                  >
                    <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-text-secondary'}`} />
                  </button>
                  {listing.status === 'sold' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-[2px]">
                      <span className="text-white font-extrabold tracking-widest uppercase text-xs">Sold</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <div className="font-extrabold text-lg text-text-primary leading-none">${listing.price}</div>
                  </div>
                  <h3 className="text-sm text-text-secondary mb-3 whitespace-nowrap overflow-hidden text-ellipsis">
                    {listing.title}
                  </h3>
                  <div className="flex justify-between items-center">
                    <div className="inline-flex items-center text-[9px] font-bold text-tulane-green uppercase bg-green-50 px-1.5 py-0.5 border border-tulane-green rounded-md">
                      Verified Student
                    </div>
                    <div className="text-[9px] text-text-secondary uppercase tracking-wider font-bold bg-bg-muted px-1.5 py-0.5 border border-border-ink rounded-md">{listing.condition}</div>
                  </div>
                </div>
              </Link>
            )})}
          </div>
        )}
      </div>
    </div>
  );
};
