import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User as UserIcon, Upload, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const Profile: React.FC = () => {
  const { user, dbUser, setDbUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!user || !dbUser) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Update Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { photoURL: base64String });
        
        // Update local context
        if (setDbUser) {
          setDbUser({ ...dbUser, photoURL: base64String });
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading photo:", error);
      setIsUploading(false);
      alert("Failed to upload photo. Please try again.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white border border-border-ink p-8 flex items-start space-x-6">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {dbUser.photoURL ? (
            <img src={dbUser.photoURL} alt={dbUser.name} className="w-24 h-24 object-cover border border-border-ink" />
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
                <span className="text-[10px] text-white font-bold uppercase tracking-wider">Change photo</span>
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
          <h1 className="text-2xl font-bold text-text-primary">{dbUser.name}</h1>
          <div className="flex items-center mt-2 space-x-2">
            <span className="inline-flex items-center text-[9px] font-bold text-tulane-green uppercase bg-[#E8F5E9] px-1.5 py-0.5 border border-tulane-green">
              Verified Tulane Student
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-2">{dbUser.email}</p>
          
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border-ink pt-6">
            <div className="border border-border-ink p-4 text-center">
              <p className="text-2xl font-extrabold text-text-primary">0</p>
              <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold mt-1">Active Listings</p>
            </div>
            <div className="border border-border-ink p-4 text-center">
              <p className="text-2xl font-extrabold text-text-primary">0</p>
              <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold mt-1">Sold Items</p>
            </div>
            <div className="border border-border-ink p-4 text-center">
              <p className="text-2xl font-extrabold text-text-primary">{dbUser.rating || 'New'}</p>
              <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold mt-1">Rating</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
