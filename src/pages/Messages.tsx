import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';

export const Messages: React.FC = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!user) return;

    // Fetch chats where user is buyer OR seller
    const qBuyer = query(collection(db, 'chats'), where('buyerId', '==', user.uid));
    const qSeller = query(collection(db, 'chats'), where('sellerId', '==', user.uid));

    const unsubscribeBuyer = onSnapshot(qBuyer, (snapshot) => {
      const buyerChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(prev => {
        const others = prev.filter(c => c.buyerId !== user.uid);
        return [...others, ...buyerChats].sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis());
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'chats'));

    const unsubscribeSeller = onSnapshot(qSeller, (snapshot) => {
      const sellerChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(prev => {
        const others = prev.filter(c => c.sellerId !== user.uid);
        return [...others, ...sellerChats].sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis());
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'chats'));

    return () => {
      unsubscribeBuyer();
      unsubscribeSeller();
    };
  }, [user]);

  useEffect(() => {
    if (!activeChat) return;

    const q = query(
      collection(db, `chats/${activeChat.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, `chats/${activeChat.id}/messages`));

    return () => unsubscribe();
  }, [activeChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChat || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        senderId: user.uid,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });

      // Figure out who the other person is
      const receiverId = activeChat.buyerId === user.uid ? activeChat.sellerId : activeChat.buyerId;

      // Send notification to the other person
      await addDoc(collection(db, 'notifications'), {
        userId: receiverId,
        title: 'New Message',
        message: newMessage.trim().length > 30 ? `${newMessage.trim().substring(0, 30)}...` : newMessage.trim(),
        link: `/messages/${activeChat.id}`,
        read: false,
        createdAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${activeChat.id}/messages`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto bg-white border border-border-ink h-[600px] flex">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-border-ink flex flex-col bg-bg-muted">
        <div className="p-4 border-b border-border-ink bg-white">
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-sm">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4 text-sm text-text-secondary text-center">No messages yet.</div>
          ) : (
            chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full text-left p-4 border-b border-border-ink hover:bg-white transition-colors ${activeChat?.id === chat.id ? 'bg-white border-l-4 border-l-tulane-green' : ''}`}
              >
                <p className="text-sm font-bold text-text-primary truncate">
                  Chat about Listing
                </p>
                <p className="text-xs text-text-secondary mt-1 truncate">
                  {chat.lastMessage || 'Start the conversation'}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-2/3 flex flex-col bg-bg-page">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-border-ink bg-white">
              <h3 className="font-bold text-text-primary uppercase tracking-wider text-sm">Conversation</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2 text-sm border border-border-ink ${isMe ? 'bg-border-ink text-white' : 'bg-bg-muted text-text-primary'}`}>
                      <p>{msg.text}</p>
                      {msg.createdAt && (
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-gray-400' : 'text-text-secondary'}`}>
                          {formatDistanceToNow(msg.createdAt.toDate())} ago
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-border-ink bg-white">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 border border-border-ink px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-ink bg-bg-page"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-border-ink text-white px-4 py-2 hover:bg-black disabled:opacity-50 transition-colors border border-border-ink"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary text-sm font-medium">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
};
