
export enum UserRole {
  ADMIN = 'Admin',
  ACCOUNTANT = 'Accountant',
  BRANCH_MANAGER = 'Branch Manager',
  CLIENT = 'Client',
  HR = 'HR',
  EMPLOYEE = 'Employee'
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  allowedBranchIds: string[];
  displayName: string;
  clientId?: string;
  password?: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountHolderName?: string;
  accountType?: 'Savings' | 'Salary' | 'Current';
  paymentMode?: 'Bank Transfer' | 'Cheque' | 'Cash';
  upiId?: string;
  cancelledChequeUrl?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: Address;
  contact: string;
  email: string;
  gstin: string;
  pan: string;
  defaultTaxRate: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  bankDetails: BankDetails;
}

export interface Client {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstin: string;
  status: 'Active' | 'Inactive';
  branchIds: string[];
  billingAddress: Address;
  shippingAddress: Address;
  portalAccess: boolean;
  portalPassword?: string;
}

export interface PayrollSettings {
  id: string; // 'global'
  pfThreshold: number;
  pfPercentage: number;
  esiThreshold: number;
  esiPercentage: number;
  ptAmount: number;
  ptSlab: number;
  overtimeMultiplier: number;
}

export interface Employee {
  id: string; // e.g., 911001
  
  // Section 1: Personal
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  maritalStatus: 'Single' | 'Married' | 'Divorced';
  bloodGroup: string;
  nationality: string;
  photoUrl?: string;

  // Section 2: Contact
  mobile: string;
  altMobile?: string;
  officialEmail: string;
  personalEmail: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactNumber: string;

  // Section 3: Address
  currentAddress: Address;
  permanentAddress: Address;
  permSameAsCurrent: boolean;

  // Section 4: Bank
  bankDetails: BankDetails;

  // Section 5: Statutory
  aadhaar: string;
  pan: string;
  uan: string;
  pfAccountNumber: string;
  esiNo: string;
  ptState: string;
  taxRegime: 'Old' | 'New';

  // Section 6: Employment
  dateOfJoining: string;
  employmentType: 'Permanent' | 'Contract' | 'Intern';
  department: string;
  designation: string;
  reportingManager: string;
  branchId: string;
  shiftType: 'General' | 'Rotational' | 'Night';
  weeklyOff: string;

  // Section 7: Salary
  salaryType: 'Monthly' | 'Daily' | 'Hourly';
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  pfDeductionType: 'Auto' | 'Manual';
  esiDeduction: number;
  professionalTax: number;
  tds: number;
  netSalary: number;

  // Section 8: Attendance & Leave
  attendanceMethod: 'Biometric' | 'App' | 'Manual';
  leavePolicy: string;
  openingLeaveBalance: number;
  overtimeEligibility: 'Yes' | 'No';

  // Section 9: System
  loginCreation: 'Yes' | 'No';
  role: UserRole;
  status: 'Active' | 'Inactive' | 'Resigned';
  lastWorkingDay?: string;
  portalPassword?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  month: string;
  days: { [day: number]: 'P' | 'A' | 'HD' | 'PL' | 'UL' };
  overtimeHours: number;
  isLocked: boolean;
}

export interface PayrollItem {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  payableDays: number;
  standardDays: number;
  lopDays: number;
  earnings: {
    basic: number;
    hra: number;
    special: number;
    bonus: number;
    overtime: number;
    others: number;
  };
  deductions: {
    pf: number;
    esi: number;
    pt: number;
    tds: number;
    advance: number;
    others: number;
  };
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  qrCode: string;
}

export interface PayrollRun {
  id: string;
  month: string;
  branchId: string;
  status: 'Draft' | 'Approved';
  processedAt: string;
  processedBy: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hsnCode: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxPercent: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  branchId: string;
  branchName: string;
  clientId: string;
  clientName: string;
  clientGstin: string;
  kindAttn: string;
  placeOfSupply: string; 
  items: InvoiceItem[];
  subTotal: number;
  taxAmount: number;
  grandTotal: number;
  status: 'Draft' | 'Posted' | 'Paid' | 'Cancelled';
  archived?: boolean; 
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  date: string;
  method: 'Bank Transfer' | 'Cash' | 'Cheque' | 'Online Gateway';
  reference: string;
  archived?: boolean; 
}

export interface AppNotification {
  id: string;
  ticketNumber?: string; 
  date: string;
  branchId: string; 
  clientId: string;
  clientName: string;
  subject: string;
  message: string;
  status: 'Open' | 'Closed' | 'Revoked'; 
  rating?: number; 
  feedback?: string; 
  adminResponse?: string; 
  responseDate?: string; 
  archived?: boolean; 
}

export type Module = 'Dashboard' | 'Invoices' | 'Payments' | 'Clients' | 'Branches' | 'Accounts' | 'Settings' | 'Scanner' | 'Notifications' | 'Payroll';
