import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, ArrowRight, Check, X } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const Offers: React.FC = () => {
  const { user } = useAuth();
  const [offersMade, setOffersMade] = useState<any[]>([]);
  const [offersReceived, setOffersReceived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch offers made by the user
    const qMade = query(
      collection(db, 'offers'),
      where('buyerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeMade = onSnapshot(qMade, async (snapshot) => {
      const fetched = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        let listingData = null;
        try {
           const listingSnap = await getDoc(doc(db, 'listings', data.listingId));
           if (listingSnap.exists()) listingData = listingSnap.data();
        } catch(e) {}
        
        fetched.push({ id: d.id, ...data, listing: listingData });
      }
      setOffersMade(fetched);
      if (snapshot.empty) setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    // Fetch offers received by the user (as seller)
    const qReceived = query(
      collection(db, 'offers'),
      where('sellerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeReceived = onSnapshot(qReceived, async (snapshot) => {
      const fetched = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        let listingData = null;
        let buyerData = null;
        try {
           const listingSnap = await getDoc(doc(db, 'listings', data.listingId));
           if (listingSnap.exists()) listingData = listingSnap.data();
           
           const buyerSnap = await getDoc(doc(db, 'users', data.buyerId));
           if (buyerSnap.exists()) buyerData = buyerSnap.data();
        } catch(e) {}
        
        fetched.push({ id: d.id, ...data, listing: listingData, buyer: buyerData });
      }
      setOffersReceived(fetched);
      setLoading(false); // Can trigger early if empty, but good enough for UI
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => {
      unsubscribeMade();
      unsubscribeReceived();
    };
  }, [user]);

  const handleUpdateStatus = async (offerId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'offers', offerId), {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'offers');
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-8 px-4 sm:px-0">Offers Dashboard</h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 sm:px-0">
          
          {/* Offers Received (Seller View) */}
          <div className="bg-white rounded-2xl shadow-sm border border-border-ink p-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-accent-blue"></div>
            <h2 className="text-xl font-bold text-text-primary mb-6">Offers Received</h2>
            
            {offersReceived.length === 0 ? (
              <p className="text-text-secondary text-sm">You haven't received any offers yet.</p>
            ) : (
              <div className="space-y-4">
                {offersReceived.map((offer) => (
                  <div key={offer.id} className={`border border-border-ink rounded-xl p-4 transition-colors ${offer.status === 'pending' ? 'bg-light-blue/20 border-accent-blue/40' : 'bg-bg-muted'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Link to={`/listing/${offer.listingId}`} className="font-semibold text-text-primary hover:text-accent-blue transition-colors">
                          {offer.listing?.title || 'Unknown Listing'}
                        </Link>
                        <p className="text-sm text-text-secondary">
                          From: {offer.buyer?.name || 'Unknown Buyer'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xl text-tulane-green">${offer.amount}</div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                          offer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          offer.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {offer.status}
                        </span>
                      </div>
                    </div>
                    
                    {offer.status === 'pending' && (
                      <div className="flex gap-2 mt-4 pt-4 border-t border-border-ink">
                        <button
                          onClick={() => handleUpdateStatus(offer.id, 'accepted')}
                          className="flex-1 bg-tulane-green text-white py-2 rounded-xl text-sm font-semibold flex items-center justify-center hover:bg-[#004f36] transition-colors"
                        >
                          <Check className="w-4 h-4 mr-1" /> Accept
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(offer.id, 'rejected')}
                          className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded-xl text-sm font-semibold flex items-center justify-center hover:bg-red-100 transition-colors"
                        >
                          <X className="w-4 h-4 mr-1" /> Decline
                        </button>
                      </div>
                    )}
                    
                    <div className="text-xs text-text-secondary mt-3">
                      {offer.createdAt ? formatDistanceToNow(offer.createdAt.toDate()) + ' ago' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Offers Made (Buyer View) */}
          <div className="bg-white rounded-2xl shadow-sm border border-border-ink p-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-light-blue"></div>
            <h2 className="text-xl font-bold text-text-primary mb-6">Offers You Made</h2>
            
            {offersMade.length === 0 ? (
              <p className="text-text-secondary text-sm">You haven't made any offers yet.</p>
            ) : (
              <div className="space-y-4">
                {offersMade.map((offer) => (
                  <div key={offer.id} className="border border-border-ink rounded-xl p-4 bg-white relative">
                    <div className="flex justify-between items-start mb-2">
                       <Link to={`/listing/${offer.listingId}`} className="font-semibold text-text-primary hover:text-accent-blue transition-colors flex items-center">
                          {offer.listing?.title || 'Unknown Listing'}
                          <ArrowRight className="w-4 h-4 ml-1 opacity-50" />
                       </Link>
                       <div className="font-bold text-xl">${offer.amount}</div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4">
                       <div className="text-xs text-text-secondary">
                        {offer.createdAt ? formatDistanceToNow(offer.createdAt.toDate()) + ' ago' : ''}
                      </div>
                       <span className={`text-xs uppercase font-bold px-2 py-1 rounded-full ${
                          offer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          offer.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {offer.status}
                        </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
