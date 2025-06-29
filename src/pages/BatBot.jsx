import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useState } from 'react';

function BatBot() {
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  const handleAskBatBot = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    const updatedChat = [...chat, { sender: 'user', text: userMsg }];
    setChat(updatedChat);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:5001/noctify-43111/us-central1/batBot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg }),
      });

      const data = await res.json();

      console.log('BatBot response:', data);

      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }

      const finalChat = [...updatedChat, {
        sender: 'batbot',
        text: data.reply || "🦇 The Bat-Signal seems to be down. Try again, citizen!"
      }];
      setChat(finalChat);

      // Update chat history
      if (!currentChatId) {
        const newChatId = Date.now();
        setCurrentChatId(newChatId);
        setChatHistory(prev => [
          ...prev,
          {
            id: newChatId,
            title: userMsg.substring(0, 30) + (userMsg.length > 30 ? '...' : ''),
            lastMessage: data.reply.substring(0, 50) + (data.reply.length > 50 ? '...' : '')
          }
        ]);
      } else {
        setChatHistory(prev =>
          prev.map(item =>
            item.id === currentChatId
              ? {
                  ...item,
                  lastMessage: data.reply.substring(0, 50) + (data.reply.length > 50 ? '...' : '')
                }
              : item
          )
        );
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Full error:', error);
      setChat(prev => [...prev, { 
        sender: 'batbot', 
        text: "🦇 Alfred reports: " + error.message 
      }]);
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setChat([]);
    setCurrentChatId(null);
  };

  const loadChatHistory = (chatId) => {
    setCurrentChatId(chatId);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-white md:flex-row">
      {/* Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-col w-full p-4">
        <Navbar />
        <h2 className="text-3xl font-light text-[#5E000C] mt-6 mb-4 ml-2">"Call me Bat-Bot"</h2>

        <div className="flex flex-col gap-6 md:flex-row">
          {/* Chat Section */}
          <div className="flex flex-1 rounded-2xl bg-[#EEEEFF] shadow-lg overflow-hidden min-h-[500px] mr-0 md:mr-10 mt-3 border-[#6163A8] border-[1px]" style={{ boxShadow: '0px 4px 15px 5px #6163A8' }}>
            {/* Left - Chat History Sidebar */}
            <div className="w-full md:w-1/3 bg-[#3F3E8C] text-white flex flex-col py-4">
              <div className="flex items-center justify-between px-4 mb-4">
                <h3 className="text-sm font-medium text-white">Chat History</h3>
                <button 
                  onClick={startNewChat}
                  className="text-xs bg-[#5353ff] hover:bg-[#4242d6] px-2 py-1 rounded transition-colors"
                >
                  New Chat
                </button>
              </div>
              <div className="flex flex-col gap-1 px-2 overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-300">No conversations yet</p>
                ) : (
                  chatHistory.map((chatItem) => (
                    <div
                      key={chatItem.id}
                      onClick={() => loadChatHistory(chatItem.id)}
                      className={`px-3 py-2 rounded-lg cursor-pointer hover:bg-[#5353ff] transition-colors ${
                        currentChatId === chatItem.id ? 'bg-[#5353ff]' : ''
                      }`}
                    >
                      <div className="text-sm font-medium truncate">{chatItem.title}</div>
                      <div className="text-xs text-gray-300 truncate">{chatItem.lastMessage}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right - Main Chat Area */}
            <div className="hidden md:flex flex-1 flex-col bg-[#EEEEFF] p-4 relative">
              {chat.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <svg width="147" height="147" viewBox="0 0 147 147" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M110.25 4.59375C124.031 13.7812 128.625 27.5625 128.625 36.75C128.625 73.5 128.625 110.25 119.438 142.406L114.844 110.25C101.062 119.438 82.6875 128.625 73.5 128.625C64.3125 128.625 45.9375 119.438 32.1562 110.25L27.5625 142.406C18.375 110.25 18.375 73.5 18.375 36.75C18.375 27.5625 22.9688 13.7812 36.75 4.59375C32.1562 18.375 32.1562 32.1562 36.75 41.3438C55.125 32.1562 91.875 32.1562 110.25 41.3438C114.844 32.1562 114.844 18.375 110.25 4.59375ZM110.25 78.0938C100.574 91.5305 95.3203 94.5164 78.0938 101.062C87.7119 110.25 105.513 107.235 114.844 96.4688C118.892 91.7889 116.796 83.6637 110.25 78.0938ZM36.75 78.0938C30.2039 83.6637 28.108 91.7889 32.1562 96.4688C41.4873 107.235 59.2881 110.25 68.9062 101.062C51.6797 94.5164 46.4256 91.5305 36.75 78.0938Z" fill="#9591EF" />
                  </svg>
                  <p className="text-md text-[#6366F1] bg-[#736ded6a] p-1 px-5 rounded-full mt-9 w-full text-center">Bored? Let's mess things up 😏</p>
                  <p className="text-md text-[#6366F1] bg-[#736ded6a] p-1 px-5 rounded-full mt-3 w-full text-center">In chef mode? Just ask my lord 🧎‍♂️</p>
                </div>
              ) : (
                <div className="flex-1 mb-4 overflow-y-auto">
                  {chat.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex mb-3 ${msg.sender === 'batbot' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${
                          msg.sender === 'batbot' 
                            ? 'bg-[#168594] text-white' 
                            : 'bg-[#5353ff] text-white'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start mb-3">
                      <div className="bg-[#168594] text-white px-4 py-2 rounded-xl text-sm">
                        🦇 Batman is thinking...
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Input */}
              <form onSubmit={handleAskBatBot} className="flex items-center w-full max-w-sm px-4 py-2 mt-auto bg-white rounded-full shadow-inner">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="BatBot at your service 👾..." 
                  className="flex-1 outline-none text-sm text-[#5E000C] placeholder-gray-500"
                  disabled={isLoading}
                />
                <button 
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="ml-2 w-8 h-8 bg-[#FD8839] rounded-full flex items-center justify-center hover:bg-[#F32D17] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? '...' : '↑'}
                </button>
              </form>
            </div>
          </div>

          {/* Mobile Chat View */}
          <div className="flex md:hidden flex-1 flex-col bg-[#EEEEFF] p-4 relative rounded-2xl shadow-lg border-[#6163A8] border-[1px]" style={{ boxShadow: '0px 4px 15px 5px #6163A8' }}>
            {chat.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <svg width="120" height="120" viewBox="0 0 147 147" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M110.25 4.59375C124.031 13.7812 128.625 27.5625 128.625 36.75C128.625 73.5 128.625 110.25 119.438 142.406L114.844 110.25C101.062 119.438 82.6875 128.625 73.5 128.625C64.3125 128.625 45.9375 119.438 32.1562 110.25L27.5625 142.406C18.375 110.25 18.375 73.5 18.375 36.75C18.375 27.5625 22.9688 13.7812 36.75 4.59375C32.1562 18.375 32.1562 32.1562 36.75 41.3438C55.125 32.1562 91.875 32.1562 110.25 41.3438C114.844 32.1562 114.844 18.375 110.25 4.59375ZM110.25 78.0938C100.574 91.5305 95.3203 94.5164 78.0938 101.062C87.7119 110.25 105.513 107.235 114.844 96.4688C118.892 91.7889 116.796 83.6637 110.25 78.0938ZM36.75 78.0938C30.2039 83.6637 28.108 91.7889 32.1562 96.4688C41.4873 107.235 59.2881 110.25 68.9062 101.062C51.6797 94.5164 46.4256 91.5305 36.75 78.0938Z" fill="#9591EF" />
                </svg>
                <p className="text-sm text-[#6366F1] bg-[#736ded6a] p-2 px-4 rounded-full mt-6 text-center">Bored? Let's mess things up 😏</p>
                <p className="text-sm text-[#6366F1] bg-[#736ded6a] p-2 px-4 rounded-full mt-3 text-center">In chef mode? Just ask my lord 🧎‍♂️</p>
              </div>
            ) : (
              <div className="flex-1 mb-4 overflow-y-auto">
                {chat.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex mb-3 ${msg.sender === 'batbot' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${
                        msg.sender === 'batbot' 
                          ? 'bg-[#168594] text-white' 
                          : 'bg-[#5353ff] text-white'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-3">
                    <div className="bg-[#168594] text-white px-4 py-2 rounded-xl text-sm">
                      🦇 Batman is thinking...
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Chat Input */}
            <form onSubmit={handleAskBatBot} className="flex items-center w-full px-4 py-2 mt-auto bg-white rounded-full shadow-inner">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="BatBot at your service 👾..." 
                className="flex-1 outline-none text-sm text-[#5E000C] placeholder-gray-500"
                disabled={isLoading}
              />
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className="ml-2 w-8 h-8 bg-[#FD8839] rounded-full flex items-center justify-center hover:bg-[#F32D17] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '...' : '↑'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BatBot;