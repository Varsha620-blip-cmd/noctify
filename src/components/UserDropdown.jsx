import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('👤');
  const dropdownRef = useRef(null);
  const { currentUser } = useAuth();

  const avatarOptions = [
    '👤', '😊', '😎', '🤓', '😄', '🥳', '🤗', '😇', '🙂', '😋', 
    '🤔', '😴', '🤠', '👨‍💻', '👩‍💻', '🧑‍🎓', '👨‍🎓', '👩‍🎓',
    '🦸‍♂️', '🦸‍♀️', '🧙‍♂️', '🧙‍♀️', '🎭', '🎨', '🎵', '⚡',
    '🔥', '🌟', '💎', '🚀', '🎯', '🏆', '💪', '🌈'
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Load saved avatar from localStorage
    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
    }
  }, []);

  const handleAvatarChange = (avatar) => {
    setSelectedAvatar(avatar);
    localStorage.setItem('userAvatar', avatar);
    setShowAvatarModal(false);
    // Trigger a custom event to update other components
    window.dispatchEvent(new CustomEvent('avatarChanged', { detail: avatar }));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <div 
          className="p-2 transition-all duration-200 transform cursor-pointer hover:scale-110"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-lg hover:from-[#F32D17] hover:to-[#C1000F] transition-all duration-200 hover:shadow-lg">
            <span className="text-2xl animate-bounce">{selectedAvatar}</span>
          </span>
        </div>

        {isOpen && (
          <div className="absolute right-0 z-50 w-64 mt-2 bg-white border border-gray-100 shadow-2xl rounded-2xl animate-fadeInScale">
            <div className="py-2">
              <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-[#FD8839]/10 to-[#F32D17]/10">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedAvatar}</span>
                  <div>
                    <p className="font-bold text-gray-900">{currentUser?.displayName || 'User'}</p>
                    <p className="text-sm text-gray-500">{currentUser?.email || 'user@example.com'}</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setShowAvatarModal(true);
                  setIsOpen(false);
                }}
                className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FD8839]/10 hover:to-[#F32D17]/10 transition-colors duration-200"
              >
                <span className="mr-3 text-xl">🎭</span>
                Change Avatar
              </button>
              
              <Link 
                to="/settings" 
                className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FD8839]/10 hover:to-[#F32D17]/10 transition-colors duration-200"
                onClick={() => setIsOpen(false)}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
              
              <div className="mt-2 border-t border-gray-100">
                <button 
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-3 text-sm text-red-600 transition-colors duration-200 hover:bg-red-50"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="p-6 bg-white shadow-2xl rounded-2xl w-96 max-h-[80vh] overflow-y-auto animate-fadeInScale">
            <h3 className="text-2xl font-bold text-[#5E000C] mb-6 text-center">Choose Your Avatar</h3>
            <div className="grid grid-cols-6 gap-3 mb-6">
              {avatarOptions.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => handleAvatarChange(avatar)}
                  className={`w-12 h-12 rounded-full text-2xl hover:bg-gradient-to-r hover:from-[#FD8839]/20 hover:to-[#F32D17]/20 transition-all duration-200 transform hover:scale-110 ${
                    selectedAvatar === avatar ? 'bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-white scale-110' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAvatarModal(false)}
                className="px-6 py-2 text-gray-600 transition-colors rounded-xl hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-white rounded-xl hover:from-[#F32D17] hover:to-[#C1000F] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UserDropdown;