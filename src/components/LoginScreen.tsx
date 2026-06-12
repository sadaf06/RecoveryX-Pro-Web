/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User } from "../types";
import { FirebaseService } from "../firebase";
import { Shield, Smartphone, Key, RefreshCw, Eye, EyeOff, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [usernameOrMobile, setUsernameOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // First time login state
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrMobile.trim() || !password.trim()) {
      setError("Please fill in both username/mobile and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Look up user in the firebase/local database
      const users = await FirebaseService.getUsers();
      const matched = users.find(u => 
        (u.mobile || "").trim().toLowerCase() === usernameOrMobile.trim().toLowerCase() ||
        (u.name || "").trim().toLowerCase() === usernameOrMobile.trim().toLowerCase()
      );

      if (!matched) {
        setError("Account not found. Please verify your username or mobile number.");
        setLoading(false);
        return;
      }

      if (matched.status === "DISABLED") {
        setError("This account has been disabled. Please contact your administrator.");
        setLoading(false);
        return;
      }

      // Plain/Mock password verification (in live, mapped securely or checked)
      if (matched.password !== password.trim()) {
        setError("Incorrect password. Please try again.");
        setLoading(false);
        return;
      }

      // Check if OTP verification is forced for first time
      if (matched.is_first_time) {
        setPendingUser(matched);
        setGeneratedOtp(Math.floor(1000 + Math.random() * 9000).toString());
        setError("");
      } else {
        onLoginSuccess(matched);
      }
    } catch (err: any) {
      setError("An error occurred during authentication. Please retry.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpValue.trim()) {
      setError("Please enter the OTP shown on screen.");
      return;
    }

    if (otpValue !== generatedOtp) {
      setError("Incorrect OTP entered.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (pendingUser) {
        // Update user in Firestore/Local DB
        await FirebaseService.updateUser(pendingUser.mobile, {
          is_first_time: false
        });

        setSuccessMsg("Device verified successfully! Signing you in...");
        
        // Log in immediately
        setTimeout(() => {
          onLoginSuccess({
            ...pendingUser,
            is_first_time: false
          });
        }, 1200);
      }
    } catch (err) {
      setError("Failed to verify. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center px-2 py-3 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-4 rounded-2xl liquid-glass p-5 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] sm:p-7 relative overflow-hidden shrink-0"
      >
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Shield className="h-5.5 w-5.5" id="shield-logo" />
          </div>
          <h2 className="mt-3.5 font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            RecoveryX Pro
          </h2>
          <p className="mt-1 text-[8.5px] text-cyan-400/80 font-mono tracking-widest uppercase font-bold">
            Professional Fleet Identity System
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!pendingUser ? (
            // Standard LOGIN form
            <motion.form 
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleLogin} 
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Username or Mobile
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    id="login-mobile-input"
                    value={usernameOrMobile}
                    onChange={(e) => setUsernameOrMobile(e.target.value)}
                    className="block w-full py-3 pl-10 pr-3 text-sm text-white placeholder-slate-600 outline-none transition-all glass-input font-mono"
                    placeholder="Enter username or mobile"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Password
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Key className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="login-password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full py-3 pl-10 pr-10 text-sm text-white placeholder-slate-600 outline-none transition-all glass-input font-mono"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-red-950/20 border border-red-500/20 p-3 text-xs text-red-300 leading-relaxed font-sans font-medium"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                id="login-submit-btn"
                disabled={loading}
                className="relative flex w-full justify-center rounded-lg py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/10 cursor-pointer glass-btn-primary disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-white" />
                ) : (
                  "Authenticate Device"
                )}
              </button>
            </motion.form>
          ) : (
            // FORCED OTP Device Verification form
            <motion.form 
              key="force-reset"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleVerifyOtp} 
              className="mt-4 space-y-3.5"
            >
              <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/15 p-3.5 text-left">
                <p className="text-[10px] font-bold text-indigo-400 font-mono uppercase tracking-widest flex items-center gap-1.5">
                  🛡️ First Time Device Verification
                </p>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-sans font-medium">
                  Welcome to the platform! Since this is your first sign-in log, you are required to verify the device.
                </p>
                <div className="mt-4 flex items-center justify-center p-4 border border-white/5 bg-slate-950/80 rounded-lg shadow-inner">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">Your verification code</p>
                    <p className="text-3xl font-mono font-black tracking-widest text-indigo-400 select-all">{generatedOtp}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono pb-1">
                  Enter Secure OTP
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    id="otp-input"
                    value={otpValue}
                    onChange={(e) => setOtpValue(e.target.value.trim().replace(/\D/g, ""))}
                    maxLength={4}
                    className="block w-full py-3 pl-10 pr-3 font-mono text-center text-xl tracking-[0.5em] text-white placeholder-slate-600 outline-none transition-all glass-input"
                    placeholder="____"
                    disabled={loading || !!successMsg}
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-950/20 border border-red-500/20 p-3 text-xs text-red-300 font-sans font-medium">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-green-950/20 border border-green-500/20 p-3 text-xs text-green-300 font-sans font-medium">
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                id="force-password-change-submit"
                disabled={loading || !!successMsg}
                className="relative flex w-full justify-center rounded-lg py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/10 cursor-pointer glass-btn-primary disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-white" />
                ) : (
                  "Verify & Complete Setup"
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between border-t border-white/5 pt-4 text-center">
          <p className="text-[10px] text-slate-500 font-mono tracking-tight text-center w-full font-semibold">
            Agent terminal connection encrypted under Firestore integrity standards.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
