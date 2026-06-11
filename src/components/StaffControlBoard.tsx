/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useMemo } from "react";
import { User, Vehicle, UploadedFile, FieldPermissions, SearchHistory, UserRole, UserStatus } from "../types";
import { FirebaseService } from "../firebase";
import AgentView from "./AgentView";
import * as XLSX from "xlsx";
import { 
  Users, 
  Upload, 
  Settings, 
  History, 
  Database,
  UserPlus,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Eye,
  Lock,
  Filter,
  ShieldAlert,
  Loader2,
  ToggleLeft,
  X,
  FileCheck,
  RefreshCw,
  Edit,
  Smartphone,
  Clock,
  LogOut,
  Search,
  Shield,
  Building,
  Car,
  MapPin,
  Key,
  ShieldCheck,
  User as UserIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface StaffControlBoardProps {
  user: User;
  onLogout: () => void;
}

type TabType = "DASHBOARD" | "SEARCH" | "USERS" | "IMPORT" | "PERMS" | "LOGS";

export default function StaffControlBoard({ user, onLogout }: StaffControlBoardProps) {
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isAdmin = user.role === "ADMIN" || isSuperAdmin;
  const [activeTab, setActiveTab] = useState<TabType>("DASHBOARD");

  // Global triggers
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  // -------------------------------------------------------------
  // TAB 1: USER MANAGEMENT (ADMIN ONLY)
  // -------------------------------------------------------------
  const [usersList, setUsersList] = useState<User[]>([]);
  const [newUserMobile, setNewUserMobile] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("NORMAL_USER");
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);

  // Edit User Modal states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserMobile, setEditUserMobile] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRole, setEditUserRole] = useState<UserRole>("NORMAL_USER");
  const [editUserStatus, setEditUserStatus] = useState<UserStatus>("ACTIVE");
  const [editUserDevice, setEditUserDevice] = useState("");

  // Search History Drill-Down State
  const [selectedUserLogsMobile, setSelectedUserLogsMobile] = useState<string | null>(null);

  const openEditModal = (targetUser: User) => {
    setEditingUser(targetUser);
    setEditUserName(targetUser.name);
    setEditUserMobile(targetUser.mobile);
    setEditUserPassword(targetUser.password || "");
    setEditUserRole(targetUser.role);
    setEditUserStatus(targetUser.status);
    setEditUserDevice(targetUser.registered_device_id || "");
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMsg("");
    setSuccessMsg("");

    if (!editUserMobile.trim() || !editUserName.trim() || !editUserPassword.trim()) {
      setErrorMsg("All fields are required to register edits.");
      return;
    }

    try {
      const updatedUserObj: User = {
        name: editUserName.trim(),
        mobile: editUserMobile.trim(),
        password: editUserPassword.trim(),
        role: editUserRole,
        status: editUserStatus,
        registered_device_id: editUserDevice.trim(),
        is_first_time: editingUser.is_first_time,
        creator_mobile: editingUser.creator_mobile
      };

      if (editingUser.mobile !== editUserMobile.trim()) {
        // Since mobile acts as document ID, delete old document and add new
        await FirebaseService.deleteUser(editingUser.mobile);
        await FirebaseService.addUser(updatedUserObj);
      } else {
        await FirebaseService.updateUser(editingUser.mobile, {
          name: editUserName.trim(),
          password: editUserPassword.trim(),
          role: editUserRole,
          status: editUserStatus,
          registered_device_id: editUserDevice.trim()
        });
      }

      setSuccessMsg(`Information updated for user: ${editUserName}`);
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setErrorMsg("Failed to save changes to database.");
      console.error(err);
    }
  };

  const handleBindDevice = async (targetUser: User) => {
    setErrorMsg("");
    setSuccessMsg("");
    const mockDeviceID = `WEB_AGENT_CHROME_MOCK_${Math.floor(100 + Math.random() * 900)}`;
    try {
      await FirebaseService.updateUser(targetUser.mobile, { registered_device_id: mockDeviceID });
      setSuccessMsg(`Successfully bound device ID '${mockDeviceID}' to user ${targetUser.name}.`);
      loadUsers();
    } catch (e) {
      setErrorMsg("Failed to bind device.");
    }
  };

  const handleDebindDevice = async (targetUser: User) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await FirebaseService.updateUser(targetUser.mobile, { registered_device_id: "" });
      setSuccessMsg(`Device registry cleared for user ${targetUser.name}.`);
      loadUsers();
    } catch (e) {
      setErrorMsg("Failed to debind device.");
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const all = await FirebaseService.getUsers();
      // Only view users created by this admin or related
      const filtered = isSuperAdmin ? all : all.filter(u => u.creator_mobile === user.mobile || u.mobile === user.mobile);
      setUsersList(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    if (!newUserMobile.trim() || !newUserName.trim() || !newUserPassword.trim()) {
      setErrorMsg("All fields are required to register a user.");
      return;
    }

    if ((newUserRole === "ADMIN" || newUserRole === "SUPER_ADMIN") && !isSuperAdmin) {
      setErrorMsg("Only Super Admin can create Admin or Super Admin roles.");
      return;
    }

    try {
      const newUserObj: User = {
        name: newUserName.trim(),
        mobile: newUserMobile.trim(),
        password: newUserPassword.trim(),
        role: newUserRole,
        status: "ACTIVE",
        registered_device_id: "",
        is_first_time: newUserRole === "NORMAL_USER", // Force agents to update password on first login
        creator_mobile: user.mobile
      };

      await FirebaseService.addUser(newUserObj);
      setSuccessMsg(`Account successfully registered for ${newUserName}!`);
      setNewUserMobile("");
      setNewUserName("");
      setNewUserPassword("");
      setShowUserForm(false);
      loadUsers();
    } catch (e) {
      setErrorMsg("Failed to register new account in database.");
      console.error(e);
    }
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    setErrorMsg("");
    setSuccessMsg("");
    if (targetUser.mobile === user.mobile) {
      setErrorMsg("You cannot disable your own profile.");
      return;
    }

    const nextStatus = targetUser.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await FirebaseService.updateUser(targetUser.mobile, { status: nextStatus });
      setSuccessMsg(`Status updated for ${targetUser.name}.`);
      loadUsers();
    } catch (e) {
      setErrorMsg("Failed to update user security status.");
    }
  };

  const handleDeleteUser = async (targetMobile: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    if (targetMobile === user.mobile) {
      setErrorMsg("Cannot drop self session profile.");
      return;
    }
    if (!confirm("Are you sure you want to permanently delete this user?")) return;

    try {
      await FirebaseService.deleteUser(targetMobile);
      setSuccessMsg("Account successfully discarded.");
      loadUsers();
    } catch (e) {
      setErrorMsg("Failed to delete account from system.");
    }
  };

  // -------------------------------------------------------------
  // TAB 2: DATA IMPORT (ADMIN & STAFF)
  // -------------------------------------------------------------
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [parsingMsg, setParsingMsg] = useState("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setErrorMsg("");
    setSuccessMsg("");
    setImporting(true);
    setParsingMsg("Reading spreadsheet workbook...");
    setImportProgress(10);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        setParsingMsg("Mapping sheet lines to Firestore columns...");
        setImportProgress(30);

        // Parse sheet to JSON array
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 0 });
        if (rawRows.length === 0) {
          setErrorMsg("The selected sheet is empty or invalid.");
          setImporting(false);
          return;
        }

        const mappedVehicles: Vehicle[] = [];

        const ownerMobile = user.role === "ADMIN" || user.role === "SUPER_ADMIN"
          ? user.mobile 
          : (user.creator_mobile || user.mobile);

        const isDuplicateFile = filesList.some(f => f.admin_mobile === ownerMobile && f.file_name === file.name);
        if (isDuplicateFile) {
          setErrorMsg("Duplicate file found. A file with this name was already uploaded.");
          setImporting(false);
          return;
        }

        for (const row of rawRows) {
          // Robust column extraction with close matching keys
          const registration_number = (
            row["Reg Number"] || row["Registration/Vehicle Number"] || row["Vehicle/Reg Number"] || 
            row["Vehicle Number"] || row["registration_number"] || row["reg_no"] || row["Reg No"] || row["REGISTRATION NUMBER"] || ""
          ).toString().trim();

          if (!registration_number) continue; // Skip lines missing core reg numbers

          const bank_name = (row["Bank Name"] || row["bank_name"] || row["Bank"] || row["bank"] || "HDFC Bank").toString().trim();
          const owner = (row["Customer Name"] || row["owner"] || row["Customer"] || row["borrower"] || row["Customer_Name"] || "Unknown Patron").toString().trim();
          const model = (row["Model"] || row["model"] || row["vehicle_model"] || "N/A").toString().trim();
          const status = (row["Status"] || row["status"] || "Active").toString().trim();
          const pos = (row["POS"] || row["pos"] || row["Point of Sale"] || "N/A").toString().trim();
          const emi = (row["EMI"] || row["emi"] || row["Emi"] || "N/A").toString().trim();
          const engine_number = (row["Engine Number"] || row["engine_number"] || row["Engine"] || "N/A").toString().trim();
          const chassis_number = (row["Chassis Number"] || row["chassis_number"] || row["Chassis"] || "N/A").toString().trim();
          const confirmer_name = (row["Confirmer Name"] || row["confirmer_name"] || row["Confirmer"] || "N/A").toString().trim();
          const loan_no = (row["Loan Number"] || row["loan_no"] || row["Loan No"] || row["Loan_No"] || "N/A").toString().trim();
          const bucket = (row["Bucket"] || row["BUCKET"] || row["Option Bucket"] || row["BUCKET NO"] || "N/A").toString().trim();

          mappedVehicles.push({
            registration_number,
            owner,
            model,
            status,
            bank_name,
            pos,
            emi,
            engine_number,
            chassis_number,
            confirmer_name,
            loan_no,
            creator_mobile: ownerMobile,
            file_name: file.name,
            bucket
          });
        }

        if (mappedVehicles.length === 0) {
          setErrorMsg("Could not parse any vehicle rows. Check column headers.");
          setImporting(false);
          return;
        }

        setParsingMsg(`Uploading ${mappedVehicles.length} items in secure batches of 500 to Firestore...`);
        setImportProgress(50);

        // Upload and record in Firebase
        const fileUploadDescriptor: UploadedFile = {
          id: `${ownerMobile}_${file.name}`,
          file_name: file.name,
          admin_mobile: ownerMobile,
          uploaded_at: Date.now(),
          record_count: mappedVehicles.length
        };

        await FirebaseService.importVehiclesBatch(mappedVehicles, fileUploadDescriptor);
        
        setImportProgress(100);
        setSuccessMsg(`File block '${file.name}' imported with parity! Successfully verified and matched ${mappedVehicles.length} records.`);
        loadFiles();
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to compile or parse the selected workbook file.");
      } finally {
        setImporting(false);
        setParsingMsg("");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // -------------------------------------------------------------
  // TAB 3: FILE CATALOG (ADMIN & STAFF)
  // -------------------------------------------------------------
  const [filesList, setFilesList] = useState<UploadedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const uploaderMobile = isSuperAdmin 
        ? undefined 
        : (user.role === "ADMIN" ? user.mobile : (user.creator_mobile || user.mobile));
      const list = await FirebaseService.getUploadedFiles(uploaderMobile);
      setFilesList(list.sort((a,b) => b.uploaded_at - a.uploaded_at));
    } catch (e) {
      console.error(e);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleDeleteFile = async (item: UploadedFile) => {
    setErrorMsg("");
    setSuccessMsg("");
    
    // Safety check: unless Super Admin, can only delete files if uploaded by own mobile or if they are staff deleting their admin's files
    const canDelete = isSuperAdmin || 
                      item.admin_mobile === user.mobile || 
                      (user.role === "OFFICE_STAFF" && item.admin_mobile === user.creator_mobile);
                      
    if (!canDelete) {
      setErrorMsg("Access Denied: You can only delete data spreadsheets uploaded by you or your node admin.");
      return;
    }

    confirmAction(
      "Confirm Deletion",
      `This will permanently delete file metadata and erase all ${item.record_count} associated vehicles records and audit lines. Proceed?`,
      async () => {
        setFilesLoading(true);
        try {
          await FirebaseService.deleteFileBatch(item.admin_mobile, item.file_name);
          setSuccessMsg(`Discarded '${item.file_name}' and cascades of child records from database.`);
          loadFiles();
        } catch (e) {
          setErrorMsg("Failed to wipe data files cascade.");
        } finally {
          setFilesLoading(false);
        }
      }
    );
  };

  // -------------------------------------------------------------
  // TAB 4: AGENT PERMISSIONS (ADMIN ONLY)
  // -------------------------------------------------------------
  const [permissionsObj, setPermissionsObj] = useState<FieldPermissions | null>(null);
  const [adminSelfPermissionsObj, setAdminSelfPermissionsObj] = useState<FieldPermissions | null>(null);
  const [selectedAdminMobile, setSelectedAdminMobile] = useState<string>("");
  const [adminList, setAdminList] = useState<User[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);

  const loadPermissions = async () => {
    if (!isAdmin) return;
    try {
      if (isSuperAdmin) {
        // Enumerate all ADMIN role users
        const users = await FirebaseService.getUsers();
        const admins = users.filter(u => u.role === "ADMIN");
        setAdminList(admins);
        
        let targetAdmin = selectedAdminMobile;
        if (!targetAdmin && admins.length > 0) {
          targetAdmin = admins[0].mobile;
          setSelectedAdminMobile(admins[0].mobile);
        }
        
        if (targetAdmin) {
          const perms = await FirebaseService.getFieldPermissions(targetAdmin, "ADMIN");
          setPermissionsObj(perms);
        } else {
          setPermissionsObj(null);
        }
      } else {
        // Regular Admin loads normal users permissions (NORMAL_USER_userMobile)
        const perms = await FirebaseService.getFieldPermissions(user.mobile, "NORMAL_USER");
        setPermissionsObj(perms);
        
        // Also load Admin's own permissions set by Super Admin to check limits
        const selfPerms = await FirebaseService.getFieldPermissions(user.mobile, "ADMIN");
        setAdminSelfPermissionsObj(selfPerms);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePermissionField = (field: keyof FieldPermissions, val: boolean) => {
    if (!permissionsObj) return;
    setPermissionsObj({
      ...permissionsObj,
      [field]: val
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionsObj || !isAdmin) return;
    setErrorMsg("");
    setSuccessMsg("");
    setPermsSaving(true);
    try {
      if (isSuperAdmin) {
        if (!selectedAdminMobile) {
          setErrorMsg("Please select an Admin account first.");
          setPermsSaving(false);
          return;
        }
        await FirebaseService.saveFieldPermissions(selectedAdminMobile, permissionsObj, "ADMIN");
        setSuccessMsg(`Search parameters policy configured for Admin (${selectedAdminMobile}) successfully.`);
      } else {
        // Normal user permissions edited by Admin
        // Make sure we force-disable fields that are not allowed by Super Admin's ADMIN policy.
        const cleaned = { ...permissionsObj };
        if (adminSelfPermissionsObj) {
          const fields: (keyof FieldPermissions)[] = [
            "show_customer_name", "show_vehicle_number", "show_bank_name", "show_pos", "show_emi",
            "show_engine_number", "show_chassis_number", "show_confirmer_name", "show_loan_no",
            "show_file_name", "show_bucket"
          ];
          fields.forEach(f => {
            if (adminSelfPermissionsObj[f] === false) {
              (cleaned as any)[f] = false;
            }
          });
        }
        await FirebaseService.saveFieldPermissions(user.mobile, cleaned, "NORMAL_USER");
        setSuccessMsg("Normal user (Field Agent) masking permissions synced and saved successfully.");
      }
    } catch (e) {
      setErrorMsg("Failed to update security permissions index.");
    } finally {
      setPermsSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === "PERMS" && isSuperAdmin && selectedAdminMobile) {
      loadPermissions();
    }
  }, [selectedAdminMobile]);

  // -------------------------------------------------------------
  // TAB 5: SEARCH LOGS (ADMIN & STAFF)
  // -------------------------------------------------------------
  const [logsList, setLogsList] = useState<SearchHistory[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState("");

  // DASHBOARD METRICS
  const [totalVehiclesCount, setTotalVehiclesCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [connectedUsersCount, setConnectedUsersCount] = useState(0);

  const loadDashboardMetrics = async () => {
    try {
      const users = await FirebaseService.getUsers();
      const filtered = isSuperAdmin ? users : users.filter(u => u.creator_mobile === user.mobile || u.mobile === user.mobile);
      setConnectedUsersCount(filtered.length);
      setActiveUsersCount(filtered.filter(u => u.status === "ACTIVE").length);

      const uploaderMobile = isSuperAdmin 
        ? undefined 
        : (user.role === "ADMIN" ? user.mobile : (user.creator_mobile || user.mobile));
      const files = await FirebaseService.getUploadedFiles(uploaderMobile);
      let count = 0;
      files.forEach(f => count += f.record_count);
      setTotalVehiclesCount(count);
    } catch (e) {
      console.error("Metrics load failed", e);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const targetQueryMobile = isSuperAdmin 
        ? undefined 
        : (user.role === "ADMIN" ? user.mobile : (user.creator_mobile || user.mobile));
      const history = await FirebaseService.getSearchHistories(targetQueryMobile);
      setLogsList(history.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleClearLogs = async (mobile?: string) => {
    confirmAction(
      "Purge Telemetry History",
      "Are you sure you want to purge telemetry history? This action is irreversible.",
      async () => {
        try {
          await FirebaseService.clearSearchHistories(mobile);
          loadLogs();
        } catch (e) {
          console.error(e);
        }
      }
    );
  };

  const handleDeleteLog = async (id?: string) => {
    if (!id) return;
    confirmAction(
      "Delete Telemetry Trace",
      "Delete this telemetry trace?",
      async () => {
        try {
          await FirebaseService.deleteSearchHistory(id);
          loadLogs();
        } catch (e) {
          console.error(e);
        }
      }
    );
  };

  const filteredLogs = logsList.filter(l => {
    if (!logsFilter.trim()) return true;
    const q = logsFilter.toLowerCase();
    return (
      (l.user_name || "").toLowerCase().includes(q) ||
      (l.vehicle_number || "").toLowerCase().includes(q) ||
      (l.user_mobile || "").toLowerCase().includes(q) ||
      (l.model || "").toLowerCase().includes(q)
    );
  });

  // Load appropriate data on active tab switch
  useEffect(() => {
    setErrorMsg("");
    setSuccessMsg("");
    switch (activeTab) {
      case "DASHBOARD":
        loadDashboardMetrics();
        break;
      case "USERS":
        loadUsers();
        break;
      case "IMPORT":
        loadFiles();
        break;
      case "PERMS":
        loadPermissions();
        break;
      case "LOGS":
        loadUsers();
        loadLogs();
        break;
    }
  }, [activeTab]);

  if (activeTab === "SEARCH") {
    return <AgentView user={user} onLogout={() => setActiveTab("DASHBOARD")} isInsideAdmin={true} />;
  }

  return (
    <div className="min-h-screen bg-[#111318] pb-16 text-slate-100">
      
      {/* Dynamic Header Based on Tab */}
      {activeTab === "DASHBOARD" ? (
        <div className="sticky top-0 z-20 bg-[#0A0D14] px-4 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-start justify-between">
            <div>
              <h1 className="font-sans text-xl font-bold tracking-widest text-white uppercase flex items-center gap-2">
                RecoveryX Pro Wb
              </h1>
              <p className="text-xs text-slate-400 mt-1">Operator: {user.name}</p>
            </div>
            <button
              onClick={onLogout}
              className="text-rose-500 hover:text-rose-400 transition-colors p-2 rounded-lg hover:bg-rose-500/10"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      ) : (
        <div className="sticky top-0 z-20 border-b border-slate-800 bg-[#111318] px-4 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("DASHBOARD")}
                className="text-slate-300 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <h1 className="font-sans text-lg font-medium tracking-tight text-white">
                {activeTab === "USERS" ? "Manage Users & Staff" :
                 activeTab === "IMPORT" ? "Data Import" :
                 activeTab === "PERMS" ? "Field Permissions" :
                 "Search & Use History"}
              </h1>
            </div>
            {activeTab === "USERS" && (
               <button onClick={loadUsers} className="text-slate-300 hover:text-white">
                 <RefreshCw className="h-5 w-5" />
               </button>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* DASHBOARD TAB VIEW */}
        {activeTab === "DASHBOARD" && (
          <div className="max-w-lg mx-auto space-y-5">
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#1A1D24] p-5 shadow-sm border border-white/5">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-bold text-white font-sans tracking-tight">{connectedUsersCount}</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-white font-bold">Network Users</p>
                  <p className="text-xs text-slate-500 mt-0.5">Total provisioned</p>
                </div>
              </div>
              <div className="rounded-2xl bg-[#1A1D24] p-5 shadow-sm border border-white/5">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                    <Shield className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-bold text-white font-sans tracking-tight">{activeUsersCount}</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-white font-bold">Active Sessions</p>
                  <p className="text-xs text-slate-500 mt-0.5">Currently active</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl bg-[#1A1D24] p-5 shadow-sm border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10 flex items-start justify-between">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8M8 11h8M8 15h8m-10 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-4xl font-bold text-white font-sans tracking-tight">{totalVehiclesCount}</p>
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-sm text-white font-bold">Tracked Vehicles Database</p>
                <p className="text-xs text-slate-500 mt-0.5">Synched from Cloud Firestore</p>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-3">Console Actions</p>
              <div className="space-y-3">
                <button onClick={() => setActiveTab("SEARCH")} className="w-full flex items-center justify-between bg-gradient-to-r from-indigo-500 to-indigo-400 p-4 rounded-2xl text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all">
                  <div className="text-left">
                    <p className="font-bold text-base">Global Search Registry</p>
                    <p className="text-xs text-white/70 mt-0.5">Search and track database vehicles</p>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                </button>

                {isAdmin && (
                  <button onClick={() => setActiveTab("USERS")} className="w-full flex items-center justify-between bg-gradient-to-r from-orange-400 to-rose-400 p-4 rounded-2xl text-white shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all">
                    <div className="text-left">
                      <p className="font-bold text-base">User & Admin Management</p>
                      <p className="text-xs text-white/70 mt-0.5">Provision access and update roles</p>
                    </div>
                    <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                  </button>
                )}

                <button onClick={() => setActiveTab("LOGS")} className="w-full flex items-center justify-between bg-gradient-to-r from-sky-400 to-blue-500 p-4 rounded-2xl text-white shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-all">
                  <div className="text-left">
                    <p className="font-bold text-base">System Queries History</p>
                    <p className="text-xs text-white/70 mt-0.5">Audit logs and search behavior</p>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
                    <History className="w-5 h-5 text-white" />
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button onClick={() => setActiveTab("IMPORT")} className="flex flex-col items-center justify-center gap-3 bg-[#1A1D24] border border-white/5 py-5 rounded-2xl text-white hover:bg-[#20242D] transition-colors active:scale-[0.98]">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-xs font-bold">Data Import</span>
                  </button>
                  {isAdmin && (
                    <button onClick={() => setActiveTab("PERMS")} className="flex flex-col items-center justify-center gap-3 bg-[#1A1D24] border border-white/5 py-5 rounded-2xl text-white hover:bg-[#20242D] transition-colors active:scale-[0.98]">
                      <Shield className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-bold">Permissions</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Success / Error notices */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-400 flex items-start gap-2.5"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="font-semibold">Operation Security Issue</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border border-green-500/30 bg-green-950/20 p-4 text-xs text-green-400 flex items-start gap-2.5"
            >
              <CheckCircle className="h-5 w-5 shrink-0 text-green-400 mt-0.5" />
              <div>
                <p className="font-semibold">Success</p>
                <p className="mt-0.5">{successMsg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Confirm Actions */}
        <AnimatePresence>
          {confirmDialog.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#0A0D14]/80 backdrop-blur-sm"
                onClick={() => setConfirmDialog(d => ({ ...d, isOpen: false }))}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative bg-[#1A1D24] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
              >
                <div className="flex items-center gap-3 text-rose-500 mb-2">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <h3 className="text-lg font-bold tracking-tight text-white leading-tight">{confirmDialog.title}</h3>
                </div>
                <p className="text-sm text-slate-400 font-medium leading-relaxed">{confirmDialog.message}</p>
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setConfirmDialog(d => ({ ...d, isOpen: false }))}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDialog(d => ({ ...d, isOpen: false }));
                      confirmDialog.onConfirm();
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors shadow-lg shadow-rose-500/20"
                  >
                    Confirm Action
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Tab Modules */}
        {activeTab !== "DASHBOARD" && (
        <div className="mt-2 relative pb-20">
          
          {/* TAB 1: USER MANAGEMENT */}
          {activeTab === "USERS" && isAdmin && (
            <div className="space-y-6 max-w-4xl mx-auto">
              
              <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Identity Access Management</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage platform operators, administrators, and field endpoints</p>
                </div>
                {!showUserForm && (
                  <button
                    onClick={() => setShowUserForm(true)}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Provision Identity
                  </button>
                )}
              </div>

              {showUserForm ? (
                <div className="bg-[#1A1D24] p-6 rounded-2xl border border-white/5 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">Provision Identity</h3>
                      <p className="text-xs text-slate-500">Create a new access endpoint in the network</p>
                    </div>
                    <button onClick={() => setShowUserForm(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Add User form */}
                  <form onSubmit={handleCreateUser} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operator Name</label>
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="E.g., Sanjay Lal"
                          className="block w-full rounded-xl border border-white/10 bg-[#0A0D14] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile Indicator (Node ID)</label>
                        <input
                          type="text"
                          value={newUserMobile}
                          onChange={(e) => setNewUserMobile(e.target.value.trim())}
                          placeholder="Enter node mobile integer"
                          className="block w-full rounded-xl border border-white/10 bg-[#0A0D14] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Access Clearance</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                          className="block w-full rounded-xl border border-white/10 bg-[#0A0D14] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none"
                        >
                          <option value="NORMAL_USER">Level 1: Field Operator</option>
                          <option value="OFFICE_STAFF">Level 2: HQ Staff</option>
                          {isSuperAdmin && <option value="ADMIN">Level 3: Supervisor</option>}
                          {isSuperAdmin && <option value="SUPER_ADMIN">Level 4: System Overlord</option>}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Initial Handshake Key</label>
                        <input
                          type="text"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Pre-shared key"
                          className="block w-full rounded-xl border border-white/10 bg-[#0A0D14] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                      <button
                        type="submit"
                        className="flex items-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                      >
                        <UserPlus className="h-4 w-4" />
                        Execute Identity Provision
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-8">
                  {usersLoading ? (
                    <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                      <span className="font-medium tracking-tight">Syncing identity matrix...</span>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Helper to render stylized row */}
                      {(() => {
                        const renderUserRow = (u: User) => {
                          const isSelf = u.mobile === user.mobile;
                          return (
                            <div key={u.mobile} className="flex flex-col justify-between p-3.5 bg-[#1A1D24] border border-white/5 rounded-xl gap-4 hover:border-white/10 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full border shrink-0 ${u.status === 'ACTIVE' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                  {u.status === 'ACTIVE' ? <CheckCircle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <p className="text-white font-bold text-sm tracking-tight truncate">{u.name}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="bg-white/5 border border-white/10 text-slate-300 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full tracking-wider">
                                      {u.role.replace('_', ' ')}
                                    </span>
                                    {u.registered_device_id ? (
                                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                                        <Smartphone className="h-2.5 w-2.5" /> Bound
                                      </span>
                                    ) : (
                                      <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        Unbound
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-white/5">
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="flex items-center gap-1 rounded-md bg-white/5 hover:bg-white/10 border border-transparent text-[10px] sm:text-xs font-bold px-2 py-1.5 text-white transition-colors flex-1 justify-center"
                                >
                                  <Settings className="h-3 w-3 text-slate-400" />
                                  Config
                                </button>

                                <button
                                  onClick={() => handleToggleUserStatus(u)}
                                  disabled={isSelf}
                                  className={`flex items-center gap-1 rounded-md border text-[10px] sm:text-xs font-bold px-2 py-1.5 transition-colors flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed ${
                                    u.status === 'ACTIVE' 
                                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' 
                                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                  }`}
                                >
                                  <ToggleLeft className="h-3 w-3" />
                                  {u.status === 'ACTIVE' ? "Suspend" : "Reinstate"}
                                </button>

                                {u.registered_device_id ? (
                                  <button
                                    onClick={() => handleDebindDevice(u)}
                                    className="flex items-center gap-1 rounded-md bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-[10px] sm:text-xs font-bold px-2 py-1.5 text-amber-500 transition-colors flex-1 justify-center"
                                  >
                                    <Lock className="h-3 w-3" />
                                    Unbind
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleBindDevice(u)}
                                    className="flex items-center gap-1 rounded-md bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-[10px] sm:text-xs font-bold px-2 py-1.5 text-indigo-400 transition-colors flex-1 justify-center"
                                  >
                                    <Smartphone className="h-3 w-3" />
                                    Bind
                                  </button>
                                )}

                                <button
                                  onClick={() => handleDeleteUser(u.mobile)}
                                  disabled={isSelf}
                                  className="flex items-center justify-center p-1.5 rounded-md bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-10">
                            {isAdmin && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2">
                                  <Shield className="w-4 h-4" /> Operations Command ({usersList.filter(u => ["ADMIN", "SUPER_ADMIN"].includes(u.role)).length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                  {usersList.filter(u => ["ADMIN", "SUPER_ADMIN"].includes(u.role)).map(u => renderUserRow(u))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-4">
                              <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2">
                                <FileCheck className="w-4 h-4" /> Headquarter Staff ({usersList.filter(u => u.role === "OFFICE_STAFF").length})
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {usersList.filter(u => u.role === "OFFICE_STAFF").length === 0 ? (
                                  <p className="p-4 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-500 col-span-full">No HQ identities enlisted.</p>
                                ) : (
                                  usersList.filter(u => u.role === "OFFICE_STAFF").map(u => renderUserRow(u))
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase flex items-center gap-2">
                                <Smartphone className="w-4 h-4" /> Field Endpoints ({usersList.filter(u => u.role === "NORMAL_USER").length})
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {usersList.filter(u => u.role === "NORMAL_USER").length === 0 ? (
                                  <p className="p-4 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-500 col-span-full">No active field operatives mapped in your zone.</p>
                                ) : (
                                  usersList.filter(u => u.role === "NORMAL_USER").map(u => renderUserRow(u))
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

      {/* EDIT USER SPECIFICATIONS MODAL */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
            >
              <div className="border-b border-slate-800 bg-slate-900 px-5 py-4 flex items-center justify-between">
                <h3 className="font-sans text-sm font-bold text-white flex items-center gap-1.5">
                  <Edit className="h-4.5 w-4.5 text-teal-400" />
                  Edit User: {editingUser.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-white hover:border-slate-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditUser} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Full Name</label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-sans"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Mobile (Login ID)</label>
                  <input
                    type="text"
                    value={editUserMobile}
                    onChange={(e) => setEditUserMobile(e.target.value.trim())}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-mono"
                    required
                  />
                  <span className="text-[9px] text-slate-500 block font-mono">⚠️ Modifying this updates document index references dynamically.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Security Password</label>
                  <input
                    type="text"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">System Role Level</label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="NORMAL_USER">NORMAL_USER (Field Agent)</option>
                    <option value="OFFICE_STAFF">OFFICE_STAFF (Operator)</option>
                    {isSuperAdmin && <option value="ADMIN">ADMIN (Supervisor)</option>}
                    {isSuperAdmin && <option value="SUPER_ADMIN">SUPER_ADMIN (System Admin)</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">User Status</label>
                  <select
                    value={editUserStatus}
                    onChange={(e) => setEditUserStatus(e.target.value as UserStatus)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>

                <div className="space-y-1 border-t border-slate-800/60 pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Device ID Binding</label>
                    {editUserDevice ? (
                      <button
                        type="button"
                        onClick={() => setEditUserDevice("")}
                        className="text-[9px] text-amber-400 underline uppercase hover:text-amber-300 font-bold"
                      >
                        Clear ID
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditUserDevice(`WEB_AGENT_CHROME_MOCK_${Math.floor(100 + Math.random() * 900)}`)}
                        className="text-[9px] text-teal-400 underline uppercase hover:text-teal-300 font-bold"
                      >
                        Set Mock ID
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editUserDevice}
                    onChange={(e) => setEditUserDevice(e.target.value.trim())}
                    placeholder="No device ID bound currently"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div className="flex gap-2.5 border-t border-slate-800/60 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-lg border border-slate-850 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="grow flex justify-center rounded-lg bg-teal-500 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

          {/* TAB 2: DATA IMPORT */}
          {activeTab === "IMPORT" && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="pb-6 border-b border-white/5">
                <h2 className="text-xl font-bold tracking-tight text-white">Data Ingestion Engine</h2>
                <p className="text-sm text-slate-500 mt-1">Import structured ledger files into the highly available search clustered database</p>
              </div>

              {importing ? (
                // Ingest state tracker loop
                <div className="rounded-2xl border border-white/5 bg-[#1A1D24] p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-indigo-500/5 pulse-animation" />
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                  <div className="relative space-y-3 max-w-sm mx-auto">
                    <p className="text-base font-bold text-white tracking-tight">{parsingMsg}</p>
                    <div className="w-full bg-[#0A0D14] rounded-full h-2 overflow-hidden border border-white/5">
                      <div 
                        className="bg-indigo-500 h-full transition-all duration-300 relative"
                        style={{ width: `${importProgress}%` }}
                      >
                         <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20" style={{ animation: 'shimmer 2s infinite' }} />
                      </div>
                    </div>
                    <span className="font-bold text-[11px] uppercase tracking-widest text-slate-500">{importProgress}% Processing</span>
                  </div>
                </div>
              ) : (
                // Drag and drop uploader
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                    dragActive 
                      ? "border-indigo-500 bg-indigo-500/5 transform scale-[1.01]" 
                      : "border-white/10 bg-[#1A1D24] hover:border-indigo-500/50 hover:bg-[#20242D]"
                  }`}
                >
                  <label className="absolute inset-0 cursor-pointer w-full h-full z-10">
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                  
                  <div className="relative">
                    <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full" />
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0A0D14] border border-white/10 shadow-xl shadow-indigo-500/10">
                      <FileSpreadsheet className="h-8 w-8 text-indigo-400" />
                    </span>
                  </div>
                  <p className="mt-8 text-lg font-bold text-white tracking-tight">
                    Secure Drop Zone
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Drag and drop dataset (.xlsx, .csv) or <span className="text-indigo-400 underline decoration-indigo-400/30 underline-offset-4 hover:decoration-indigo-400 transition-colors">browse files</span>
                  </p>
                  <p className="mt-4 text-xs text-slate-500 font-medium max-w-md bg-white/5 border border-white/5 p-3 rounded-lg">
                    Automatically validates and maps headers: Bank Name, Registration, Owner, Model, EMI, Chassis, Engine, Confirmer.
                  </p>
                </div>
              )}

              {/* Uploaded Files Table */}
              <div className="pt-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-white">System Data Fragments</h2>
                    <p className="text-xs text-slate-500 mt-1">Review injected datasets. Deleting a block permanently retracts related child nodes.</p>
                  </div>
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <Database className="w-5 h-5" />
                  </div>
                </div>

                {filesLoading ? (
                  <div className="py-12 bg-[#1A1D24] border border-white/5 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" /> 
                    <span className="text-sm font-medium text-slate-400">Retrieving catalog fragments...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filesList.length > 0 ? (
                      filesList.map(item => (
                        <div key={item.id} className="relative group rounded-2xl border border-white/5 bg-[#1A1D24] p-5 transition-all hover:border-white/10 hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors" />
                          <div className="relative space-y-4">
                            <div className="flex items-start justify-between">
                              <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold text-indigo-400 border border-indigo-500/20">
                                Import Fragment
                              </span>
                              <button
                                onClick={() => handleDeleteFile(item)}
                                id={`delete-file-btn-${item.id}`}
                                className="rounded-lg border border-transparent hover:border-rose-500/20 bg-white/5 hover:bg-rose-500/10 p-2 text-slate-400 hover:text-rose-400 transition-colors relative z-10"
                                title="Delete file and cascading vehicles"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <div>
                              <p className="font-sans text-sm font-bold text-white tracking-tight line-clamp-1" title={item.file_name}>
                                {item.file_name}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                <Clock className="w-3 h-3" />
                                {new Date(item.uploaded_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between relative">
                            <span className="text-xs font-medium text-slate-500">Indexed Lines:</span>
                            <span className="text-sm font-bold text-white flex items-center gap-1.5 bg-[#0A0D14] border border-white/5 px-3 py-1 rounded-lg">
                              <Database className="w-3.5 h-3.5 text-indigo-400" />
                              {item.record_count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-16 rounded-2xl border border-dashed border-white/10 bg-[#1A1D24] text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-[#0A0D14] border border-white/5 flex items-center justify-center mb-4 text-slate-600">
                          <AlertCircle className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-bold text-white tracking-tight">No External Datasets Discovered</p>
                        <p className="text-xs text-slate-500 mt-2 max-w-sm">Use the Secure Drop Zone above to ingest target operational assets into the network structure.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MASK-PERMISSIONS CONFIG PANEL */}
          {activeTab === "PERMS" && isAdmin && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="pb-6 border-b border-white/5">
                <h2 className="text-xl font-bold tracking-tight text-white">Identity Access Control & Masking</h2>
                <p className="text-sm text-slate-500 mt-1">Configure structural metadata visibility constraints per clearance tier</p>
              </div>

              {isSuperAdmin ? (
                <div className="rounded-2xl border border-white/5 bg-[#1A1D24] p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4" /> Global Matrix Configuration Target:
                      </label>
                      <p className="text-xs text-slate-400 max-w-2xl">
                        Supervisors (Admins) propagate these mask settings to all field operators under their node tree. Select a Supervisor node to enforce restrictions.
                      </p>
                    </div>
                    {adminList.length > 0 ? (
                      <select
                        value={selectedAdminMobile}
                        onChange={(e) => setSelectedAdminMobile(e.target.value)}
                        className="block w-full max-w-md rounded-xl border border-white/10 bg-[#0A0D14] px-4 py-3 text-sm text-white font-medium outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all appearance-none"
                      >
                        {adminList.map(adm => (
                          <option key={adm.mobile} value={adm.mobile}>
                            {adm.name} — Node ID: {adm.mobile}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 mt-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">Empty Supervisor Registry. Provision a Supervisor endpoint using the Identity Access Management tab first.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {(!isSuperAdmin || (isSuperAdmin && selectedAdminMobile)) && permissionsObj ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-[#1A1D24] p-6 rounded-2xl border border-white/5 shadow-xl">
                    <div className="pb-4 border-b border-white/5 mb-6">
                      <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                        <Lock className="w-4 h-4 text-indigo-400" />
                        {isSuperAdmin ? "Supervisor Security Context" : "Field Agent Security Context"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isSuperAdmin 
                          ? "Toggle node visibility variables. Enforced constraints cascade downward from this Supervisor."
                          : "Configure read-clearance arrays for connected field operators. Parent locks cannot be overridden."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { field: "show_customer_name", desc: "Customer Name", icon: <UserIcon className="w-4 h-4" /> },
                        { field: "show_vehicle_number", desc: "Vehicle Number", icon: <Car className="w-4 h-4" /> },
                        { field: "show_bank_name", desc: "Bank Name", icon: <Building className="w-4 h-4" /> },
                        { field: "show_pos", desc: "POS", icon: <MapPin className="w-4 h-4" /> },
                        { field: "show_emi", desc: "EMI", icon: <Database className="w-4 h-4" /> },
                        { field: "show_engine_number", desc: "Engine Number", icon: <Settings className="w-4 h-4" /> },
                        { field: "show_chassis_number", desc: "Chassis Number", icon: <ShieldAlert className="w-4 h-4" /> },
                        { field: "show_confirmer_name", desc: "Confirmer Name", icon: <FileCheck className="w-4 h-4" /> },
                        { field: "show_loan_no", desc: "Loan Number", icon: <Key className="w-4 h-4" /> },
                        { field: "show_file_name", desc: "Source File Name", icon: <FileCheck className="w-4 h-4" /> },
                        { field: "show_bucket", desc: "Bucket", icon: <Building className="w-4 h-4" /> }
                      ].map(opt => {
                        const isAllowedBySuper = isSuperAdmin ? true : (adminSelfPermissionsObj ? adminSelfPermissionsObj[opt.field as keyof FieldPermissions] !== false : true);
                        const isValueChecked = isAllowedBySuper && permissionsObj[opt.field as keyof FieldPermissions] === true;

                        return (
                          <div key={opt.field} className={`flex items-start justify-between rounded-xl border p-4 transition-all ${
                            !isAllowedBySuper ? "border-rose-500/10 bg-rose-500/5 opacity-75 grayscale sepia" : "border-white/5 bg-[#0A0D14] hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5"
                          }`}>
                            <div className="flex gap-3">
                              <div className={`p-2 rounded-lg shrink-0 ${!isAllowedBySuper ? "bg-rose-500/10 text-rose-500" : isValueChecked ? "bg-indigo-500/10 text-indigo-400" : "bg-white/5 text-slate-500"}`}>
                                {!isAllowedBySuper ? <ShieldAlert className="w-4 h-4" /> : opt.icon}
                              </div>
                              <div className="space-y-0.5 pt-0.5">
                                <span className={`font-bold text-sm tracking-tight block ${!isAllowedBySuper ? "text-rose-400" : "text-white"}`}>
                                  {opt.desc}
                                </span>
                                {!isAllowedBySuper ? (
                                  <span className="text-xs text-rose-500/80 font-medium">Overriden by Root Directive</span>
                                ) : (
                                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isValueChecked ? "text-emerald-400" : "text-slate-500"}`}>
                                    {isValueChecked ? "Clearance Granted" : "Masked"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              id={`perm-btn-${opt.field}`}
                              disabled={!isAllowedBySuper}
                              onClick={() => handleUpdatePermissionField(opt.field as keyof FieldPermissions, !isValueChecked)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 outline-none mt-1 ${
                                isValueChecked ? "bg-indigo-500" : "bg-white/10"
                              } ${!isAllowedBySuper ? "cursor-not-allowed opacity-40 bg-rose-900" : "hover:ring-4 hover:ring-indigo-500/20"}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 mt-1 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-spring ${
                                  isValueChecked ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-end">
                      <button
                        type="button"
                        id="save-permissions-btn"
                        disabled={permsSaving}
                        onClick={handleSavePermissions}
                        className="flex items-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                      >
                        {permsSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Propagating Matrix...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            Enforce Clearance Matrix
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 5: AGENT SEARCH AUDIT TRAIL LOGS */}
          {activeTab === "LOGS" && (() => {
            // Group and sort users by latest search history
            const sortedUsersWithHistory = (() => {
              // Extract all users from usersList and unique mobile entries from logsList
              const combinedUsersMap = new Map<string, { mobile: string, name: string }>();
              
              usersList.forEach(u => combinedUsersMap.set(u.mobile, { mobile: u.mobile, name: u.name }));
              logsList.forEach(l => {
                if (!combinedUsersMap.has(l.user_mobile)) {
                  combinedUsersMap.set(l.user_mobile, { mobile: l.user_mobile, name: l.user_name || "Unknown Agent" });
                }
              });

              const mapped = Array.from(combinedUsersMap.values()).map(u => {
                const userLogs = logsList.filter(l => l.user_mobile === u.mobile);
                const sortedUserLogs = [...userLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const latestTime = sortedUserLogs.length > 0 ? new Date(sortedUserLogs[0].timestamp).getTime() : 0;
                return {
                  user: u,
                  logsCount: userLogs.length,
                  latestTime,
                  latestLog: sortedUserLogs[0] || null,
                  logs: sortedUserLogs
                };
              });

              // Sort: latest searches first
              return mapped.sort((a, b) => b.latestTime - a.latestTime);
            })();

            const filteredUserWiseList = (() => {
              if (!logsFilter.trim()) return sortedUsersWithHistory;
              const q = logsFilter.toLowerCase();
              return sortedUsersWithHistory.filter(item => {
                const nameMatch = item.user.name.toLowerCase().includes(q);
                const mobileMatch = item.user.mobile.toLowerCase().includes(q);
                const plateMatch = item.logs.some(l => l.vehicle_number.toLowerCase().includes(q));
                return nameMatch || mobileMatch || plateMatch;
              });
            })();

            return (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="pb-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">System Audit Trails</h2>
                    <p className="text-sm text-slate-500 mt-1">Review operational search queries executed by deployed field endpoints</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={loadLogs}
                      className="px-4 py-2 font-bold text-sm bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors flex items-center gap-2 border border-white/10"
                    >
                      <Loader2 className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`} /> Sync Matrix
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleClearLogs()}
                        className="px-4 py-2 font-bold text-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/20"
                      >
                        Purge All
                      </button>
                    )}
                  </div>
                </div>

                // 1. List of users ordered by latest query activity
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-[#1A1D24] p-4 rounded-2xl border border-white/5 shadow-xl">
                    <div className="relative max-w-md w-full">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                        <Filter className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={logsFilter}
                        onChange={(e) => setLogsFilter(e.target.value)}
                        placeholder="Filter targets or ID patterns..."
                        className="block w-full rounded-xl border border-white/10 bg-[#0A0D14] py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {logsLoading ? (
                    <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 bg-[#1A1D24] border border-white/5 rounded-2xl shadow-xl">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" /> 
                      <span className="text-sm font-medium tracking-tight">Decoupling telemetry matrices...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredUserWiseList.length > 0 ? (
                        filteredUserWiseList.map((item) => {
                          const hasSearches = item.logsCount > 0;
                          const isExpanded = selectedUserLogsMobile === item.user.mobile;
                          const firstName = item.user.name ? item.user.name.split(" ")[0] : "Agent";

                          return (
                            <div 
                              key={item.user.mobile}
                              onClick={() => hasSearches && setSelectedUserLogsMobile(isExpanded ? null : item.user.mobile)}
                              className={`flex flex-col p-5 rounded-2xl border transition-all ${
                                hasSearches 
                                  ? "bg-[#1A1D24] border-white/5 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer" 
                                  : "bg-[#0A0D14] border-white/5 opacity-60"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                                <div className="space-y-3 flex-1 min-w-0">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex -space-x-2 shrink-0">
                                      <div className={`w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-xs font-bold ${hasSearches ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                                        {firstName.charAt(0).toUpperCase()}
                                      </div>
                                    </div>
                                    <h3 className={`text-sm font-extrabold tracking-wide uppercase px-2.5 py-1 rounded-lg ${
                                      hasSearches 
                                        ? "text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 shadow-sm shadow-indigo-500/10" 
                                        : "text-slate-400 bg-[#0A0D14]"
                                    }`}>
                                      {firstName}
                                    </h3>
                                    <span className="bg-white/5 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/10 shrink-0">
                                      ID: {item.user.mobile}
                                    </span>
                                    {hasSearches && (
                                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex gap-1 uppercase tracking-wider shrink-0">
                                        Active Traces Present
                                      </span>
                                    )}
                                  </div>
                                  
                                  {item.latestLog && !isExpanded && (
                                    <div className="bg-[#0A0D14] border border-white/5 p-3 rounded-xl flex items-center justify-between gap-4 w-full sm:max-w-md">
                                      <div className="space-y-0.5">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Latest Signature</p>
                                        <p className="text-sm font-bold text-white font-mono tracking-wider">{item.latestLog.vehicle_number}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 pt-2">
                                          <Clock className="w-3.5 h-3.5" />
                                          {new Date(item.latestLog.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {!hasSearches && (
                                    <p className="text-xs text-slate-500 pt-1">No telemetry traces detected.</p>
                                  )}
                                </div>

                                <div className="mt-2 sm:mt-0 flex shrink-0 items-center justify-end gap-3">
                                  {hasSearches && (
                                    <button 
                                      className="text-xs font-bold text-white group flex items-center gap-2 bg-[#12141C] hover:bg-slate-800 px-4 py-2 rounded-xl transition-all border border-white/10 active:scale-95"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedUserLogsMobile(isExpanded ? null : item.user.mobile);
                                      }}
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp className="h-4 w-4" /> Hide Searches
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-4 w-4" /> Dropdown Log
                                        </>
                                      )}
                                      <span className="bg-[#0A0D14]/50 border border-white/10 text-[10px] px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold ml-1">{item.logsCount}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Collapsible Dropdown for all searches */}
                              {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-white/5 space-y-3 w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-between px-1 pb-1">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                      <History className="h-3.5 w-3.5 text-indigo-400" /> All Search Histories
                                    </h4>
                                    {isSuperAdmin && (
                                      <button
                                        onClick={() => {
                                          confirmAction(
                                            "Purge Node Traces",
                                            "Purge all telemetry traces for this specific node? This cannot be undone.",
                                            () => handleClearLogs(item.user.mobile)
                                          );
                                        }}
                                        className="text-[10px] font-bold text-rose-400 border border-rose-500/10 hover:border-rose-500/30 px-2 py-1 rounded bg-rose-500/5 hover:bg-rose-500/10 transition-all animate-pulse"
                                      >
                                        Purge All Local Traces
                                      </button>
                                    )}
                                  </div>
                                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                    {item.logs.map((log, index) => (
                                      <div key={log.id || index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#0A0D14] border border-white/5 p-3.5 rounded-xl hover:border-indigo-500/20 transition-all gap-4">
                                        <div className="flex items-center gap-3.5 min-w-0">
                                          <div className="w-9 h-9 rounded-lg bg-[#12141C] border border-white/5 flex items-center justify-center text-slate-500 shrink-0">
                                            <Car className="w-4.5 h-4.5 text-indigo-400" />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-sm font-bold text-white font-mono tracking-wider truncate select-all">{log.vehicle_number}</p>
                                            <p className="text-[10px] text-slate-500 font-mono truncate">
                                              Model Target: <span className="text-slate-400">{log.model || "Unknown Unit"}</span>
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-indigo-400" />
                                            {new Date(log.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                          </span>
                                          {(isSuperAdmin || user.role === "ADMIN") && (
                                            <button 
                                              onClick={() => handleDeleteLog(log.id)}
                                              className="text-slate-600 hover:text-rose-400 transition-colors p-1.5 rounded hover:bg-rose-500/10"
                                              title="Delete Trace"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-16 bg-[#1A1D24] border border-dashed border-white/10 rounded-2xl text-center flex flex-col items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-[#0A0D14] border border-white/5 flex items-center justify-center mb-4 text-slate-600">
                            <AlertCircle className="w-8 h-8" />
                          </div>
                          <p className="text-sm font-bold text-white tracking-tight">No Matching Telemetry</p>
                          <p className="text-xs text-slate-500 mt-2">Adjust your filtering parameters to reveal connected nodes.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        </div>
        )}
      </div>
    </div>
  );
}
