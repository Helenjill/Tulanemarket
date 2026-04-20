import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { logout, db } from '../lib/firebase';
import { Search, PlusSquare, MessageSquare, Heart, User as UserIcon, Bell } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/?q=${encodeURIComponent(searchInput.trim())}`);
    } else {
      navigate('/');
    }
  };

  const markAsRead = async (id: string, link: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setShowNotifications(false);
      navigate(link);
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <nav className="bg-tulane-green border-b border-border-ink sticky top-0 z-50 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-[70px]">
          <div className="flex items-center flex-1">
            <Link to="/" onClick={() => setSearchInput('')} className="flex-shrink-0 flex items-center">
              <span className="font-extrabold text-[22px] tracking-tight uppercase">Tulane Market</span>
            </Link>
            
            {/* Search Bar (Desktop) */}
            <div className="hidden sm:ml-10 sm:flex sm:items-center flex-1 max-w-[400px]">
              <form onSubmit={handleSearch} className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-white/70" />
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="block w-full pl-10 pr-3 py-[10px] border border-white/30 bg-white/10 text-sm text-white placeholder-white/70 focus:outline-none focus:border-white focus:bg-white/20 transition-colors"
                  placeholder="Search textbooks, furniture, dorm gear..."
                />
              </form>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="hidden lg:block text-sm font-semibold mr-4">Verified Marketplace for Students</div>
            {user ? (
              <>
                <Link to="/create" className="text-white/90 hover:text-white flex items-center gap-1 text-sm font-medium">
                  <PlusSquare className="h-5 w-5" />
                  <span className="hidden sm:inline">Sell</span>
                </Link>
                <Link to="/messages" className="text-white/90 hover:text-white relative">
                  <MessageSquare className="h-5 w-5" />
                </Link>
                <Link to="/favorites" className="text-white/90 hover:text-white">
                  <Heart className="h-5 w-5" />
                </Link>
                
                {/* Notifications */}
                <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="flex items-center text-white/90 hover:text-white relative"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[16px] text-center rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  
                  {showNotifications && (
                    <div className="absolute right-0 w-80 mt-2 bg-white border border-border-ink shadow-lg text-text-primary z-50">
                      <div className="p-3 border-b border-border-ink flex justify-between items-center bg-bg-muted">
                        <h3 className="font-bold text-sm uppercase tracking-wider">Notifications</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-sm text-text-secondary text-center">No notifications yet</div>
                        ) : (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id} 
                              onClick={() => markAsRead(notif.id, notif.link)}
                              className={`p-3 border-b border-border-ink cursor-pointer hover:bg-bg-page transition-colors ${!notif.read ? 'bg-blue-50' : 'bg-white'}`}
                            >
                              <div className="text-sm font-bold">{notif.title}</div>
                              <div className="text-xs text-text-secondary mt-1">{notif.message}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile */}
                <div className="relative group pb-2">
                  <button className="flex items-center text-white/90 hover:text-white mt-1">
                    <UserIcon className="h-5 w-5" />
                  </button>
                  <div className="absolute top-full right-0 w-48 hidden group-hover:block z-50">
                    <div className="bg-white border-0 shadow-lg rounded-xl overflow-hidden text-text-primary mt-1">
                      <Link to="/profile" className="block px-4 py-3 text-sm hover:bg-light-blue/30 font-medium transition-colors">Profile</Link>
                      <Link to="/offers" className="block px-4 py-3 text-sm hover:bg-light-blue/30 font-medium transition-colors border-t border-border-ink">My Offers</Link>
                      <button onClick={handleLogout} className="block w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600 font-medium border-t border-border-ink transition-colors">Logout</button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Link to="/login" className="bg-border-ink text-white px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:bg-black transition-colors border border-border-ink">
                Log In
              </Link>
            )}
          </div>
        </div>
        
        {/* Search Bar (Mobile) */}
        {!location.pathname.includes('/messages') && (
          <div className="sm:hidden pb-3">
            <form onSubmit={handleSearch} className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-white/70" />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-[10px] border border-white/30 bg-white/10 text-sm text-white placeholder-white/70 focus:outline-none focus:border-white focus:bg-white/20 transition-colors"
                placeholder="Search items..."
              />
            </form>
          </div>
        )}
      </div>
    </nav>
  );
};
