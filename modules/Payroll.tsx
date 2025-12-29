
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, Calendar, FileText, 
  ShieldCheck, Landmark, Plus, Search, 
  Edit2, 
  BarChart3, Calculator,
  X, Camera, RefreshCw, Settings as SettingsIcon, ChevronRight,
  ChevronLeft, Save, Banknote,
  Download, Upload, Loader2, PlayCircle, Printer,
  History, UserMinus, HardHat, Check, Clock, TrendingUp
} from 'lucide-react';
import { 
  Employee, AttendanceRecord, 
  PayrollItem, Branch, UserRole, 
  PayrollSettings
} from '../types';
import { db, storage } from '../firebase';
import { collection, onSnapshot, setDoc, doc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateSecureQR, COMPANY_NAME, LOGO_DARK_BG } from '../constants';
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
  const [activeSubMenu, setActiveSubMenu] = useState<'Dashboard' | 'Employees' | 'Attendance' | 'Processing' | 'Payslips' | 'Settings'>('Dashboard');
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
  const [isOvertimeOnly, setIsOvertimeOnly] = useState(false);
  
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingItem, setPrintingItem] = useState<PayrollItem | null>(null);
  const [printingType, setPrintingType] = useState<'PAYSLIP' | 'OT'>('PAYSLIP');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const pf = emp.pfDeductionType === 'Auto' ? Math.round(Math.min(basic, 15000) * 0.12) : 0;
      const esi = (gross <= 21000) ? Math.round(gross * 0.0075) : 0;
      const pt = (gross > 15000) ? 200 : 0;
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingEmp) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `employee_photos/${editingEmp.id}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setEditingEmp({ ...editingEmp, photoUrl: downloadURL });
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload photo.");
    } finally {
      setIsUploading(false);
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
        console.error("Save error:", e);
        alert("Error saving employee: " + e.message);
    }
  };

  const runPayrollEngine = async (targetEmp?: Employee) => {
    const isSingle = !!targetEmp;
    const modeStr = isOvertimeOnly ? 'OVERTIME ONLY' : 'STANDARD';
    if (!confirm(`Execute ${modeStr} payroll for ${isSingle ? targetEmp.fullName : 'ENTIRE BATCH'} for ${procMonth}?`)) return;
    
    setIsProcessing(true);
    try {
        const batch = writeBatch(db);
        const [year, month] = procMonth.split('-').map(v => parseInt(v));
        const daysInMonth = new Date(year, month, 0).getDate();
        
        const targetList = isSingle ? [targetEmp] : employees.filter(e => e.status !== 'Inactive');

        for (const emp of targetList) {
            const attId = `${emp.id}-${procMonth}`;
            const att = attendance.find(a => a.id === attId);
            
            const lopDays = Object.values(att?.days || {}).filter(v => v === 'UL' || v === 'A').length;
            const payableDays = daysInMonth - lopDays;
            const ratio = payableDays / daysInMonth;

            // Base Components
            let e_basic = isOvertimeOnly ? 0 : Math.round(emp.basicSalary * ratio);
            let e_hra = isOvertimeOnly ? 0 : Math.round(emp.hra * ratio);
            let e_special = isOvertimeOnly ? 0 : Math.round(emp.specialAllowance * ratio);
            let e_others = isOvertimeOnly ? 0 : Math.round((emp.otherAllowances || 0) * ratio);
            let e_bonus = isOvertimeOnly ? 0 : (Number(emp.fixedBonus) || 0);
            
            const ot_hours = att?.overtimeHours || 0;
            // STRICTLY USE EMPLOYEE SPECIFIC RATE
            const empOTRate = Number(emp.overtimeRatePerHour) || 0;
            const e_overtime = Math.round(ot_hours * empOTRate);

            const gross = e_basic + e_hra + e_special + e_others + e_bonus + e_overtime;

            // Deductions
            const d_pf = isOvertimeOnly ? 0 : Math.round(Math.min(e_basic, 15000) * 0.12);
            const d_pt = isOvertimeOnly ? 0 : (gross > 15000 ? 200 : 0);
            const d_esi = isOvertimeOnly ? 0 : ((gross <= 21000) ? Math.round(gross * 0.0075) : 0);
            const advanceRecovery = isOvertimeOnly ? 0 : Math.min(Number(emp.outstandingAdvance) || 0, Math.floor(gross * 0.3));
            
            const totalDeductions = d_pf + d_pt + d_esi + advanceRecovery;
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
                isFinalSettlement: ['Resigned', 'Terminated', 'Retired'].includes(emp.status),
                earnings: { basic: e_basic, hra: e_hra, special: e_special, bonus: e_bonus, overtime: e_overtime, others: e_others },
                deductions: { pf: d_pf, esi: d_esi, pt: d_pt, tds: 0, advance: advanceRecovery, others: 0 },
                grossEarnings: gross,
                totalDeductions,
                netSalary: net,
                overtimeHours: ot_hours,
                qrCode: generateSecureQR({ type: 'PAYSLIP', empId: emp.id, month: procMonth, net, company: COMPANY_NAME })
            };

            batch.set(doc(db, 'payroll_items', itemId), payrollData);
            if (!isOvertimeOnly && advanceRecovery > 0) {
              batch.update(doc(db, 'employees', emp.id), { outstandingAdvance: (emp.outstandingAdvance || 0) - advanceRecovery });
            }
        }
        await batch.commit();
        alert(`${isOvertimeOnly ? 'Overtime' : 'Standard'} Payroll Computed.`);
    } catch (e: any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const handleDirectPrint = (item: PayrollItem, type: 'PAYSLIP' | 'OT') => {
    const originalTitle = document.title;
    const monthStr = new Date(item.runId.split('-')[1] + "-01").toLocaleString('default', { month: 'long' });
    document.title = `${type === 'PAYSLIP' ? 'Payslip' : 'OT_Authorization'}_${item.employeeId}_${monthStr}`;

    setPrintingItem(item);
    setPrintingType(type);
    setIsPrinting(true);

    setTimeout(() => {
        window.print();
        setIsPrinting(false);
        setPrintingItem(null);
        document.title = originalTitle;
    }, 500);
  };

  /** 
   * SAP/PWC STYLE BLACK-AND-WHITE DOCUMENT
   */
  const BW_PayslipDocument = ({ item }: { item: PayrollItem }) => {
    const emp = employees.find(e => e.id === item.employeeId);
    const branch = branches.find(b => b.id === emp?.branchId) || branches[0];
    const monthYear = new Date(item.runId.split('-')[1] + "-01");
    const monthStr = monthYear.toLocaleString('default', { month: 'long' }).toUpperCase();

    return (
      <div className="bg-white w-[210mm] min-h-[297mm] p-12 text-black font-sans flex flex-col border border-black relative print:border-none print:p-8">
        <div className="flex justify-between items-start border-b border-black pb-4 mb-4">
          <img src={LOGO_DARK_BG} alt="Logo" className="h-16 grayscale brightness-0 object-contain" />
          <div className="text-right flex-1 ml-10 text-black">
            <h1 className="text-xl font-bold uppercase tracking-tight leading-tight">{COMPANY_NAME.toUpperCase()}</h1>
            <p className="text-sm font-bold uppercase tracking-widest">Service Delivery Center</p>
            <p className="text-xs font-medium uppercase opacity-80">(Private Limited)</p>
          </div>
        </div>

        <div className="text-center mb-6">
           <h2 className="text-md font-bold text-black border-b border-black inline-block px-4 pb-0.5">
             Payslip for the month of {monthStr} {monthYear.getFullYear()}
           </h2>
        </div>

        <div className="grid grid-cols-2 gap-x-0 border border-black mb-6 text-black">
           <div className="border-r border-black">
              {[
                { l: 'Employee ID', v: item.employeeId },
                { l: 'Date of Birth', v: emp?.dob ? new Date(emp.dob).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase() : '' },
                { l: 'Designation', v: emp?.designation?.toUpperCase() || 'OFFICER' },
                { l: 'UAN Number', v: emp?.uan || '' },
                { l: 'PF Number', v: emp?.pfAccountNumber || '' },
                { l: 'Regime Type', v: `${emp?.taxRegime} Regime` }
              ].map((row, i) => (
                <div key={i} className={`flex px-3 py-1 text-[10px] ${i < 5 ? 'border-b border-black' : ''}`}>
                   <span className="w-[120px] font-bold">{row.l}</span>
                   <span className="flex-1">: {row.v}</span>
                </div>
              ))}
           </div>
           <div>
              {[
                { l: 'Employee Name', v: item.employeeName?.toUpperCase() },
                { l: 'Joining Date', v: emp?.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase() : '' },
                { l: 'Location', v: branch.address.city?.toUpperCase() },
                { l: 'Pan Number', v: emp?.pan?.toUpperCase() || '' },
                { l: 'LOS', v: item.lopDays },
                { l: 'Status', v: emp?.status?.toUpperCase() || 'ACTIVE' }
              ].map((row, i) => (
                <div key={i} className={`flex px-3 py-1 text-[10px] ${i < 5 ? 'border-b border-black' : ''}`}>
                   <span className="w-[120px] font-bold">{row.l}</span>
                   <span className="flex-1">: {row.v}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="flex border border-black flex-1 max-h-[340px] text-black">
           <div className="w-1/2 border-r border-black flex flex-col">
              <div className="bg-gray-100 p-2 font-bold border-b border-black text-[11px] flex justify-between uppercase">
                 <span>EARNINGS</span><span>Amount (Rs.)</span>
              </div>
              <div className="flex-1 p-3 space-y-1 text-[10px]">
                 <div className="flex justify-between"><span>Basic Salary</span><span>{item.earnings.basic.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 <div className="flex justify-between"><span>House Rent Allowance</span><span>{item.earnings.hra.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 {item.earnings.bonus > 0 && <div className="flex justify-between"><span>Statutory Bonus</span><span>{item.earnings.bonus.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}
                 <div className="flex justify-between"><span>OOC Allowance</span><span>{item.earnings.special.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 <div className="flex justify-between"><span>Special Pay</span><span>{item.earnings.others.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
              </div>
              <div className="bg-gray-100 p-2 font-bold border-t border-black text-[11px] flex justify-between uppercase">
                 <span>Total Earnings Rs.</span><span>{(item.grossEarnings - (item.earnings.overtime || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
           </div>
           <div className="w-1/2 flex flex-col">
              <div className="bg-gray-100 p-2 font-bold border-b border-black text-[11px] flex justify-between uppercase">
                 <span>DEDUCTIONS</span><span>Amount (Rs.)</span>
              </div>
              <div className="flex-1 p-3 space-y-1 text-[10px]">
                 <div className="flex justify-between"><span>Provident Fund</span><span>{item.deductions.pf.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 <div className="flex justify-between"><span>Professional Tax</span><span>{item.deductions.pt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
                 {item.deductions.esi > 0 && <div className="flex justify-between"><span>ESI Deduction</span><span>{item.deductions.esi.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}
                 {item.deductions.advance > 0 && <div className="flex justify-between font-bold"><span>Advance Recovery</span><span>{item.deductions.advance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}
              </div>
              <div className="bg-gray-100 p-2 font-bold border-t border-black text-[11px] flex justify-between uppercase">
                 <span>Total Deductions Rs.</span><span>{item.totalDeductions.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
           </div>
        </div>

        <div className="border-x border-b border-black flex text-black">
           <div className="w-2/3 p-4 flex items-center space-x-6">
              <QRCode value={item.qrCode} size={70} fgColor="#000000" />
              <div className="flex-1">
                 <div className="text-lg font-black border border-black px-4 py-2 inline-block">
                    Net Salary Rs. {(item.netSalary - (item.earnings.overtime || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                 </div>
                 <p className="text-[9px] font-bold italic mt-2 opacity-70">Disbursed In Words: {numberToWords(item.netSalary - (item.earnings.overtime || 0))}</p>
              </div>
           </div>
           <div className="w-1/3 border-l border-black text-[10px]">
              {[
                { l: 'STANDARD DAYS', v: item.standardDays },
                { l: 'DAYS WORKED', v: item.payableDays },
                { l: 'PAYMENT', v: (item.paymentMethod || emp?.bankDetails.paymentMode)?.toUpperCase() },
                { l: 'BANK', v: emp?.bankDetails.bankName.toUpperCase() },
                { l: 'A/C No.', v: emp?.bankDetails.accountNumber }
              ].map((row, i) => (
                <div key={i} className={`flex px-3 py-1.5 ${i < 4 ? 'border-b border-black' : ''}`}>
                   <span className="w-[100px] font-bold uppercase">{row.l}</span>
                   <span className="flex-1">: {row.v}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="mt-6 border border-black p-4 text-[9px] font-medium leading-relaxed bg-gray-50 text-black">
           <p className="font-bold border-b border-black/20 pb-1 mb-2">Note: This is a system generated report. This does not require any signature.</p>
           <p className="opacity-80">Private and Confidential Disclaimer: This payslip has been generated by the {COMPANY_NAME.toUpperCase()} payroll service provider. All compensation information has been treated as confidential.</p>
        </div>
      </div>
    );
  };

  /**
   * SEPARATE OVERTIME AUTHORIZATION VOUCHER
   * Uses Per-Employee Specific OT Rates
   */
  const OvertimeAuthorizationDocument = ({ item }: { item: PayrollItem }) => {
    const emp = employees.find(e => e.id === item.employeeId);
    const monthYear = new Date(item.runId.split('-')[1] + "-01");
    const monthStr = monthYear.toLocaleString('default', { month: 'long' }).toUpperCase();

    return (
      <div className="bg-white w-[210mm] min-h-[148mm] p-12 text-black font-sans flex flex-col border-2 border-black relative print:border-none print:p-8">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-8">
           <img src={LOGO_DARK_BG} alt="Logo" className="h-14 grayscale brightness-0 object-contain" />
           <div className="text-right">
              <h1 className="text-xl font-black uppercase tracking-tighter">OVERTIME AUTHORIZATION VOUCHER</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-emerald-600">Verified Personnel Settlement</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-x-12 mb-10 text-black border border-black p-6">
           <div className="space-y-3">
              <div><p className="text-[10px] font-black uppercase text-gray-400">Personnel ID</p><p className="text-lg font-bold">{item.employeeId}</p></div>
              <div><p className="text-[10px] font-black uppercase text-gray-400">Personnel Name</p><p className="text-lg font-bold uppercase">{item.employeeName}</p></div>
           </div>
           <div className="space-y-3 border-l border-black pl-8">
              <div><p className="text-[10px] font-black uppercase text-gray-400">Reporting Period</p><p className="text-lg font-bold">{monthStr} {monthYear.getFullYear()}</p></div>
              <div><p className="text-[10px] font-black uppercase text-gray-400">Voucher Ref</p><p className="text-lg font-bold font-mono">{item.id}-OT</p></div>
           </div>
        </div>

        <div className="flex-1">
           <table className="w-full border-collapse border border-black text-[12px]">
              <thead>
                 <tr className="bg-gray-100 font-black uppercase">
                    <th className="border border-black p-3 text-left">Description</th>
                    <th className="border border-black p-3 text-center">Qty (Hrs)</th>
                    <th className="border border-black p-3 text-center">Specific Rate</th>
                    <th className="border border-black p-3 text-right">Net Value</th>
                 </tr>
              </thead>
              <tbody>
                 <tr>
                    <td className="border border-black p-4 font-bold">Supplemental Overtime Compensation</td>
                    <td className="border border-black p-4 text-center font-black">{item.overtimeHours} HRS</td>
                    <td className="border border-black p-4 text-center font-bold">₹ {(emp?.overtimeRatePerHour || 0).toLocaleString()} / HR</td>
                    <td className="border border-black p-4 text-right font-black text-lg">₹ {item.earnings.overtime.toLocaleString()}</td>
                 </tr>
              </tbody>
           </table>
        </div>

        <div className="mt-10 flex justify-between items-end">
           <div className="flex items-center space-x-6">
              <QRCode value={item.qrCode} size={60} fgColor="#000000" />
              <div>
                 <p className="text-[9px] font-black uppercase">Authored By</p>
                 <p className="text-[11px] font-bold italic">{COMPANY_NAME}</p>
              </div>
           </div>
           <div className="text-right">
              <div className="w-48 h-10 border-b-2 border-black mb-1"></div>
              <p className="text-[10px] font-black uppercase">Branch HR Lead Terminal</p>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] font-sans">
      {isPrinting && printingItem && createPortal(
         printingType === 'PAYSLIP' ? <BW_PayslipDocument item={printingItem} /> : <OvertimeAuthorizationDocument item={printingItem} />, 
         document.getElementById('print-portal')!
      )}

      <div className="flex bg-white border-b no-print overflow-x-auto custom-scrollbar">
        {[
          { id: 'Dashboard', icon: BarChart3 },
          { id: 'Employees', icon: Users },
          { id: 'Attendance', icon: Calendar },
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
           <div className="grid grid-cols-4 gap-6">
              <div className="bg-black p-8 rounded-[32px] text-white shadow-xl h-48 flex flex-col justify-between">
                 <h3 className="text-xs font-black uppercase opacity-60">Master Count</h3>
                 <p className="text-5xl font-black">{employees.length}</p>
                 <div className="flex items-center text-[10px] font-bold opacity-60"><ShieldCheck className="mr-2" size={14}/> Active Records</div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border h-48 flex flex-col justify-between shadow-sm border-black/10">
                 <h3 className="text-xs font-black uppercase text-gray-400">Total Monthly Expenditure</h3>
                 <p className="text-3xl font-black">₹ {payrollItems.reduce((acc, i) => acc + i.netSalary, 0).toLocaleString()}</p>
                 <div className="flex items-center text-[10px] font-bold text-black bg-gray-100 px-3 py-1 rounded-full w-fit uppercase tracking-tighter">Gross Ledger Val</div>
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
                  <button onClick={handleAdd} className="px-8 py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center">
                      <Plus size={16} className="mr-2"/> Onboard Personnel
                  </button>
              </div>
              <div className="bg-white rounded-3xl border border-black/10 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-[11px]">
                      <thead className="bg-gray-50 border-b text-gray-500 font-black uppercase tracking-widest">
                          <tr><th className="px-8 py-5">Personnel ID</th><th className="px-8 py-5">Legal Name</th><th className="px-8 py-5">Specific OT Rate</th><th className="px-8 py-5">Current Gross</th><th className="px-8 py-5 text-right">System Action</th></tr>
                      </thead>
                      <tbody className="divide-y">
                          {employees.map(emp => (
                              <tr key={emp.id} className="hover:bg-gray-50">
                                  <td className="px-8 py-5 font-mono font-black text-black">{emp.id}</td>
                                  <td className="px-8 py-5 font-black uppercase">{emp.fullName}</td>
                                  <td className="px-8 py-5 text-emerald-600 font-black">
                                     <div className="flex items-center">
                                        <TrendingUp size={12} className="mr-2" />
                                        ₹ {(emp.overtimeRatePerHour || 0).toLocaleString()} / HR
                                     </div>
                                  </td>
                                  <td className="px-8 py-5 font-black">₹ {(emp.grossSalary || 0).toLocaleString()}</td>
                                  <td className="px-8 py-5 text-right">
                                    <div className="flex justify-end space-x-2">
                                      <button onClick={() => { setActiveSubMenu('Processing'); setEditingEmp(emp); }} className="p-2 border border-black rounded-lg hover:bg-black hover:text-white transition-all"><PlayCircle size={14}/></button>
                                      <button onClick={() => { setEditingEmp(emp); setShowEmpModal(true); }} className="p-2 border border-black rounded-lg hover:bg-black hover:text-white transition-all"><Edit2 size={14}/></button>
                                    </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           </div>
        )}

        {activeSubMenu === 'Attendance' && (
           <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-sm space-y-6">
              <input type="month" className="text-sm font-black text-black bg-gray-50 px-4 py-2 rounded-xl" value={procMonth} onChange={e => setProcMonth(e.target.value)}/>
              <div className="overflow-x-auto">
                 <table className="w-full text-[10px] border-collapse min-w-[1000px]">
                    <thead><tr className="bg-gray-50 border-b font-black uppercase text-gray-500"><th className="px-4 py-3 text-left">Personnel</th>{Array.from({length: 31}).map((_,i)=><th key={i} className="px-1 text-center w-8">{i+1}</th>)}<th className="px-4 py-3 text-right">OT Hours</th></tr></thead>
                    <tbody className="divide-y border-black/5">
                       {employees.map(emp => (
                          <tr key={emp.id} className="hover:bg-gray-50">
                             <td className="px-4 py-3 font-bold uppercase truncate max-w-[150px]">{emp.fullName}</td>
                             {Array.from({length: 31}).map((_,i)=>(<td key={i} className="p-1 border border-gray-100 text-center text-[9px] font-black cursor-pointer hover:bg-black hover:text-white" onClick={async () => {
                                const id = `${emp.id}-${procMonth}`;
                                const rec = attendance.find(a => a.id === id) || { id, employeeId: emp.id, month: procMonth, days: {}, overtimeHours: 0, isLocked: false };
                                rec.days[i+1] = rec.days[i+1] === 'P' ? 'A' : 'P';
                                await setDoc(doc(db, 'attendance', id), rec);
                             }}>{attendance.find(a => a.id === `${emp.id}-${procMonth}`)?.days[i+1] || '-'}</td>))}
                             <td className="px-4 py-3">
                                <input type="number" className="w-20 h-8 border border-black/20 rounded px-2 font-black text-right bg-blue-50/30" value={attendance.find(a => a.id === `${emp.id}-${procMonth}`)?.overtimeHours || 0}
                                  onChange={async (e) => {
                                    const id = `${emp.id}-${procMonth}`;
                                    const rec = attendance.find(a => a.id === id) || { id, employeeId: emp.id, month: procMonth, days: {}, overtimeHours: 0, isLocked: false };
                                    rec.overtimeHours = Number(e.target.value);
                                    await setDoc(doc(db, 'attendance', id), rec);
                                  }} />
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeSubMenu === 'Processing' && (
           <div className="max-w-xl mx-auto bg-white p-12 rounded-[40px] shadow-2xl border border-black/10 mt-10">
              <div className="text-center mb-10">
                  <Calculator size={64} className="mx-auto text-black mb-6" />
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Computation Terminal</h3>
                  <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-[0.2em]">Executing Multi-Component Batch Logic</p>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Period</label>
                        <input type="month" className="w-full h-14 bg-gray-50 border border-black/10 rounded-2xl px-6 text-lg font-black" value={procMonth} onChange={e => setProcMonth(e.target.value)}/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Disbursement</label>
                        <select className="w-full h-14 bg-gray-50 border border-black/10 rounded-2xl px-6 text-xs font-black uppercase tracking-widest" value={selectedPayMethod} onChange={e => setSelectedPayMethod(e.target.value)}>
                          <option>Bank Transfer</option>
                          <option>Cash</option>
                          <option>Cheque</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-black/10">
                    <div className="flex items-center space-x-3">
                        <HardHat size={20} className={isOvertimeOnly ? 'text-black' : 'text-gray-300'} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Selective Overtime Mode</span>
                    </div>
                    <button onClick={() => setIsOvertimeOnly(!isOvertimeOnly)} className={`w-12 h-6 rounded-full transition-all flex items-center p-1 ${isOvertimeOnly ? 'bg-black' : 'bg-gray-200'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isOvertimeOnly ? 'translate-x-6' : ''}`}></div>
                    </button>
                </div>

                <button onClick={() => runPayrollEngine()} disabled={isProcessing} className="w-full py-6 bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-gray-900 transition-all flex items-center justify-center">
                    {isProcessing ? <Loader2 className="animate-spin mr-3" /> : <PlayCircle className="mr-3" />}
                    {isProcessing ? 'COMPUTING MATRIX...' : 'RUN SYSTEM EXECUTION'}
                </button>
              </div>
           </div>
        )}

        {activeSubMenu === 'Payslips' && (
           <div className="bg-white rounded-3xl border border-black/10 shadow-sm overflow-hidden">
              <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50 border-b text-gray-500 uppercase font-black tracking-widest">
                      <tr><th className="px-8 py-5">Voucher ID</th><th className="px-8 py-5">Personnel</th><th className="px-8 py-5 text-right">Value</th><th className="px-8 py-5 text-center">Classification</th><th className="px-8 py-5 text-right">Print Actions</th></tr>
                  </thead>
                  <tbody className="divide-y border-black/5">
                      {payrollItems.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-8 py-5 font-mono text-gray-500">{item.id}</td>
                              <td className="px-8 py-5 font-black uppercase text-black">{item.employeeName}</td>
                              <td className="px-8 py-5 text-right font-black">₹ {item.netSalary.toLocaleString()}</td>
                              <td className="px-8 py-5 text-center">
                                 {item.id.includes('-OT') ? 
                                    <span className="px-3 py-1 bg-emerald-600 text-white rounded-full font-black text-[8px] uppercase tracking-tighter">Overtime Voucher</span> : 
                                    <span className="px-3 py-1 border border-black rounded-full font-black text-[8px] uppercase tracking-tighter">Standard Salary</span>
                                 }
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex justify-end space-x-2">
                                  {!item.id.includes('-OT') && <button onClick={() => handleDirectPrint(item, 'PAYSLIP')} className="p-2 border border-black rounded-lg hover:bg-black hover:text-white transition-all" title="Print Salary Slip"><Printer size={16}/></button>}
                                  {(item.overtimeHours || 0) > 0 && (
                                     <button onClick={() => handleDirectPrint(item, 'OT')} className="p-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all" title="Print Specific Overtime Authorization"><Clock size={16}/></button>
                                  )}
                                </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </div>
        )}

        {activeSubMenu === 'Settings' && globalSettings && (
           <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white p-10 rounded-[40px] border border-black/10 shadow-sm space-y-8">
                 <h3 className="text-xl font-black uppercase flex items-center tracking-tighter"><SettingsIcon className="mr-3"/> Global Statutory Ledger</h3>
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">PF Threshold</label><input type="number" className="w-full h-12 bg-gray-50 border border-black/5 rounded-xl px-4 font-black" value={globalSettings.pfThreshold} onChange={e => setGlobalSettings({...globalSettings, pfThreshold: Number(e.target.value)})}/></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">PF Share %</label><input type="number" className="w-full h-12 bg-gray-50 border border-black/5 rounded-xl px-4 font-black" value={globalSettings.pfPercentage} onChange={e => setGlobalSettings({...globalSettings, pfPercentage: Number(e.target.value)})}/></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">ESI Threshold</label><input type="number" className="w-full h-12 bg-gray-50 border border-black/5 rounded-xl px-4 font-black" value={globalSettings.esiThreshold} onChange={e => setGlobalSettings({...globalSettings, esiThreshold: Number(e.target.value)})}/></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">OT Multiplier</label><input type="number" step="0.1" className="w-full h-12 bg-gray-50 border border-black/5 rounded-xl px-4 font-black" value={globalSettings.overtimeMultiplier} onChange={e => setGlobalSettings({...globalSettings, overtimeMultiplier: Number(e.target.value)})}/></div>
                 </div>
                 <button onClick={async () => { await setDoc(doc(db, 'payroll_settings', 'global'), globalSettings); alert("Settings Applied."); }} className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Apply Master Settings</button>
              </div>
           </div>
        )}
      </div>

      {showEmpModal && editingEmp && (
          <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6 backdrop-blur-sm">
             <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-black">
                <div className="p-8 border-b border-black flex justify-between items-center">
                   <div><h2 className="text-2xl font-black uppercase tracking-tighter">Personnel Master Data</h2><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Master ID: {editingEmp.id}</p></div>
                   <button onClick={() => setShowEmpModal(false)} className="p-3 hover:bg-gray-100 rounded-full border border-black"><X size={24}/></button>
                </div>
                <div className="flex bg-gray-50 border-b border-black overflow-x-auto no-scrollbar px-6">
                   {['Personal', 'Contact', 'Address', 'Banking', 'Statutory', 'Employment', 'Salary', 'Components', 'Access'].map((label, idx) => (
                      <button key={idx} onClick={() => setOnboardingTab(idx)} className={`flex items-center space-x-2 px-6 py-5 text-[11px] font-black uppercase transition-all relative shrink-0 ${onboardingTab === idx ? 'text-black' : 'text-gray-400'}`}>
                         <span>{label}</span>{onboardingTab === idx && <div className="absolute bottom-0 left-6 right-6 h-1 bg-black rounded-t-full"></div>}
                      </button>
                   ))}
                </div>
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                   {onboardingTab === 0 && (
                      <div className="grid grid-cols-4 gap-8">
                         <div className="col-span-4 mb-6 flex items-center justify-center">
                             <div className="w-32 h-32 rounded-[32px] border-2 border-black overflow-hidden flex items-center justify-center relative bg-gray-50 shadow-inner">
                                 {isUploading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10"><Loader2 className="animate-spin text-black" /></div>}
                                 {editingEmp.photoUrl ? <img src={editingEmp.photoUrl} className="w-full h-full object-cover" /> : <Camera size={32} className="text-gray-300" />}
                             </div>
                             <div className="ml-8 flex flex-col space-y-3 flex-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Image Storage Unit</label>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-6 py-3 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg w-fit">
                                  <Upload size={16} className="mr-2" /> Select From Device
                                </button>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">JPG / PNG High Fidelity | Max 2MB</p>
                             </div>
                         </div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Employee ID</label><input disabled className="w-full h-12 bg-gray-100 border border-black/10 rounded-2xl px-5 font-mono font-bold" value={editingEmp.id || ''}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Full Name</label><input className="w-full h-12 border border-black rounded-2xl px-5 font-bold outline-none uppercase" value={editingEmp.fullName || ''} onChange={e => setEditingEmp({...editingEmp, fullName: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Father's Name</label><input className="w-full h-12 border border-black rounded-2xl px-5 font-bold outline-none uppercase" value={editingEmp.fatherName || ''} onChange={e => setEditingEmp({...editingEmp, fatherName: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Mother's Name</label><input className="w-full h-12 border border-black rounded-2xl px-5 font-bold outline-none uppercase" value={editingEmp.motherName || ''} onChange={e => setEditingEmp({...editingEmp, motherName: e.target.value})}/></div>
                      </div>
                   )}
                   {onboardingTab === 6 && (
                      <div className="space-y-10">
                         <div className="grid grid-cols-4 gap-8 bg-black p-8 rounded-[32px] text-white">
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Monthly Basic</label><input type="number" className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.basicSalary || 0} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, basicSalary: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">House Rent</label><input type="number" className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.hra || 0} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, hra: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Other Perks</label><input type="number" className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.otherAllowances || 0} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, otherAllowances: Number(e.target.value)}))}/></div>
                         </div>
                         <div className="flex justify-around bg-gray-50 p-8 rounded-[32px] border border-black">
                            <div className="text-center"><p className="text-[10px] font-black text-gray-400 uppercase">Gross Master Calculation</p><p className="text-2xl font-black">₹ {(editingEmp.grossSalary || 0).toLocaleString()}</p></div>
                            <div className="text-center"><p className="text-[10px] font-black text-black uppercase tracking-widest">Net Payable Estimates</p><p className="text-2xl font-black text-black">₹ {(editingEmp.netSalary || 0).toLocaleString()}</p></div>
                         </div>
                      </div>
                   )}
                   {onboardingTab === 7 && (
                      <div className="space-y-8">
                         <h4 className="text-sm font-black uppercase text-black flex items-center border-b border-black pb-4"><Calculator className="mr-2" size={18} /> Dynamic Component Calibration</h4>
                         <div className="grid grid-cols-3 gap-8">
                            <div className="space-y-1">
                               <label className="text-[10px] font-black uppercase text-gray-500">Personnel OT Rate (Subjective)</label>
                               <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600">₹</span>
                                  <input type="number" className="w-full h-14 border-2 border-emerald-100 rounded-2xl pl-10 pr-5 font-black text-lg outline-none focus:border-emerald-500 bg-emerald-50/20 shadow-sm" value={editingEmp.overtimeRatePerHour || 0} onChange={e => setEditingEmp({...editingEmp, overtimeRatePerHour: Number(e.target.value)})} placeholder="Set Rate / HR"/>
                               </div>
                               <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">This employee will be compensated at this rate per approved hour.</p>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase">Outstanding Advance</label><input type="number" className="w-full h-14 border-2 border-black rounded-2xl px-5 font-bold outline-none" value={editingEmp.outstandingAdvance || 0} onChange={e => setEditingEmp({...editingEmp, outstandingAdvance: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase">Fixed Monthly Bonus</label><input type="number" className="w-full h-14 border-2 border-black rounded-2xl px-5 font-bold outline-none" value={editingEmp.fixedBonus || 0} onChange={e => setEditingEmp({...editingEmp, fixedBonus: Number(e.target.value)})}/></div>
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-8 border-t border-black bg-gray-50 flex justify-between items-center">
                   <div className="flex space-x-4">
                      <button disabled={onboardingTab === 0} onClick={() => setOnboardingTab(t => t - 1)} className="px-6 py-4 bg-white border border-black rounded-2xl text-[11px] font-black uppercase text-black disabled:opacity-30 flex items-center transition-all hover:bg-gray-100"><ChevronLeft size={16} className="mr-2"/> Previous Unit</button>
                      <button disabled={onboardingTab === 8} onClick={() => setOnboardingTab(t => t + 1)} className="px-8 py-4 bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center transition-all hover:bg-gray-800">Proceed <ChevronRight size={16} className="ml-2"/></button>
                   </div>
                   <button onClick={handleSave} className="px-12 py-4 bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center hover:bg-gray-800 active:scale-95 transition-all"><Check size={18} className="mr-2"/> Persist Master Data</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default Payroll;
