import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import ChatCard from '../components/ChatCard';
import NotificationsPanel from '../components/NotificationPanel';
import NewGroupModal from '../components/NewGroupModal';
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  serverTimestamp, where, getDocs, doc, updateDoc 
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from '../context/AuthContext';

function NotifyFriends() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);
  const [showChatView, setShowChatView] = useState(false);
  const [friends, setFriends] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch user's friends for group creation
  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUser) return;

      try {
        const friendsQuery1 = query(
          collection(db, 'friends'),
          where('user1', '==', currentUser.uid)
        );
        
        const friendsQuery2 = query(
          collection(db, 'friends'),
          where('user2', '==', currentUser.uid)
        );

        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(friendsQuery1),
          getDocs(friendsQuery2)
        ]);

        const friendsList = [];
        
        snapshot1.docs.forEach(doc => {
          const data = doc.data();
          friendsList.push({
            uid: data.user2,
            name: data.user2Name
          });
        });

        snapshot2.docs.forEach(doc => {
          const data = doc.data();
          friendsList.push({
            uid: data.user1,
            name: data.user1Name
          });
        });

        setFriends(friendsList);
      } catch (error) {
        console.error('Error fetching friends:', error);
      }
    };

    fetchFriends();
  }, [currentUser]);

  // Fetch notifications
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch messages for active group
  useEffect(() => {
    if (!activeGroupId) return;

    const q = query(
      collection(db, "groups", activeGroupId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [activeGroupId]);

  // Fetch user's groups
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setGroups(groupsData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!currentUser || !activeGroupId) return;

    try {
      await addDoc(collection(db, "groups", activeGroupId, "messages"), {
        text: newMessage,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email.split('@')[0],
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleGroupSelect = (groupId) => {
    setActiveGroupId(groupId);
    setShowChatView(true);
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const activeGroup = groups.find(group => group.id === activeGroupId) || { 
    name: 'Select a chat', 
    members: [], 
    avatar: '👥' 
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-white md:flex-row">
      {/* Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-col w-full p-4 pb-20 md:pb-4">
        <Navbar />
        <h2 className="text-2xl md:text-3xl font-light text-[#5E000C] mt-6 mb-4 ml-2 animate-fadeInUp">
          NOTIFY YOUR FRIENDS
        </h2>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Chat Section */}
          <div className="flex flex-1 rounded-2xl bg-gradient-to-br from-[#FD8839] to-[#F32D17] shadow-2xl overflow-hidden min-h-[500px] border-[#C1000F] border-[1px] animate-slideInLeft">
            {/* Mobile View */}
            <div className="flex w-full md:hidden">
              {!showChatView ? (
                <div className="w-full bg-gradient-to-b from-[#F32D17] to-[#C1000F] text-white flex flex-col py-4">
                  <div className="flex items-center justify-between px-4 mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5zM15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                      </svg>
                      Chats ({groups.length})
                    </h3>
                    <button 
                      onClick={() => setGroupModalOpen(true)}
                      className="px-3 py-1 text-sm rounded-xl bg-white/20 hover:bg-white/30 transition-all transform hover:scale-105"
                    >
                      + New
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 px-2 overflow-y-auto">
                    {groups.length > 0 ? (
                      groups.map((group) => (
                        <div
                          key={group.id}
                          className="px-2 py-1 transition-all rounded-xl cursor-pointer hover:bg-white/20 transform hover:scale-105"
                          onClick={() => handleGroupSelect(group.id)}
                        >
                          <ChatCard
                            name={group.name}
                            icon={group.avatar || '👥'}
                            lastUpdate={`${group.members?.length || 0} members`}
                            isActive={false}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <svg className="w-16 h-16 mb-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-white/70 mb-2">No groups yet</p>
                        <button 
                          onClick={() => setGroupModalOpen(true)}
                          className="px-4 py-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
                        >
                          Create your first group
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-col flex-1 bg-white/10">
                  {/* Chat header with back button */}
                  <div className="flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-[#C1000F] to-[#5E000C] text-white">
                    <button 
                      onClick={() => setShowChatView(false)}
                      className="p-2 text-white rounded-xl hover:bg-white/20 transition-all transform hover:scale-110"
                    >
                      ←
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl animate-bounce">{activeGroup.avatar || '👥'}</span>
                      <div>
                        <h3 className="font-bold">{activeGroup.name}</h3>
                        <p className="text-sm opacity-80">{activeGroup.members?.length || 0} members</p>
                      </div>
                    </div>
                    <div className="w-8"></div>
                  </div>
                  
                  {/* Messages area */}
                  <div className="flex flex-col justify-end flex-1 p-4 space-y-3 overflow-y-auto">
                    {messages.length > 0 ? (
                      messages.map((msg, index) => (
                        <div
                          key={msg.id}
                          className={`self-start px-4 py-3 rounded-2xl max-w-[80%] text-sm shadow-lg animate-slideInUp ${
                            msg.senderId === currentUser?.uid
                              ? 'bg-white/30 self-end text-right backdrop-blur-sm'
                              : 'bg-white/20 text-left backdrop-blur-sm'
                          }`}
                          style={{ animationDelay: `${index * 0.1}s` }}
                        >
                          <p className="mb-1 text-xs font-bold text-white/80">
                            {msg.senderId === currentUser?.uid ? 'You' : msg.senderName}
                          </p>
                          <p className='text-white font-medium'>{msg.text}</p>
                          <p className="text-xs text-white/60 mt-1">
                            {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-white/70">
                        <svg className="w-20 h-20 mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-center">No messages yet. Start the conversation!</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message input */}
                  <form onSubmit={handleSendMessage} className="flex items-center w-full px-3 py-2 mx-4 mt-4 mb-4 bg-white border rounded-full shadow-inner border-white/30">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 outline-none text-sm text-[#5E000C] placeholder-gray-500"
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim()}
                      className="ml-2 w-10 h-10 bg-[#FD8839] rounded-full flex items-center justify-center hover:bg-[#F32D17] transition-all text-white disabled:opacity-50 transform hover:scale-110"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Desktop View */}
            <div className="hidden w-full md:flex">
              {/* Groups list */}
              <div className="w-1/3 bg-gradient-to-b from-[#F32D17] to-[#C1000F] text-white flex flex-col py-4 rounded-l-2xl">
                <div className="flex items-center justify-between px-4 mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5zM15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                    </svg>
                    Chats ({groups.length})
                  </h3>
                  <button 
                    onClick={() => setGroupModalOpen(true)}
                    className="px-3 py-1 text-sm rounded-xl bg-white/20 hover:bg-white/30 transition-all transform hover:scale-105"
                  >
                    + New
                  </button>
                </div>
                <div className="flex flex-col gap-2 px-2 overflow-y-auto">
                  {groups.length > 0 ? (
                    groups.map((group) => (
                      <div
                        key={group.id}
                        className={`px-2 py-1 rounded-xl cursor-pointer transition-all transform hover:scale-105 ${
                          activeGroupId === group.id ? 'bg-white/30 scale-105' : 'hover:bg-white/20'
                        }`}
                        onClick={() => setActiveGroupId(group.id)}
                      >
                        <ChatCard
                          name={group.name}
                          icon={group.avatar || '👥'}
                          lastUpdate={`${group.members?.length || 0} members`}
                          isActive={activeGroupId === group.id}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <svg className="w-16 h-16 mb-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-white/70 mb-2">No groups yet</p>
                      <button 
                        onClick={() => setGroupModalOpen(true)}
                        className="px-4 py-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
                      >
                        Create your first group
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat area */}
              <div className="relative flex flex-col flex-1 p-4 bg-white/10">
                {activeGroupId ? (
                  <>
                    <div className="w-full px-4 py-3 bg-gradient-to-r from-[#C1000F] to-[#5E000C] text-white rounded-xl mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl animate-bounce">{activeGroup.avatar || '👥'}</span>
                        <div>
                          <h3 className="font-bold">{activeGroup.name}</h3>
                          <p className="text-sm opacity-80">{activeGroup.members?.length || 0} members</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-end flex-1 w-full p-4 space-y-3 overflow-y-auto">
                      {messages.length > 0 ? (
                        messages.map((msg, index) => (
                          <div
                            key={msg.id}
                            className={`self-start px-4 py-3 rounded-2xl max-w-[70%] text-sm shadow-lg animate-slideInUp ${
                              msg.senderId === currentUser?.uid
                                ? 'bg-white/30 self-end text-right backdrop-blur-sm'
                                : 'bg-white/20 text-left backdrop-blur-sm'
                            }`}
                            style={{ animationDelay: `${index * 0.1}s` }}
                          >
                            <p className="mb-1 text-xs font-bold text-white/80">
                              {msg.senderId === currentUser?.uid ? 'You' : msg.senderName}
                            </p>
                            <p className='text-white font-medium'>{msg.text}</p>
                            <p className="text-xs text-white/60 mt-1">
                              {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/70">
                          <svg className="w-20 h-20 mb-4 text-white/30 animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <p className="text-center">No messages yet. Start the conversation!</p>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="flex items-center w-full max-w-lg px-4 py-3 mt-auto bg-white border rounded-full shadow-inner border-white/30">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 outline-none text-sm text-[#5E000C] placeholder-gray-500"
                      />
                      <button 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        className="ml-3 w-10 h-10 bg-[#FD8839] rounded-full flex items-center justify-center hover:bg-[#F32D17] transition-all text-white disabled:opacity-50 transform hover:scale-110"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white/70">
                    <svg className="w-24 h-24 mb-6 text-white/30 animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-center text-lg">Select a group to start chatting</p>
                    <p className="text-center text-sm text-white/50 mt-2">Choose from your groups or create a new one</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notifications Panel */}
          <div className="w-full lg:w-[28%] animate-slideInRight">
            <NotificationsPanel 
              notifications={notifications}
              onCreateGroup={() => setGroupModalOpen(true)}
              onMarkAsRead={markNotificationAsRead}
            />
          </div>
        </div>
      </div>

      {/* New Group Modal */}
      <NewGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        friends={friends}
        onCreate={async ({ groupName, members, avatar }) => {
          try {
            const docRef = await addDoc(collection(db, 'groups'), {
              name: groupName,
              members,
              avatar: avatar || '👥',
              createdAt: serverTimestamp(),
              createdBy: currentUser.uid
            });
            
            // Add notification to all group members
            members.forEach(async (memberId) => {
              if (memberId !== currentUser.uid) {
                await addDoc(collection(db, 'notifications'), {
                  type: 'group_invite',
                  groupId: docRef.id,
                  groupName,
                  userId: memberId,
                  senderId: currentUser.uid,
                  senderName: currentUser.displayName || currentUser.email,
                  read: false,
                  createdAt: serverTimestamp()
                });
              }
            });

            setActiveGroupId(docRef.id);
            setGroupModalOpen(false);
            if (window.innerWidth < 768) {
              setShowChatView(true);
            }
          } catch (err) {
            console.error('Error creating group:', err);
          }
        }}
      />
    </div>
  );
}

export default NotifyFriends;