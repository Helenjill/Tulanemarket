import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { MapPin, Heart, MessageSquare, DollarSign, User as UserIcon, ArrowRight, CheckCircle2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [listing, setListing] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState('');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'listings', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setListing({ id: docSnap.id, ...data });
          
          // Fetch seller
          const sellerRef = doc(db, 'users', data.sellerId);
          const sellerSnap = await getDoc(sellerRef);
          if (sellerSnap.exists()) {
            setSeller(sellerSnap.data());
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `listings/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id]);

  useEffect(() => {
    // Check if favorited
    if (!user || !id) return;
    const q = query(collection(db, 'favorites'), where('userId', '==', user.uid), where('listingId', '==', id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setFavoriteDocId(snapshot.docs[0].id);
      } else {
        setFavoriteDocId(null);
      }
    });
    return () => unsubscribe();
  }, [user, id]);

  const toggleFavorite = async () => {
    if (!user || !id) {
      alert("Please log in to save items.");
      return;
    }
    
    try {
      if (favoriteDocId) {
        await deleteDoc(doc(db, 'favorites', favoriteDocId));
      } else {
        await addDoc(collection(db, 'favorites'), {
          userId: user.uid,
          listingId: id,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !listing || !offerAmount) return;

    try {
      await addDoc(collection(db, 'offers'), {
        listingId: listing.id,
        buyerId: user.uid,
        sellerId: listing.sellerId,
        amount: parseFloat(offerAmount),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send notification to seller
      await addDoc(collection(db, 'notifications'), {
        userId: listing.sellerId,
        title: 'New Offer Received',
        message: `Someone made an offer of $${parseFloat(offerAmount)} on "${listing.title}".`,
        link: '/offers',
        read: false,
        createdAt: serverTimestamp()
      });

      alert('Offer sent successfully!');
      setShowOfferForm(false);
      setOfferAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'offers');
    }
  };

  const handleMessageSeller = async () => {
    if (!user || !listing) return;
    
    try {
      // Check if chat already exists
      const q = query(
        collection(db, 'chats'), 
        where('listingId', '==', listing.id),
        where('buyerId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      
      let chatId;
      if (querySnapshot.empty) {
        // Create new chat
        const chatRef = await addDoc(collection(db, 'chats'), {
          listingId: listing.id,
          buyerId: user.uid,
          sellerId: listing.sellerId,
          updatedAt: serverTimestamp()
        });
        chatId = chatRef.id;
      } else {
        chatId = querySnapshot.docs[0].id;
      }
      
      navigate(`/messages/${chatId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const handleMarkAsSold = async () => {
    if (!user || !listing) return;
    if (window.confirm("Are you sure you want to mark this item as sold? It will no longer appear in active searches.")) {
      try {
        const docRef = doc(db, 'listings', listing.id);
        await updateDoc(docRef, { status: 'sold', updatedAt: serverTimestamp() });
        setListing({ ...listing, status: 'sold' });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `listings/${listing.id}`);
      }
    }
  };

  const handleDeleteListing = async () => {
    if (!user || !listing) return;
    if (window.confirm("Are you sure you want to permanently delete this listing? This action cannot be undone.")) {
      try {
        const docRef = doc(db, 'listings', listing.id);
        await deleteDoc(docRef);
        navigate('/'); // Redirect to home after delete
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `listings/${listing.id}`);
      }
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!listing) return <div className="text-center py-12">Listing not found.</div>;

  const isOwner = user?.uid === listing.sellerId;

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
      {/* Left: Images */}
      <div className="space-y-4">
        <div className="aspect-square bg-[#EEE] border border-border-ink overflow-hidden flex items-center justify-center text-xs text-[#999]">
          {listing.images && listing.images.length > 0 ? (
            <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <span>No image</span>
          )}
        </div>
        {listing.images && listing.images.length > 1 && (
          <div className="grid grid-cols-4 gap-4">
            {listing.images.slice(1).map((img: string, idx: number) => (
              <div key={idx} className="aspect-square bg-[#EEE] border border-border-ink">
                <img src={img} alt={`${listing.title} ${idx + 2}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Details */}
      <div className="flex flex-col">
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <h1 className="text-3xl font-serif italic text-text-primary">{listing.title}</h1>
            <button 
              onClick={toggleFavorite}
              className="w-10 h-10 flex items-center justify-center text-border-ink hover:bg-bg-muted transition-colors border border-border-ink"
            >
              <Heart className={`w-5 h-5 ${favoriteDocId ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>
          <p className="text-3xl font-extrabold text-text-primary mt-2">${listing.price}</p>
          <div className="flex items-center space-x-4 mt-4 text-sm text-text-secondary font-medium">
            <span>{listing.condition}</span>
            <span>•</span>
            <span>{listing.category}</span>
            <span>•</span>
            <span>{listing.createdAt ? formatDistanceToNow(listing.createdAt.toDate()) + ' ago' : 'Just now'}</span>
          </div>
        </div>

        <div className="prose prose-sm text-text-primary mb-8 leading-relaxed">
          <p className="whitespace-pre-wrap">{listing.description}</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center text-sm text-text-primary font-medium">
            <MapPin className="w-4 h-4 mr-2 text-border-ink" />
            Meetup: {listing.meetupLocations?.join(', ') || 'Not specified'}
          </div>
          <div className="flex items-center text-sm text-text-primary font-medium">
            <DollarSign className="w-4 h-4 mr-2 text-border-ink" />
            Accepts: {listing.paymentMethods?.join(', ') || 'Not specified'}
          </div>
        </div>

        {/* Seller Info */}
        <Link to={`/user/${listing.sellerId}`} className="block border border-border-ink p-4 mb-8 flex items-center justify-between bg-white hover:bg-bg-muted transition-colors">
          <div className="flex items-center">
            {seller?.photoURL ? (
              <img src={seller.photoURL} alt={seller.name} className="w-12 h-12 object-cover border border-border-ink" />
            ) : (
              <div className="w-12 h-12 bg-tulane-green text-white flex items-center justify-center font-bold text-lg border border-border-ink">
                {seller?.name ? seller.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="ml-4">
              <p className="text-sm font-bold text-text-primary">{seller?.name || 'Unknown Seller'}</p>
              <div className="inline-flex items-center text-[9px] font-bold text-tulane-green uppercase bg-[#E8F5E9] px-1.5 py-0.5 border border-tulane-green mt-1">
                Verified Student
              </div>
            </div>
          </div>
          <div className="text-text-secondary text-sm font-bold flex items-center gap-1 group">
            View Profile <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Actions */}
        {!isOwner && (
          <div className="space-y-3 mt-auto">
            {showOfferForm ? (
              <form onSubmit={handleMakeOffer} className="flex space-x-2">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-text-secondary sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="block w-full pl-7 pr-12 py-3 border border-border-ink focus:outline-none focus:ring-1 focus:ring-border-ink sm:text-sm"
                    placeholder="0.00"
                  />
                </div>
                <button type="submit" className="bg-border-ink text-white px-6 py-3 text-[13px] font-semibold uppercase tracking-wider hover:bg-black transition-colors">
                  Send Offer
                </button>
                <button type="button" onClick={() => setShowOfferForm(false)} className="bg-bg-muted border border-border-ink text-border-ink px-4 py-3 text-[13px] font-semibold uppercase tracking-wider hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </form>
            ) : (
              <button 
                onClick={() => setShowOfferForm(true)}
                className="w-full bg-border-ink text-white py-3 text-[13px] font-semibold uppercase tracking-wider hover:bg-black transition-colors flex items-center justify-center"
              >
                Make Offer
              </button>
            )}
            
            <button 
              onClick={handleMessageSeller}
              className="w-full bg-white border border-border-ink text-border-ink py-3 text-[13px] font-semibold uppercase tracking-wider hover:bg-bg-muted transition-colors flex items-center justify-center"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Message Seller
            </button>
          </div>
        )}

        {isOwner && (
          <div className="mt-auto bg-bg-muted border border-border-ink p-6 text-center shadow-sm">
            <p className="text-sm text-text-primary font-bold mb-4 uppercase tracking-wider">Seller Options</p>
            <div className="space-y-3">
              {listing.status !== 'sold' && (
                <button 
                  onClick={handleMarkAsSold}
                  className="w-full flex items-center justify-center bg-tulane-green text-white py-3 text-[13px] font-semibold uppercase tracking-wider hover:bg-green-800 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Sold
                </button>
              )}
              <Link 
                to={`/edit/${listing.id}`}
                className="w-full flex items-center justify-center bg-white border border-border-ink text-text-primary py-3 text-[13px] font-semibold uppercase tracking-wider hover:bg-bg-muted transition-colors"
              >
                Edit Listing
              </Link>
              <button 
                onClick={handleDeleteListing}
                className="w-full flex items-center justify-center bg-white border border-red-200 text-red-600 py-3 text-[13px] font-semibold uppercase tracking-wider hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Listing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
