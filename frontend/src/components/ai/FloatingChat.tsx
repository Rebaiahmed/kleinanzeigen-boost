import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Bot, User } from 'lucide-react';

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: 'Hallo! Ich bin dein KleinanzeigenBoost Assistent. Wie kann ich helfen?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInputValue('');
    setIsTyping(true);

    // Mock streaming response
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: `Hier ist eine simulierte Antwort auf: "${text}". In der finalen Version wird dieser Text über SSE von OpenAI gestreamt.` }]);
    }, 1500);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-transform hover:scale-105 ${isOpen ? 'hidden' : 'block'}`}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl border border-ka-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          
          {/* Header */}
          <div className="bg-purple-600 text-white p-4 flex justify-between items-center shadow-sm z-10">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-5 h-5" />
              KI-Assistent
            </div>
            <button onClick={() => setIsOpen(false)} className="text-purple-100 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-ka-gray-50 flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-ka-green text-white' : 'bg-purple-100 text-purple-600'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-ka-green text-white rounded-tr-none' : 'bg-white border border-ka-gray-100 rounded-tl-none text-ka-gray-900'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3 bg-white border border-ka-gray-100 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-ka-gray-200">
            {/* Prompt Chips */}
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              <button onClick={() => handleSend("Welche Anzeige soll ich optimieren?")} className="shrink-0 whitespace-nowrap text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-full px-3 py-1.5 transition-colors">
                Welche Anzeige soll ich optimieren?
              </button>
              <button onClick={() => handleSend("Warum schlägt mein Repost fehl?")} className="shrink-0 whitespace-nowrap text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-full px-3 py-1.5 transition-colors">
                Warum schlägt mein Repost fehl?
              </button>
              <button onClick={() => handleSend("Beste Zeit zum Reposten?")} className="shrink-0 whitespace-nowrap text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-full px-3 py-1.5 transition-colors">
                Beste Zeit zum Reposten?
              </button>
            </div>

            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
              className="flex gap-2"
            >
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Frag mich etwas..." 
                className="flex-1 border border-ka-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
              />
              <button 
                type="submit" 
                disabled={!inputValue.trim()}
                className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:bg-ka-gray-300 disabled:cursor-not-allowed text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                <Send className="w-4 h-4 ml-[-2px]" />
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
}
