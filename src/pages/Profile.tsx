import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Loader2 } from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

type Listing = {
  id: string;
  title?: string;
  price?: number;
  images?: string[];
  status?: string;
  sellerId?: string;
};

export const Profile: React.FC = () => {
  const { user, dbUser, setDbUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [userListings, setUserListings] = useState<Listing[]>([]);

  if (!user || !dbUser) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const reader = new FileReader();

      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;

          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { photoURL: base64String });

          if (setDbUser) {
            setDbUser({ ...dbUser, photoURL: base64String });
          }
        } catch (error) {
          console.error('Error uploading photo:', error);
          alert('Failed to upload photo. Please try again.');
        } finally {
          setIsUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setIsUploading(false);
      alert('Failed to upload photo. Please try again.');
    }
  };

  useEffect(() => {
    const fetchUserListings = async () => {
      if (!user) return;

      setIsLoadingListings(true);

      try {
        const listingsQuery = query(
          collection(db, 'listings'),
          where('sellerId', '==', user.uid)
        );

        const snapshot = await getDocs(listingsQuery);

        const listings: Listing[] = snapshot.docs.map((listingDoc) => ({
          id: listingDoc.id,
          ...(listingDoc.data() as Omit<Listing, 'id'>),
        }));

        setUserListings(listings);
      } catch (error) {
        console.error('Error fetching user listings:', error);
      } finally {
        setIsLoadingListings(false);
      }
    };

    fetchUserListings();
  }, [user]);

  const activeListings = userListings.filter(
    (listing) => listing.status !== 'sold'
  );

  const soldListings = userListings.filter(
    (listing) => listing.status === 'sold'
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white border border-border-ink p-8">
        <div className="flex items-start space-x-6">
          <div
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {dbUser.photoURL ? (
              <img
                src={dbUser.photoURL}
                alt={dbUser.name}
                className="w-24 h-24 object-cover border border-border-ink"
              />
            ) : (
              <div className="w-24 h-24 bg-tulane-green text-white flex items-center justify-center font-bold text-3xl border border-border-ink">
                {dbUser.name ? dbUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}

            <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-white mb-1" />
                  <span className="text-[10px] text-white font-bold uppercase tracking-wider">
                    Change photo
                  </span>
                </>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">
              {dbUser.name}
            </h1>

            <div className="flex items-center mt-2 space-x-2">
              <span className="inline-flex items-center text-[9px] font-bold text-tulane-green uppercase bg-[#E8F5E9] px-1.5 py-0.5 border border-tulane-green">
                Verified Tulane Student
              </span>
            </div>

            <p className="text-sm text-text-secondary mt-2">{dbUser.email}</p>

            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border-ink pt-6">
              <div className="border border-border-ink p-4 text-center">
                <p className="text-2xl font-extrabold text-text-primary">
                  {isLoadingListings ? '...' : activeListings.length}
                </p>
                <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold mt-1">
                  Active Listings
                </p>
              </div>

              <div className="border border-border-ink p-4 text-center">
                <p className="text-2xl font-extrabold text-text-primary">
                  {isLoadingListings ? '...' : soldListings.length}
                </p>
                <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold mt-1">
                  Sold Items
                </p>
              </div>

              <div className="border border-border-ink p-4 text-center">
                <p className="text-2xl font-extrabold text-text-primary">
                  {dbUser.rating || 'New'}
                </p>
                <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold mt-1">
                  Rating
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-border-ink p-8">
        <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider text-sm mb-6">
          Your Listings
        </h2>

        {isLoadingListings ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-border-ink" />
            <p className="text-sm text-text-secondary">Loading listings...</p>
          </div>
        ) : userListings.length === 0 ? (
          <p className="text-sm text-text-secondary">
            You haven&apos;t posted any listings yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {userListings.map((listing) => (
              <div
                key={listing.id}
                className="border border-border-ink bg-white overflow-hidden"
              >
                <div className="aspect-square bg-bg-page border-b border-border-ink">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title || 'Listing image'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-secondary text-sm">
                      No image
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <p className="text-xl font-extrabold text-text-primary">
                    {typeof listing.price === 'number'
                      ? `$${listing.price}`
                      : '$0'}
                  </p>

                  <p className="text-sm font-semibold text-text-primary truncate">
                    {listing.title || 'Untitled Listing'}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center text-[9px] font-bold text-tulane-green uppercase bg-[#E8F5E9] px-1.5 py-0.5 border border-tulane-green">
                      Verified Student
                    </span>

                    <span className="inline-flex items-center text-[9px] font-bold text-text-secondary uppercase bg-bg-muted px-1.5 py-0.5 border border-border-ink">
                      {listing.status === 'sold' ? 'Sold' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
