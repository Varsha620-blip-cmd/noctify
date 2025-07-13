import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

function NewGroupModal({ isOpen, onClose, onCreate, friends = [] }) {
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState('👥');
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  const avatarOptions = [
    '👥', '🎉', '🚀', '💼', '🎓', '🏠', '🎮', '🍕', '📚', '💪', 
    '🎵', '🌟', '🔥', '⚡', '🎯', '🏆', '💎', '🌈', '🦄', '🎨',
    '🎭', '🎪', '🎬', '📱', '💻', '🎸', '🎤', '🎧', '🎲', '🎳',
    '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🏊‍♂️'
  ];

  const handleAddMember = (e) => {
    const uid = e.target.value;
    if (uid && !selectedUserIds.includes(uid)) {
      setSelectedUserIds(prev => [...prev, uid]);
      e.target.value = ''; // Reset the dropdown
    }
  };

  const handleRemoveMember = (uid) => {
    setSelectedUserIds(prev => prev.filter(id => id !== uid));
  };

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    if (selectedUserIds.length === 0) {
      setError('Please add at least one member');
      return;
    }

    if (!currentUser) {
      setError('User not authenticated');
      return;
    }

    onCreate({
      groupName,
      members: [currentUser.uid, ...selectedUserIds],
      avatar: selectedAvatar
    });
    setGroupName('');
    setSelectedUserIds([]);
    setSelectedAvatar('👥');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl w-[90%] max-w-md shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeInScale">
        <h2 className="text-2xl font-bold mb-6 text-[#5E000C] text-center">Create New Group</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
            <input
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-3 border border-[#FD8839] rounded-xl focus:ring-2 focus:ring-[#F32D17] focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Avatar Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Choose Group Avatar</label>
            <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-xl">
              {avatarOptions.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`w-8 h-8 rounded-full text-lg hover:bg-gradient-to-r hover:from-[#FD8839]/20 hover:to-[#F32D17]/20 transition-all duration-200 transform hover:scale-110 ${
                    selectedAvatar === avatar ? 'bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-white scale-110' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Friends</label>
            {friends.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm text-gray-500">You need to add friends first to create a group.</p>
                <p className="text-xs text-gray-400 mt-1">Use the search bar to find and add friends!</p>
              </div>
            ) : (
              <>
                <select
                  onChange={handleAddMember}
                  className="w-full p-3 mb-3 border border-[#FD8839] rounded-xl focus:ring-2 focus:ring-[#F32D17] focus:border-transparent transition-all duration-200"
                  defaultValue=""
                >
                  <option value="" disabled>Select a friend to add</option>
                  {friends
                    .filter(friend => !selectedUserIds.includes(friend.uid))
                    .map(friend => (
                      <option key={friend.uid} value={friend.uid}>
                        {friend.name}
                      </option>
                    ))}
                </select>

                {selectedUserIds.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected friends ({selectedUserIds.length}):</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedUserIds.map(uid => {
                        const friend = friends.find(f => f.uid === uid);
                        return (
                          <div key={uid} className="flex items-center justify-between p-2 bg-gradient-to-r from-[#FD8839]/10 to-[#F32D17]/10 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-r from-[#FD8839] to-[#F32D17] rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {friend?.name?.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium">{friend?.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(uid)}
                              className="text-[#F32D17] hover:text-[#C1000F] transition-colors p-1 hover:bg-red-100 rounded"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-200 rounded-xl hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={friends.length === 0}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#FD8839] to-[#F32D17] text-white rounded-xl hover:from-[#F32D17] hover:to-[#C1000F] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewGroupModal;