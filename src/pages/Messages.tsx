import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { formatDistanceToNow } from 'date-fns';
import { Send, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export const Messages: React.FC = () => {
  const { user, dbUser } = useAuth();
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();

  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const qBuyer = query(collection(db, 'chats'), where('buyerId', '==', user.uid));
    const qSeller = query(collection(db, 'chats'), where('sellerId', '==', user.uid));

    let buyerChats: any[] = [];
    let sellerChats: any[] = [];

    const enrichChats = async (rawChats: any[]) => {
      const enriched = await Promise.all(
        rawChats.map(async (chat) => {
          const isBuyer = chat.buyerId === user.uid;
          const otherUserId = isBuyer ? chat.sellerId : chat.buyerId;

          let otherName =
            isBuyer
              ? chat.sellerName
              : chat.buyerName;

          let otherPhoto =
            isBuyer
              ? chat.sellerPhoto
              : chat.buyerPhoto;

          if (!otherName || !otherPhoto) {
            try {
              const otherUserSnap = await getDoc(doc(db, 'users', otherUserId));
              if (otherUserSnap.exists()) {
                const otherUserData = otherUserSnap.data();
                otherName =
                  otherName ||
                  otherUserData.name ||
                  otherUserData.displayName ||
                  otherUserData.email?.split('@')[0] ||
                  'Tulane Student';
                otherPhoto = otherPhoto || otherUserData.photoURL || '';
              }
            } catch (error) {
              console.error('Error loading chat user info:', error);
            }
          }

          return {
            ...chat,
            otherUserId,
            otherName: otherName || 'Tulane Student',
            otherPhoto: otherPhoto || '',
          };
        })
      );

      return enriched;
    };

    const mergeChats = async () => {
      const chatMap = new Map<string, any>();

      [...buyerChats, ...sellerChats].forEach((chat) => {
        chatMap.set(chat.id, chat);
      });

      const merged = Array.from(chatMap.values()).sort((a, b) => {
        const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return bTime - aTime;
      });

      const enriched = await enrichChats(merged);
      setChats(enriched);
      setLoadingChats(false);
    };

    const unsubscribeBuyer = onSnapshot(
      qBuyer,
      (snapshot) => {
        buyerChats = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        mergeChats();
      },
      (error) => {
        setLoadingChats(false);
        handleFirestoreError(error, OperationType.GET, 'chats');
      }
    );

    const unsubscribeSeller = onSnapshot(
      qSeller,
      (snapshot) => {
        sellerChats = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        mergeChats();
      },
      (error) => {
        setLoadingChats(false);
        handleFirestoreError(error, OperationType.GET, 'chats');
      }
    );

    return () => {
      unsubscribeBuyer();
      unsubscribeSeller();
    };
  }, [user]);

  useEffect(() => {
    if (!chatId || chats.length === 0) return;

    const matchingChat = chats.find((chat) => chat.id === chatId);
    if (matchingChat) {
      setActiveChat(matchingChat);
    }
  }, [chatId, chats]);

  useEffect(() => {
    if (!activeChat && chats.length > 0 && !chatId) {
      setActiveChat(chats[0]);
    }
  }, [chats, activeChat, chatId]);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `chats/${activeChat.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, `chats/${activeChat.id}/messages`)
    );

    return () => unsubscribe();
  }, [activeChat]);

  const handleSelectChat = (chat: any) => {
    setActiveChat(chat);
    navigate(`/messages/${chat.id}`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChat || !newMessage.trim()) return;

    const trimmedMessage = newMessage.trim();

    try {
      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        senderId: user.uid,
        text: trimmedMessage,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: trimmedMessage,
        updatedAt: serverTimestamp(),
        buyerName: activeChat.buyerName || dbUser?.name || '',
        sellerName: activeChat.sellerName || '',
        buyerPhoto: activeChat.buyerPhoto || dbUser?.photoURL || '',
        sellerPhoto: activeChat.sellerPhoto || '',
      });

      const receiverId =
        activeChat.buyerId === user.uid ? activeChat.sellerId : activeChat.buyerId;

      await addDoc(collection(db, 'notifications'), {
        userId: receiverId,
        title: 'New Message',
        message:
          trimmedMessage.length > 30
            ? `${trimmedMessage.substring(0, 30)}...`
            : trimmedMessage,
        link: `/messages/${activeChat.id}`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${activeChat.id}/messages`);
    }
  };

  const handleDeleteChat = async (targetChatId: string) => {
    const confirmed = window.confirm(
      'Delete this conversation? This cannot be undone.'
    );
    if (!confirmed) return;

    setDeletingChatId(targetChatId);

    try {
      const messagesRef = collection(db, `chats/${targetChatId}/messages`);
      const messagesSnapshot = await getDocs(messagesRef);

      await Promise.all(
        messagesSnapshot.docs.map((messageDoc) =>
          deleteDoc(doc(db, `chats/${targetChatId}/messages`, messageDoc.id))
        )
      );

      await deleteDoc(doc(db, 'chats', targetChatId));

      if (activeChat?.id === targetChatId) {
        setActiveChat(null);
        setMessages([]);
        navigate('/messages');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${targetChatId}`);
    } finally {
      setDeletingChatId(null);
    }
  };

  const activeChatDisplayName = activeChat?.otherName || 'Tulane Student';
  const activeChatPhoto = activeChat?.otherPhoto || '';
  const activeChatListingTitle = activeChat?.listingTitle || 'Listing';

  return (
    <div className="max-w-5xl mx-auto bg-white border border-border-ink h-[600px] flex">
      <div className="w-1/3 border-r border-border-ink flex flex-col bg-bg-muted">
        <div className="p-4 border-b border-border-ink bg-white">
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-sm">
            Messages
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="p-4 text-sm text-text-secondary text-center">
              Loading messages...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-sm text-text-secondary text-center">
              No messages yet.
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`border-b border-border-ink ${
                  activeChat?.id === chat.id ? 'bg-white border-l-4 border-l-tulane-green' : ''
                }`}
              >
                <div className="flex items-center">
                  <button
                    onClick={() => handleSelectChat(chat)}
                    className="flex-1 text-left p-4 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {chat.otherPhoto ? (
                        <img
                          src={chat.otherPhoto}
                          alt={chat.otherName}
                          className="w-10 h-10 object-cover border border-border-ink rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-tulane-green text-white flex items-center justify-center font-bold border border-border-ink rounded-full flex-shrink-0">
                          {(chat.otherName || 'T').charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {chat.otherName || 'Tulane Student'}
                        </p>
                        <p className="text-[11px] text-text-secondary truncate">
                          {chat.listingTitle || 'Listing'}
                        </p>
                        <p className="text-xs text-text-secondary mt-1 truncate">
                          {chat.lastMessage || 'Start the conversation'}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDeleteChat(chat.id)}
                    disabled={deletingChatId === chat.id}
                    className="px-3 py-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                    aria-label="Delete conversation"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="w-2/3 flex flex-col bg-bg-page">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-border-ink bg-white">
              <div className="flex items-center gap-3">
                {activeChatPhoto ? (
                  <img
                    src={activeChatPhoto}
                    alt={activeChatDisplayName}
                    className="w-10 h-10 object-cover border border-border-ink rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-tulane-green text-white flex items-center justify-center font-bold border border-border-ink rounded-full">
                    {activeChatDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <h3 className="font-bold text-text-primary text-sm truncate">
                    {activeChatDisplayName}
                  </h3>
                  <p className="text-xs text-text-secondary truncate">
                    About: {activeChatListingTitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-text-secondary text-sm text-center pt-8">
                  No messages in this conversation yet.
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2 text-sm border border-border-ink ${
                          isMe
                            ? 'bg-border-ink text-white'
                            : 'bg-bg-muted text-text-primary'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.createdAt && (
                          <p
                            className={`text-[10px] mt-1 ${
                              isMe ? 'text-gray-300' : 'text-text-secondary'
                            }`}
                          >
                            {formatDistanceToNow(msg.createdAt.toDate())} ago
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-border-ink bg-white">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeChatDisplayName}...`}
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
