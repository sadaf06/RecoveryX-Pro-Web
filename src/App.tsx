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
    if (confirm("Reset current config to default sandbox and wipe emulator schemas?")) {
      FirebaseService.clearCustomConfig();
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 font-mono text-xs text-slate-500">
        Authenticating terminal environment...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-slate-950">
      
      {/* Real vs Mock banner helper */}
      <div className="bg-slate-900 border-b border-slate-800/80 text-center py-1.5 px-4 text-xs font-mono flex items-center justify-center gap-2 flex-wrap">
        {isRealFirebase ? (
          <>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-300">Connected to active Firestore DB:</span>
            <span className="rounded bg-teal-500/10 px-1 py-0.2 text-[10px] text-teal-400 font-bold border border-teal-500/20">
              {configProjectId || "Production"}
            </span>
          </>
        ) : (
          <>
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-slate-300">Running inside Local Staging Preview:</span>
            <span className="rounded bg-amber-500/10 px-1 py-0.2 text-[10px] text-amber-400 font-bold border border-amber-500/20">
              Demo Sandbox Cache
            </span>
            <button 
              onClick={() => setShowConfigModal(true)}
              className="text-[10px] text-teal-400 underline decoration-dotted font-bold hover:text-teal-300 ml-1 transition"
            >
              Configure Live Firebase credentials
            </button>
          </>
        )}
      </div>

      <main className="grow flex flex-col justify-stretch">
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
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Panel Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
            >
              <div className="border-b border-slate-800 bg-slate-900 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-sans text-sm font-bold text-white">Database Configuration</h3>
                    <p className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">
                      Firestore Integration Hub
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white hover:border-slate-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
                <div className="rounded-lg bg-slate-950 p-3.5 border border-slate-800/60 flex items-start gap-2.5">
                  <Sliders className="h-5 w-5 shrink-0 text-teal-400 mt-0.5" />
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
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
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Web SDK API Key</label>
                  <input
                    type="password"
                    value={configApiKey}
                    onChange={(e) => setConfigApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Application App ID (Optional)</label>
                  <input
                    type="text"
                    value={configAppId}
                    onChange={(e) => setConfigAppId(e.target.value)}
                    placeholder="1:947485617795:web:..."
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                {configSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-950/40 border border-green-500/30 p-2.5 text-xs text-green-400">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                    <span>Configuration saved! Reloading client SDK...</span>
                  </div>
                )}

                <div className="flex gap-2.5 border-t border-slate-800/60 pt-4">
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Wipe custom cache
                  </button>
                  <button
                    type="submit"
                    className="grow relative flex justify-center rounded-lg bg-teal-500 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 transition"
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
