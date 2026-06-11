/// <reference types="vite/client" />

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
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
  Firestore
} from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { 
  User as DBUser, 
  Vehicle, 
  UploadedFile, 
  SearchHistory, 
  FieldPermissions, 
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
    window.location.reload();
  },

  // Users Auth / Session Operations
  getUsers: async (): Promise<DBUser[]> => {
    if (isRealFirebase && dbInstance) {
      const path = 'users';
      try {
        const snap = await getDocs(collection(dbInstance, path));
        return snap.docs.map(d => ({ mobile: d.id, ...d.data() } as DBUser));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, path);
      }
    } else {
      return getLocalCollection<DBUser>("users", DEFAULT_USERS_SEED);
    }
  },

  addUser: async (user: DBUser): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = `users/${user.mobile}`;
      try {
        await setDoc(doc(dbInstance, 'users', user.mobile), user);
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

  updateUser: async (mobile: string, updates: Partial<DBUser>): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = `users/${mobile}`;
      try {
        await updateDoc(doc(dbInstance, 'users', mobile), updates as any);
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, path);
      }
    } else {
      const users = getLocalCollection<DBUser>("users", DEFAULT_USERS_SEED);
      const updated = users.map(u => u.mobile === mobile ? { ...u, ...updates } : u);
      saveLocalCollection("users", updated);
    }
  },

  deleteUser: async (mobile: string): Promise<void> => {
    if (isRealFirebase && dbInstance) {
      const path = `users/${mobile}`;
      try {
        await deleteDoc(doc(dbInstance, 'users', mobile));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    } else {
      const users = getLocalCollection<DBUser>("users", DEFAULT_USERS_SEED);
      const filtered = users.filter(u => u.mobile !== mobile);
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

  importVehiclesBatch: async (vehicles: Vehicle[], uploadedFile: UploadedFile): Promise<void> => {
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
          batch.set(newDocRef, item);
        }
        try {
          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'vehicles-batch');
        }
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
  }
};
