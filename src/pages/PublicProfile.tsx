import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Star, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const PublicProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [targetUser, setTargetUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [commentInput, setCommentInput] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        // Fetch user data
        const userRef = doc(db, 'users', id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setTargetUser({ id: userSnap.id, ...userSnap.data() });
        } else {
          setTargetUser(null);
          setLoading(false);
          return;
        }

        // Fetch their listings
        const qListings = query(
          collection(db, 'listings'),
          where('sellerId', '==', id),
          orderBy('createdAt', 'desc')
        );
        const listingsSnap = await getDocs(qListings);
        setListings(listingsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        // Listen to their reviews
        const qReviews = query(
          collection(db, 'reviews'),
          where('targetUserId', '==', id),
          orderBy('createdAt', 'desc')
        );
        
        const unsubscribe = onSnapshot(qReviews, async (snapshot) => {
          const fetchedReviews = [];
          for (const d of snapshot.docs) {
            const revData = d.data();
            // Fetch reviewer info
            const reviewerRef = doc(db, 'users', revData.reviewerId);
            const reviewerSnap = await getDoc(reviewerRef);
            let reviewerName = 'Anonymous';
            let reviewerPhoto = '';
            if (reviewerSnap.exists()) {
              reviewerName = reviewerSnap.data().name;
              reviewerPhoto = reviewerSnap.data().photoURL;
            }
            
            fetchedReviews.push({ 
              id: d.id, 
              ...revData,
              reviewerName,
              reviewerPhoto
            });
          }
          setReviews(fetchedReviews);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching reviews", error);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching profile", error);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !targetUser) return;
    
    setSubmittingReview(true);
    try {
      const { doc: firestoreDoc, collection: firestoreCollection, updateDoc, writeBatch } = await import('firebase/firestore');
      
      const newReviewRef = firestoreDoc(firestoreCollection(db, 'reviews'));
      const userRef = firestoreDoc(db, 'users', targetUser.id);
      
      const currentRating = targetUser.rating || 0;
      const currentReviewCount = targetUser.reviewCount || 0;
      
      const newCount = currentReviewCount + 1;
      const newRating = ((currentRating * currentReviewCount) + ratingInput) / newCount;

      const batch = writeBatch(db);
      
      batch.set(newReviewRef, {
        reviewerId: user.uid,
        targetUserId: targetUser.id,
        rating: ratingInput,
        comment: commentInput.trim(),
        createdAt: serverTimestamp()
      });

      batch.update(userRef, {
        rating: newRating,
        reviewCount: newCount
      });

      await batch.commit();

      setShowReviewForm(false);
      setCommentInput('');
      setRatingInput(5);
      
      // Speculatively update local UI
      setTargetUser({
        ...targetUser,
        rating: newRating,
        reviewCount: newCount
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading Profile...</div>;
  if (!targetUser) return <div className="text-center py-12">User not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-white border border-border-ink p-8 flex flex-col md:flex-row items-center md:items-start md:space-x-8 rounded-2xl shadow-sm">
        <div className="h-32 w-32 border border-border-ink flex items-center justify-center bg-bg-muted flex-shrink-0 mb-6 md:mb-0 rounded-full overflow-hidden">
          {targetUser.photoURL ? (
            <img src={targetUser.photoURL} alt={targetUser.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl text-border-ink/50 font-serif italic">{targetUser.name?.charAt(0) || 'U'}</span>
          )}
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-serif italic text-text-primary mb-2 flex flex-col sm:flex-row items-center sm:items-baseline gap-2">
            <span>{targetUser.name}</span>
            <span className="inline-flex items-center text-[10px] font-bold text-tulane-green uppercase bg-[#E8F5E9] px-2 py-1 border border-tulane-green font-sans not-italic rounded-md">
              Verified Student
            </span>
          </h1>
          
          <div className="flex items-center justify-center md:justify-start space-x-2 text-text-secondary mb-4">
            <div className="flex items-center text-yellow-500">
              <Star className="w-5 h-5 fill-current" />
              <span className="ml-1 font-bold text-text-primary">{targetUser.rating ? targetUser.rating.toFixed(1) : 'No Rating'}</span>
            </div>
            <span>•</span>
            <span>{targetUser.reviewCount || 0} Reviews</span>
            <span>•</span>
            <span>Joined {targetUser.createdAt ? formatDistanceToNow(targetUser.createdAt.toDate()) + ' ago' : 'Recently'}</span>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed bg-bg-muted p-4 border border-border-ink rounded-xl">
            {targetUser.bio || "No bio provided."}
          </p>
        </div>
      </div>

      {/* Review Section */}
      <div className="bg-white border border-border-ink p-8 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-6 border-b border-border-ink pb-4">
          <h2 className="text-2xl font-serif italic text-text-primary">Reviews</h2>
          {user && user.uid !== targetUser.id && (
            <button 
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="px-4 py-2 bg-text-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors rounded-xl"
            >
              {showReviewForm ? 'Cancel' : 'Leave a Review'}
            </button>
          )}
        </div>

        {showReviewForm && (
          <form onSubmit={handleSubmitReview} className="mb-8 bg-bg-muted p-6 border border-border-ink rounded-xl">
            <h3 className="font-bold uppercase tracking-wider text-sm mb-4">Rate this user</h3>
            
            <div className="flex items-center mb-4 space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRatingInput(star)}
                >
                  <Star className={`w-8 h-8 ${star <= ratingInput ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>

            <textarea
              required
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Share your experience buying or selling with this user..."
              className="w-full border border-border-ink focus:outline-none focus:ring-1 focus:ring-border-ink p-3 text-sm h-24 resize-none mb-4 rounded-xl"
            />
            
            <button
              type="submit"
              disabled={submittingReview || !commentInput.trim()}
              className="bg-border-ink text-white px-6 py-2 text-sm font-bold uppercase tracking-wider hover:bg-black disabled:opacity-50 transition-colors rounded-xl"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="text-center text-text-secondary py-8">No reviews yet.</p>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-border-ink pb-6 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-bg-muted flex items-center justify-center border border-border-ink mr-3 overflow-hidden rounded-full">
                       {review.reviewerPhoto ? (
                          <img src={review.reviewerPhoto} alt="reviewer" className="h-full w-full object-cover"/>
                       ) : (
                          <span className="text-xs font-serif italic text-text-secondary">{review.reviewerName.charAt(0)}</span>
                       )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-text-primary">{review.reviewerName}</div>
                      <div className="flex items-center text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-text-secondary">
                    {review.createdAt ? formatDistanceToNow(review.createdAt.toDate()) + ' ago' : 'Recently'}
                  </div>
                </div>
                <p className="text-sm text-text-primary mt-3 pl-11">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Listings Grid */}
      <div>
        <h2 className="text-2xl font-serif italic text-text-primary mb-6">{targetUser.name}'s Listings</h2>
        {listings.length === 0 ? (
          <div className="text-center py-12 text-text-secondary border border-border-ink bg-white rounded-2xl">
            This user has no active listings.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {listings.map((listing) => (
              <Link key={listing.id} to={`/listing/${listing.id}`} className="group flex flex-col border border-border-ink bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="relative aspect-square w-full bg-[#EEE] overflow-hidden border-b border-border-ink flex items-center justify-center">
                  {listing.images && listing.images.length > 0 ? (
                    <img 
                      src={listing.images[0]} 
                      alt={listing.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 rounded-none"
                    />
                  ) : (
                    <span className="text-xs text-[#999]">No image</span>
                  )}
                  {listing.status === 'sold' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold tracking-wider uppercase text-xs">Sold</span>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white">
                  <div className="font-extrabold text-lg text-text-primary mb-1 leading-none">${listing.price}</div>
                  <h3 className="text-sm text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
                    {listing.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
