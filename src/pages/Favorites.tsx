import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Favorites: React.FC = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // First, listen to the favorites collection to get the listing IDs
    const q = query(collection(db, 'favorites'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      
      // For each favorite, fetch the actual listing data
      const favoriteItems: any[] = [];
      for (const d of snapshot.docs) {
        const favData = d.data();
        const listingId = favData.listingId;
        
        try {
          const listingDoc = await getDoc(doc(db, 'listings', listingId));
          if (listingDoc.exists()) {
            favoriteItems.push({
              ...listingDoc.data(),
              id: listingDoc.id,
              favoriteDocId: d.id // We keep the favorite document ID to allow un-favoriting deeply
            });
          }
        } catch (err) {
          console.error("Failed to fetch favorited listing", err);
        }
      }
      
      setFavorites(favoriteItems);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching favorites:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const removeFavorite = async (e: React.MouseEvent, favoriteDocId: string) => {
    e.preventDefault();
    try {
      await deleteDoc(doc(db, 'favorites', favoriteDocId));
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-3xl font-serif italic text-text-primary">Saved Items</h2>
            <p className="mt-2 text-sm text-text-secondary">Listings you've bookmarked to check out later.</p>
          </div>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col space-y-2 border border-border-ink p-0">
                <div className="bg-gray-200 aspect-square w-full border-b border-border-ink"></div>
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 w-3/4"></div>
                  <div className="h-4 bg-gray-200 w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16 text-text-secondary border border-border-ink bg-white flex flex-col items-center justify-center">
            <Heart className="w-12 h-12 text-border-ink/20 mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-1">No saved items yet</h3>
            <p>Click the heart icon on any listing to save it here.</p>
            <Link to="/" className="mt-6 px-6 py-2 bg-text-primary text-white text-sm font-bold uppercase tracking-wider hover:bg-black transition-colors border border-text-primary">
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {favorites.map((listing) => (
              <Link key={listing.id} to={`/listing/${listing.id}`} className="group flex flex-col border border-border-ink bg-white relative">
                <div className="relative aspect-square w-full bg-[#EEE] overflow-hidden border-b border-border-ink flex items-center justify-center text-xs text-[#999]">
                  {listing.images && listing.images.length > 0 ? (
                    <img 
                      src={listing.images[0]} 
                      alt={listing.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span>No image</span>
                  )}
                  <button 
                    onClick={(e) => removeFavorite(e, listing.favoriteDocId)}
                    className="absolute top-2.5 right-2.5 w-8 h-8 bg-white border border-border-ink flex items-center justify-center hover:bg-bg-page transition-colors z-10 rounded-full shadow-sm"
                  >
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  </button>
                  {listing.status === 'sold' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                      <span className="text-white font-bold tracking-wider uppercase text-xs">Sold</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-extrabold text-lg text-text-primary">${listing.price}</div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider">{listing.condition}</div>
                  </div>
                  <h3 className="text-sm text-text-secondary mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    {listing.title}
                  </h3>
                  <div className="inline-flex items-center text-[9px] font-bold text-tulane-green uppercase bg-[#E8F5E9] px-1.5 py-0.5 border border-tulane-green">
                    Verified Student
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
