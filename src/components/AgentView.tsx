/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { User, Vehicle, FieldPermissions, SearchHistory } from "../types";
import { FirebaseService } from "../firebase";
import { 
  Search, 
  RefreshCw,
  Lock, 
  X, 
  CheckCircle,
  Grid,
  Building,
  Car,
  MapPin,
  Key,
  ShieldCheck,
  User as UserIcon,
  Cpu,
  AlertTriangle,
  Coins,
  Sparkles,
  Layers,
  Activity,
  Smartphone,
  Database,
  Share2,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AgentViewProps {
  user: User;
  onLogout: () => void;
  isInsideAdmin?: boolean;
}

type FilterType = "GENERAL" | "VEHICLE_LAST_4" | "ENGINE_LAST_4" | "CHASSIS_LAST_4" | "LOAN_STARTS";

export default function AgentView({ user, onLogout, isInsideAdmin }: AgentViewProps) {
  // Determine creator mobile of interest based on active user's roles
  const targetCreatorMobile = useMemo(() => {
    if (user.role === "SUPER_ADMIN" || user.role === "OFFICE_STAFF") return undefined; // All vehicles for super admin and office staff
    if (user.role === "ADMIN") return user.mobile;     // Creator of own uploaded vehicles
    return user.creator_mobile || user.mobile;         // Creator for normal user
  }, [user]);

  const targetCacheKey = useMemo(() => {
    return targetCreatorMobile || "all_users";
  }, [targetCreatorMobile]);

  // Database cache, permissions, and logs state
  const [cachedVehicles, setCachedVehicles] = useState<Vehicle[]>([]);
  const [permissions, setPermissions] = useState<FieldPermissions | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>("");

  // Search filter and queries
  const [searchFilter, setSearchFilter] = useState<FilterType>("VEHICLE_LAST_4");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Helper to fetch custom permissions based on role hierarchy
  const fetchActivePermissions = async (): Promise<FieldPermissions> => {
    if (user.role === "SUPER_ADMIN" || user.role === "OFFICE_STAFF") {
      return {
        role_string: "unmasked_all",
        role: "ADMIN",
        show_customer_name: true,
        show_vehicle_number: true,
        show_bank_name: true,
        show_pos: true,
        show_emi: true,
        show_engine_number: true,
        show_chassis_number: true,
        show_confirmer_name: true,
        show_loan_no: true,
        show_file_name: false,
        show_bucket: false
      };
    }
    if (user.role === "ADMIN") {
      return await FirebaseService.getFieldPermissions(user.mobile, "ADMIN");
    }
    // NORMAL_USER (Field agent) sees what the Admin permitted specifically for normal users
    return await FirebaseService.getFieldPermissions(user.creator_mobile || "admin", "NORMAL_USER");
  };

  // Handle Action
  const handleSyncData = async () => {
    setSyncing(true);
    try {
      const vehicles = await FirebaseService.syncData(targetCreatorMobile);
      setCachedVehicles(vehicles);
      localStorage.setItem(`VEHICLE_CACHE_${targetCacheKey}`, JSON.stringify(vehicles));
      const syncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSynced(syncTime);
      localStorage.setItem(`VEHICLE_CACHE_TIME_${targetCacheKey}`, syncTime);

      const perms = await fetchActivePermissions();
      setPermissions(perms);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setSyncing(false);
      }, 300);
    }
  };

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const perms = await fetchActivePermissions();
        setPermissions(perms);
      } catch (e) {
        console.error("Failed to fetch permissions layout", e);
      }
    };
    loadPermissions();

    const localCacheStr = localStorage.getItem(`VEHICLE_CACHE_${targetCacheKey}`);
    const localTimeStr = localStorage.getItem(`VEHICLE_CACHE_TIME_${targetCacheKey}`);
    if (localCacheStr) {
      try {
        const parsed = JSON.parse(localCacheStr);
        setCachedVehicles(parsed);
        if (localTimeStr) setLastSynced(localTimeStr);
      } catch (e) {
        console.error("Failed to parse local vehicles cache", e);
      }
    } else {
      handleSyncData();
    }
  }, [targetCreatorMobile, targetCacheKey]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const normQuery = searchQuery.trim().toLowerCase();
    
    // First, filter all matching vehicles
    const rawFiltered = cachedVehicles.filter(v => {
      switch (searchFilter) {
        case "GENERAL":
          return (
            (v.registration_number || "").toLowerCase().includes(normQuery) ||
            (v.owner || "").toLowerCase().includes(normQuery) ||
            (v.bank_name || "").toLowerCase().includes(normQuery) ||
            (v.model || "").toLowerCase().includes(normQuery) ||
            (v.pos || "").toLowerCase().includes(normQuery) ||
            (v.loan_no || "").toLowerCase().includes(normQuery) ||
            (v.engine_number || "").toLowerCase().includes(normQuery) ||
            (v.chassis_number || "").toLowerCase().includes(normQuery)
          );
        case "VEHICLE_LAST_4": {
          const cleanReg = (v.registration_number || "").replace(/\s+/g, "");
          return cleanReg.toLowerCase().includes(normQuery.replace(/\s+/g, ""));
        }
        case "ENGINE_LAST_4": {
          const cleanEng = (v.engine_number || "").replace(/\s+/g, "");
          return cleanEng.toLowerCase().includes(normQuery.replace(/\s+/g, ""));
        }
        case "CHASSIS_LAST_4": {
          const cleanChas = (v.chassis_number || "").replace(/\s+/g, "");
          return cleanChas.toLowerCase().includes(normQuery.replace(/\s+/g, ""));
        }
        case "LOAN_STARTS":
          return (v.loan_no || "").toLowerCase().includes(normQuery.replace(/\s+/g, ""));
        default:
          return false;
      }
    });

    // Then, deduplicate by registration_number
    const dedupedMap = new Map<string, Vehicle>();
    rawFiltered.forEach(v => {
      const regNo = (v.registration_number || "").toUpperCase().trim();
      if (!dedupedMap.has(regNo)) {
        dedupedMap.set(regNo, v);
      }
    });

    return Array.from(dedupedMap.values());
  }, [cachedVehicles, searchQuery, searchFilter]);

  const selectedMatches = useMemo(() => {
    if (!selectedVehicle) return [];
    const regNo = (selectedVehicle.registration_number || "").toUpperCase().trim();
    return cachedVehicles.filter(v => (v.registration_number || "").toUpperCase().trim() === regNo);
  }, [selectedVehicle, cachedVehicles]);

  const handleSelectCard = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const historyLog: SearchHistory = {
        user_mobile: user.mobile,
        user_name: user.name,
        vehicle_number: vehicle.registration_number,
        model: vehicle.model,
        timestamp: new Date().toISOString(),
        creator_mobile: user.creator_mobile || user.mobile
      };
      await FirebaseService.addSearchHistory(historyLog);
    } catch (e) {
      console.error("Failed to construct audit trail", e);
    }
  };

  const renderField = (fieldKey: keyof FieldPermissions, value: string) => {
    const isBypass = user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "OFFICE_STAFF";
    const isAllowed = isBypass ? true : (permissions ? permissions[fieldKey] === true : true);
    if (isAllowed) return value || "N/A";
    return (
      <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider font-bold uppercase shrink-0">
        <Lock className="h-3 w-3" /> Locked
      </span>
    );
  };

  const handleShareText = async () => {
    if (!selectedVehicle) return;
    const isMasked = (fieldKey: keyof FieldPermissions) => {
      const isBypass = user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "OFFICE_STAFF";
      return !(isBypass ? true : (permissions ? permissions[fieldKey] === true : true));
    };
    
    const text = `Registry Dossier
Owner: ${isMasked("show_customer_name") ? "LOCKED" : selectedVehicle.owner || "N/A"}
Reg No: ${isMasked("show_vehicle_number") ? "LOCKED" : selectedVehicle.registration_number || "N/A"}
Bank: ${isMasked("show_bank_name") && user.role === "NORMAL_USER" ? "LOCKED" : selectedVehicle.bank_name || "N/A"}
POS: ${isMasked("show_pos") ? "LOCKED" : selectedVehicle.pos || "N/A"}
EMI: ${isMasked("show_emi") ? "LOCKED" : selectedVehicle.emi || "N/A"}
Bucket: ${isMasked("show_bucket") ? "LOCKED" : selectedVehicle.bucket || "N/A"}
Loan No: ${isMasked("show_loan_no") ? "LOCKED" : selectedVehicle.loan_no || "N/A"}
Engine: ${isMasked("show_engine_number") ? "LOCKED" : selectedVehicle.engine_number || "N/A"}
Chassis: ${isMasked("show_chassis_number") ? "LOCKED" : selectedVehicle.chassis_number || "N/A"}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Secure Asset Registry", text });
      } catch (e) {
        console.error("Share failed", e);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Dossier copied to clipboard!");
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="h-screen bg-[#0A0D14] text-slate-100 flex flex-col overflow-hidden relative font-sans">
      {/* Decorative premium radial vector ambient lights */}
      <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Header Panel - Re-engineered for Multi-Million Dollar Aesthetic - COMPACT VERSION */}
      <div className="shrink-0 z-20 border-b border-white/5 bg-[#0F1218]/90 shadow-2xl backdrop-blur-xl p-2 sm:p-3 flex items-center justify-between gap-4">
        {/* Title / Identity block */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/5 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="hidden xs:block">
            <div className="flex items-center gap-2">
              <h1 className="font-sans text-[10px] sm:text-xs font-black tracking-widest text-white uppercase">
                RecoveryX Pro Wb
              </h1>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[8px] font-bold text-indigo-400 uppercase tracking-widest hidden sm:inline-block">
                {user.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
              <span className="hidden sm:inline">Secure Terminal • </span><span className="text-slate-400 font-mono">{user.name}</span>
            </p>
          </div>
        </div>

        {/* Global registry live status and workstation controller actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2 bg-[#0A0D14]/80 border border-white/5 rounded-lg px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-semibold text-slate-300">
              Index: <strong className="text-white font-mono">{cachedVehicles.length.toLocaleString()}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSyncData}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg bg-[#2D2A1E] hover:bg-[#3d3928] border border-amber-500/20 text-amber-400 px-2.5 py-1.5 text-[10px] font-bold font-sans transition-all active:scale-95"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Registry</span>
              <span className="sm:hidden">Sync</span>
            </button>
            <button
              onClick={onLogout}
              className="rounded-lg bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/25 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:text-rose-400 transition-all active:scale-95"
            >
              {isInsideAdmin ? "Return" : "Lockout"}
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Modern Workstation Command Bar - COMPACT VERSION */}
      <div className="shrink-0 z-10 border-b border-white/5 bg-[#171A21]/40 px-2 py-2 sm:px-3 flex items-center gap-2">
        {/* Custom triggers for search targeting */}
        <div className="relative flex items-center bg-[#0A0D14] border border-white/10 rounded-lg p-0.5 shrink-0">
          <select
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value as FilterType);
              setSearchQuery("");
            }}
            className="appearance-none font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-transparent pr-6 pl-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="VEHICLE_LAST_4" className="bg-[#12141C]">Plate</option>
            <option value="GENERAL" className="bg-[#12141C]">Omni</option>
            <option value="ENGINE_LAST_4" className="bg-[#12141C]">Engine</option>
            <option value="CHASSIS_LAST_4" className="bg-[#12141C]">Chassis</option>
            <option value="LOAN_STARTS" className="bg-[#12141C]">Agreemnt</option>
          </select>
          <div className="absolute right-2 pointer-events-none text-indigo-400">
            <span className="text-[7px] font-sans">▼</span>
          </div>
        </div>

        {/* Premium search field with adaptive placeholder */}
        <div className="relative grow">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchFilter === "VEHICLE_LAST_4" ? "Plate indices..." :
              searchFilter === "ENGINE_LAST_4" ? "Engine codes..." :
              searchFilter === "CHASSIS_LAST_4" ? "Chassis codes..." :
              searchFilter === "LOAN_STARTS" ? "Loan tokens..." : "Omni database..."
            }
            className="block w-full rounded-lg border border-white/10 bg-[#0A0D14] py-2 pl-9 pr-9 text-xs text-white placeholder-slate-600 outline-none transition-all duration-300 focus:border-indigo-500 focus:ring-0.5 focus:ring-indigo-500 font-mono tracking-wide"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>


      {/* Main command layout search result view area */}
      <div className="grow overflow-y-auto p-4 sm:p-6 bg-[#0A0D14]/40 z-10 animate-fade-in">
        {!searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 max-w-sm mx-auto">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-xl shadow-indigo-500/5">
              <div className="absolute inset-0 bg-indigo-500/5 rounded-3xl animate-ping" />
              <Search className="h-8 w-8 text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold tracking-tight text-white font-sans">Ready for Query lookup</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Type above to trigger instant offline searches from secure cached index database files.
              </p>
            </div>
            {/* Detailed performance stats block */}
            <div className="w-full bg-[#1A1D24]/65 border border-white/5 rounded-2xl p-4.5 space-y-3.5 text-left shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Subscribed Index</p>
                  <p className="text-xs font-bold text-white mt-0.5">{cachedVehicles.length.toLocaleString()} Loaded Assets</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Client Security Enclave</p>
                  <p className="text-xs font-bold text-emerald-400 mt-0.5">Offline Protection Active</p>
                </div>
              </div>
              {lastSynced && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Telemetry Handshake</p>
                    <p className="text-xs font-mono font-bold text-slate-300 mt-0.5">Synchronized: {lastSynced}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3 max-w-sm mx-auto">
            <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/25 text-rose-400 shadow-xl shadow-rose-500/5">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">No Vehicles Discovered</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                The indexing system searched cached nodes but found no metrics. Check spelling or adjust lookup context filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 pb-8 auto-rows-max animate-fade-in" id="vehicles-search-grid">
            {filteredVehicles.map(v => (
              <motion.div
                key={v.id}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectCard(v)}
                className="group relative cursor-pointer rounded-xl border border-white/5 bg-[#1A1D24]/90 p-2.5 hover:border-indigo-500/30 hover:bg-[#20242D] transition-all duration-300 flex flex-col justify-between h-[85px] shadow-xl hover:shadow-indigo-500/5 overflow-hidden"
              >
                {/* Visual accent top corner glow */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative flex items-center justify-between gap-1 w-full min-w-0 text-[10px]">
                  <span className="font-bold text-slate-300 truncate flex-1" title={v.owner}>
                    {renderField("show_customer_name", v.owner)}
                  </span>
                  {user.role !== "NORMAL_USER" && (
                    <span className="text-[9px] font-bold text-indigo-400 shrink-0 truncate max-w-[45%] bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/10" title={v.bank_name || "Creditor"}>
                      {renderField("show_bank_name", v.bank_name || "Creditor")}
                    </span>
                  )}
                </div>

                <div className="bg-gradient-to-b from-[#0A0D14] to-[#12141C] border border-white/5 px-2 py-1 rounded-lg text-center shadow-inner group-hover:border-indigo-500/20 transition-colors">
                  <p className="font-mono text-xs font-black tracking-widest text-[#F8FAFC]">
                    {renderField("show_vehicle_number", v.registration_number)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Enterprise dossiers layout details window modal */}
      <AnimatePresence>
        {selectedVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVehicle(null)}
              className="absolute inset-0 bg-[#020408]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0F1218]/98 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
            >
              {/* Premium Top Multi-Million Dollar Styling Accents */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
              
              {/* Dossier Header - Compact */}
              <div className="border-b border-white/5 bg-[#171A21] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-400">Secure Asset Registry Dossier</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {user.role !== "NORMAL_USER" && (
                        <>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{renderField("show_bank_name", selectedVehicle.bank_name || "Creditor")}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-700" />
                        </>
                      )}
                      <span className={`text-[8px] font-black uppercase tracking-widest ${
                        selectedVehicle.status?.toLowerCase() === 'active' || !selectedVehicle.status ? "text-emerald-400" : "text-amber-500"
                      }`}>
                        {selectedVehicle.status || "ACTIVE"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPDF}
                    className="rounded-lg bg-white/5 hover:bg-white/10 p-1.5 text-slate-400 hover:text-white transition-all duration-200"
                    title="Export as PDF"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleShareText}
                    className="rounded-lg bg-white/5 hover:bg-white/10 p-1.5 text-slate-400 hover:text-white transition-all duration-200"
                    title="Share as Text"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-white/10 mx-1"></div>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    className="rounded-lg bg-white/5 hover:bg-rose-500/10 p-1.5 text-slate-400 hover:text-rose-400 transition-all duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Master Plate Label - Ultra Compact Embossed */}
              <div className="p-4 bg-[#0A0D14] border-b border-white/5">
                <div className="relative bg-gradient-to-b from-[#1E222B] to-[#12141C] border border-white/10 px-4 py-3 rounded-xl text-center shadow-inner overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-indigo-600/50" />
                  <p className="text-xl font-black font-mono tracking-[0.3em] pl-4 uppercase text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] select-all leading-none">
                    {renderField("show_vehicle_number", selectedVehicle.registration_number)}
                  </p>
                  {selectedVehicle.model && (
                    <p className="mt-2 text-[10px] font-black text-indigo-400/80 uppercase tracking-widest pl-4">
                      {selectedVehicle.model}
                    </p>
                  )}
                </div>
              </div>

              {/* Dossier Body - Single Column Details */}
              <div className="p-5 overflow-y-auto max-h-[60vh] space-y-5">
                <div className="space-y-2.5">
                  <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-500 flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5" /> Registry Identity
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg sm:col-span-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Legal Owner / Customer</span>
                      <p className="text-sm font-bold text-white truncate">{renderField("show_customer_name", selectedVehicle.owner)}</p>
                    </div>
                    {renderField("show_file_name", selectedVehicle.file_name) && selectedVehicle.file_name && (
                      <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg flex flex-col gap-2 sm:col-span-2">
                        <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold block mb-1">Source Ledger File(s)</span>
                        {selectedMatches.length > 1 ? (
                          <div className="space-y-1.5 font-mono text-xs max-h-32 overflow-y-auto pr-1">
                            {selectedMatches.map((m, idx) => (
                              <button
                                key={m.id || idx}
                                onClick={() => setSelectedVehicle(m)}
                                className={`w-full text-left px-3 py-2 rounded-md font-bold truncate transition-colors border ${
                                  m.id === selectedVehicle.id 
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                                    : "bg-[#0A0D14] text-slate-400 border-white/5 hover:border-white/10 hover:text-slate-300"
                                }`}
                                title={m.file_name}
                              >
                                {m.file_name || "Unknown File"}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-mono font-bold text-slate-300 truncate" title={selectedVehicle.file_name}>{renderField("show_file_name", selectedVehicle.file_name)}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg sm:col-span-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Agreement Number</span>
                      <p className="text-xs font-bold text-white font-mono break-all">{renderField("show_loan_no", selectedVehicle.loan_no)}</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5 sm:col-span-2">
                      <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Bucket</span>
                        <p className="text-[10px] sm:text-xs font-bold text-white font-mono truncate">{renderField("show_bucket", selectedVehicle.bucket)}</p>
                      </div>
                      <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">EMI</span>
                        <p className="text-[10px] sm:text-xs font-bold text-white font-mono break-all">{renderField("show_emi", selectedVehicle.emi)}</p>
                      </div>
                      <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">POS</span>
                        <p className="text-[10px] sm:text-xs font-bold text-indigo-400 font-mono break-all tracking-tight">{renderField("show_pos", selectedVehicle.pos)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 sm:col-span-2">
                      <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Engine Code</span>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-300 font-mono break-all">{renderField("show_engine_number", selectedVehicle.engine_number)}</p>
                      </div>
                      <div className="bg-[#1A1D24] border border-white/5 p-3 rounded-lg">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Chassis Code</span>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-300 font-mono break-all">{renderField("show_chassis_number", selectedVehicle.chassis_number)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-500 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> Authorization
                  </h4>
                  <div className="bg-indigo-500/5 border border-indigo-500/10 p-3.5 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-bold text-white">{renderField("show_confirmer_name", selectedVehicle.confirmer_name)}</p>
                    </div>
                    <span className="text-[9px] font-mono tracking-widest font-bold uppercase text-emerald-400">SIGN OK</span>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

