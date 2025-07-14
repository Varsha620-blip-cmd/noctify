import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

function Settings() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoSync: true,
    emailNotifications: true,
    pushNotifications: true,
    language: 'english',
    currency: 'inr'
  });

  const [profileData, setProfileData] = useState({
    name: '',
    email: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load settings and profile data on component mount
  useEffect(() => {
    if (currentUser) {
      setProfileData({
        name: currentUser.displayName || '',
        email: currentUser.email || ''
      });

      // Load settings from localStorage
      const savedSettings = localStorage.getItem('userSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    }
  }, [currentUser]);

  const handleToggle = (setting) => {
    const newSettings = {
      ...settings,
      [setting]: !settings[setting]
    };
    setSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
    
    setMessage(`${setting.replace(/([A-Z])/g, ' $1').toLowerCase()} ${newSettings[setting] ? 'enabled' : 'disabled'}`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSelectChange = (setting, value) => {
    const newSettings = {
      ...settings,
      [setting]: value
    };
    setSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
    
    setMessage(`${setting} updated to ${value}`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: profileData.name
      });

      // Update Firestore user document
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        name: profileData.name,
        updatedAt: new Date()
      });

      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm('Are you sure you want to clear all your data? This action cannot be undone.')) {
      setLoading(true);
      
      try {
        const batch = writeBatch(db);

        // Clear user's exams
        const examsQuery = query(collection(db, 'users', currentUser.uid, 'exams'));
        const examsSnapshot = await getDocs(examsQuery);
        examsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Clear user's bills
        const billsQuery = query(collection(db, 'bills'), where('createdBy', '==', currentUser.uid));
        const billsSnapshot = await getDocs(billsQuery);
        billsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Clear user's notifications
        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
        const notificationsSnapshot = await getDocs(notificationsQuery);
        notificationsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Clear user's friend requests
        const friendRequestsQuery1 = query(collection(db, 'friendRequests'), where('senderId', '==', currentUser.uid));
        const friendRequestsQuery2 = query(collection(db, 'friendRequests'), where('receiverId', '==', currentUser.uid));
        const [frSnapshot1, frSnapshot2] = await Promise.all([
          getDocs(friendRequestsQuery1),
          getDocs(friendRequestsQuery2)
        ]);
        [...frSnapshot1.docs, ...frSnapshot2.docs].forEach(doc => {
          batch.delete(doc.ref);
        });

        // Clear user's friendships
        const friendsQuery1 = query(collection(db, 'friends'), where('user1', '==', currentUser.uid));
        const friendsQuery2 = query(collection(db, 'friends'), where('user2', '==', currentUser.uid));
        const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
          getDocs(friendsQuery1),
          getDocs(friendsQuery2)
        ]);
        [...friendsSnapshot1.docs, ...friendsSnapshot2.docs].forEach(doc => {
          batch.delete(doc.ref);
        });

        // Clear user's status updates
        const statusQuery = query(collection(db, 'status_updates'), where('userId', '==', currentUser.uid));
        const statusSnapshot = await getDocs(statusQuery);
        statusSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Commit all deletions
        await batch.commit();

        // Clear localStorage
        localStorage.removeItem('userSettings');
        localStorage.removeItem('userAvatar');

        setMessage('All data cleared successfully!');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Error clearing data:', error);
        setMessage('Error clearing data. Please try again.');
        setTimeout(() => setMessage(''), 3000);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone and you will lose all your data.')) {
      if (window.confirm('This is your final warning. Are you absolutely sure you want to delete your account?')) {
        setLoading(true);
        
        try {
          // First clear all data
          await handleClearAllData();
          
          // Delete user document from Firestore
          await deleteDoc(doc(db, 'users', currentUser.uid));
          
          // Delete the user account
          await deleteUser(currentUser);
          
          setMessage('Account deleted successfully. You will be redirected to login.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } catch (error) {
          console.error('Error deleting account:', error);
          if (error.code === 'auth/requires-recent-login') {
            setMessage('Please log out and log back in, then try deleting your account again.');
          } else {
            setMessage('Error deleting account. Please try again or contact support.');
          }
          setTimeout(() => setMessage(''), 5000);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const exportData = async () => {
    try {
      setLoading(true);
      
      // Collect all user data
      const userData = {
        profile: profileData,
        settings: settings,
        exportDate: new Date().toISOString()
      };

      // Get exams
      const examsQuery = query(collection(db, 'users', currentUser.uid, 'exams'));
      const examsSnapshot = await getDocs(examsQuery);
      userData.exams = examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get bills
      const billsQuery = query(collection(db, 'bills'), where('createdBy', '==', currentUser.uid));
      const billsSnapshot = await getDocs(billsQuery);
      userData.bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get friends
      const friendsQuery1 = query(collection(db, 'friends'), where('user1', '==', currentUser.uid));
      const friendsQuery2 = query(collection(db, 'friends'), where('user2', '==', currentUser.uid));
      const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
        getDocs(friendsQuery1),
        getDocs(friendsQuery2)
      ]);
      userData.friends = [
        ...friendsSnapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...friendsSnapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];
      
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `noctify-data-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      setMessage('Data exported successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setMessage('Error exporting data. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    const defaultSettings = {
      notifications: true,
      darkMode: false,
      autoSync: true,
      emailNotifications: true,
      pushNotifications: true,
      language: 'english',
      currency: 'inr'
    };
    
    setSettings(defaultSettings);
    localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
    setMessage('Settings reset to default values!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="min-h-screen w-full bg-[#ffffff] flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-col w-full p-4 pb-20 md:pb-4">
        <Navbar />
        
        <h1 className="text-3xl font-light text-[#424495] mt-6 mb-6 ml-2">SETTINGS</h1>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-center font-medium animate-slideInDown ${
            message.includes('Error') || message.includes('error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {message}
          </div>
        )}

        <div className="w-full max-w-4xl mx-auto space-y-6">
          {/* Profile Section */}
          <div className="bg-[#EEEEFF] rounded-2xl p-6 shadow-lg animate-fadeInUp" style={{ boxShadow: '-8px 5px 15px #6366F1' }}>
            <h2 className="text-2xl font-semibold text-[#424495] mb-4 flex items-center gap-3">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#6366F1"/>
                <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="#6366F1"/>
              </svg>
              Profile Settings
            </h2>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-[#424495] mb-2">Full Name</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all duration-200"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#424495] mb-2">Email</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Notification Settings */}
          <div className="bg-[#EEEEFF] rounded-2xl p-6 shadow-lg animate-fadeInUp" style={{ boxShadow: '-8px 5px 15px #6366F1', animationDelay: '0.1s' }}>
            <h2 className="text-2xl font-semibold text-[#424495] mb-4 flex items-center gap-3">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21S18 15 18 8Z" fill="#6366F1"/>
                <path d="M13.73 21A2 2 0 0 1 10.27 21" fill="#6366F1"/>
              </svg>
              Notifications
            </h2>
            <div className="space-y-4">
              {[
                { key: 'notifications', label: 'Enable Notifications', desc: 'Receive general app notifications' },
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Get updates via email' },
                { key: 'pushNotifications', label: 'Push Notifications', desc: 'Receive push notifications on your device' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 transition-all duration-200 bg-white rounded-xl hover:shadow-md">
                  <div>
                    <h3 className="font-medium text-[#424495]">{item.label}</h3>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(item.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                      settings[item.key] ? 'bg-[#6366F1]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        settings[item.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* App Settings */}
          <div className="bg-[#EEEEFF] rounded-2xl p-6 shadow-lg animate-fadeInUp" style={{ boxShadow: '-8px 5px 15px #6366F1', animationDelay: '0.2s' }}>
            <h2 className="text-2xl font-semibold text-[#424495] mb-4 flex items-center gap-3">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#6366F1"/>
                <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.2579 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.01127 9.77251C4.28054 9.5799 4.48571 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" fill="#6366F1"/>
              </svg>
              App Settings
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 transition-all duration-200 bg-white rounded-xl hover:shadow-md">
                <div>
                  <h3 className="font-medium text-[#424495]">Dark Mode</h3>
                  <p className="text-sm text-gray-600">Switch to dark theme</p>
                </div>
                <button
                  onClick={() => handleToggle('darkMode')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                    settings.darkMode ? 'bg-[#6366F1]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      settings.darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 transition-all duration-200 bg-white rounded-xl hover:shadow-md">
                <div>
                  <h3 className="font-medium text-[#424495]">Auto Sync</h3>
                  <p className="text-sm text-gray-600">Automatically sync data across devices</p>
                </div>
                <button
                  onClick={() => handleToggle('autoSync')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                    settings.autoSync ? 'bg-[#6366F1]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      settings.autoSync ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 transition-all duration-200 bg-white rounded-xl hover:shadow-md">
                <h3 className="font-medium text-[#424495] mb-2">Language</h3>
                <select
                  value={settings.language}
                  onChange={(e) => handleSelectChange('language', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all duration-200"
                >
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="spanish">Spanish</option>
                  <option value="french">French</option>
                  <option value="german">German</option>
                </select>
              </div>

              <div className="p-4 transition-all duration-200 bg-white rounded-xl hover:shadow-md">
                <h3 className="font-medium text-[#424495] mb-2">Currency</h3>
                <select
                  value={settings.currency}
                  onChange={(e) => handleSelectChange('currency', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all duration-200"
                >
                  <option value="inr">INR (₹)</option>
                  <option value="usd">USD ($)</option>
                  <option value="eur">EUR (€)</option>
                  <option value="gbp">GBP (£)</option>
                  <option value="jpy">JPY (¥)</option>
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={resetSettings}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-[#EEEEFF] rounded-2xl p-6 shadow-lg animate-fadeInUp" style={{ boxShadow: '-8px 5px 15px #6366F1', animationDelay: '0.3s' }}>
            <h2 className="text-2xl font-semibold text-[#424495] mb-4 flex items-center gap-3">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" fill="#6366F1"/>
              </svg>
              Data Management
            </h2>
            <div className="space-y-4">
              <div className="p-4 transition-all duration-200 bg-white rounded-xl hover:shadow-md">
                <h3 className="font-medium text-[#424495] mb-2">Export Data</h3>
                <p className="text-sm text-gray-600 mb-3">Download all your data including profile, exams, bills, and friends in JSON format</p>
                <button
                  onClick={exportData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Exporting...' : 'Export Data'}
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="p-6 border border-red-200 bg-red-50 rounded-2xl animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
            <h2 className="flex items-center gap-3 mb-4 text-2xl font-semibold text-red-600">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Danger Zone
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl">
                <h3 className="font-medium text-red-600 mb-2">Clear All Data</h3>
                <p className="text-sm text-gray-600 mb-3">This will permanently delete all your exams, bills, friends, and other data. Your account will remain active.</p>
                <button 
                  onClick={handleClearAllData}
                  disabled={loading}
                  className="px-4 py-2 text-white transition-all duration-200 transform bg-orange-600 rounded-lg hover:bg-orange-700 hover:scale-105 disabled:opacity-50"
                >
                  {loading ? 'Clearing...' : 'Clear All Data'}
                </button>
              </div>
              
              <div className="p-4 bg-white rounded-xl">
                <h3 className="font-medium text-red-600 mb-2">Delete Account</h3>
                <p className="text-sm text-gray-600 mb-3">This will permanently delete your account and all associated data. This action cannot be undone.</p>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="px-4 py-2 text-white transition-all duration-200 transform bg-red-600 rounded-lg hover:bg-red-700 hover:scale-105 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;