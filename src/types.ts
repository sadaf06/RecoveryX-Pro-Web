/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "OFFICE_STAFF" | "NORMAL_USER";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface User {
  name: string;
  mobile: string; // Document ID
  password?: string;
  role: UserRole;
  status: UserStatus;
  registered_device_id: string;
  is_first_time: boolean;
  creator_mobile: string;
}

export interface Vehicle {
  id?: string; // Auto-generated Doc ID
  registration_number: string;
  owner: string; // Customer Name
  model: string;
  status: string; // Defaults to "Active"
  bank_name: string;
  pos: string;
  emi: string;
  engine_number: string;
  chassis_number: string;
  confirmer_name: string;
  loan_no: string;
  creator_mobile: string;
  file_name: string;
  bucket: string;
}

export interface UploadedFile {
  id: string; // Document ID: "adminMobile_fileName"
  file_name: string;
  admin_mobile: string;
  uploaded_at: number; // Milliseconds timestamp
  record_count: number;
}

export interface SearchHistory {
  id?: string;
  user_mobile: string;
  user_name: string;
  vehicle_number: string;
  model: string;
  timestamp: string; // ISO string or Milli string
  creator_mobile: string;
}

export interface FieldPermissions {
  id?: string; // Document ID: "NORMAL_USER_adminMobile" or "ADMIN_adminMobile"
  role_string: string; // "NORMAL_USER_adminMobile" or "ADMIN_adminMobile"
  role: "NORMAL_USER" | "ADMIN";
  show_customer_name: boolean;
  show_vehicle_number: boolean;
  show_bank_name: boolean;
  show_pos: boolean;
  show_emi: boolean;
  show_engine_number: boolean;
  show_chassis_number: boolean;
  show_confirmer_name: boolean;
  show_loan_no: boolean;
  show_file_name: boolean;
  show_bucket: boolean;
}

export interface FirebaseConnectionConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
