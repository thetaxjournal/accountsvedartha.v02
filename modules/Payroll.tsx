
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, Calendar, FileText, 
  ShieldCheck, Landmark, Plus, Search, 
  Edit2, 
  BarChart3, Calculator,
  X, Camera, RefreshCw, Settings as SettingsIcon, ChevronRight,
  ChevronLeft, Save, Banknote,
  Download, Upload, Loader2, PlayCircle, Printer,
  History, UserMinus, HardHat, Check, Clock, TrendingUp, CreditCard, Building2, Briefcase, UserCheck,
  UserCircle, Mail, MapPin, CheckCircle2, AlertCircle, Zap
} from 'lucide-react';
import { 
  Employee, AttendanceRecord, 
  PayrollItem, Branch, UserRole, 
  PayrollSettings, Address
} from '../types';
import { db, storage } from '../firebase';
import { collection, onSnapshot, setDoc, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateSecureQR, COMPANY_NAME, LOGO_DARK_BG, INDIAN_STATES } from '../constants';
import QRCode from 'react-qr-code';

const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    return '';
  };
  let str = '';
  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  const thousands = Math.floor(num / 1000);
  num %= 1000;
  const remaining = Math.floor(num);
  if (crores > 0) str += convert(crores) + ' crore ';
  if (lakhs > 0) str += convert(lakhs) + ' lakh ';
  if (thousands > 0) str += convert(thousands) + ' thousand ';
  if (remaining > 0) str += convert(remaining);
  return 'Rupees ' + str.trim() + ' only';
};

interface PayrollProps {
  branches: Branch[];
  userRole: UserRole;
}

const Payroll: React.FC<PayrollProps> = ({ branches = [], userRole }) => {
  const [activeSubMenu, setActiveSubMenu] = useState<'Dashboard' | 'Employees' | 'Attendance' | 'Overtime' | 'Processing' | 'Payslips' | 'Settings'>('Dashboard');
  const [onboardingTab, setOnboardingTab] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [globalSettings, setGlobalSettings] = useState<PayrollSettings | null>(null);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [procMonth, setProcMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedPayMethod, setSelectedPayMethod] = useState('Bank Transfer');
  
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingItem, setPrintingItem] = useState<PayrollItem | null>(null);
  const [printingType, setPrintingType] = useState<'PAYSLIP' | 'OT'>('PAYSLIP');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chequeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubEmp = onSnapshot(collection(db, 'employees'), (s) => setEmployees(s.docs.map(d => d.data() as Employee)));
    const unsubAtt = onSnapshot(collection(db, 'attendance'), (s) => setAttendance(s.docs.map(d => d.data() as AttendanceRecord)));
    const unsubItem = onSnapshot(collection(db, 'payroll_items'), (s) => setPayrollItems(s.docs.map(d => d.data() as PayrollItem)));
    const unsubSet = onSnapshot(doc(db, 'payroll_settings', 'global'), (d) => {
        if (d.exists()) {
            setGlobalSettings(d.data() as PayrollSettings);
        } else {
            const initial: PayrollSettings = { id: 'global', pfThreshold: 15000, pfPercentage: 12, esiThreshold: 21000, esiPercentage: 0.75, ptAmount: 200, ptSlab: 15000, overtimeMultiplier: 1.5 };
            setDoc(doc(db, 'payroll_settings', 'global'), initial);
        }
    });
    return () => { unsubEmp(); unsubAtt(); unsubItem(); unsubSet(); };
  }, []);

  const calculateSalaryFields = (emp: any) => {
      const basic = Number(emp.basicSalary) || 0;
      const hra = Number(emp.hra) || 0;
      const spl = Number(emp.specialAllowance) || 0;
      const other = Number(emp.otherAllowances) || 0;
      const gross = basic + hra + spl + other;
      
      const pfThreshold = globalSettings?.pfThreshold || 15000;
      const pfPerc = globalSettings?.pfPercentage || 12;
      const pf = emp.pfDeductionType === 'Auto' ? Math.round(Math.min(basic, pfThreshold) * (pfPerc / 100)) : 0;
      
      const esiThreshold = globalSettings?.esiThreshold || 21000;
      const esiPerc = globalSettings?.esiPercentage || 0.75;
      const esi = (gross <= esiThreshold) ? Math.round(gross * (esiPerc / 100)) : 0;
      
      const pt = (gross > (globalSettings?.ptSlab || 15000)) ? (globalSettings?.ptAmount || 200) : 0;
      const tds = Number(emp.tds) || 0;
      const net = gross - (pf + esi + pt + tds);
      
      return { ...emp, grossSalary: gross, netSalary: net, professionalTax: pt, esiDeduction: esi };
  };

  const handleAdd = () => {
    const lastId = employees.reduce((max, emp) => {
        const idNum = parseInt(emp.id);
        return isNaN(idNum) ? max : Math.max(max, idNum);
    }, 911000);
    const newId = (lastId + 1).toString();
    
    setEditingEmp({
      id: newId, fullName: '', fatherName: '', motherName: '', dob: '', gender: 'Male', maritalStatus: 'Single', bloodGroup: '', nationality: 'Indian', photoUrl: '',
      mobile: '', altMobile: '', officialEmail: '', personalEmail: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactNumber: '',
      currentAddress: { line1: '', city: '', state: 'Karnataka', pincode: '', country: 'INDIA' },
      permanentAddress: { line1: '', city: '', state: 'Karnataka', pincode: '', country: 'INDIA' },
      permSameAsCurrent: false,
      bankDetails: { bankName: '', accountNumber: '', ifscCode: '', branchName: '', accountHolderName: '', accountType: 'Salary', paymentMode: 'Bank Transfer', upiId: '', cancelledChequeUrl: '' },
      aadhaar: '', pan: '', uan: '', pfAccountNumber: '', esiNo: '', ptState: 'Karnataka', taxRegime: 'Old',
      dateOfJoining: '', employmentType: 'Permanent', department: 'Technology', designation: '', reportingManager: '', branchId: branches[0]?.id || 'B001', shiftType: 'General', weeklyOff: 'Sunday',
      salaryType: 'Monthly', basicSalary: 0, hra: 0, specialAllowance: 0, otherAllowances: 0, grossSalary: 0, pfDeductionType: 'Auto', esiDeduction: 0, professionalTax: 0, tds: 0, netSalary: 0,
      outstandingAdvance: 0, fixedBonus: 0, overtimeRatePerHour: 0, 
      attendanceMethod: 'Manual', leavePolicy: 'Standard', openingLeaveBalance: 0, overtimeEligibility: 'Yes',
      loginCreation: 'Yes', role: UserRole.EMPLOYEE, status: 'Active', portalPassword: newId
    });
    setOnboardingTab(0);
    setShowEmpModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photoUrl' | 'cancelledChequeUrl') => {
    const file = e.target.files?.[0];
    if (!file || !editingEmp) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `employee_docs/${editingEmp.id}/${field}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setEditingEmp((prev: any) => {
          if (!prev) return prev;
          if (field === 'photoUrl') {
              return { ...prev, photoUrl: downloadURL };
          } else {
              return { 
                  ...prev, 
                  bankDetails: { ...prev.bankDetails, cancelledChequeUrl: downloadURL } 
              };
          }
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Failed to upload document: " + (error.message || "Unknown error"));
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!editingEmp) return;
    if (!editingEmp.fullName || !editingEmp.id) {
        alert("Employee ID and Full Name are mandatory.");
        return;
    }
    try {
        await setDoc(doc(db, 'employees', editingEmp.id), editingEmp);
        setShowEmpModal(false);
        setEditingEmp(null);
    } catch (e: any) {
        alert("Error: " + e.message);
    }
  };

  const updateAddr = (type: 'currentAddress' | 'permanentAddress', field: keyof Address, value: string) => {
    if (!editingEmp) return;
    const newEmp = { ...editingEmp };
    newEmp[type] = { ...newEmp[type], [field]: value };
    if (type === 'currentAddress' && newEmp.permSameAsCurrent) {
        newEmp.permanentAddress = { ...newEmp.currentAddress };
    }
    setEditingEmp(newEmp);
  };

  const updateBank = (field: string, value: string) => {
      setEditingEmp({ ...editingEmp, bankDetails: { ...editingEmp.bankDetails, [field]: value }});
  };

  const handleAttendanceChange = async (empId: string, day: number, status: string) => {
      const attId = `${empId}-${procMonth}`;
      const existing = attendance.find(a => a.id === attId);
      const newAtt: AttendanceRecord = existing ? { ...existing, days: { ...existing.days, [day]: status as any } } : {
          id: attId, employeeId: empId, month: procMonth, days: { [day]: status as any }, overtimeHours: 0, isLocked: false
      };
      await setDoc(doc(db, 'attendance', attId), newAtt);
  };

  const handleOTChange = async (empId: string, hours: number) => {
      const attId = `${empId}-${procMonth}`;
      const existing = attendance.find(a => a.id === attId);
      const newAtt: AttendanceRecord = existing ? { ...existing, overtimeHours: hours } : {
          id: attId, employeeId: empId, month: procMonth, days: {}, overtimeHours: hours, isLocked: false
      };
      await setDoc(doc(db, 'attendance', attId), newAtt);
  };

  const handleRateChange = async (empId: string, rate: number) => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      try {
          await updateDoc(doc(db, 'employees', empId), { overtimeRatePerHour: rate });
      } catch (e: any) {
          console.error("Rate update failed", e);
      }
  };

  const runPayrollEngine = async (isOvertimeOnly: boolean = false) => {
    if (!confirm(`Execute ${isOvertimeOnly ? 'OVERTIME ONLY' : 'STANDARD'} payroll for all active employees for ${procMonth}?`)) return;
    
    setIsProcessing(true);
    try {
        const batch = writeBatch(db);
        const [year, month] = procMonth.split('-').map(v => parseInt(v));
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (const emp of employees.filter(e => e.status === 'Active')) {
            const attId = `${emp.id}-${procMonth}`;
            const att = attendance.find(a => a.id === attId);
            
            const lopDays = Object.values(att?.days || {}).filter(v => v === 'UL' || v === 'A').length;
            const payableDays = daysInMonth - lopDays;
            const ratio = payableDays / daysInMonth;

            let e_basic = isOvertimeOnly ? 0 : Math.round(emp.basicSalary * ratio);
            let e_hra = isOvertimeOnly ? 0 : Math.round(emp.hra * ratio);
            let e_special = isOvertimeOnly ? 0 : Math.round(emp.specialAllowance * ratio);
            let e_others = isOvertimeOnly ? 0 : Math.round((emp.otherAllowances || 0) * ratio);
            let e_bonus = isOvertimeOnly ? 0 : (Number(emp.fixedBonus) || 0);
            
            const ot_hours = att?.overtimeHours || 0;
            const empOTRate = Number(emp.overtimeRatePerHour) || 0;
            const e_overtime = Math.round(ot_hours * empOTRate);

            const gross = e_basic + e_hra + e_special + e_others + e_bonus + e_overtime;
            const d_pf = isOvertimeOnly ? 0 : Math.round(Math.min(e_basic, globalSettings?.pfThreshold || 15000) * ((globalSettings?.pfPercentage || 12) / 100));
            const d_pt = isOvertimeOnly ? 0 : (gross > (globalSettings?.ptSlab || 15000) ? (globalSettings?.ptAmount || 200) : 0);
            const d_esi = isOvertimeOnly ? 0 : ((gross <= (globalSettings?.esiThreshold || 21000)) ? Math.round(gross * ((globalSettings?.esiPercentage || 0.75) / 100)) : 0);
            
            const totalDeductions = d_pf + d_pt + d_esi;
            const net = gross - totalDeductions;

            const itemId = `PR-${procMonth}-${emp.id}${isOvertimeOnly ? '-OT' : ''}`;
            const payrollData: PayrollItem = {
                id: itemId,
                runId: `RUN-${procMonth}`,
                employeeId: emp.id,
                employeeName: emp.fullName,
                payableDays,
                standardDays: daysInMonth,
                lopDays,
                paymentMethod: selectedPayMethod,
                earnings: { basic: e_basic, hra: e_hra, special: e_special, bonus: e_bonus, overtime: e_overtime, others: e_others },
                deductions: { pf: d_pf, esi: d_esi, pt: d_pt, tds: 0, advance: 0, others: 0 },
                grossEarnings: gross,
                totalDeductions,
                netSalary: net,
                overtimeHours: ot_hours,
                qrCode: generateSecureQR({ type: 'PAYSLIP', empId: emp.id, month: procMonth, net, company: COMPANY_NAME })
            };
            batch.set(doc(db, 'payroll_items', itemId), payrollData);
        }
        await batch.commit();
        alert(`Payroll Archive Generated for ${procMonth}.`);
    } catch (e: any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const handleUpdateGlobalSettings = async () => {
    if (!globalSettings) return;
    await setDoc(doc(db, 'payroll_settings', 'global'), globalSettings);
    alert('Compliance parameters updated globally.');
  };

  const stats = useMemo(() => {
    const monthItems = payrollItems.filter(p => p.runId === `RUN-${procMonth}`);
    return {
        totalPayout: monthItems.reduce((acc, i) => acc + i.netSalary, 0),
        totalOT: monthItems.reduce((acc, i) => acc + i.earnings.overtime, 0),
        headCount: employees.filter(e => e.status === 'Active').length
    };
  }, [payrollItems, procMonth, employees]);

  /** SAP / PWC STYLE PRINTING TEMPLATE */
  const BW_PayslipDocument = ({ item }: { item: PayrollItem }) => {
    const employee = employees.find(e => e.id === item.employeeId);
    const branch = branches.find(b => b.id === employee?.branchId) || branches[0];
    const monthYear = new Date(item.runId.split('-')[1] + "-01");
    const monthStr = monthYear.toLocaleString('default', { month: 'long' }).toUpperCase();

    return (
      <div className="bg-white w-[210mm] min-h-[297mm] p-12 text-black font-sans flex flex-col border border-black relative print:border-none print:p-8">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <img src={LOGO_DARK_BG} alt="Logo" className="h-20 grayscale brightness-0 object-contain" />
          <div className="text-right flex-1 ml-10">
            <h1 className="text-xl font-bold uppercase tracking-tight leading-tight">{COMPANY_NAME.toUpperCase()}</h1>
            <p className="text-sm font-bold uppercase tracking-widest">Service Delivery Center</p>
            <p className="text-[10px] font-medium uppercase opacity-60">(Private Limited)</p>
          </div>
        </div>
        
        <div className="text-center mb-6">
           <h2 className="text-lg font-bold text-black border-b-2 border-black inline-block px-8 pb-1 uppercase tracking-widest">
             Payslip for the month of {monthStr} {monthYear.getFullYear()}
           </h2>
        </div>

        <div className="grid grid-cols-2 gap-x-0 border-2 border-black mb-6">
           <div className="border-r border-black">
              {[
                { l: 'Employee ID', v: item.employeeId },
                { l: 'Date of Birth', v: employee?.dob },
                { l: 'Designation', v: employee?.designation?.toUpperCase() },
                { l: 'UAN Number', v: employee?.uan || 'N/A' },
                { l: 'PF Number', v: employee?.pfAccountNumber || 'N/A' },
                { l: 'Regime Type', v: employee?.taxRegime + ' Regime' }
              ].map((row, i) => (
                <div key={i} className={`flex px-4 py-1.5 text-[11px] ${i < 5 ? 'border-b border-black' : ''}`}>
                   <span className="w-[140px] font-bold">{row.l}</span><span>: {row.v}</span>
                </div>
              ))}
           </div>
           <div>
              {[
                { l: 'Employee Name', v: item.employeeName?.toUpperCase() },
                { l: 'Joining Date', v: employee?.dateOfJoining },
                { l: 'Location', v: branch.address.city?.toUpperCase() },
                { l: 'PAN Number', v: employee?.pan?.toUpperCase() || 'N/A' },
                { l: 'LOS', v: item.lopDays + ' Days' },
                { l: 'Tax ID', v: branch.gstin }
              ].map((row, i) => (
                <div key={i} className={`flex px-4 py-1.5 text-[11px] ${i < 5 ? 'border-b border-black' : ''}`}>
                   <span className="w-[140px] font-bold">{row.l}</span><span>: {row.v}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="flex border-2 border-black flex-1 max-h-[400px]">
           <div className="w-1/2 border-r border-black flex flex-col">
              <div className="bg-gray-100 p-2.5 font-bold border-b border-black text-[12px] flex justify-between uppercase">
                <span>EARNINGS</span>
                <span>Amount (Rs.)</span>
              </div>
              <div className="flex-1 p-4 space-y-2 text-[11px]">
                 <div className="flex justify-between"><span>Basic Salary</span><span className="font-bold">{item.earnings.basic.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 <div className="flex justify-between"><span>House Rent Allowance</span><span className="font-bold">{item.earnings.hra.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 <div className="flex justify-between"><span>Special Pay</span><span className="font-bold">{item.earnings.special.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 {item.earnings.overtime > 0 && <div className="flex justify-between"><span>Overtime Pay</span><span className="font-bold">{item.earnings.overtime.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}
                 {item.earnings.bonus > 0 && <div className="flex justify-between"><span>Fixed Bonus</span><span className="font-bold">{item.earnings.bonus.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}
              </div>
              <div className="bg-gray-100 p-2.5 font-bold border-t border-black text-[12px] flex justify-between uppercase">
                <span>Total Earnings Rs.</span>
                <span>{item.grossEarnings.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
           </div>
           <div className="w-1/2 flex flex-col">
              <div className="bg-gray-100 p-2.5 font-bold border-b border-black text-[12px] flex justify-between uppercase">
                <span>DEDUCTIONS</span>
                <span>Amount (Rs.)</span>
              </div>
              <div className="flex-1 p-4 space-y-2 text-[11px]">
                 <div className="flex justify-between"><span>Provident Fund</span><span className="font-bold">{item.deductions.pf.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 <div className="flex justify-between"><span>Professional Tax</span><span className="font-bold">{item.deductions.pt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 {item.deductions.esi > 0 && <div className="flex justify-between"><span>ESI Contribution</span><span className="font-bold">{item.deductions.esi.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}
                 {item.deductions.tds > 0 && <div className="flex justify-between"><span>Income Tax (TDS)</span><span className="font-bold">{item.deductions.tds.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}
              </div>
              <div className="bg-gray-100 p-2.5 font-bold border-t border-black text-[12px] flex justify-between uppercase">
                <span>Total Deductions Rs.</span>
                <span>{item.totalDeductions.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
           </div>
        </div>

        <div className="border-x-2 border-b-2 border-black p-5 flex items-center justify-between bg-gray-50">
           <div className="flex items-center space-x-8">
              <div className="p-1.5 border border-black bg-white">
                <QRCode value={item.qrCode} size={90} />
              </div>
              <div>
                <p className="text-[14px] font-black uppercase tracking-tight">Net Salary Payable Rs. {item.netSalary.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                <p className="text-[10px] font-bold italic mt-1.5 opacity-70">{numberToWords(item.netSalary)}</p>
              </div>
           </div>
           <div className="text-right space-y-1">
              <div className="flex justify-between w-56 text-[10px]"><span className="font-bold">STANDARD DAYS</span><span>: {item.standardDays}</span></div>
              <div className="flex justify-between w-56 text-[10px]"><span className="font-bold">DAYS WORKED</span><span>: {item.payableDays}</span></div>
              <div className="flex justify-between w-56 text-[10px]"><span className="font-bold">PAYMENT MODE</span><span>: {employee?.bankDetails.paymentMode?.toUpperCase()}</span></div>
              <div className="flex justify-between w-56 text-[10px]"><span className="font-bold">BANK A/C NO</span><span className="font-mono">: {employee?.bankDetails.accountNumber}</span></div>
           </div>
        </div>

        <div className="mt-8 border-2 border-black p-5 space-y-3 bg-gray-50/50">
           <p className="text-[10px] font-bold uppercase">Note: This is a system generated report. This does not require any signature.</p>
           <p className="text-[9px] leading-relaxed opacity-70">
             Private and Confidential Disclaimer: This payslip has been generated by the {COMPANY_NAME} SDC payroll engine. All compensation information has been treated as strictly confidential and is for individual recipient use only.
           </p>
        </div>
        <div className="mt-auto flex justify-between text-[9px] font-bold uppercase opacity-40 pt-4">
           <span>Doc Ref: PR-SDC-V1</span>
           <span>Vedartha Systems & Solutions</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] font-sans">
      <div className="flex bg-white border-b no-print overflow-x-auto custom-scrollbar">
        {[
          { id: 'Dashboard', icon: BarChart3 },
          { id: 'Employees', icon: Users },
          { id: 'Attendance', icon: Calendar },
          { id: 'Overtime', icon: Clock },
          { id: 'Processing', icon: Calculator },
          { id: 'Payslips', icon: FileText },
          { id: 'Settings', icon: SettingsIcon }
        ].map(item => (
          <button key={item.id} onClick={() => setActiveSubMenu(item.id as any)} className={`flex-1 min-w-[120px] py-5 text-[11px] font-black uppercase flex flex-col items-center space-y-2 transition-all ${activeSubMenu === item.id ? 'text-[#0854a0] border-b-2 border-[#0854a0] bg-blue-50/40' : 'text-gray-400 hover:bg-gray-50'}`}>
            <item.icon size={18} /><span>{item.id}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar no-print">
        {activeSubMenu === 'Dashboard' && (
            <div className="space-y-8 animate-in fade-in">
               <div className="grid grid-cols-3 gap-8">
                  <div className="bg-black text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                     <div className="relative z-10"><p className="text-[10px] font-black uppercase opacity-60">Total Month Payout</p><p className="text-4xl font-black mt-2">₹ {stats.totalPayout.toLocaleString()}</p><p className="text-[10px] mt-4 font-bold text-blue-400 uppercase tracking-widest">{procMonth}</p></div>
                  </div>
                  <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                     <p className="text-[10px] font-black uppercase text-gray-400">Total OT Paid</p><p className="text-3xl font-black mt-2 text-rose-600">₹ {stats.totalOT.toLocaleString()}</p><TrendingUp className="text-rose-200 mt-4" size={32}/>
                  </div>
                  <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
                     <p className="text-[10px] font-black uppercase text-gray-400">Active Headcount</p><p className="text-3xl font-black mt-2 text-emerald-600">{stats.headCount} STAFF</p><Users className="text-emerald-100 mt-4" size={32}/>
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] border border-black/5 flex items-center justify-between">
                  <div><h3 className="font-black text-lg uppercase tracking-tight">Financial Period Controls</h3><p className="text-xs text-gray-400 font-bold uppercase mt-1">Select Active Ledger Month for Computation</p></div>
                  <input type="month" className="h-14 px-6 bg-gray-50 border border-gray-200 rounded-2xl font-black outline-none focus:border-[#0854a0] transition-all" value={procMonth} onChange={(e) => setProcMonth(e.target.value)} />
               </div>
            </div>
        )}

        {activeSubMenu === 'Employees' && (
           <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-black/10 shadow-sm">
                  <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                      <input type="text" className="w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold" placeholder="Personnel Query..."/>
                  </div>
                  <button onClick={handleAdd} className="px-8 py-4 bg-[#0854a0] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center"><Plus size={16} className="mr-2"/> Onboard Personnel</button>
              </div>
              <div className="bg-white rounded-3xl border border-black/10 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-[11px]">
                      <thead className="bg-gray-50 border-b text-gray-500 font-black uppercase tracking-widest">
                          <tr><th className="px-8 py-5">ID</th><th className="px-8 py-5">Full Name</th><th className="px-8 py-5">Designation</th><th className="px-8 py-5 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y">
                          {employees.map(emp => (
                              <tr key={emp.id} className="hover:bg-gray-50">
                                  <td className="px-8 py-5 font-mono font-black text-black">{emp.id}</td>
                                  <td className="px-8 py-5"><div className="flex items-center space-x-3"><div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border">{emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover" /> : <UserCircle size={18} className="m-1.5 text-gray-300" />}</div><span className="font-black uppercase">{emp.fullName}</span></div></td>
                                  <td className="px-8 py-5 font-bold text-gray-500">{emp.designation}</td>
                                  <td className="px-8 py-5 text-right"><button onClick={() => { setEditingEmp(emp); setShowEmpModal(true); }} className="p-2 border border-black/10 rounded-lg hover:bg-[#0854a0] hover:text-white transition-all"><Edit2 size={14}/></button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           </div>
        )}

        {activeSubMenu === 'Attendance' && (
           <div className="space-y-6 animate-in fade-in">
              <div className="bg-[#0854a0] text-white p-10 rounded-[40px] flex justify-between items-center">
                 <div><h2 className="text-2xl font-black uppercase tracking-tighter">Daily Ledger Terminal</h2><p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Period: {new Date(procMonth+"-01").toLocaleString('default', {month:'long', year:'numeric'})}</p></div>
                 <div className="flex items-center space-x-4"><p className="text-[10px] font-black uppercase opacity-60">Status Legend:</p><div className="flex space-x-2 text-[9px] font-black"><span className="px-3 py-1 bg-white/10 rounded-lg border border-white/10">P: PRESENT</span><span className="px-3 py-1 bg-rose-500/20 text-rose-200 rounded-lg border border-rose-500/10">A: ABSENT</span><span className="px-3 py-1 bg-amber-500/20 text-amber-200 rounded-lg border border-amber-500/10">UL: UNPAID LEAVE</span></div></div>
              </div>
              <div className="bg-white rounded-[40px] border border-black/5 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-[10px]">
                          <thead className="bg-gray-50 border-b font-black uppercase text-gray-400">
                             <tr>
                                <th className="px-6 py-4 sticky left-0 bg-gray-50 border-r z-10 w-48">Personnel Name</th>
                                {[...Array(31)].map((_, i) => <th key={i} className="px-3 py-4 text-center border-r min-w-[36px]">{i+1}</th>)}
                             </tr>
                          </thead>
                          <tbody className="divide-y">
                             {employees.map(emp => {
                                const att = attendance.find(a => a.id === `${emp.id}-${procMonth}`);
                                return (
                                   <tr key={emp.id} className="hover:bg-blue-50/20">
                                      <td className="px-6 py-3 font-black text-gray-900 border-r sticky left-0 bg-white shadow-[4px_0_12px_rgba(0,0,0,0.02)] uppercase">{emp.fullName}</td>
                                      {[...Array(31)].map((_, i) => {
                                         const day = i + 1;
                                         const val = att?.days?.[day] || '-';
                                         return (
                                            <td key={i} className="px-0 py-0 border-r group relative">
                                               <select 
                                                 value={val} 
                                                 onChange={(e) => handleAttendanceChange(emp.id, day, e.target.value)}
                                                 className={`w-full h-12 text-center font-black outline-none cursor-pointer transition-all bg-transparent appearance-none hover:bg-gray-50 ${val === 'A' ? 'text-rose-500' : val === 'UL' ? 'text-amber-500' : val === 'P' ? 'text-emerald-600' : 'text-gray-200'}`}
                                               >
                                                  <option value="-">-</option><option value="P">P</option><option value="A">A</option><option value="UL">UL</option><option value="HD">HD</option>
                                               </select>
                                            </td>
                                         );
                                      })}
                                   </tr>
                                );
                             })}
                          </tbody>
                      </table>
                  </div>
              </div>
           </div>
        )}

        {activeSubMenu === 'Overtime' && (
           <div className="space-y-6 animate-in fade-in">
              <div className="bg-black text-white p-10 rounded-[40px] flex justify-between items-center shadow-2xl">
                 <div className="flex items-center space-x-6"><div className="p-5 bg-white/10 rounded-3xl"><Clock className="text-rose-400" size={32}/></div><div><h2 className="text-2xl font-black uppercase tracking-tighter">Overtime Authorization</h2><p className="text-[10px] font-bold opacity-40 uppercase mt-1">Approve & Release Standalone OT Vouchers</p></div></div>
                 <button onClick={() => runPayrollEngine(true)} className="px-10 py-5 bg-[#0854a0] hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center transition-all"><Zap size={16} className="mr-2"/> Dispatch Standalone OT Slips</button>
              </div>
              <div className="bg-white rounded-[40px] border border-black/10 overflow-hidden shadow-sm">
                 <table className="w-full text-left text-[11px]">
                    <thead className="bg-gray-50 border-b font-black uppercase text-gray-500">
                       <tr><th className="px-8 py-5">Personnel</th><th className="px-8 py-5">Money Per Hour (₹)</th><th className="px-8 py-5">OT Hours (Month)</th><th className="px-8 py-5 text-right">Computed OT Pay</th></tr>
                    </thead>
                    <tbody className="divide-y">
                       {employees.map(emp => {
                          const att = attendance.find(a => a.id === `${emp.id}-${procMonth}`);
                          const hours = att?.overtimeHours || 0;
                          return (
                             <tr key={emp.id} className="hover:bg-gray-50">
                                <td className="px-8 py-5 font-black uppercase">{emp.fullName}</td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-gray-400 font-bold">₹</span>
                                        <input 
                                            type="number" 
                                            className="w-24 h-12 bg-gray-50 border rounded-xl px-4 font-black text-[#0854a0] outline-none focus:border-[#0854a0]" 
                                            value={emp.overtimeRatePerHour || 0} 
                                            onChange={(e) => handleRateChange(emp.id, Number(e.target.value))}
                                        />
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <input 
                                        type="number" 
                                        className="w-24 h-12 bg-gray-50 border rounded-xl px-4 font-black text-blue-600 outline-none focus:border-[#0854a0]" 
                                        value={hours} 
                                        onChange={(e) => handleOTChange(emp.id, Number(e.target.value))}
                                    />
                                </td>
                                <td className="px-8 py-5 text-right font-black text-rose-600">₹ {(hours * (emp.overtimeRatePerHour || 0)).toLocaleString()}</td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeSubMenu === 'Processing' && (
           <div className="space-y-8 animate-in fade-in flex flex-col items-center py-20">
              <div className="bg-white p-16 rounded-[48px] border border-black/5 shadow-2xl text-center max-w-xl">
                 <Calculator className="text-[#0854a0] mx-auto mb-8" size={64} />
                 <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Run Payroll Engine</h2>
                 <p className="text-sm text-gray-500 font-medium leading-relaxed mb-10">Generate monthly compensation vouchers by applying compliance logic, attendance ratios, and overtime calculations across the active workforce.</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-gray-50 rounded-3xl border border-black/5 text-left"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Month</p><p className="text-xl font-black mt-1 uppercase">{new Date(procMonth+"-01").toLocaleString('default', {month:'long', year:'numeric'})}</p></div>
                    <div className="p-6 bg-gray-50 rounded-3xl border border-black/5 text-left"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Staff Impacted</p><p className="text-xl font-black mt-1 uppercase">{employees.filter(e=>e.status==='Active').length} Records</p></div>
                 </div>
                 <button disabled={isProcessing} onClick={() => runPayrollEngine(false)} className="w-full mt-8 py-6 bg-[#0854a0] text-white rounded-[24px] text-sm font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-700 transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-50">
                    {isProcessing ? <Loader2 className="animate-spin"/> : <PlayCircle/>} <span>Initialize Batch Run</span>
                 </button>
              </div>
           </div>
        )}

        {activeSubMenu === 'Payslips' && (
           <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-black/10">
                 <h2 className="text-xl font-black uppercase tracking-tighter">Historical Vouchers</h2>
                 <div className="flex items-center space-x-3"><p className="text-[10px] font-bold text-gray-400 uppercase">Sort by Period</p><select className="h-10 px-4 bg-gray-50 rounded-lg text-xs font-bold outline-none" value={procMonth} onChange={e=>setProcMonth(e.target.value)}>{[...new Set(payrollItems.map(p=>p.runId.split('-')[1]))].sort().reverse().map(m=><option key={m} value={m}>{m}</option>)}</select></div>
              </div>
              <div className="bg-white rounded-[40px] border border-black/10 overflow-hidden">
                 <table className="w-full text-left text-[11px]">
                    <thead className="bg-gray-50 border-b font-black uppercase text-gray-500">
                       <tr><th className="px-8 py-5">Voucher ID</th><th className="px-8 py-5">Employee</th><th className="px-8 py-5">Net Takehome</th><th className="px-8 py-5 text-right">Operations</th></tr>
                    </thead>
                    <tbody className="divide-y">
                       {payrollItems.filter(p => p.runId === `RUN-${procMonth}`).map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                             <td className="px-8 py-5 font-mono font-black text-blue-600">{item.id}</td>
                             <td className="px-8 py-5 font-black uppercase">{item.employeeName}</td>
                             <td className="px-8 py-5 font-black text-emerald-600">₹ {item.netSalary.toLocaleString()}</td>
                             <td className="px-8 py-5 text-right">
                               <div className="flex justify-end space-x-2">
                                 <button onClick={() => { setPrintingItem(item); setPrintingType('PAYSLIP'); setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); setPrintingItem(null); }, 600); }} className="p-3 bg-gray-50 rounded-xl hover:bg-black hover:text-white transition-all"><Printer size={16}/></button>
                                 <button onClick={async () => { if(confirm('Purge this record?')) await deleteDoc(doc(db, 'payroll_items', item.id)); }} className="p-3 bg-gray-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><UserMinus size={16}/></button>
                               </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeSubMenu === 'Settings' && globalSettings && (
           <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in">
              <div className="bg-white p-12 rounded-[48px] border border-black/10 shadow-sm space-y-10">
                 <div><h2 className="text-2xl font-black uppercase tracking-tighter">Compliance Master Records</h2><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Global statutory deduction parameters</p></div>
                 <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-6">
                       <h3 className="text-xs font-black uppercase text-[#0854a0] border-b pb-2">Provident Fund (PF)</h3>
                       <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Employee Contribution (%)</label><input type="number" className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-black" value={globalSettings.pfPercentage} onChange={e=>setGlobalSettings({...globalSettings, pfPercentage: Number(e.target.value)})}/></div>
                       <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Cap Threshold (Max Basic)</label><input type="number" className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-black" value={globalSettings.pfThreshold} onChange={e=>setGlobalSettings({...globalSettings, pfThreshold: Number(e.target.value)})}/></div>
                    </div>
                    <div className="space-y-6">
                       <h3 className="text-xs font-black uppercase text-rose-600 border-b pb-2">ESI / Health Insurance</h3>
                       <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Contribution Rate (%)</label><input type="number" step="0.05" className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-black" value={globalSettings.esiPercentage} onChange={e=>setGlobalSettings({...globalSettings, esiPercentage: Number(e.target.value)})}/></div>
                       <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Gross Salary Eligibility Cap</label><input type="number" className="w-full h-14 bg-gray-50 rounded-2xl px-6 font-black" value={globalSettings.esiThreshold} onChange={e=>setGlobalSettings({...globalSettings, esiThreshold: Number(e.target.value)})}/></div>
                    </div>
                 </div>
                 <div className="pt-10 border-t flex justify-end"><button onClick={handleUpdateGlobalSettings} className="px-16 py-5 bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center hover:bg-gray-800 transition-all active:scale-95"><Save className="mr-3" size={18}/> Commit Policy Changes</button></div>
              </div>
           </div>
        )}
      </div>

      {isPrinting && printingItem && createPortal(<BW_PayslipDocument item={printingItem} />, document.getElementById('print-portal')!)}

      {showEmpModal && editingEmp && (
          <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
             <div className="bg-white w-full max-w-7xl rounded-[48px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-black/10">
                <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-[#fcfcfc]">
                   <div><h2 className="text-3xl font-black uppercase tracking-tighter">Personnel Master Data</h2><p className="text-[11px] font-bold text-[#0854a0] uppercase tracking-[0.3em] mt-1">Unified Enterprise Resource Record: {editingEmp.id}</p></div>
                   <button onClick={() => setShowEmpModal(false)} className="p-4 hover:bg-gray-100 rounded-full border border-gray-100 text-gray-400"><X size={28}/></button>
                </div>
                <div className="flex bg-gray-50 border-b border-gray-200 overflow-x-auto no-scrollbar px-10">
                   {['Personal', 'Contact', 'Address', 'Banking', 'Statutory', 'Employment', 'Salary', 'Attendance', 'Access'].map((label, idx) => (
                      <button key={idx} onClick={() => setOnboardingTab(idx)} className={`flex items-center space-x-3 px-8 py-6 text-[11px] font-black uppercase transition-all relative shrink-0 ${onboardingTab === idx ? 'text-[#0854a0]' : 'text-gray-400'}`}>
                         <span>{label}</span>
                         {onboardingTab === idx && <div className="absolute bottom-0 left-8 right-8 h-1 bg-[#0854a0] rounded-t-full"></div>}
                      </button>
                   ))}
                </div>
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white">
                   {onboardingTab === 0 && (
                      <div className="grid grid-cols-4 gap-x-10 gap-y-8 animate-in fade-in duration-300">
                         <div className="col-span-1 flex flex-col items-center">
                             <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-48 h-48 rounded-[40px] border-4 border-gray-50 overflow-hidden flex items-center justify-center relative bg-gray-50 shadow-inner group cursor-pointer hover:border-blue-100 transition-all"
                             >
                                 {isUploading && <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10"><Loader2 className="animate-spin text-[#0854a0]" /></div>}
                                 {editingEmp.photoUrl ? <img src={editingEmp.photoUrl} className="w-full h-full object-cover" /> : <Camera size={48} className="text-gray-200" />}
                                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'photoUrl')} />
                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Upload className="text-white" size={24} />
                                 </div>
                             </div>
                             <button onClick={() => fileInputRef.current?.click()} className="mt-4 text-[10px] font-black uppercase text-[#0854a0] tracking-widest hover:underline">Upload Photograph</button>
                         </div>
                         <div className="col-span-3 grid grid-cols-2 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Personnel ID</label><input disabled className="w-full h-14 bg-gray-100 border border-gray-200 rounded-2xl px-6 font-mono font-bold text-gray-400 text-lg" value={editingEmp.id || ''}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Full Name</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none uppercase" value={editingEmp.fullName || ''} onChange={e => setEditingEmp({...editingEmp, fullName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Father's Name</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none uppercase" value={editingEmp.fatherName || ''} onChange={e => setEditingEmp({...editingEmp, fatherName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Date of Birth</label><input type="date" className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.dob || ''} onChange={e => setEditingEmp({...editingEmp, dob: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Blood Group</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.bloodGroup || ''} onChange={e => setEditingEmp({...editingEmp, bloodGroup: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Nationality</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.nationality || 'Indian'} onChange={e => setEditingEmp({...editingEmp, nationality: e.target.value})}/></div>
                         </div>
                      </div>
                   )}
                   {onboardingTab === 6 && (
                      <div className="space-y-10 animate-in fade-in">
                         <div className="grid grid-cols-4 gap-8 bg-black p-10 rounded-[40px] text-white">
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Salary Type</label><select className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.salaryType} onChange={e => setEditingEmp({...editingEmp, salaryType: e.target.value})}><option>Monthly</option><option>Daily</option><option>Hourly</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Basic Component</label><input type="number" className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.basicSalary} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, basicSalary: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Overtime Rate/Hr</label><input type="number" className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.overtimeRatePerHour} onChange={e => setEditingEmp({...editingEmp, overtimeRatePerHour: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Special Allowance</label><input type="number" className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.specialAllowance} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, specialAllowance: Number(e.target.value)}))}/></div>
                         </div>
                         <div className="flex justify-around bg-gray-50 p-10 rounded-[40px] border border-black/5 shadow-inner">
                            <div className="text-center"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gross Computed</p><p className="text-3xl font-black text-gray-800">₹ {(editingEmp.grossSalary || 0).toLocaleString()}</p></div>
                            <div className="text-center"><p className="text-[10px] font-black text-[#0854a0] uppercase tracking-[0.2em] mb-1">Net Takehome</p><p className="text-3xl font-black text-[#0854a0]">₹ {(editingEmp.netSalary || 0).toLocaleString()}</p></div>
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-10 border-t border-gray-100 bg-[#fcfcfc] flex justify-between items-center shadow-[0_-12px_48px_rgba(0,0,0,0.05)]">
                   <div className="flex space-x-4">
                      <button disabled={onboardingTab === 0} onClick={() => setOnboardingTab(t => t - 1)} className="px-10 py-5 bg-white border border-gray-200 rounded-[20px] text-[11px] font-black uppercase text-gray-400 disabled:opacity-30 flex items-center transition-all hover:bg-gray-50"><ChevronLeft size={16} className="mr-3"/> Previous</button>
                      <button disabled={onboardingTab === 8} onClick={() => setOnboardingTab(t => t + 1)} className="px-12 py-5 bg-[#0854a0] text-white rounded-[20px] text-[11px] font-black uppercase tracking-widest flex items-center transition-all shadow-xl shadow-blue-100 hover:bg-blue-700">Next Unit <ChevronRight size={16} className="ml-3"/></button>
                   </div>
                   <button onClick={handleSave} className="px-20 py-5 bg-black text-white rounded-[20px] text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center hover:bg-gray-800 transition-all active:scale-95"><Check size={18} className="mr-3"/> Commit Master Record</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default Payroll;
