import { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import AddBillModal from '../components/AddBillModal';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, getDocs, query, where, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const getCurrentMonthTotal = (bills, currentUserId) => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  let total = 0;
  bills.forEach(bill => {
    const billDate = bill.createdAt;
    if (!billDate || billDate < start || billDate > end) return;
    
    if (bill.createdBy === currentUserId) {
      total += Number(bill.amount);
    } else if (bill.splitTo?.some(person => person.uid === currentUserId)) {
      const share = Number(bill.amount) / (bill.splitTo.length || 1);
      total += share;
    }
  });
  
  return total;
};

function ExpenseTracker() {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [bills, setBills] = useState([]);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const { currentUser } = useAuth();
  const [youPaid, setYouPaid] = useState(0);
  const [youOwe, setYouOwe] = useState(0);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  // Memoized calculations for better performance
  const myMonthlyTotal = useMemo(() => 
    getCurrentMonthTotal(bills, currentUser?.uid), 
    [bills, currentUser?.uid]
  );

  // Get pending bills for current user
  const getPendingBills = useMemo(() => {
    if (!currentUser) return [];
    
    return bills.filter(bill => {
      // Bills you created that are pending
      if (bill.createdBy === currentUser.uid && bill.status !== 'Paid') {
        return true;
      }
      
      // Bills split with you that you haven't paid
      return bill.splitTo?.some(person => person.uid === currentUser.uid) && 
             !bill.paidBy?.some(person => person.uid === currentUser.uid) &&
             bill.status !== 'Paid';
    });
  }, [bills, currentUser]);

  // Toggle payment status for a user
  const togglePaymentStatus = async (billId, personUid, currentPaidBy) => {
    const docRef = doc(db, 'bills', billId);
    const updatedPaidBy = currentPaidBy.some(person => person.uid === personUid)
      ? currentPaidBy.filter(person => person.uid !== personUid)
      : [...currentPaidBy, { uid: personUid }];

    await updateDoc(docRef, { paidBy: updatedPaidBy });
  };

  // Toggle overall bill status
  const toggleStatus = async (billId, currentStatus) => {
    try {
      const billRef = doc(db, 'bills', billId);
      await updateDoc(billRef, {
        status: currentStatus === 'Paid' ? 'Pending' : 'Paid'
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Fetch bills
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribers = [];

    // Fetch bills created by user
    const createdByQuery = query(
      collection(db, 'bills'),
      where('createdBy', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const unsubscribe1 = onSnapshot(createdByQuery, (snapshot) => {
      const createdBills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      // Fetch bills split with user
      const allBillsQuery = query(
        collection(db, 'bills'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe2 = onSnapshot(allBillsQuery, (snapshot) => {
        const allBills = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));

        // Filter bills that involve current user
        const userBills = allBills.filter(bill => 
          bill.createdBy === currentUser.uid || 
          bill.splitTo?.some(person => person.uid === currentUser.uid)
        );

        setBills(userBills);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching bills:', error);
        setLoading(false);
      });

      unsubscribers.push(unsubscribe2);
    }, (error) => {
      console.error('Error fetching created bills:', error);
      setLoading(false);
    });

    unsubscribers.push(unsubscribe1);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser]);
  
  // Fetch Friends for the split bill feature
  useEffect(() => {
    if (!currentUser) return;

    const fetchFriends = async () => {
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

  // Calculate paid and owe amounts
  useEffect(() => {
    if (!currentUser) return;

    let paid = 0;
    let owe = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    bills.forEach((bill) => {
      const billDate = bill.createdAt;
      if (!billDate || billDate.getMonth() !== currentMonth || billDate.getFullYear() !== currentYear) return;

      // Your own bills (full amount)
      if (bill.createdBy === currentUser.uid) {
        paid += Number(bill.amount);
      }
      
      // Bills split with you (your share)
      if (bill.splitTo?.some(person => person.uid === currentUser.uid)) {
        const share = bill.amount / (bill.splitTo.length || 1);
        
        if (bill.paidBy?.some(person => person.uid === currentUser.uid)) {
          paid += share;
        } else {
          owe += share;
        }
      }
    });

    setYouPaid(paid);
    setYouOwe(owe);
  }, [bills, currentUser]);

  if (!currentUser || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#072D44]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#5790AB]"></div>
          <p className="mt-4 text-[#D0D7E1]">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#072D44] md:flex-row">
      {/* Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-col w-full p-4 pb-20 md:pb-4">
        <Navbar />

        <h2 className="text-2xl md:text-3xl font-light text-[#D0D7E1] mt-6 mb-4 ml-2 animate-fadeInUp">
          EXPENSE TRACKER
        </h2>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left Column */}
          <div className="flex flex-col flex-1 gap-4">
            {/* Average Spend Card */}
            <div className="bg-gradient-to-br from-[#064469] to-[#5790AB] text-white rounded-2xl shadow-xl p-4 md:p-6 min-h-[180px] animate-slideInLeft card-hover">
              <div className="flex flex-col items-center gap-3 md:flex-row md:items-start">
                <svg width="90" height="90" viewBox="0 0 115 115" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
                  <path fillRule="evenodd" clipRule="evenodd" d="M57.5 67.0833C57.5 63.2708 59.0145 59.6145 61.7103 56.9187C64.4062 54.2228 68.0625 52.7083 71.875 52.7083H91.0417C93.5833 52.7083 96.0209 53.718 97.8181 55.5152C99.6153 57.3124 100.625 59.75 100.625 62.2916V71.875C100.625 74.4166 99.6153 76.8542 97.8181 78.6514C96.0209 80.4486 93.5833 81.4583 91.0417 81.4583H71.875C68.0625 81.4583 64.4062 79.9438 61.7103 77.248C59.0145 74.5521 57.5 70.8958 57.5 67.0833ZM71.875 62.2916C70.6042 62.2916 69.3854 62.7965 68.4868 63.6951C67.5882 64.5937 67.0833 65.8125 67.0833 67.0833C67.0833 68.3541 67.5882 69.5729 68.4868 70.4715C69.3854 71.3701 70.6042 71.875 71.875 71.875H91.0417V62.2916H71.875Z" fill="white" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M58.904 15.779C59.8025 14.8807 61.0211 14.376 62.2917 14.376C63.5622 14.376 64.7808 14.8807 65.6794 15.779L78.6504 28.75H65.0996L58.904 22.5544C58.0057 21.6558 57.501 20.4372 57.501 19.1667C57.501 17.8961 58.0057 16.6775 58.904 15.779ZM59.4837 28.75L46.5127 15.779C45.6141 14.8807 44.3956 14.376 43.125 14.376C41.8544 14.376 40.6359 14.8807 39.7373 15.779L26.7663 28.75H59.4837ZM21.9746 33.5417L21.7063 33.8052C19.6157 34.3106 17.7559 35.5046 16.4261 37.1951C15.0964 38.8856 14.3739 40.9742 14.375 43.125V91.0417C14.375 93.5833 15.3847 96.0209 17.1819 97.8181C18.9791 99.6153 21.4167 100.625 23.9583 100.625H81.4583C84 100.625 86.4375 99.6153 88.2348 97.8181C90.032 96.0209 91.0417 93.5833 91.0417 91.0417H71.875C65.5209 91.0417 59.427 88.5175 54.9339 84.0244C50.4408 79.5314 47.9167 73.4375 47.9167 67.0833C47.9167 60.7292 50.4408 54.6353 54.9339 50.1422C59.427 45.6492 65.5209 43.125 71.875 43.125H91.0417C91.0427 40.9742 90.3203 38.8856 88.9905 37.1951C87.6608 35.5046 85.801 34.3106 83.7104 33.8052L83.4421 33.5417H21.9746Z" fill="white" />
                </svg>
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-light md:text-2xl">Monthly Expenses:</h3>
                  <p className="text-2xl font-semibold md:text-3xl gradient-text">₹{myMonthlyTotal}</p>
                </div>
                <div className="p-3 ml-6 text-white rounded-lg shadow-lg bg-white/20 glass">
                  <h3 className="mb-4 font-normal text-md">My Summary (This Month)</h3>
                  <p className="flex items-center gap-2">
                    <span className="text-green-300">✅</span> 
                    You Paid: <strong>₹{youPaid.toFixed(2)}</strong>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-red-300">💸</span> 
                    You Owe: <strong>₹{youOwe.toFixed(2)}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* My Pending Bills Section */}
            <div className="bg-gradient-to-br from-[#5790AB] to-[#9CCDDB] p-4 md:p-6 rounded-2xl shadow-lg animate-slideInUp card-hover">
              <h3 className="mb-4 text-xl font-semibold text-[#072D44] md:text-2xl flex items-center gap-2">
                <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                My Pending Bills
              </h3>
              <div className="space-y-3 overflow-y-auto max-h-60">
                {getPendingBills.length > 0 ? (
                  getPendingBills.map((bill, index) => (
                    <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-white/60 hover:bg-white/80 transition-colors animate-slideInUp" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div>
                        <h4 className="font-medium text-[#072D44]">{bill.description}</h4>
                        <p className="text-sm text-[#064469]">
                          Amount: ₹{bill.createdBy === currentUser.uid 
                            ? bill.amount 
                            : (bill.amount / (bill.splitTo?.length || 1)).toFixed(2)
                          }
                        </p>
                        <p className="text-xs text-gray-500">
                          {bill.createdAt?.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          bill.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {bill.status || 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[#064469]">No pending bills! 🎉</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Cards */}
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex flex-col justify-between bg-gradient-to-br from-[#064469] to-[#5790AB] p-4 md:p-6 rounded-2xl shadow-lg flex-1 card-hover animate-slideInLeft" style={{ animationDelay: '0.3s' }}>
                <div>
                  <svg width="60" height="60" viewBox="0 0 81 81" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-float">
                    <path fillRule="evenodd" clipRule="evenodd" d="M60.75 10.125C63.3326 10.1249 65.8176 11.1116 67.6966 12.8833C69.5756 14.6551 70.7066 17.0779 70.8581 19.656L70.875 20.25V67.5C70.8748 68.0619 70.7344 68.6148 70.4664 69.1086C70.1984 69.6025 69.8114 70.0216 69.3404 70.328C68.8694 70.6344 68.3294 70.8183 67.7693 70.8632C67.2093 70.908 66.6468 70.8123 66.1331 70.5847L65.7281 70.3755L56.5312 64.7122L47.331 70.3755C46.8598 70.665 46.3246 70.8343 45.7726 70.8684C45.2205 70.9026 44.6686 70.8005 44.1653 70.5713L43.794 70.3755L34.5938 64.7122L25.3935 70.3755C24.9113 70.6723 24.3622 70.843 23.7967 70.8719C23.2313 70.9008 22.6676 70.787 22.1577 70.541C21.6477 70.2949 21.2079 69.9245 20.8787 69.4638C20.5494 69.0032 20.3413 68.4671 20.2736 67.905L20.25 67.5V47.25H13.5C12.6734 47.2499 11.8755 46.9464 11.2577 46.3971C10.64 45.8478 10.2453 45.0908 10.1486 44.2699L10.125 43.875V18.5625C10.1247 16.4203 10.9392 14.3582 12.4033 12.7945C13.8674 11.2307 15.8714 10.2824 18.009 10.1419L18.5625 10.125H60.75ZM50.625 40.5H37.125C36.2299 40.5 35.3715 40.8556 34.7385 41.4885C34.1056 42.1215 33.75 42.9799 33.75 43.875C33.75 44.7701 34.1056 45.6285 34.7385 46.2615C35.3715 46.8944 36.2299 47.25 37.125 47.25H50.625C51.5201 47.25 52.3785 46.8944 53.0115 46.2615C53.6444 45.6285 54 44.7701 54 43.875C54 42.9799 53.6444 42.1215 53.0115 41.4885C52.3785 40.8556 51.5201 40.5 50.625 40.5ZM18.5625 16.875C18.1149 16.875 17.6857 17.0528 17.3693 17.3693C17.0528 17.6857 16.875 18.1149 16.875 18.5625V40.5H20.25V18.5625C20.25 18.1149 20.0722 17.6857 19.7557 17.3693C19.4393 17.0528 19.0101 16.875 18.5625 16.875ZM54 27H37.125C36.2648 27.001 35.4374 27.3303 34.8119 27.9209C34.1864 28.5114 33.81 29.3185 33.7595 30.1772C33.7091 31.0359 33.9885 31.8815 34.5406 32.5412C35.0928 33.2008 35.8759 33.6248 36.7301 33.7264L37.125 33.75H54C54.8602 33.749 55.6876 33.4197 56.3131 32.8291C56.9386 32.2386 57.315 31.4315 57.3655 30.5728C57.4159 29.7141 57.1365 28.8685 56.5844 28.2088C56.0322 27.5492 55.2491 27.1252 54.3949 27.0236L54 27Z" fill="white" />
                  </svg>
                  <p className="mt-3 mb-5 ml-2 text-base md:text-lg text-white/90">Split a new bill with friends.</p>
                </div>
                <button 
                  className="mt-4 px-4 py-2 bg-white text-[#064469] rounded-xl hover:bg-gray-100 text-sm w-fit font-medium transition-all transform hover:scale-105"
                  onClick={() => setAddModalOpen(true)}
                >
                  Split Now →
                </button>
              </div>

              <div className="flex flex-col justify-between bg-gradient-to-br from-[#9CCDDB] to-[#D0D7E1] flex-1 p-4 md:p-6 shadow-lg rounded-2xl card-hover animate-slideInRight" style={{ animationDelay: '0.4s' }}>
                <div>
                  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
                    <path fillRule="evenodd" clipRule="evenodd" d="M36.156 3.75H35.844C33.147 3.75 30.9 3.75 29.118 3.99C27.234 4.242 25.533 4.8 24.168 6.165C22.8 7.533 22.242 9.234 21.99 11.115C21.819 12.396 21.768 15.453 21.756 18.075C15.69 18.276 12.045 18.984 9.516 21.516C6 25.029 6 30.687 6 42C6 53.313 6 58.971 9.516 62.484C13.032 65.997 18.687 66 30 66H42C53.313 66 58.971 66 62.484 62.484C65.997 58.968 66 53.313 66 42C66 30.687 66 25.029 62.484 21.516C59.955 18.984 56.31 18.276 50.244 18.078C50.232 15.453 50.184 12.396 50.01 11.118C49.758 9.234 49.2 7.533 47.832 6.168C46.467 4.8 44.766 4.242 42.882 3.99C41.1 3.75 38.85 3.75 36.156 3.75ZM45.744 18.006C45.729 15.465 45.687 12.732 45.552 11.715C45.363 10.332 45.042 9.738 44.652 9.348C44.262 8.958 43.668 8.637 42.282 8.448C40.836 8.256 38.892 8.25 36 8.25C33.108 8.25 31.164 8.256 29.715 8.451C28.332 8.637 27.738 8.958 27.348 9.351C26.958 9.744 26.637 10.332 26.448 11.715C26.313 12.735 26.268 15.465 26.256 18.006C27.432 18 28.68 17.998 30 18H42C43.324 18 44.572 18.002 45.744 18.006ZM36 27.75C36.5967 27.75 37.169 27.9871 37.591 28.409C38.0129 28.831 38.25 29.4033 38.25 30V30.03C41.517 30.852 44.25 33.429 44.25 36.999C44.25 37.5957 44.0129 38.168 43.591 38.59C43.169 39.0119 42.5967 39.249 42 39.249C41.4033 39.249 40.831 39.0119 40.409 38.59C39.9871 38.168 39.75 37.5957 39.75 36.999C39.75 35.847 38.472 34.251 36 34.251C33.528 34.251 32.25 35.847 32.25 36.999C32.25 38.151 33.528 39.75 36 39.75C40.155 39.75 44.25 42.63 44.25 47.001C44.25 50.571 41.517 53.145 38.25 53.97V54C38.25 54.5967 38.0129 55.169 37.591 55.591C37.169 56.0129 36.5967 56.25 36 56.25C35.4033 56.25 34.831 56.0129 34.409 55.591C33.9871 55.169 33.75 54.5967 33.75 54V53.97C30.483 53.148 27.75 50.571 27.75 47.001C27.75 46.4043 27.9871 45.832 28.409 45.41C28.831 44.9881 29.4033 44.751 30 44.751C30.5967 44.751 31.169 44.9881 31.591 45.41C32.0129 45.832 32.25 46.4043 32.25 47.001C32.25 48.153 33.528 49.749 36 49.749C38.472 49.749 39.75 48.153 39.75 47.001C39.75 45.849 38.472 44.25 36 44.25C31.845 44.25 27.75 41.37 27.75 36.999C27.75 33.429 30.483 30.852 33.75 30.03V30C33.75 29.4033 33.9871 28.831 34.409 28.409C34.831 27.9871 35.4033 27.75 36 27.75Z" fill="#072D44" />
                  </svg>
                  <p className="mt-3 mb-5 ml-2 text-base md:text-lg text-[#072D44]">Add a personal expense.</p>
                </div>
                <button 
                  className="px-4 py-2 mt-4 text-sm font-medium text-[#072D44] transition-all bg-[#072D44]/20 rounded-xl hover:bg-[#072D44]/30 w-fit transform hover:scale-105"
                  onClick={() => setAddModalOpen(true)}
                >
                  Add Now →
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Panel */}
          <div className="flex-1 p-4 rounded-2xl md:p-6 bg-gradient-to-br from-[#064469] to-[#5790AB] animate-slideInRight card-hover">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-xl font-medium text-white md:text-2xl flex items-center gap-2">
                <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                Transactions
              </h4>
              <button className="text-sm text-white/80 hover:text-white hover:underline transition-colors">See all</button>
            </div>

            {/* Transactions Table */}
            <div className="p-4 overflow-x-auto bg-white/10 rounded-xl glass">
              <table className="w-full text-left min-w-[400px]">
                <thead className="font-medium text-white border-b-2 border-white/30">
                  <tr>
                    <th className="pb-2">Members</th>
                    <th className="px-4 pb-2">Amount</th>
                    <th className="px-2 pb-2">Description</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {bills.slice(0, 10).map((bill, index) => (
                    <>
                      <tr key={bill.id} className="h-12 border-b border-white/20 hover:bg-white/10 transition-colors animate-slideInUp" style={{ animationDelay: `${index * 0.1}s` }}>
                        <td className="flex gap-1">
                          <span className={`bg-white/20 text-white px-2 py-1 rounded-full text-xs font-semibold ${
                            bill.createdBy === currentUser.uid ? 'bg-[#9CCDDB] text-[#072D44]' : 'bg-[#D0D7E1] text-[#072D44]'
                          }`}>
                            {bill.createdBy === currentUser.uid ? 'You' : 'Friend'}
                          </span>
                          {bill.splitTo && bill.splitTo.length > 0 && (
                            bill.splitTo.map((person, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-semibold text-white rounded-full bg-white/20"
                                title={person.name}
                              >
                                {person.name?.split(' ').map(w => w[0]).join('').toUpperCase() || person.uid?.substring(0, 2).toUpperCase()}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="px-4">₹{bill.amount}</td>
                        <td className="px-2 max-w-[150px] truncate" title={bill.description}>{bill.description}</td>
                        <td>
                          <button
                            onClick={() => toggleStatus(bill.id, bill.status)}
                            className={`px-3 py-1 text-sm text-white rounded-full transition-all transform hover:scale-105 ${
                              bill.status === 'Paid' ? 'bg-green-500/80 hover:bg-green-600' : 'bg-red-500/80 hover:bg-red-600'
                            }`}
                          >
                            {bill.status || 'Pending'}
                          </button>
                        </td>
                        <td>
                          <button 
                            onClick={() => setExpandedBillId(bill.id === expandedBillId ? null : bill.id)}
                            className="text-sm text-white hover:text-gray-200 transition-colors transform hover:scale-110"
                          >
                            {bill.id === expandedBillId ? '▲' : '▼'}
                          </button>
                        </td>
                      </tr>
                      {expandedBillId === bill.id && (
                        <tr>
                          <td colSpan="5" className="px-4 py-3 rounded-lg bg-white/5 animate-slideInDown">
                            <div className="flex flex-col gap-3">
                              <h5 className="font-medium text-white flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                Payment Details:
                              </h5>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                {bill.splitTo?.map((person, idx) => (
                                  <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                                    <span className="font-medium text-white">{person.name}</span>
                                    <button
                                      onClick={() => togglePaymentStatus(bill.id, person.uid, bill.paidBy || [])}
                                      className={`px-3 py-1 text-xs rounded-full font-medium transition-all transform hover:scale-105 ${
                                        (bill.paidBy || []).some(p => p.uid === person.uid) 
                                          ? 'bg-green-500 text-white hover:bg-green-600' 
                                          : 'bg-red-500 text-white hover:bg-red-600'
                                      }`}
                                    >
                                      {(bill.paidBy || []).some(p => p.uid === person.uid) ? 'Paid ✓' : 'Pending'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {bills.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-white/70">
                        <svg className="w-16 h-16 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        No transactions yet. Start by adding your first bill!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Bill Modal */}
      <AddBillModal
        isOpen={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={async (billData) => {
          try {
            const docRef = await addDoc(collection(db, 'bills'), {
              ...billData,
              paidBy: [],
              createdAt: new Date(),
              createdBy: currentUser.uid,
              status: 'Pending'
            });

            // Send notifications to split members
            if (billData.splitTo && billData.splitTo.length > 0) {
              billData.splitTo.forEach(async (person) => {
                await addDoc(collection(db, 'notifications'), {
                  type: 'expense_split',
                  userId: person.uid,
                  senderId: currentUser.uid,
                  senderName: currentUser.displayName || currentUser.email.split('@')[0],
                  message: `${currentUser.displayName || currentUser.email.split('@')[0]} split a bill with you: ${billData.description}`,
                  billId: docRef.id,
                  amount: billData.amount,
                  read: false,
                  createdAt: serverTimestamp()
                });
              });
            }

            console.log('Bill saved with ID:', docRef.id);
          } catch (error) {
            console.error('Error adding bill:', error);
          }
        }}
      />
    </div>
  );
}

export default ExpenseTracker;