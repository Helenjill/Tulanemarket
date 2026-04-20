import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { ShieldCheck, ShoppingBag, Loader2, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!email.trim().toLowerCase().endsWith('@tulane.edu')) {
      setError('You must use a valid @tulane.edu email address.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (!isLogin && !name.trim()) {
      setError('Please provide a name or handle.');
      setLoading(false);
      return;
    }

    try {
      const authEmail = email.trim().toLowerCase();
      if (isLogin) {
        await signInWithEmailAndPassword(auth, authEmail, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
        
        // Custom creation override (AuthContext usually does this, but we explicitly set it here)
        const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
        const db = (await import('../lib/firebase')).db;
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: name.trim(),
          bio: bio.trim(),
          photoURL: photoBase64,
          createdAt: serverTimestamp(),
          rating: 0,
          reviewCount: 0
        });
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Are you sure you have an account?');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try logging in.');
      } else {
        setError(err.message || 'Failed to authenticate.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-serif italic text-text-primary tracking-tight">Tulane Market</h1>
            <p className="mt-3 text-lg text-text-secondary">
              Buy, sell, and trade with verified students on campus.
            </p>
          </div>

          <div className="bg-bg-muted border border-border-ink p-8">
            <div className="space-y-6 mb-8 border-b border-border-ink pb-8">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <ShieldCheck className="h-6 w-6 text-tulane-green" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Verified Students Only</h3>
                  <p className="text-sm text-text-secondary mt-1">Join the exclusive campus marketplace using your Tulane email.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <ShoppingBag className="h-6 w-6 text-tulane-green" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Campus Marketplace</h3>
                  <p className="text-sm text-text-secondary mt-1">Find textbooks, furniture, and dorm essentials.</p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                        Display Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        placeholder="e.g. Green Wave 23"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full border border-border-ink px-4 py-3 bg-white focus:outline-none focus:ring-1 focus:ring-border-ink"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="bio" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                        Bio (Optional)
                      </label>
                      <textarea
                        id="bio"
                        placeholder="What are you studying? What are you selling mostly?"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full border border-border-ink px-4 py-3 bg-white focus:outline-none focus:ring-1 focus:ring-border-ink h-20 resize-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                        Profile Picture (Optional)
                      </label>
                      <div className="flex items-center space-x-4">
                        <div className="h-16 w-16 bg-white border border-border-ink flex items-center justify-center overflow-hidden">
                          {photoBase64 ? (
                            <img src={photoBase64} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs text-text-secondary">None</span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-border-ink file:text-white file:font-bold hover:file:bg-black file:uppercase file:text-[10px] file:tracking-wider file:cursor-pointer transition-colors"
                        />
                      </div>
                    </div>
                    <div className="border-b border-border-ink my-4"></div>
                  </>
                )}

                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                    Tulane Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="username@tulane.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-border-ink px-4 py-3 bg-white focus:outline-none focus:ring-1 focus:ring-border-ink"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-border-ink px-4 py-3 bg-white focus:outline-none focus:ring-1 focus:ring-border-ink"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full flex items-center justify-center py-3 px-4 border border-border-ink text-[13px] font-semibold uppercase tracking-wider text-white bg-border-ink hover:bg-black focus:outline-none disabled:opacity-50 transition-colors mt-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      {isLogin ? 'Log In' : 'Create Account'} <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                  className="text-xs font-bold text-text-secondary uppercase underline hover:text-text-primary"
                >
                  {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
