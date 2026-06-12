/// <reference types="vite/client" />

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, FirebaseConnectionConfig } from "./types";
import { FirebaseService, isRealFirebase } from "./firebase";
import LoginScreen from "./components/LoginScreen";
import AgentView from "./components/AgentView";
import StaffControlBoard from "./components/StaffControlBoard";
import { 
  Database, 
  Settings, 
  X, 
  CheckCircle, 
  Smartphone, 
  Sparkles, 
  Lock, 
  HelpCircle,
  TrendingUp,
  Sliders,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Settings Panel state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configApiKey, setConfigApiKey] = useState("");
  const [configProjectId, setConfigProjectId] = useState("");
  const [configAppId, setConfigAppId] = useState("");
  const [configSuccess, setConfigSuccess] = useState(false);
  const [resetClicked, setResetClicked] = useState(false);

  // Load session from localStorage on mount (persistent login) and set document title
  useEffect(() => {
    document.title = "RecoveryX Pro";
    const cachedUser = localStorage.getItem("ACTIVE_USER_SESSION");
    if (cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser));
      } catch (e) {
        console.error("Failed to parse session cache", e);
      }
    }
    setAuthLoading(false);

    // Initialize config values if they exist
    const localConfigStr = localStorage.getItem("COMPANION_CUSTOM_FIREBASE_CONFIG");
    if (localConfigStr) {
      try {
        const parsed: FirebaseConnectionConfig = JSON.parse(localConfigStr);
        setConfigApiKey(parsed.apiKey || "");
        setConfigProjectId(parsed.projectId || "");
        setConfigAppId(parsed.appId || "");
      } catch (e) {}
    } else {
      setConfigApiKey(import.meta.env.VITE_FIREBASE_API_KEY || "");
      setConfigProjectId(import.meta.env.VITE_FIREBASE_PROJECT_ID || "");
      setConfigAppId(import.meta.env.VITE_FIREBASE_APP_ID || "");
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("ACTIVE_USER_SESSION", JSON.stringify(user));
  };

  // 🚨 SECURITY OVERRIDE ON LOGOUT (Instructed precisely by user):
  // When logging out, clear ALL local cache trackers, LocalStorage, IndexedDB records, and
  // temporary session vehicles IMMEDIATELY so no trace remains in browser memory under inspect.
  const handleLogout = () => {
    // 1. Clear session
    setCurrentUser(null);
    sessionStorage.clear();

    // 2. Clear caches and LocalStorage
    // We clear all vehicle logs, search histories, permissions caches and credentials
    const itemsToClear = [
      "ACTIVE_USER_SESSION",
      `VEHICLE_CACHE_${currentUser?.creator_mobile}`,
      `VEHICLE_CACHE_TIME_${currentUser?.creator_mobile}`,
      "MOCK_FIRESTORE_uploaded_files",
      "MOCK_FIRESTORE_search_histories"
    ];
    itemsToClear.forEach(item => localStorage.removeItem(item));

    // Optional: Fully wipe localStorage (except custom configs if the user configured them)
    const customConfigBackup = localStorage.getItem("COMPANION_CUSTOM_FIREBASE_CONFIG");
    localStorage.clear();
    if (customConfigBackup) {
      localStorage.setItem("COMPANION_CUSTOM_FIREBASE_CONFIG", customConfigBackup);
    }

    console.log("Security Override Active: Memory cache cleared completely on logout.");
    window.location.reload(); // Force hard reload to wipe runtime variables in JS closure engine!
  };

  // Custom configuration submission
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configApiKey.trim() || !configProjectId.trim()) {
      alert("API Key and Project ID are minimum required entries.");
      return;
    }

    const config: FirebaseConnectionConfig = {
      apiKey: configApiKey.trim(),
      authDomain: `${configProjectId.trim()}.firebaseapp.com`,
      projectId: configProjectId.trim(),
      storageBucket: `${configProjectId.trim()}.appspot.com`,
      messagingSenderId: "",
      appId: configAppId.trim()
    };

    FirebaseService.saveCustomConfig(config);
    setConfigSuccess(true);
    setTimeout(() => {
      setShowConfigModal(false);
      setConfigSuccess(false);
    }, 1000);
  };

  const handleResetConfig = () => {
    if (!resetClicked) {
      setResetClicked(true);
      setTimeout(() => setResetClicked(false), 3000); // revert to original state after 3s
      return;
    }
    FirebaseService.clearCustomConfig();
    setResetClicked(false);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#06080F] font-mono text-xs text-indigo-400">
        <div className="flex flex-col items-center gap-3">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="tracking-widest uppercase text-[10px] font-bold">Authenticating SECURE Core Enclave...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-full liquid-bg text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white p-2.5 sm:p-4 box-border overflow-hidden relative z-10 font-sans">
      
      {/* Real vs Mock banner helper - Redesigned as a premium glassy metadata anchor */}
      <div className="bg-slate-950/40 border border-white/5 rounded-xl text-center py-1.5 px-3 text-[10.5px] font-mono flex items-center justify-center gap-1.5 flex-wrap backdrop-blur-md z-30 shrink-0">
        {isRealFirebase ? (
          <>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-slate-400 font-sans font-medium">Secure Core Active:</span>
            <span className="rounded-md glass-badge-green px-2 py-0.5 text-[8.5px] font-bold tracking-wider">
              {configProjectId || "Production"}
            </span>
          </>
        ) : (
          <>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
            </span>
            <span className="text-slate-400 font-sans text-[10px] font-medium">Environment Mirror:</span>
            <span className="rounded-md glass-badge-amber px-1.5 py-0.2 text-[8px] font-bold tracking-wider">
              DEMO SANDBOX ACTIVE
            </span>
            <button 
              onClick={() => setShowConfigModal(true)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:underline ml-1 transition-colors font-sans"
            >
              Configure Firebase
            </button>
          </>
        )}
      </div>

      <main className="grow flex flex-col justify-stretch overflow-hidden min-h-0 mt-2">
        {!currentUser ? (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        ) : (currentUser.role === "NORMAL_USER" || currentUser.role === "OFFICE_STAFF") ? (
          <AgentView user={currentUser} onLogout={handleLogout} />
        ) : (
          <StaffControlBoard user={currentUser} onLogout={handleLogout} />
        )}
      </main>



      {/* Developer Config Setting Drawer / Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfigModal(false)}
              className="absolute inset-0 bg-[#03050A]/75 backdrop-blur-md"
            />

            {/* Panel Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl glass-container shadow-2xl"
            >
              <div className="border-b border-white/5 bg-white/[0.02] px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white tracking-tight">Database Configuration</h3>
                    <p className="font-mono text-[9px] text-indigo-400/80 uppercase tracking-widest font-bold">
                      Firestore Integration Hub
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-lg border border-white/5 bg-white/[0.04] hover:bg-white/[0.08] p-1.5 text-slate-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
                <div className="rounded-lg bg-indigo-950/20 p-3.5 border border-indigo-500/10 flex items-start gap-2.5">
                  <Sliders className="h-5 w-5 shrink-0 text-indigo-400 mt-0.5" />
                  <p className="text-[11px] text-indigo-200/75 leading-relaxed font-sans font-medium">
                    By default, this applet hooks into environment variables. To mirror and inspect your own active Firestore project, paste your client keys below.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Firebase Project ID</label>
                  <input
                    type="text"
                    value={configProjectId}
                    onChange={(e) => setConfigProjectId(e.target.value)}
                    placeholder="Enter project ID (e.g. repo-tracker-343)"
                    className="block w-full rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none glass-input font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Web SDK API Key</label>
                  <input
                    type="password"
                    value={configApiKey}
                    onChange={(e) => setConfigApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="block w-full rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none glass-input font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Application App ID (Optional)</label>
                  <input
                    type="text"
                    value={configAppId}
                    onChange={(e) => setConfigAppId(e.target.value)}
                    placeholder="1:947485617795:web:..."
                    className="block w-full rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none glass-input font-mono"
                  />
                </div>

                {configSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-950/40 border border-green-500/30 p-2.5 text-xs text-green-400">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                    <span>Configuration saved! Reloading client SDK...</span>
                  </div>
                )}

                <div className="flex gap-2.5 border-t border-white/5 pt-4">
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                      resetClicked 
                        ? "bg-rose-500/10 border border-rose-500/40 text-rose-400 hover:bg-rose-500 hover:text-white" 
                        : "glass-btn-secondary text-slate-400 hover:text-white"
                    }`}
                  >
                    {resetClicked ? "Tap to Confirm Wipe" : "Wipe custom cache"}
                  </button>
                  <button
                    type="submit"
                    className="grow relative flex justify-center rounded-lg py-2 text-xs font-bold text-white glass-btn-primary cursor-pointer"
                  >
                    Apply Config & Boot
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
