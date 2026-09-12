/// <reference types="vite/client" />

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps, deleteApp, FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch,
  getDocFromServer,
  getDocsFromServer,
  getCountFromServer,
  orderBy,
  startAt,
  endAt,
  limit,
  Firestore
} from "firebase/firestore";
import { getAuth, Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, updateProfile, signOut, onAuthStateChanged } from "firebase/auth";
import { 
  User as DBUser, 
  Vehicle, 
  UploadedFile, 
  SearchHistory, 
  FieldPermissions, 
  Subscription,
  FirebaseConnectionConfig 
} from "./types";
import firebaseConfig from "../firebase-applet-config.json";

// -------------------------------------------------------------
// 1. ERROR HANDLER (Required by firebase-integration skill)
// -------------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentAuth = authInstance;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: currentAuth ? {
      userId: currentAuth.currentUser?.uid,
      email: currentAuth.currentUser?.email,
      emailVerified: currentAuth.currentUser?.emailVerified,
      isAnonymous: currentAuth.currentUser?.isAnonymous,
      tenantId: currentAuth.currentUser?.tenantId,
      providerInfo: currentAuth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    } : {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// -------------------------------------------------------------
// 2. DETECT AND INITIALIZE REAL FIREBASE SECURELY
// -------------------------------------------------------------
let resolvedConfig: FirebaseConnectionConfig | null = null;

// Read config from Vite environment variables (prefixed with VITE_)
const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;

// Read config from localStorage if user specified custom credentials in the dashboard
const localConfigStr = localStorage.getItem("COMPANION_CUSTOM_FIREBASE_CONFIG");

if (localConfigStr) {
  try {
    const parsed = JSON.parse(localConfigStr);
    if (parsed && parsed.projectId && parsed.apiKey) {
      resolvedConfig = parsed;
      console.log("Firebase initialized using user-provided credentials from Cache.");
    }
  } catch (e) {
    console.error("Failed to parse custom Firebase config", e);
  }
}

// Fallback to sandbox applet credentials from firebase-applet-config.json
if (!resolvedConfig && firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey) {
  resolvedConfig = {
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket || `${firebaseConfig.projectId}.appspot.com`,
    messagingSenderId: firebaseConfig.messagingSenderId || "",
    appId: firebaseConfig.appId || "",
  };
  console.log("Firebase initialized using firebase-applet-config.json.", firebaseConfig.projectId);
}

// Fallback to env-vars
if (!resolvedConfig && envApiKey && envProjectId) {
  resolvedConfig = {
    apiKey: envApiKey,
    authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`,
    projectId: envProjectId,
    storageBucket: envStorageBucket || `${envProjectId}.appspot.com`,
    messagingSenderId: envMessagingSenderId || "",
    appId: envAppId || "",
  };
  console.log("Firebase initialized using environment variables.", envProjectId);
}

// Global instances
export let firebaseApp: FirebaseApp | null = null;
export let dbInstance: Firestore | null = null;
export let authInstance: Auth | null = null;
export let isRealFirebase = false;

if (resolvedConfig) {
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(resolvedConfig);
    } else {
      firebaseApp = getApp();
    }
    
    // Pass firestoreDatabaseId if utilizing the applet's preset firebase config project
    const dbId = (resolvedConfig.projectId === firebaseConfig.projectId) 
      ? (firebaseConfig as any).firestoreDatabaseId || "(default)"
      : "(default)";
    
    // Implement and enable persistent offline cache (Mandatory Safeguard 2)
    dbInstance = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, dbId);
    authInstance = getAuth(firebaseApp);
    isRealFirebase = true;
    console.log("Real Firebase Client set up successfully.");

    // Validate connection test-run lazily
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(dbInstance!, 'test_connection_dummy', 'ping'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('client is offline')) {
          console.warn("Firebase client reports as offline. Query caching may occur.");
        }
      }
    };
    testConnection();
  } catch (error) {
    console.error("Failed to instantiate real Firebase SDK. Cascading to local emulator.", error);
    isRealFirebase = false;
  }
}

// -------------------------------------------------------------
// 3. INTERNAL EMULATED DATABASE LAYER (PERFECT FALLBACK)
// -------------------------------------------------------------
// Standard default seed data for a super clean, responsive offline preview
const DEFAULT_USERS_SEED: DBUser[] = [
  {
    name: "Alok Kumar (Admin)",
    mobile: "1111111111",
    password: "admin",
    role: "ADMIN",
    status: "ACTIVE",
    registered_device_id: "WEB_AGENT_CHROME_MOCK_1",
    is_first_time: false,
    creator_mobile: "admin"
  },
  {
    name: "Meera Gupta (Staff)",
    mobile: "2222222222",
    password: "office",
    role: "OFFICE_STAFF",
    status: "ACTIVE",
    registered_device_id: "WEB_AGENT_CHROME_MOCK_2",
    is_first_time: false,
    creator_mobile: "1111111111"
  },
  {
    name: "Rohit Sen (Agent)",
    mobile: "3333333333",
    password: "agent",
    role: "NORMAL_USER",
    status: "ACTIVE",
    registered_device_id: "WEB_AGENT_CHROME_MOCK_3",
    is_first_time: true, // Focus password reset workflow
    creator_mobile: "1111111111"
  },
  {
    name: "Vikram Das (Disabled Agent)",
    mobile: "4444444444",
    password: "agent",
    role: "NORMAL_USER",
    status: "DISABLED",
    registered_device_id: "",
    is_first_time: false,
    creator_mobile: "1111111111"
  }
];

const DEFAULT_VEHICLES_SEED: Vehicle[] = [
  {
    id: "v_1",
    registration_number: "DL1CAB5560",
    owner: "Suresh Chandra Mandi",
    model: "Maruti Suzuki Swift DDiS",
    status: "Active",
    bank_name: "HDFC Bank Ltd",
    pos: "New Delhi Okhla",
    emi: "14,500 INR",
    engine_number: "ENG-ENG33488210",
    chassis_number: "CHS-992383820",
    confirmer_name: "Surendra Yadav",
    loan_no: "LN-HDFC-9938812",
    creator_mobile: "1111111111",
    file_name: "delhi_delinquencies_v1.xlsx",
    bucket: "BK-1"
  },
  {
    id: "v_2",
    registration_number: "MH12GP9045",
    owner: "Ramesh Ganpatrao Shinde",
    model: "Mahindra Scorpio S11",
    status: "Active",
    bank_name: "State Bank of India",
    pos: "Pune Swargate",
    emi: "24,800 INR",
    engine_number: "ENG-MAH4419920",
    chassis_number: "CHS-SC4420888",
    confirmer_name: "Milind Gawade",
    loan_no: "LN-SBI-44029288",
    creator_mobile: "1111111111",
    file_name: "maharashtra_rec_june.xlsx",
    bucket: "BK-2"
  },
  {
    id: "v_3",
    registration_number: "MH02ER3122",
    owner: "Karan Johar Rawat",
    model: "Hyundai Creta SX",
    status: "Active",
    bank_name: "HDFC Bank Ltd",
    pos: "Mumbai Andheri East",
    emi: "19,200 INR",
    engine_number: "ENG-HYU99318",
    chassis_number: "CHS-CRT77821",
    confirmer_name: "Nilesh Sawant",
    loan_no: "LN-HDFC-2283811",
    creator_mobile: "1111111111",
    file_name: "maharashtra_rec_june.xlsx",
    bucket: "BK-3"
  },
  {
    id: "v_4",
    registration_number: "KA03MM8871",
    owner: "Ankit Srinivas Rao",
    model: "Tata Nexon EV",
    status: "Active",
    bank_name: "Axis Bank Ltd",
    pos: "Bangalore Whitefield",
    emi: "16,700 INR",
    engine_number: "ENG-EV88210",
    chassis_number: "CHS-NX887211",
    confirmer_name: "Venkatesh Prasad",
    loan_no: "LN-AXIS-8821422",
    creator_mobile: "1111111111",
    file_name: "bangalore_ev_data.xlsx",
    bucket: "BK-2"
  },
  {
    id: "v_5",
    registration_number: "DL3CBS1092",
    owner: "Pradeep Yadav",
    model: "Honda City i-VTEC",
    status: "Active",
    bank_name: "ICICI Bank Ltd",
    pos: "Delhi Connaught Place",
    emi: "15,800 INR",
    engine_number: "ENG-HON-81123",
    chassis_number: "CHS-CIT-99044",
    confirmer_name: "Dharmender Singh",
    loan_no: "LN-ICICI-441221",
    creator_mobile: "1111111111",
    file_name: "delhi_delinquencies_v1.xlsx",
    bucket: "BK-1"
  }
];

const DEFAULT_FILES_SEED: UploadedFile[] = [
  {
    id: "1111111111_delhi_delinquencies_v1.xlsx",
    file_name: "delhi_delinquencies_v1.xlsx",
    admin_mobile: "1111111111",
    uploaded_at: 1781033600000,
    record_count: 2
  },
  {
    id: "1111111111_maharashtra_rec_june.xlsx",
    file_name: "maharashtra_rec_june.xlsx",
    admin_mobile: "1111111111",
    uploaded_at: 1781034000000,
    record_count: 2
  },
  {
    id: "1111111111_bangalore_ev_data.xlsx",
    file_name: "bangalore_ev_data.xlsx",
    admin_mobile: "1111111111",
    uploaded_at: 1781034500000,
    record_count: 1
  }
];

const DEFAULT_PERMS_SEED: FieldPermissions[] = [
  {
    id: "NORMAL_USER_1111111111",
    role_string: "NORMAL_USER_1111111111",
    role: "NORMAL_USER",
    show_customer_name: true,
    show_vehicle_number: true,
    show_bank_name: true,
    show_pos: false, // Default false to showcase masking!
    show_emi: false, // Masked
    show_engine_number: false, // Masked
    show_chassis_number: false, // Masked
    show_confirmer_name: true,
    show_loan_no: true,
    show_file_name: false,
    show_bucket: false
  }
];

const DEFAULT_LOGS_SEED: SearchHistory[] = [
  {
    user_mobile: "3333333333",
    user_name: "Rohit Sen (Agent)",
    vehicle_number: "DL1CAB5560",
    model: "Maruti Suzuki Swift DDiS",
    timestamp: new Date().toISOString(),
    creator_mobile: "1111111111"
  }
];

// Empty by design: no doc means blocked until super-admin recharges.
const DEFAULT_SUBS_SEED: Subscription[] = [];

// Read collection from localStorage with direct schema-matching format
function getLocalCollection<T>(key: string, seed: T[]): T[] {
  const cached = localStorage.getItem(`MOCK_FIRESTORE_${key}`);
  if (!cached) {
    localStorage.setItem(`MOCK_FIRESTORE_${key}`, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(cached);
  } catch (e) {
    console.error(`Local collection parsing failed for ${key}`, e);
    return seed;
  }
}

function saveLocalCollection<T>(key: string, data: T[]) {
  localStorage.setItem(`MOCK_FIRESTORE_${key}`, JSON.stringify(data));
}

// Normalized search fields for server-side prefix search (quota-safe for
// 40K+ datasets). Stored on every uploaded vehicle; old docs without these
// fields simply won't match server queries until re-imported.
function normReg(value: string): string {
  return (value || "").toUpperCase().replace(/[\s-]+/g, "");
}

function vehicleSearchFields(v: Vehicle): Record<string, string> {
  return {
    reg_norm: normReg(v.registration_number),
    reg_rev: [...normReg(v.registration_number)].reverse().join(""),
    engine_norm: normReg(v.engine_number),
    engine_rev: [...normReg(v.engine_number)].reverse().join(""),
    chassis_norm: normReg(v.chassis_number),
    chassis_rev: [...normReg(v.chassis_number)].reverse().join(""),
    loan_norm: normReg(v.loan_no),
    owner_norm: (v.owner || "").toUpperCase().trim(),
  };
}

// -------------------------------------------------------------
// 4. UNIFIED CONTEXT SERVICE API
// -------------------------------------------------------------
export const FirebaseService = {
  // Config modification
  saveCustomConfig: (config: FirebaseConnectionConfig) => {
    localStorage.setItem("COMPANION_CUSTOM_FIREBASE_CONFIG", JSON.stringify(config));
    window.location.reload(); // Reload immediately so SDK bootstraps with new credentials!
  },

  clearCustomConfig: () => {
    localStorage.removeItem("COMPANION_CUSTOM_FIREBASE_CONFIG");
    localStorage.removeItem("MOCK_FIRESTORE_users");
    localStorage.removeItem("MOCK_FIRESTORE_vehicles");
    localStorage.removeItem("MOCK_FIRESTORE_uploaded_files");
    localStorage.removeItem("MOCK_FIRESTORE_search_histories");
    localStorage.removeItem("MOCK_FIRESTORE_field_permissions");
    localStorage.removeItem("MOCK_FIRESTORE_subscriptions");
    window.location.reload();
  },

  // Users Auth / Session Operations
  // Secure mode: doc ID = Auth UID. Mock mode: doc ID = mobile (legacy).
  getUsers: async (): Promise<DBUser[]> => {
    if (isRealFirebase && dbInstance) {
      const path = 'users';
      try {
        const snap = await getDocs(collection(dbInstance, path));
        return snap.docs.map(d => {
          const data = d.data() as any;
          return { ...data, uid: d.id, mobile: data.mobile || d.id } as DBUser;
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, path);
      }
    } else {
      return getLocalCollection<DBUser>("users", DEFAULT_USERS_SEED);
    }
  },

  addUser: async (user: DBUser): Promise<void> => {
    const docId = (isRealFirebase && (user as any).uid) ? (user as any).uid as string : user.mobile;
    if (isRealFirebase && dbInstance) {
      const path = `users/${docId}`;
      try {
        await setDoc(doc(dbInstance, 'users', docId), user);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    } else {
      const users = getLocalCollection<DBUser>("users", DEFAULT_USERS_SEED);
      // Remove duplicates
      const filtered = users.filter(u => u.mobile !== user.mobile);
      filtered.push(user);
      saveLocalCollection("users", filtered);
    }
  },

  updateUser: async (docId: string, updates: Partial<DBUser>): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = `users/${docId}`;
      try {
        await updateDoc(doc(dbInstance, 'users', docId), updates as any);
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, path);
      }
    } else {
      const users = getLocalCollection<DBUser>("users", DEFAULT_USERS_SEED);
      const updated = users.map(u => u.mobile === docId ? { ...u, ...updates } : u);
      saveLocalCollection("users", updated);
    }
  },

  deleteUser: async (docId: string): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = `users/${docId}`;
      try {
        await deleteDoc(doc(dbInstance, 'users', docId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    } else {
      const users = getLocalCollection<DBUser>("users", DEFAULT_USERS_SEED);
      const filtered = users.filter(u => u.mobile !== docId);
      saveLocalCollection("users", filtered);
    }
  },

  // Vehicles Management
  getVehicles: async (creatorMobile?: string): Promise<Vehicle[]> => {
    if (isRealFirebase && dbInstance) {
      const path = 'vehicles';
      try {
        let q;
        if (creatorMobile) {
          q = query(collection(dbInstance, path), where("creator_mobile", "==", creatorMobile));
        } else {
          q = collection(dbInstance, path);
        }
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Vehicle));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, path);
      }
    } else {
      const list = getLocalCollection<Vehicle>("vehicles", DEFAULT_VEHICLES_SEED);
      if (creatorMobile) {
        return list.filter(v => v.creator_mobile === creatorMobile);
      }
      return list;
    }
  },

  // Dedicated explicit function to bypass cache on manual Sync actions (Safeguard 2)
  syncData: async (creatorMobile?: string): Promise<Vehicle[]> => {
    if (isRealFirebase && dbInstance) {
      const path = 'vehicles';
      try {
        let q;
        if (creatorMobile) {
          q = query(collection(dbInstance, path), where("creator_mobile", "==", creatorMobile));
        } else {
          q = collection(dbInstance, path);
        }
        // Force sync through network to bypass local cache
        const snap = await getDocsFromServer(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Vehicle));
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, path);
      }
    } else {
      return await FirebaseService.getVehicles(creatorMobile);
    }
  },

  handleForceSync: async (creatorMobile?: string): Promise<Vehicle[]> => {
    return await FirebaseService.syncData(creatorMobile);
  },

  importVehiclesBatch: async (
    vehicles: Vehicle[],
    uploadedFile: UploadedFile,
    onProgress?: (doneChunks: number, totalChunks: number) => void
  ): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      // 1. Save File Upload Metadata
      const fileId = `${uploadedFile.admin_mobile}_${uploadedFile.file_name}`;
      const filePath = `uploaded_files/${fileId}`;
      try {
        await setDoc(doc(dbInstance, 'uploaded_files', fileId), uploadedFile);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, filePath);
      }

      // 2. Upload vehicles in standard chunks of 500 for optimal Firestore write performance
      const chunks: Vehicle[][] = [];
      for (let i = 0; i < vehicles.length; i += 500) {
        chunks.push(vehicles.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(dbInstance);
        for (const item of chunk) {
          const newDocRef = doc(collection(dbInstance, 'vehicles'));
          batch.set(newDocRef, { ...item, ...vehicleSearchFields(item) });
        }
        try {
          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'vehicles-batch');
        }
        onProgress?.(chunks.indexOf(chunk) + 1, chunks.length);
      }
    } else {
      // 1. Files Mock
      const files = getLocalCollection<UploadedFile>("uploaded_files", DEFAULT_FILES_SEED);
      const filesFiltered = files.filter(f => f.id !== uploadedFile.id);
      filesFiltered.push(uploadedFile);
      saveLocalCollection("uploaded_files", filesFiltered);

      // 2. Vehicles Mock
      const localVehicles = getLocalCollection<Vehicle>("vehicles", DEFAULT_VEHICLES_SEED);
      const generated = vehicles.map((v, index) => ({
        ...v,
        id: `v_imported_${Date.now()}_${index}`
      }));
      saveLocalCollection("vehicles", [...localVehicles, ...generated]);
    }
  },

  deleteFileBatch: async (adminMobile: string, fileName: string): Promise<void> => {
    const fileId = `${adminMobile}_${fileName}`;
    if (isRealFirebase && dbInstance) {
      // 1. Fetch all child vehicles belonging to file block
      const path = 'vehicles';
      try {
        const q = query(
          collection(dbInstance, path), 
          where("file_name", "==", fileName)
        );
        const snapshot = await getDocs(q);
        
        // Filter in memory to avoid the composite index requirement in Firestore
        const docRefs = snapshot.docs.filter(d => {
          const data = d.data();
          return data && data.creator_mobile === adminMobile;
        });
        
        // Delete in batches of 500
        for (let i = 0; i < docRefs.length; i += 500) {
          const chunk = docRefs.slice(i, i + 500);
          const batch = writeBatch(dbInstance);
          for (const docSnap of chunk) {
            batch.delete(docSnap.ref);
          }
          await batch.commit();
        }

        // 2. Delete main file descriptor
        await deleteDoc(doc(dbInstance, 'uploaded_files', fileId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `cascade-file-delete-${fileId}`);
      }
    } else {
      // 1. Delete file descriptor
      const files = getLocalCollection<UploadedFile>("uploaded_files", DEFAULT_FILES_SEED);
      const filesFiltered = files.filter(f => f.id !== fileId);
      saveLocalCollection("uploaded_files", filesFiltered);

      // 2. Delete vehicles associated with it
      const localVehicles = getLocalCollection<Vehicle>("vehicles", DEFAULT_VEHICLES_SEED);
      const vehiclesFiltered = localVehicles.filter(
        v => !(v.creator_mobile === adminMobile && v.file_name === fileName)
      );
      saveLocalCollection("vehicles", vehiclesFiltered);
    }
  },

  // Uploaded Files Catalogue
  getUploadedFiles: async (adminMobile?: string): Promise<UploadedFile[]> => {
    if (isRealFirebase && dbInstance) {
      const path = 'uploaded_files';
      try {
        let q;
        if (adminMobile) {
          q = query(collection(dbInstance, path), where("admin_mobile", "==", adminMobile));
        } else {
          q = collection(dbInstance, path);
        }
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as UploadedFile));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, path);
      }
    } else {
      const list = getLocalCollection<UploadedFile>("uploaded_files", DEFAULT_FILES_SEED);
      if (adminMobile) {
        return list.filter(f => f.admin_mobile === adminMobile);
      }
      return list;
    }
  },

  // Field Permissions
  getFieldPermissions: async (adminMobile: string, targetRole: "ADMIN" | "NORMAL_USER" = "NORMAL_USER"): Promise<FieldPermissions> => {
    const docId = `${targetRole}_${adminMobile}`;
    const defaultVal: FieldPermissions = {
      role_string: docId,
      role: targetRole,
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

    if (isRealFirebase && dbInstance) {
      const path = `field_permissions/${docId}`;
      try {
        const snap = await getDoc(doc(dbInstance, 'field_permissions', docId));
        if (snap.exists()) {
          return { id: snap.id, ...(snap.data() as any) } as FieldPermissions;
        } else {
          // Initialize if missing
          await setDoc(doc(dbInstance, 'field_permissions', docId), defaultVal);
          return defaultVal;
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, path);
      }
    } else {
      const perms = getLocalCollection<FieldPermissions>("field_permissions", DEFAULT_PERMS_SEED);
      const found = perms.find(p => p.role_string === docId);
      if (found) return found;

      // Create new
      perms.push(defaultVal);
      saveLocalCollection("field_permissions", perms);
      return defaultVal;
    }
  },

  saveFieldPermissions: async (adminMobile: string, perms: Partial<FieldPermissions>, targetRole: "ADMIN" | "NORMAL_USER" = "NORMAL_USER"): Promise<void> => {
    const docId = `${targetRole}_${adminMobile}`;
    if (isRealFirebase && dbInstance) {
      const path = `field_permissions/${docId}`;
      try {
        await setDoc(doc(dbInstance, 'field_permissions', docId), {
          role_string: docId,
          role: targetRole,
          ...perms
        }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    } else {
      const localPerms = getLocalCollection<FieldPermissions>("field_permissions", DEFAULT_PERMS_SEED);
      const existing = localPerms.find(p => p.role_string === docId) || {
        role_string: docId,
        role: targetRole,
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

      const updatedPerm: FieldPermissions = {
        ...existing,
        ...perms,
        role_string: docId,
        role: targetRole,
      };

      const filtered = localPerms.filter(p => p.role_string !== docId);
      filtered.push(updatedPerm);
      saveLocalCollection("field_permissions", filtered);
    }
  },

  // Search Histories
  getSearchHistories: async (creatorMobile?: string): Promise<SearchHistory[]> => {
    if (isRealFirebase && dbInstance) {
      const path = 'search_histories';
      try {
        let q;
        if (creatorMobile) {
          q = query(collection(dbInstance, path), where("creator_mobile", "==", creatorMobile));
        } else {
          q = collection(dbInstance, path);
        }
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as SearchHistory));
        return results.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, path);
      }
    } else {
      const list = getLocalCollection<SearchHistory>("search_histories", DEFAULT_LOGS_SEED);
      let res = list;
      if (creatorMobile) {
        res = list.filter(l => l.creator_mobile === creatorMobile);
      }
      return res.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  },

  addSearchHistory: async (history: SearchHistory): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = 'search_histories';
      try {
        await addDoc(collection(dbInstance, path), history);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    } else {
      const list = getLocalCollection<SearchHistory>("search_histories", DEFAULT_LOGS_SEED);
      list.push({ ...history, id: `hist_${Date.now()}` });
      saveLocalCollection("search_histories", list);
    }
  },

  deleteSearchHistory: async (id: string): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = `search_histories/${id}`;
      try {
        await deleteDoc(doc(dbInstance, 'search_histories', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    } else {
      const list = getLocalCollection<SearchHistory>("search_histories", DEFAULT_LOGS_SEED);
      saveLocalCollection("search_histories", list.filter(l => l.id !== id));
    }
  },

  clearSearchHistories: async (creatorMobile?: string): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = 'search_histories';
      try {
        let q;
        if (creatorMobile) {
          q = query(collection(dbInstance, path), where("creator_mobile", "==", creatorMobile));
        } else {
          q = collection(dbInstance, path);
        }
        const snap = await getDocs(q);
        // Batch delete
        for (let i = 0; i < snap.docs.length; i += 500) {
          const chunk = snap.docs.slice(i, i + 500);
          const batchOp = writeBatch(dbInstance);
          chunk.forEach((d) => batchOp.delete(d.ref));
          await batchOp.commit();
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    } else {
      if (creatorMobile) {
        const list = getLocalCollection<SearchHistory>("search_histories", DEFAULT_LOGS_SEED);
        saveLocalCollection("search_histories", list.filter(l => l.creator_mobile !== creatorMobile));
      } else {
        saveLocalCollection("search_histories", []);
      }
    }
  },

  // Server-side prefix search: only matching docs download (max ~50 per
  // field). No composite index needed. Creator scoping applied in memory.
  searchVehiclesServer: async (
    searchQuery: string,
    filter: string,
    creatorMobile?: string
  ): Promise<Vehicle[]> => {
    if (!isRealFirebase || !dbInstance) return [];
    const normQ = normReg(searchQuery);
    if (normQ.length < 3) return [];
    const revQ = [...normQ].reverse().join("");
    const fieldMap: Record<string, [string, string][]> = {
      VEHICLE_LAST_4: [["reg_rev", revQ]],
      ENGINE_LAST_4: [["engine_rev", revQ]],
      CHASSIS_LAST_4: [["chassis_rev", revQ]],
      LOAN_STARTS: [["loan_norm", normQ]],
      GENERAL: [
        ["reg_norm", normQ],
        ["owner_norm", searchQuery.toUpperCase().trim()],
        ["loan_norm", normQ],
        ["engine_rev", revQ],
        ["chassis_rev", revQ],
      ],
    };
    const fields = fieldMap[filter] || fieldMap["GENERAL"];
    const merged: Vehicle[] = [];
    for (const [field, prefix] of fields) {
      if (!prefix) continue;
      try {
        const q = query(
          collection(dbInstance, "vehicles"),
          orderBy(field),
          startAt(prefix),
          endAt(prefix + "\uf8ff"),
          limit(50)
        );
        const snap = await getDocs(q);
        snap.docs.forEach(d => merged.push({ id: d.id, ...(d.data() as any) } as Vehicle));
      } catch (e) {
        console.error("Server search failed for", field, e);
      }
    }
    const seen = new Set<string>();
    const out: Vehicle[] = [];
    for (const v of merged) {
      const key = v.id || v.registration_number;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!creatorMobile || v.creator_mobile === creatorMobile) out.push(v);
    }
    return out.slice(0, 100);
  },

  // Region sync: downloads ONLY Kota-region vehicles (RTO RJ-08/17/20/26/28/33
  // by reg_norm prefix). Bounded subset — quota-safe vs full download.
  // Creator scoping applied in memory. Old docs without reg_norm are skipped.
  syncRegionVehicles: async (creatorMobile?: string): Promise<Vehicle[]> => {
    if (!isRealFirebase || !dbInstance) return [];
    const prefixes = ["RJ08", "RJ17", "RJ20", "RJ26", "RJ28", "RJ33"];
    const merged: Vehicle[] = [];
    const seen = new Set<string>();
    for (const p of prefixes) {
      try {
        const q = query(
          collection(dbInstance, "vehicles"),
          orderBy("reg_norm"),
          startAt(p),
          endAt(p + "~"),
          limit(2000)
        );
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          if (seen.has(d.id)) return;
          seen.add(d.id);
          const v = { id: d.id, ...(d.data() as any) } as Vehicle;
          if (!creatorMobile || v.creator_mobile === creatorMobile) merged.push(v);
        });
      } catch (e) {
        console.error("Region sync failed for", p, e);
      }
    }
    return merged;
  },

  // Live total count via aggregation (cheap: ~1 read per 1000 docs).
  // Returns null offline so callers can fall back to file-metadata sums.
  countVehicles: async (creatorMobile?: string): Promise<number | null> => {
    if (!isRealFirebase || !dbInstance) return null;
    try {
      const base: any = collection(dbInstance, "vehicles");
      const q = creatorMobile
        ? query(base, where("creator_mobile", "==", creatorMobile))
        : base;
      const snap = await getCountFromServer(q);
      return snap.data().count;
    } catch (e) {
      console.warn("Live vehicle count failed, using fallback.", e);
      return null;
    }
  },

  // Subscriptions (admin-level recharge gate)
  getSubscription: async (adminMobile: string): Promise<Subscription | null> => {
    if (isRealFirebase && dbInstance) {
      const path = `subscriptions/${adminMobile}`;
      try {
        const snap = await getDoc(doc(dbInstance, 'subscriptions', adminMobile));
        if (snap.exists()) {
          return { admin_mobile: snap.id, ...(snap.data() as any) } as Subscription;
        }
        return null;
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, path);
      }
    } else {
      const list = getLocalCollection<Subscription>("subscriptions", DEFAULT_SUBS_SEED);
      return list.find(s => s.admin_mobile === adminMobile) || null;
    }
  },

  saveSubscription: async (sub: Subscription): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = `subscriptions/${sub.admin_mobile}`;
      try {
        await setDoc(doc(dbInstance, 'subscriptions', sub.admin_mobile), sub);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    } else {
      const list = getLocalCollection<Subscription>("subscriptions", DEFAULT_SUBS_SEED);
      saveLocalCollection("subscriptions", [
        ...list.filter(s => s.admin_mobile !== sub.admin_mobile),
        sub
      ]);
    }
  },

};

// -------------------------------------------------------------
// 6. DEVICE BIND (web parity with Android: one browser per agent)
// -------------------------------------------------------------
export function getWebDeviceId(): string {
  let id = null;
  try {
    id = localStorage.getItem("WEB_DEVICE_ID");
  } catch (e) {}
  if (!id) {
    id = `WEB_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    try {
      localStorage.setItem("WEB_DEVICE_ID", id);
    } catch (e) {}
  }
  return id;
}

// Admins bypass the device lock (same as Android)
export function isDeviceLockExempt(user: DBUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.mobile === "admin";
}

// Empty or legacy mock IDs bind fresh on next login (one-time migration)
export function needsDeviceBind(user: DBUser): boolean {
  const id = user.registered_device_id || "";
  return id === "" || id.startsWith("WEB_AGENT_CHROME_MOCK_");
}
// -------------------------------------------------------------
// 7. FIREBASE AUTH (secure mode: UID-keyed users, synthetic emails)
// -------------------------------------------------------------
export function userDocId(u: { uid?: string; mobile: string }): string {
  return isRealFirebase && u.uid ? u.uid : u.mobile;
}

export function syntheticEmail(mobile: string): string {
  return `${mobile.trim()}@recoveryx.app`;
}

// Token scope packed into Auth displayName: just the SCOPE string
// (admin mobile, or ALL). Rules v3 compare it directly — no parsing,
// no get() calls, nothing that can throw on stale tokens.
export function authScopePack(role: string, mobile: string, creatorMobile: string): string {
  const m = (mobile || "").trim();
  if (role === "SUPER_ADMIN" || m === "admin") return "ALL";
  if (role === "ADMIN") return m;
  return (creatorMobile || "").trim() || m;
}

// Resolves once Firebase Auth finishes restoring its persisted session
export function authReady(): Promise<void> {
  if (!authInstance) return Promise.resolve();
  const current = authInstance.currentUser;
  if (current) return Promise.resolve();
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(authInstance!, () => {
      unsub();
      resolve();
    });
    // Safety timeout: never block login longer than 4s
    setTimeout(() => {
      try { unsub(); } catch (e) {}
      resolve();
    }, 4000);
  });
}

export interface AuthLoginResult {
  uid: string;
  profile: DBUser;
}

export async function authLogin(mobile: string, password: string): Promise<AuthLoginResult> {
  if (!isRealFirebase || !authInstance || !dbInstance) {
    throw new Error("Secure auth unavailable in demo mode.");
  }
  const cleanMobile = mobile.trim();
  const cleanPass = password.trim();
  let uid: string;
  try {
    const cred = await signInWithEmailAndPassword(authInstance, syntheticEmail(cleanMobile), cleanPass);
    uid = cred.user.uid;
    // Force a fresh ID token so just-packed name claims (backfill/role
    // change) reach Firestore immediately — not after the hourly refresh.
    try {
      await cred.user.getIdToken(true);
    } catch (e) {
      console.warn("Token force-refresh failed, continuing with cached token.", e);
    }
  } catch (e: any) {
    const code: string = e?.code || "";
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      // No legacy fallback (removed post-cutover): without an Auth account
      // there is no secure way to verify identity under strict rules.
      // Unmigrated users must be re-created by super admin.
      throw new Error("Account not found. Please verify your mobile number.");
    }
    if (code === "auth/wrong-password") {
      throw new Error("Incorrect password. Please try again.");
    }
    if (code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Try again later.");
    }
    if (code === "auth/user-disabled") {
      throw new Error("This account has been disabled. Please contact your administrator.");
    }
    throw new Error("Authentication failed. Please retry.");
  }
  const snap = await getDoc(doc(dbInstance, "users", uid));
  if (!snap.exists()) {
    try { await signOut(authInstance); } catch (e) {}
    throw new Error("Account not migrated yet. Contact Super Admin.");
  }
  const data = snap.data() as any;
  return { uid: snap.id, profile: { ...data, uid: snap.id, mobile: data.mobile || mobile } as DBUser };
}

// Separate Auth instance so creating/resetting accounts never disturbs
// the admin's own session.
function secondaryAuth(): Auth {
  if (!firebaseApp) throw new Error("Firebase not initialized.");
  const name = "recoveryx-secondary";
  const existing = getApps().find(a => a.name === name);
  const app = existing || initializeApp({
    apiKey: (firebaseApp.options as any).apiKey,
    authDomain: (firebaseApp.options as any).authDomain,
    projectId: (firebaseApp.options as any).projectId,
    storageBucket: (firebaseApp.options as any).storageBucket,
    messagingSenderId: (firebaseApp.options as any).messagingSenderId,
    appId: (firebaseApp.options as any).appId,
  }, name);
  return getAuth(app);
}

export async function createAuthUser(mobile: string, password: string, scopePack?: string): Promise<string> {
  const sAuth = secondaryAuth();
  try {
    const cred = await createUserWithEmailAndPassword(sAuth, syntheticEmail(mobile), password);
    const uid = cred.user.uid;
    if (scopePack) {
      try { await updateProfile(cred.user, { displayName: scopePack }); } catch (e) {}
    }
    await signOut(sAuth);
    return uid;
  } catch (e: any) {
    try { await signOut(sAuth); } catch (err) {}
    if (e?.code === "auth/email-already-in-use") {
      throw new Error("Auth account already exists for this mobile (previously deleted?).");
    }
    throw new Error(e?.message || "Failed to create auth account.");
  }
}

// Admin-side password reset: sign in as the user on the secondary instance
// (using the current password on record), set the new one, sign out.
export async function resetAuthPassword(mobile: string, oldPassword: string, newPassword: string, scopePack?: string): Promise<void> {
  const sAuth = secondaryAuth();
  try {
    const cred = await signInWithEmailAndPassword(sAuth, syntheticEmail(mobile), oldPassword);
    await updatePassword(cred.user, newPassword);
    if (scopePack) {
      try { await updateProfile(cred.user, { displayName: scopePack }); } catch (e) {}
    }
  } catch (e: any) {
    const code: string = e?.code || "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      throw new Error("Could not verify current password in Auth. Password not changed there.");
    }
    throw new Error(e?.message || "Auth password reset failed.");
  } finally {
    try { await signOut(sAuth); } catch (err) {}
  }
}

// Set/refresh the token scope pack on an existing Auth account (backfill + role changes)
export async function setAuthScope(mobile: string, password: string, scopePack: string): Promise<void> {
  const sAuth = secondaryAuth();
  try {
    const cred = await signInWithEmailAndPassword(sAuth, syntheticEmail(mobile), password);
    await updateProfile(cred.user, { displayName: scopePack });
  } finally {
    try { await signOut(sAuth); } catch (err) {}
  }
}

// Best-effort cleanup of an Auth account (used for create rollback).
// Only works right after creation while credentials are known.
export async function deleteAuthUser(mobile: string, password: string): Promise<void> {
  const sAuth = secondaryAuth();
  try {
    const cred = await signInWithEmailAndPassword(sAuth, syntheticEmail(mobile), password);
    await cred.user.delete();
  } finally {
    try { await signOut(sAuth); } catch (err) {}
  }
}

export function authLogout(): Promise<void> {
  if (!authInstance) return Promise.resolve();
  return signOut(authInstance).catch(() => {});
}

function randomTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(8);
  (window.crypto || (window as any).msCrypto).getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += chars[arr[i] % chars.length];
  return out;
}

export interface MigrationResult {
  mobile: string;
  name: string;
  status: "created" | "failed";
  note: string;
  tempPassword?: string;
}

export interface BackfillResult {
  mobile: string;
  name: string;
  status: "fixed" | "failed" | "skipped";
  note: string;
}

// Backfill token scopes for ALREADY-migrated accounts (needs OPEN rules
// briefly, since it lists users+passwords). Run BEFORE publishing rules v2.
// Everyone must logout+login afterwards so tokens carry the name claim.
export async function backfillTokenScopes(
  onProgress?: (done: number, total: number) => void
): Promise<BackfillResult[]> {
  if (!isRealFirebase || !dbInstance) {
    throw new Error("Needs real Firebase.");
  }
  const snap = await getDocs(collection(dbInstance, "users"));
  const targets = snap.docs.filter(d => {
    const data = d.data() as any;
    return (data.uid || data.auth_uid) && data.mobile && data.password;
  });
  const results: BackfillResult[] = [];
  let done = 0;
  for (const d of targets) {
    const data = d.data() as any;
    const mobile: string = (data.mobile || "").trim();
    const name: string = data.name || mobile;
    try {
      await setAuthScope(
        mobile,
        (data.password || "").trim(),
        authScopePack(data.role || "NORMAL_USER", mobile, data.creator_mobile || mobile)
      );
      results.push({ mobile, name, status: "fixed", note: "Scope packed" });
    } catch (e: any) {
      results.push({ mobile, name, status: "failed", note: e?.message || "Failed" });
    }
    done++;
    try { onProgress?.(done, targets.length); } catch (err) {}
  }
  return results;
}

// Post-cutover cleanup: delete legacy mobile-keyed docs (no uid field).
// Run only after migration verified + strict rules published.
export async function cleanupLegacyUserDocs(
  onProgress?: (done: number, total: number) => void
): Promise<{ deleted: number; kept: number }> {
  if (!isRealFirebase || !dbInstance) {
    throw new Error("Needs real Firebase.");
  }
  const snap = await getDocs(collection(dbInstance, "users"));
  let deleted = 0;
  let kept = 0;
  let done = 0;
  for (const d of snap.docs) {
    const data = d.data() as any;
    if (!data.uid && !data.auth_uid) {
      await deleteDoc(d.ref);
      deleted++;
    } else {
      kept++;
    }
    done++;
    try { onProgress?.(done, snap.size); } catch (err) {}
  }
  return { deleted, kept };
}

export interface DiagResult {
  label: string;
  ok: boolean;
  detail: string;
}

// One-tap connection diagnostics: token claims + single-get + small list +
// full list + indexed query. Pinpoints token vs rules failures exactly.
export async function runDiagnostics(): Promise<DiagResult[]> {
  const out: DiagResult[] = [];
  if (!isRealFirebase || !dbInstance || !authInstance) {
    out.push({ label: "Mode", ok: false, detail: "Demo/mock mode — diagnostics need real Firebase." });
    return out;
  }
  const u = authInstance.currentUser;
  if (!u) {
    out.push({ label: "Auth session", ok: false, detail: "No Firebase user — logout + login first." });
    return out;
  }
  try {
    const tok = await u.getIdTokenResult(false);
    const email = (tok.claims.email as string) || "";
    const name = ((tok.claims as any).name as string) || "";
    out.push({
      label: "Token claims",
      ok: !!(email && name),
      detail: `email=${email || "?"} name=${name || "(missing — relogin needed)"}`,
    });
  } catch (e: any) {
    out.push({ label: "Token claims", ok: false, detail: e?.message || "Token read failed" });
  }
  // Single-get own doc (no list involved)
  try {
    const snap = await getDoc(doc(dbInstance, "users", u.uid));
    out.push({
      label: "Own profile read",
      ok: snap.exists(),
      detail: snap.exists() ? `role=${(snap.data() as any).role || "?"}` : "doc missing",
    });
  } catch (e: any) {
    out.push({ label: "Own profile read", ok: false, detail: e?.message || String(e) });
  }
  // Small list (limit 1): passes even under tight per-request budgets
  try {
    const snap = await getDocs(query(collection(dbInstance, "users"), limit(1)));
    out.push({ label: "Users list (1 doc probe)", ok: true, detail: `returned ${snap.size}` });
  } catch (e: any) {
    out.push({ label: "Users list (1 doc probe)", ok: false, detail: e?.message || String(e) });
  }
  // Full list
  try {
    const snap = await getDocs(collection(dbInstance, "users"));
    out.push({ label: "Users list (full)", ok: true, detail: `${snap.size} docs readable` });
  } catch (e: any) {
    out.push({ label: "Users list (full)", ok: false, detail: e?.message || String(e) });
  }
  // Indexed orderBy query (region/search path)
  try {
    const snap = await getDocs(query(collection(dbInstance, "vehicles"), orderBy("reg_norm"), limit(1)));
    out.push({ label: "Vehicle index probe", ok: true, detail: `returned ${snap.size}` });
  } catch (e: any) {
    out.push({ label: "Vehicle index probe", ok: false, detail: e?.message || String(e) });
  }
  return out;
}

// One-time migration (super admin, BEFORE publishing secure rules):
// legacy mobile-keyed docs -> Auth accounts + UID-keyed docs.
// Weak (<6 char) passwords are auto-reset; temp passwords are reported once.
export async function migrateLegacyUsers(
  onProgress?: (done: number, total: number) => void
): Promise<MigrationResult[]> {
  if (!isRealFirebase || !dbInstance) {
    throw new Error("Migration needs real Firebase.");
  }
  const snap = await getDocs(collection(dbInstance, "users"));
  const legacy = snap.docs.filter(d => {
    const data = d.data() as any;
    return !data.uid && !data.auth_uid;
  });
  const results: MigrationResult[] = [];
  let done = 0;
  for (const d of legacy) {
    const data = d.data() as any;
    const mobile: string = (data.mobile || d.id || "").trim();
    const name: string = data.name || mobile;
    try {
      if (!mobile) throw new Error("Missing mobile.");
      let password: string = ((data.password || "") as string).trim();
      let temp: string | undefined;
      if (!/^[A-Za-z0-9]{6,}$/.test(password)) {
        password = randomTempPassword();
        temp = password;
      }
      let uid: string;
      try {
        uid = await createAuthUser(mobile, password);
      } catch (e: any) {
        if (/already exists/.test(e?.message || "")) {
          // Recover UID by signing in on the secondary instance
          const sAuth = secondaryAuth();
          const cred = await signInWithEmailAndPassword(sAuth, syntheticEmail(mobile), password);
          uid = cred.user.uid;
          await signOut(sAuth);
        } else {
          throw e;
        }
      }
      await setDoc(doc(dbInstance!, "users", uid), {
        ...data,
        mobile,
        password,
        uid,
        email: syntheticEmail(mobile),
        auth_uid: uid,
      });
      // Token scope pack (rules v2 identity) — needs a fresh sign-in
      try {
        await setAuthScope(mobile, password, authScopePack(data.role || "NORMAL_USER", mobile, data.creator_mobile || mobile));
      } catch (e: any) {
        results.push({ mobile, name, status: "failed", note: "Doc created but scope pack failed: " + (e?.message || "sign-in failed") });
        done++;
        try { onProgress?.(done, legacy.length); } catch (err) {}
        continue;
      }
      results.push({
        mobile,
        name,
        status: "created",
        note: temp ? "Weak password auto-reset" : "Migrated",
        tempPassword: temp,
      });
    } catch (e: any) {
      results.push({ mobile, name, status: "failed", note: e?.message || "Failed" });
    }
    done++;
    try { onProgress?.(done, legacy.length); } catch (err) {}
  }
  return results;
}
export interface UserSecret {
  password: string;
  admin_mobile: string; // owner admin node (scoping)
  mobile: string;
}

// -------------------------------------------------------------
// 8. PASSWORD VAULT (US-006: passwords OUT of listable user docs)
// -------------------------------------------------------------
export const vaultService = {
  getSecret: async (uid: string): Promise<UserSecret | null> => {
    if (!isRealFirebase || !dbInstance) return null;
    try {
      const snap = await getDoc(doc(dbInstance, "user_secrets", uid));
      if (!snap.exists()) return null;
      return snap.data() as UserSecret;
    } catch (e) {
      console.error("Vault read failed", e);
      return null;
    }
  },

  saveSecret: async (uid: string, secret: UserSecret): Promise<void> => {
    if (!isRealFirebase || !dbInstance) return;
    const path = `user_secrets/${uid}`;
    try {
      await setDoc(doc(dbInstance, "user_secrets", uid), secret);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  deleteSecret: async (uid: string): Promise<void> => {
    if (!isRealFirebase || !dbInstance) return;
    try {
      await deleteDoc(doc(dbInstance, "user_secrets", uid));
    } catch (e) {
      console.error("Vault delete failed", e);
    }
  },

  // One-time move: users.password -> user_secrets/{uid}, then blank the doc field.
  movePasswordsToVault: async (
    onProgress?: (done: number, total: number) => void
  ): Promise<{ moved: number; skipped: number; failed: number }> => {
    let moved = 0;
    let skipped = 0;
    let failed = 0;
    if (!isRealFirebase || !dbInstance) return { moved, skipped, failed };
    const users = await FirebaseService.getUsers();
    let done = 0;
    for (const u of users) {
      try {
        const uid = (u as any).uid;
        const pw = (u.password || "").trim();
        if (!uid || !pw) {
          skipped++;
        } else {
          await vaultService.saveSecret(uid, {
            password: pw,
            admin_mobile: u.creator_mobile || u.mobile,
            mobile: u.mobile,
          });
          await FirebaseService.updateUser(uid, { password: "" } as any);
          moved++;
        }
      } catch (e) {
        console.error("Vault move failed for", u.mobile, e);
        failed++;
      }
      done++;
      try { onProgress?.(done, users.length); } catch (err) {}
    }
    return { moved, skipped, failed };
  },
};

// -------------------------------------------------------------
// 5. SUBSCRIPTION GATE (recharge khtm -> login band)
// -------------------------------------------------------------
// Super admin (role SUPER_ADMIN or mobile "admin") is always exempt,
// otherwise nobody could renew once everything expires.
export function isExemptUser(user: { role: string; mobile: string }): boolean {
  return user.role === "SUPER_ADMIN" || user.mobile === "admin";
}

export function resolveSubscriptionOwner(user: DBUser): string | null {
  if (isExemptUser(user)) return null;
  if (user.role === "ADMIN") return user.mobile;
  return user.creator_mobile || user.mobile;
}

export interface SubscriptionCheck {
  ok: boolean;
  subscription: Subscription | null;
}

export async function checkUserSubscription(user: DBUser): Promise<SubscriptionCheck> {
  const owner = resolveSubscriptionOwner(user);
  if (!owner) return { ok: true, subscription: null };
  try {
    // Strict mode: no doc, expired, inactive, or auto-trial => blocked.
    // Only a super-admin recharge (30D/90D/365D) unlocks login.
    const sub = await FirebaseService.getSubscription(owner);
    const now = Date.now();
    if (!sub || sub.status !== "ACTIVE" || sub.expires_at <= now || sub.plan_name.startsWith("TRIAL_")) {
      return { ok: false, subscription: sub };
    }
    return { ok: true, subscription: sub };
  } catch (e) {
    // Offline / unreachable: fail-open so field work doesn't stop.
    console.warn("Subscription check failed, allowing login (offline mode?).", e);
    return { ok: true, subscription: null };
  }
}

export function subscriptionDaysLeft(sub: Subscription): number {
  return Math.ceil((sub.expires_at - Date.now()) / 86400000);
}

// Precise countdown: "2 days 4 hours left" / "6 hours left" / "Expired"
export function formatTimeLeft(sub: Subscription): string {
  const ms = sub.expires_at - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const dLabel = days === 1 ? "day" : "days";
  const hLabel = hours === 1 ? "hour" : "hours";
  if (days <= 0) return `${hours} ${hLabel} left`;
  return `${days} ${dLabel} ${hours} ${hLabel} left`;
}

// Compact for badges: "2d 4h left" / "6h left" / "Expired"
export function formatTimeLeftShort(sub: Subscription): string {
  const ms = sub.expires_at - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days <= 0) return `${hours}h left`;
  return `${days}d ${hours}h left`;
}

// UI state shared by badges/banners — mirrors the login gate exactly.
export type SubscriptionState = "active" | "expiring" | "blocked" | "none";

export function getSubscriptionState(sub: Subscription | null): SubscriptionState {
  if (!sub) return "none";
  if (sub.status !== "ACTIVE" || sub.expires_at <= Date.now() || sub.plan_name.startsWith("TRIAL_")) {
    return "blocked";
  }
  return subscriptionDaysLeft(sub) <= 7 ? "expiring" : "active";
}
