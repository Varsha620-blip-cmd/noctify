import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import UserDropdown from './UserDropdown';

function Navbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const { currentUser } = useAuth();

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for notifications
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const friendRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'friendRequest'
      }));

      // Also listen for accepted friend requests
      const acceptedQuery = query(
        collection(db, 'friendRequests'),
        where('senderId', '==', currentUser.uid),
        where('status', '==', 'accepted')
      );

      onSnapshot(acceptedQuery, (acceptedSnapshot) => {
        const acceptedRequests = acceptedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'friendAccepted'
        }));

        const allNotifications = [...friendRequests, ...acceptedRequests]
          .sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);

        setNotifications(allNotifications);
        setUnreadCount(allNotifications.filter(n => !n.read).length);
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Search users
  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const results = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(user => 
          user.uid !== currentUser?.uid &&
          (user.name?.toLowerCase().includes(query.toLowerCase()) ||
           user.email?.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 5);

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Send friend request
  const sendFriendRequest = async (receiverId, receiverName) => {
    if (!currentUser) return;

    try {
      // Check if request already exists
      const existingQuery = query(
        collection(db, 'friendRequests'),
        where('senderId', '==', currentUser.uid),
        where('receiverId', '==', receiverId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        alert('Friend request already sent!');
        return;
      }

      // Check if they're already friends
      const friendsQuery1 = query(
        collection(db, 'friends'),
        where('user1', '==', currentUser.uid),
        where('user2', '==', receiverId)
      );
      
      const friendsQuery2 = query(
        collection(db, 'friends'),
        where('user1', '==', receiverId),
        where('user2', '==', currentUser.uid)
      );

      const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
        getDocs(friendsQuery1),
        getDocs(friendsQuery2)
      ]);

      if (!friendsSnapshot1.empty || !friendsSnapshot2.empty) {
        alert('You are already friends!');
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email.split('@')[0],
        receiverId,
        receiverName,
        status: 'pending',
        timestamp: serverTimestamp(),
        read: false
      });

      // Add notification for the receiver
      await addDoc(collection(db, 'notifications'), {
        type: 'friend_request',
        userId: receiverId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email.split('@')[0],
        message: `${currentUser.displayName || currentUser.email.split('@')[0]} sent you a friend request`,
        read: false,
        createdAt: serverTimestamp()
      });

      alert('Friend request sent!');
      setSearchQuery('');
      setShowSearchResults(false);
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  // Handle friend request response
  const handleFriendRequest = async (requestId, action) => {
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      
      if (action === 'accept') {
        await updateDoc(requestRef, {
          status: 'accepted',
          read: true
        });
        
        // Add to friends collection for both users
        const request = notifications.find(n => n.id === requestId);
        if (request) {
          await addDoc(collection(db, 'friends'), {
            user1: request.senderId,
            user2: request.receiverId,
            user1Name: request.senderName,
            user2Name: request.receiverName,
            timestamp: serverTimestamp()
          });

          // Notify the sender that their request was accepted
          await addDoc(collection(db, 'notifications'), {
            type: 'friend_accepted',
            userId: request.senderId,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email.split('@')[0],
            message: `${currentUser.displayName || currentUser.email.split('@')[0]} accepted your friend request`,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } else {
        await updateDoc(requestRef, {
          status: 'rejected',
          read: true
        });
      }
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'friendRequests', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <div className="flex justify-between items-center p-4 mt-[-20px]">
      {/* Search */}
      <div className="relative w-full max-w-md md:w-1/3" ref={searchRef}>
        <input
          className="w-full p-3 pl-10 rounded-xl border border-[#FD8839] focus:outline-none focus:ring-2 focus:ring-[#F32D17] bg-gradient-to-r from-[#FD8839]/10 to-[#F32D17]/10 transition-all duration-200 focus:shadow-lg placeholder-gray-500"
          placeholder="Search friends by name..."
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors duration-200">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" stroke="#FD8839" strokeWidth="2"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#FD8839" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto animate-fadeInScale">
            {searchResults.map((user) => (
              <div key={user.uid} className="flex items-center justify-between p-4 hover:bg-gray-50 border-b last:border-b-0 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-[#FD8839] to-[#F32D17] rounded-full flex items-center justify-center text-white font-bold">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name || user.email.split('@')[0]}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => sendFriendRequest(user.uid, user.name || user.email.split('@')[0])}
                  className="px-4 py-2 bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-white text-sm rounded-xl hover:from-[#F32D17] hover:to-[#C1000F] transition-all transform hover:scale-105"
                >
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right side icons */}
      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Notification */}
        <div className="relative" ref={notificationRef}>
          <div 
            className="relative p-2 transition-all duration-200 transform cursor-pointer hover:scale-110"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-lg hover:from-[#F32D17] hover:to-[#C1000F] transition-all duration-200 hover:shadow-lg">
              <svg width="26" height="26" viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.75 39.375H26.25C26.25 41.4375 24.5625 43.125 22.5 43.125C20.4375 43.125 18.75 41.4375 18.75 39.375ZM39.375 35.625V37.5H5.625V35.625L9.375 31.875V20.625C9.375 14.8125 13.125 9.75 18.75 8.0625V7.5C18.75 5.4375 20.4375 3.75 22.5 3.75C24.5625 3.75 26.25 5.4375 26.25 7.5V8.0625C31.875 9.75 35.625 14.8125 35.625 20.625V31.875L39.375 35.625ZM31.875 20.625C31.875 15.375 27.75 11.25 22.5 11.25C17.25 11.25 13.125 15.375 13.125 20.625V33.75H31.875V20.625Z" fill="white"/>
              </svg>
            </span>
            {unreadCount > 0 && (
              <span className="absolute w-6 h-6 bg-[#C1000F] rounded-full -top-1 -right-1 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto animate-fadeInScale">
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[#FD8839]/10 to-[#F32D17]/10">
                <h3 className="font-bold text-gray-900 text-lg">Notifications</h3>
              </div>
              
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5v-5zM11 19H6a2 2 0 01-2-2V7a2 2 0 012-2h6m2 13V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2z" />
                  </svg>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50' : ''}`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    {notification.type === 'friendRequest' && notification.status === 'pending' && (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-[#FD8839] to-[#F32D17] rounded-full flex items-center justify-center text-white font-bold">
                            {notification.senderName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {notification.senderName}
                            </p>
                            <p className="text-sm text-gray-600">sent you a friend request</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFriendRequest(notification.id, 'accept');
                            }}
                            className="flex-1 px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFriendRequest(notification.id, 'reject');
                            }}
                            className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {notification.type === 'friendAccepted' && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                          ✓
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {notification.receiverName} accepted your friend request
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.timestamp?.toDate?.()?.toLocaleDateString() || 'Just now'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Message */}
        <div className="relative p-2 transition-all duration-200 transform cursor-pointer hover:scale-110">
          <span className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-lg hover:from-[#F32D17] hover:to-[#C1000F] transition-all duration-200 hover:shadow-lg">
            <svg width="28" height="28" viewBox="0 0 43 43" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.16663 21.5C7.16663 17.6986 8.67674 14.0528 11.3648 11.3648C14.0528 8.67678 17.6985 7.16667 21.5 7.16667C25.3014 7.16667 28.9471 8.67678 31.6352 11.3648C34.3232 14.0528 35.8333 17.6986 35.8333 21.5V30.6196C35.8333 32.1389 35.8333 32.895 35.6075 33.5024C35.428 33.9837 35.1471 34.4207 34.7839 34.784C34.4207 35.1472 33.9836 35.4281 33.5023 35.6076C32.895 35.8333 32.1371 35.8333 30.6195 35.8333H21.5C17.6985 35.8333 14.0528 34.3232 11.3648 31.6352C8.67674 28.9472 7.16663 25.3014 7.16663 21.5Z" stroke="white" strokeWidth="2"/>
              <path d="M16.125 19.7083H26.875M21.5 26.875H26.875" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>

        {/* User Profile with Dropdown */}
        <UserDropdown />
      </div>
    </div>
  )
}

export default Navbar