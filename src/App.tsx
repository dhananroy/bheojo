import React, { useState, useEffect } from 'react';
import {
  Send,
  Scan,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Sun,
  Moon,
  Zap,
  QrCode,
} from 'lucide-react';
import { SimpleQrSender } from './components/SimpleQrSender';
import { SimpleQrReceiver } from './components/SimpleQrReceiver';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('bhejo_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [activeTab, setActiveTab] = useState<'SEND' | 'RECEIVE'>('SEND');

  useEffect(() => {
    localStorage.setItem('bhejo_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleOpenDualTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-200 ${
        isDark
          ? 'bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white'
          : 'bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white'
      }`}
    >
      {/* Top Header */}
      <header
        className={`sticky top-0 z-40 transition-colors duration-200 border-b backdrop-blur-md ${
          isDark
            ? 'bg-slate-900/75 border-slate-800/80'
            : 'bg-white/85 border-slate-200/90 shadow-xs'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* App Title & Brand */}
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 text-white ring-2 ring-white/10">
              <QrCode size={20} className="stroke-[2.3]" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Bhejo
                </h1>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    isDark
                      ? 'text-emerald-400 bg-emerald-950/70 border-emerald-800/50'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }`}
                >
                  Zero Internet
                </span>
              </div>
              <p
                className={`text-xs ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Instant screen-to-camera optical transfer
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Day / Night Theme Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isDark
                  ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-slate-700 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-xs'
              }`}
              title={isDark ? 'Switch to Day mode' : 'Switch to Night mode'}
            >
              {isDark ? (
                <>
                  <Sun size={15} className="text-amber-400" />
                  <span>Day</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-indigo-600" />
                  <span>Night</span>
                </>
              )}
            </button>

            {/* Test Dual Tab Button */}
            <button
              id="dual-tab-btn"
              onClick={handleOpenDualTab}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                isDark
                  ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="Open in new window to test sending and receiving"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">2nd Tab (Test)</span>
              <span className="sm:hidden">Test</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-5 py-3 sm:py-5 space-y-4">
        {/* Giant Main Mode Switcher: SEND vs RECEIVE */}
        <div
          className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl max-w-xs sm:max-w-sm mx-auto border shadow-xs transition-colors duration-200 ${
            isDark
              ? 'bg-slate-900/90 border-slate-800 shadow-slate-950/40'
              : 'bg-white border-slate-200/90 shadow-slate-200/50'
          }`}
        >
          <button
            id="tab-send-btn"
            onClick={() => setActiveTab('SEND')}
            className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'SEND'
                ? 'bg-blue-600 text-white shadow-xs scale-[1.02]'
                : isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Send size={15} />
            <span>Send</span>
          </button>

          <button
            id="tab-receive-btn"
            onClick={() => setActiveTab('RECEIVE')}
            className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'RECEIVE'
                ? 'bg-emerald-600 text-white shadow-xs scale-[1.02]'
                : isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Scan size={15} />
            <span>Receive</span>
          </button>
        </div>

        {/* Active Content: Sender or Receiver */}
        {activeTab === 'SEND' ? (
          <SimpleQrSender theme={theme} />
        ) : (
          <SimpleQrReceiver theme={theme} />
        )}

        {/* 3-Step Visual Guide */}
        <div
          className={`rounded-2xl p-3.5 sm:p-4 border transition-colors duration-200 max-w-4xl mx-auto ${
            isDark
              ? 'bg-slate-900/40 border-slate-800/70 text-slate-400'
              : 'bg-white border-slate-200/80 text-slate-600 shadow-xs'
          }`}
        >
          <div
            className={`flex items-center space-x-2 font-bold text-xs mb-2.5 ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            <Smartphone size={14} className="text-blue-600" />
            <span>How Bhejo works between 2 devices:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
            <div
              className={`p-2.5 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-slate-950/60 border-slate-800/70'
                  : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <span className="font-bold text-blue-600 dark:text-blue-400 block mb-0.5">
                1. Sender: Tap "Send"
              </span>
              Type a message or select a photo. An animated code appears on screen.
            </div>
            <div
              className={`p-2.5 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-slate-950/60 border-slate-800/70'
                  : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                2. Receiver: Tap "Receive"
              </span>
              Allow camera and point it straight at the sender's screen.
            </div>
            <div
              className={`p-2.5 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-slate-950/60 border-slate-800/70'
                  : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">
                3. Instant & Private
              </span>
              Fast optical stream directly between screens. 100% zero server upload.
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer
        className={`border-t py-4 mt-auto transition-colors duration-200 ${
          isDark
            ? 'border-slate-900 bg-slate-950/80'
            : 'border-slate-200/70 bg-white/70'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 text-center text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
          <div
            className={`flex items-center space-x-1.5 font-medium ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Bhejo • 100% Offline Optical Data Stream</span>
          </div>
          <div className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            Screen-to-Camera transfer • No accounts, no servers
          </div>
        </div>
      </footer>
    </div>
  );
}
