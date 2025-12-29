
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, CreditCard, TrendingUp, FileText, 
  ShieldCheck, Landmark, Plus, Search, Filter, 
  Download, Printer, Trash2, Edit2, CheckCircle2, 
  Clock, AlertCircle, BarChart3, Receipt, Wallet, 
  Settings as SettingsIcon, ChevronRight, Calculator,
  Lock, RefreshCw, X, User, Phone, MapPin, Briefcase, 
  ShieldAlert, Save, Upload, Banknote,
  Heart, GraduationCap, Building, ClipboardCheck, Power,
  ChevronLeft, Camera
} from 'lucide-react';
import { 
  Employee, AttendanceRecord, 
  PayrollRun, PayrollItem, Branch, UserRole, 
  PayrollSettings, Address, BankDetails
} from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, setDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore';
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

const Payroll: React.FC<{ branches: Branch[], userRole: UserRole }> = ({ branches = [], userRole }) => {
  const [activeSubMenu, setActiveSubMenu] = useState<'Dashboard' | 'Employees' | 'Attendance' | 'Processing' | 'Payslips' | 'Settings'>('Dashboard');
  const [onboardingTab, setOnboardingTab] = useState(0);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [globalSettings, setGlobalSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
    return () => { unsubEmp(); unsubAtt(); unsubItem(); unsubSet(); };
  }, []);

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);

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
    // Robust ID generation starting from 911001
    const lastId = employees.reduce((max, emp) => {
        const idNum = parseInt(emp.id);
        return isNaN(idNum) ? max : Math.max(max, idNum);
    }, 911000);
    const newId = (lastId + 1).toString();
    
    setEditingEmp({
      id: newId, 
      fullName: '', fatherName: '', motherName: '', dob: '', gender: 'Male', maritalStatus: 'Single', bloodGroup: '', nationality: 'Indian', photoUrl: '',
      mobile: '', altMobile: '', officialEmail: '', personalEmail: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactNumber: '',
      currentAddress: { line1: '', city: '', state: 'Karnataka', pincode: '', country: 'INDIA' },
      permanentAddress: { line1: '', city: '', state: 'Karnataka', pincode: '', country: 'INDIA' },
      permSameAsCurrent: false,
      bankDetails: { bankName: '', accountNumber: '', ifscCode: '', branchName: '', accountHolderName: '', accountType: 'Salary', paymentMode: 'Bank Transfer', upiId: '', cancelledChequeUrl: '' },
      aadhaar: '', pan: '', uan: '', pfAccountNumber: '', esiNo: '', ptState: 'Karnataka', taxRegime: 'Old',
      dateOfJoining: '', employmentType: 'Permanent', department: 'Technology', designation: '', reportingManager: '', branchId: branches[0]?.id || 'B001', shiftType: 'General', weeklyOff: 'Sunday',
      salaryType: 'Monthly', basicSalary: 0, hra: 0, specialAllowance: 0, otherAllowances: 0, grossSalary: 0, pfDeductionType: 'Auto', esiDeduction: 0, professionalTax: 0, tds: 0, netSalary: 0,
      attendanceMethod: 'Manual', leavePolicy: 'Standard', openingLeaveBalance: 0, overtimeEligibility: 'Yes',
      loginCreation: 'Yes', role: UserRole.EMPLOYEE, status: 'Active', portalPassword: newId
    });
    setOnboardingTab(0);
    setShowEmpModal(true);
  };

  const handleSave = async () => {
    if (!editingEmp.fullName) return alert("Full Name is mandatory.");
    const finalEmp = calculateSalaryFields(editingEmp);
    await setDoc(doc(db, 'employees', finalEmp.id), finalEmp);
    setShowEmpModal(false);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [procMonth, setProcMonth] = useState(new Date().toISOString().slice(0, 7));

  const runPayrollEngine = async () => {
    if (!confirm(`Run payroll computation for ${procMonth}?`)) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(db);
        const branchId = branches[0]?.id || 'B001';
        const runId = `PR-${procMonth}-${branchId}`;
        const daysInMonth = new Date(parseInt(procMonth.split('-')[0]), parseInt(procMonth.split('-')[1]), 0).getDate();

        for (const emp of employees) {
            if (emp.status !== 'Active') continue;
            const attId = `${emp.id}-${procMonth}`;
            const att = attendance.find(a => a.id === attId);
            const lopDays = Object.values(att?.days || {}).filter(v => v === 'UL' || v === 'A').length;
            const payableDays = daysInMonth - lopDays;
            const ratio = payableDays / daysInMonth;

            const e_basic = Math.round(emp.basicSalary * ratio);
            const e_hra = Math.round(emp.hra * ratio);
            const e_special = Math.round(emp.specialAllowance * ratio);
            const e_others = Math.round((emp.otherAllowances || 0) * ratio);
            const gross = e_basic + e_hra + e_special + e_others;

            const d_pf = Math.round(Math.min(e_basic, 15000) * 0.12);
            const d_pt = gross > 15000 ? 200 : 0;
            const d_esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
            const d_tds = Math.round((emp.tds || 0) * ratio);
            const totalDeductions = d_pf + d_pt + d_esi + d_tds;
            const net = gross - totalDeductions;

            const itemId = `${runId}-${emp.id}`;
            batch.set(doc(db, 'payroll_items', itemId), {
                id: itemId, runId, employeeId: emp.id, employeeName: emp.fullName, payableDays, standardDays: daysInMonth, lopDays,
                earnings: { basic: e_basic, hra: e_hra, special: e_special, bonus: 0, overtime: 0, others: e_others },
                deductions: { pf: d_pf, esi: d_esi, pt: d_pt, tds: d_tds, advance: 0, others: 0 },
                grossEarnings: gross, totalDeductions, netSalary: net,
                qrCode: generateSecureQR({ type: 'PAYSLIP', empId: emp.id, month: procMonth, net, company: COMPANY_NAME })
            });
        }
        await batch.commit();
        alert("Success: Payroll successfully computed.");
    } catch (e: any) {
        alert("Error: " + e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const PayslipDocument = ({ item }: { item: PayrollItem }) => {
    const emp = employees.find(e => e.id === item.employeeId);
    const monthYear = new Date(item.runId.split('-')[1] + "-01");
    const monthLong = monthYear.toLocaleString('default', { month: 'long' }).toUpperCase();
    const yearLong = monthYear.getFullYear();
    const branch = branches.find(b => b.id === emp?.branchId) || branches[0];

    return (
      <div className="bg-white w-[210mm] min-h-[297mm] p-[10mm] text-black font-sans flex flex-col border border-gray-400 relative print:border-none print:p-0">
        <div className="flex justify-between items-center border-2 border-black p-4 mb-4">
          <img src={LOGO_DARK_BG} alt="VEDARTHA" className="h-14 object-contain" />
          <div className="text-right flex-1 ml-10">
            <h1 className="text-xl font-bold uppercase tracking-tight leading-tight">
              VEDARTHA INTERNATIONAL LIMITED SERVICE DELIVERY CENTER
            </h1>
            <p className="text-sm font-bold uppercase">(BENGALURU) PRIVATE LIMITED</p>
          </div>
        </div>
        <div className="text-center mb-4">
           <h2 className="text-md font-bold text-blue-800 uppercase tracking-wide">Payslip for the month of {monthLong} {yearLong}</h2>
        </div>
        <table className="w-full border-t-2 border-x-2 border-black border-collapse text-[10px]">
           <tbody>
              <tr className="border-b border-black">
                 <td className="p-2 w-1/4 border-r border-black font-bold">Employee ID</td>
                 <td className="p-2 w-1/4 border-r border-black">: {item.employeeId}</td>
                 <td className="p-2 w-1/4 border-r border-black font-bold">Employee Name</td>
                 <td className="p-2 w-1/4">: {item.employeeName}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 border-r border-black font-bold">Date of Birth</td>
                 <td className="p-2 border-r border-black">: {emp?.dob || 'N/A'}</td>
                 <td className="p-2 border-r border-black font-bold">Joining Date</td>
                 <td className="p-2">: {emp?.dateOfJoining || 'N/A'}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 border-r border-black font-bold">Designation</td>
                 <td className="p-2 border-r border-black">: {emp?.designation}</td>
                 <td className="p-2 border-r border-black font-bold">Location</td>
                 <td className="p-2">: {branch?.address.city}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 border-r border-black font-bold">UAN Number</td>
                 <td className="p-2 border-r border-black">: {emp?.uan}</td>
                 <td className="p-2 border-r border-black font-bold">Pan Number</td>
                 <td className="p-2">: {emp?.pan}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 border-r border-black font-bold">PF Number</td>
                 <td className="p-2 border-r border-black">: {emp?.pfAccountNumber}</td>
                 <td className="p-2 border-r border-black font-bold">LOS</td>
                 <td className="p-2">: {item.lopDays}</td>
              </tr>
              <tr className="border-b-2 border-black">
                 <td className="p-2 border-r border-black font-bold">Regime Type</td>
                 <td className="p-2 border-r border-black">: {emp?.taxRegime || 'Old'} Regime</td>
                 <td colSpan={2} className="p-0"></td>
              </tr>
           </tbody>
        </table>

        <div className="flex border-x-2 border-black border-collapse text-[10px]">
           <div className="w-1/2 border-r border-black">
              <table className="w-full">
                 <thead>
                    <tr className="border-b border-black bg-gray-100">
                       <th className="text-left p-2 border-r border-black font-bold uppercase">EARNINGS</th>
                       <th className="text-right p-2 font-bold uppercase">Amount (Rs.)</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200">
                    <tr><td className="p-2 border-r border-black">Basic Salary</td><td className="p-2 text-right">{(item.earnings?.basic || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td className="p-2 border-r border-black">House Rent Allowance</td><td className="p-2 text-right">{(item.earnings?.hra || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td className="p-2 border-r border-black">Special Pay</td><td className="p-2 text-right">{(item.earnings?.special || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td className="p-2 border-r border-black">Other Allowances</td><td className="p-2 text-right">{(item.earnings?.others || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr className="h-10"><td></td><td className="border-l border-black"></td></tr>
                 </tbody>
              </table>
           </div>
           <div className="w-1/2">
              <table className="w-full">
                 <thead>
                    <tr className="border-b border-black bg-gray-100">
                       <th className="text-left p-2 border-r border-black font-bold uppercase">DEDUCTIONS</th>
                       <th className="text-right p-2 font-bold uppercase">Amount (Rs.)</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200">
                    <tr><td className="p-2 border-r border-black">Provident Fund</td><td className="p-2 text-right">{(item.deductions?.pf || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td className="p-2 border-r border-black">Professional Tax</td><td className="p-2 text-right">{(item.deductions?.pt || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td className="p-2 border-r border-black">ESI</td><td className="p-2 text-right">{(item.deductions?.esi || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td className="p-2 border-r border-black">TDS</td><td className="p-2 text-right">{(item.deductions?.tds || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>
                    <tr className="h-10"><td className="border-r border-black"></td><td></td></tr>
                 </tbody>
              </table>
           </div>
        </div>

        <div className="flex border-2 border-black border-collapse text-[10px] font-bold">
           <div className="w-1/2 flex justify-between p-2 border-r border-black bg-gray-50">
              <span className="uppercase">Total Earnings Rs.</span>
              <span>{(item.grossEarnings || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
           </div>
           <div className="w-1/2 flex justify-between p-2 bg-gray-50">
              <span className="uppercase">Total Deductions Rs.</span>
              <span>{(item.totalDeductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
           </div>
        </div>

        <div className="flex border-x-2 border-b-2 border-black border-collapse text-[10px]">
           <div className="w-2/3 p-0 border-r border-black">
              <div className="border-b border-black p-2 bg-gray-100 flex justify-between items-center h-8">
                 <span className="font-bold uppercase tracking-widest text-blue-900">Net Salary Rs. {(item.netSalary || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
              <div className="p-4 space-y-2">
                 <div className="flex items-center space-x-4">
                    <QRCode value={item.qrCode} size={60} level="M" fgColor="#000000" />
                    <div>
                       <p className="text-[8px] font-bold opacity-60">SYSTEM GENERATED QR</p>
                       <p className="text-[9px] italic font-medium">{numberToWords(item.netSalary || 0)}</p>
                    </div>
                 </div>
              </div>
           </div>
           <div className="w-1/3">
              <table className="w-full h-full">
                 <tbody>
                    <tr className="border-b border-black">
                       <td className="p-2 font-bold w-1/2 border-r border-black">STANDARD DAYS</td>
                       <td className="p-2">: {item.standardDays}</td>
                    </tr>
                    <tr className="border-b border-black">
                       <td className="p-2 font-bold border-r border-black">DAYS WORKED</td>
                       <td className="p-2">: {item.payableDays}</td>
                    </tr>
                    <tr className="border-b border-black bg-gray-50">
                       <td className="p-2 font-bold border-r border-black">PAYMENT</td>
                       <td className="p-2">: {emp?.bankDetails.paymentMode?.toUpperCase() || 'BANK TRANSFER'}</td>
                    </tr>
                    <tr className="border-b border-black">
                       <td className="p-2 font-bold border-r border-black">BANK</td>
                       <td className="p-2">: {emp?.bankDetails.bankName.toUpperCase() || 'N/A'}</td>
                    </tr>
                    <tr>
                       <td className="p-2 font-bold border-r border-black">A/C No.</td>
                       <td className="p-2 font-mono">: {emp?.bankDetails.accountNumber || 'N/A'}</td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </div>

        <div className="mt-4 text-[9px] font-bold border-2 border-black p-4 space-y-2">
           <p>Note: This is a system generated report. This does not require any signature.</p>
           <p className="leading-relaxed">
             Private and Confidential Disclaimer: This payslip has been generated by the Vedartha Systems & Solution payroll service provider. All compensation information has been treated as confidential.
           </p>
        </div>
      </div>
    );
  };

  const [viewingPayslip, setViewingPayslip] = useState<PayrollItem | null>(null);

  const onboardingTabs = [
    { label: 'Personal Info', icon: User },
    { label: 'Contact', icon: Phone },
    { label: 'Address', icon: MapPin },
    { label: 'Banking', icon: Landmark },
    { label: 'Statutory', icon: ShieldAlert },
    { label: 'Employment', icon: Briefcase },
    { label: 'Salary/Payroll', icon: Banknote },
    { label: 'Attendance', icon: ClipboardCheck },
    { label: 'System/Login', icon: Power },
  ];

  const renderEmployees = () => (
    <div className="space-y-6">
       <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input type="text" className="w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold" placeholder="Filter Master Database..."/>
           </div>
           <button onClick={handleAdd} className="px-8 py-4 bg-[#0854a0] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center transition-all hover:bg-blue-800 active:scale-95">
              <Plus size={16} className="mr-2"/> New Personnel Entry
           </button>
        </div>

        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
           <table className="w-full text-left text-[11px]">
              <thead className="bg-gray-50 border-b text-gray-400 font-black uppercase tracking-widest">
                 <tr>
                    <th className="px-8 py-5">Personnel ID</th>
                    <th className="px-8 py-5">Identity & Designation</th>
                    <th className="px-8 py-5">Monthly Net</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y">
                 {employees.map(emp => (
                   <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-8 py-5 font-mono font-black text-[#0854a0]">{emp.id}</td>
                      <td className="px-8 py-5">
                         <p className="font-black text-gray-800 uppercase">{emp.fullName}</p>
                         <p className="text-[9px] text-gray-400 font-bold uppercase">{emp.department} | {emp.designation}</p>
                      </td>
                      <td className="px-8 py-5 font-black text-gray-600">₹ {(emp.netSalary || 0).toLocaleString('en-IN')}</td>
                      <td className="px-8 py-5"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${emp.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{emp.status}</span></td>
                      <td className="px-8 py-5 text-right"><button onClick={() => { setEditingEmp(emp); setShowEmpModal(true); }} className="p-2 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Edit2 size={14}/></button></td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] font-sans">
      <div className="flex bg-white border-b no-print overflow-x-auto custom-scrollbar">
        {[
          { id: 'Dashboard', icon: BarChart3 },
          { id: 'Employees', icon: Users },
          { id: 'Attendance', icon: Calendar },
          { id: 'Processing', icon: Calculator },
          { id: 'Payslips', icon: FileText },
          { id: 'Settings', icon: SettingsIcon }
        ].map(item => (
          <button key={item.id} onClick={() => setActiveSubMenu(item.id as any)} className={`flex-1 min-w-[140px] py-5 text-[11px] font-black uppercase flex flex-col items-center space-y-2 transition-all ${activeSubMenu === item.id ? 'text-[#0854a0] border-b-2 border-[#0854a0] bg-blue-50/40' : 'text-gray-400 hover:bg-gray-50'}`}>
            <item.icon size={18} /><span>{item.id}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
        {activeSubMenu === 'Dashboard' && (
           <div className="grid grid-cols-4 gap-6 animate-in fade-in">
              <div className="bg-[#0854a0] p-8 rounded-[40px] shadow-2xl text-white flex flex-col justify-between h-52">
                 <div><h3 className="text-xs font-black uppercase opacity-60">Personnel Count</h3><p className="text-5xl font-black tracking-tighter mt-4">{employees.length}</p></div>
                 <div className="flex items-center text-[10px] font-bold opacity-60 uppercase"><ShieldCheck className="mr-2" size={14}/> Verified Ledger</div>
              </div>
           </div>
        )}

        {activeSubMenu === 'Employees' && renderEmployees()}
        
        {activeSubMenu === 'Attendance' && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex justify-between items-center">
                   <input type="month" className="text-sm font-black text-[#0854a0] bg-gray-50 px-4 py-2 rounded-xl" value={procMonth} onChange={e => setProcMonth(e.target.value)}/>
                   <div className="flex space-x-4 text-[9px] font-black uppercase text-gray-400">
                      <span className="text-emerald-500">P = Present</span><span className="text-rose-500">UL = Unpaid Leave</span><span className="text-amber-500">HD = Half Day</span>
                   </div>
                </div>
                <div className="bg-white rounded-[32px] border overflow-x-auto shadow-sm">
                   <table className="w-full text-[10px] border-collapse min-w-[1200px]">
                      <thead className="bg-gray-50 border-b font-black uppercase">
                         <tr><th className="px-6 py-4 border-r w-48 sticky left-0 bg-gray-50 z-10 text-left">Personnel Name</th>{Array.from({length: 31}).map((_, i) => <th key={i} className="px-1 py-4 text-center border-r w-8">{i+1}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y">
                         {employees.filter(e => e.status === 'Active').map(emp => {
                            const id = `${emp.id}-${procMonth}`;
                            const rec = attendance.find(a => a.id === id);
                            return (
                              <tr key={emp.id} className="hover:bg-blue-50/20">
                                 <td className="px-6 py-4 font-bold border-r sticky left-0 bg-white z-10">{emp.fullName}</td>
                                 {Array.from({length: 31}).map((_, i) => (
                                   <td key={i} className="p-0 border-r text-center">
                                      <select className="w-full h-8 text-[9px] font-black bg-transparent text-center border-none appearance-none cursor-pointer" value={rec?.days[i+1] || ''} onChange={async (e) => {
                                          const existing = rec || { id, employeeId: emp.id, month: procMonth, days: {}, overtimeHours: 0, isLocked: false };
                                          existing.days[i+1] = e.target.value as any;
                                          await setDoc(doc(db, 'attendance', id), existing);
                                      }}><option value="">-</option><option value="P">P</option><option value="A">A</option><option value="UL">UL</option><option value="HD">HD</option></select>
                                   </td>
                                 ))}
                              </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
            </div>
        )}

        {activeSubMenu === 'Processing' && (
            <div className="max-w-xl mx-auto bg-white p-12 rounded-[48px] shadow-2xl border text-center mt-10">
                <Calculator size={64} className="mx-auto text-[#0854a0] mb-8" />
                <h3 className="text-2xl font-black uppercase text-gray-800">Global Payroll Engine</h3>
                <p className="text-xs text-gray-400 font-bold my-6 uppercase">Computation handles pro-rata LOP, Statutory (PF/ESI) & TDS.</p>
                <div className="space-y-4">
                    <input type="month" className="w-full h-16 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-6 text-xl font-black text-center outline-none transition-all" value={procMonth} onChange={e => setProcMonth(e.target.value)}/>
                    <button onClick={runPayrollEngine} disabled={isProcessing} className="w-full py-6 bg-[#0854a0] text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center transition-all transform active:scale-95">
                        {isProcessing ? <><RefreshCw className="animate-spin mr-3"/> Running Matrix calculations...</> : 'Initiate Engine Execution'}
                    </button>
                </div>
            </div>
        )}

        {activeSubMenu === 'Payslips' && (
            <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden animate-in fade-in">
                <div className="p-8 border-b bg-gray-50/30 flex justify-between items-center">
                    <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-gray-400">Voucher Distribution Hub</h3>
                </div>
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-gray-50/50 border-b text-gray-400 font-black uppercase">
                        <tr><th className="px-8 py-5">Voucher Ref</th><th className="px-8 py-5">Business Partner</th><th className="px-8 py-5 text-right">Settlement Inr</th><th className="px-8 py-5 text-right">Operations</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {payrollItems.length === 0 ? (
                           <tr><td colSpan={4} className="py-20 text-center uppercase font-black text-gray-200 tracking-[0.3em]">No Computed Vouchers Found</td></tr>
                        ) : (
                           payrollItems.map(item => (
                               <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                   <td className="px-8 py-5 font-mono font-bold text-gray-400">{item.id}</td>
                                   <td className="px-8 py-5 font-black uppercase text-gray-800">{item.employeeName} ({item.employeeId})</td>
                                   <td className="px-8 py-5 text-right font-black text-emerald-600">₹ {(item.netSalary || 0).toLocaleString('en-IN')}</td>
                                   <td className="px-8 py-5 text-right"><button onClick={() => setViewingPayslip(item)} className="p-3 text-blue-500 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-xl shadow-sm transition-all"><Download size={18}/></button></td>
                               </tr>
                           ))
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {activeSubMenu === 'Settings' && globalSettings && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
                <div className="bg-white p-10 rounded-[48px] border shadow-2xl space-y-10">
                   <div className="flex items-center space-x-4 border-b pb-6"><SettingsIcon size={32} className="text-[#0854a0]"/><h3 className="text-2xl font-black uppercase tracking-tighter">Statutory Compliance Mapping</h3></div>
                   <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">PF Threshold (INR)</label><input type="number" className="w-full h-14 bg-gray-50 border-2 border-transparent focus:border-[#0854a0] rounded-2xl px-6 font-black" value={globalSettings.pfThreshold} onChange={e => setGlobalSettings({...globalSettings, pfThreshold: Number(e.target.value)})}/></div>
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">PF Share (%)</label><input type="number" className="w-full h-14 bg-gray-50 border-2 border-transparent focus:border-[#0854a0] rounded-2xl px-6 font-black" value={globalSettings.pfPercentage} onChange={e => setGlobalSettings({...globalSettings, pfPercentage: Number(e.target.value)})}/></div>
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">ESI Threshold (INR)</label><input type="number" className="w-full h-14 bg-gray-50 border-2 border-transparent focus:border-[#0854a0] rounded-2xl px-6 font-black" value={globalSettings.esiThreshold} onChange={e => setGlobalSettings({...globalSettings, esiThreshold: Number(e.target.value)})}/></div>
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">ESI Rate (%)</label><input type="number" className="w-full h-14 bg-gray-50 border-2 border-transparent focus:border-[#0854a0] rounded-2xl px-6 font-black" value={globalSettings.esiPercentage} onChange={e => setGlobalSettings({...globalSettings, esiPercentage: Number(e.target.value)})}/></div>
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">PT Amount (Flat)</label><input type="number" className="w-full h-14 bg-gray-50 border-2 border-transparent focus:border-[#0854a0] rounded-2xl px-6 font-black" value={globalSettings.ptAmount} onChange={e => setGlobalSettings({...globalSettings, ptAmount: Number(e.target.value)})}/></div>
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">OT Multiplier (Rate x ?)</label><input type="number" className="w-full h-14 bg-gray-50 border-2 border-transparent focus:border-[#0854a0] rounded-2xl px-6 font-black" value={globalSettings.overtimeMultiplier} onChange={e => setGlobalSettings({...globalSettings, overtimeMultiplier: Number(e.target.value)})}/></div>
                   </div>
                   <button onClick={async () => { await setDoc(doc(db, 'payroll_settings', 'global'), globalSettings); alert("System policies committed."); }} className="w-full py-6 bg-[#0854a0] text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl flex items-center justify-center hover:bg-blue-800 transition-all"><Save className="mr-3" size={20}/> Commit Global Policy</button>
                </div>
            </div>
        )}
      </div>

      {showEmpModal && editingEmp && (
          <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
             <div className="bg-[#f8f9fa] w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-white/20">
                <div className="p-8 border-b bg-white flex justify-between items-center shadow-sm">
                   <div>
                      <h2 className="text-2xl font-black text-gray-800 tracking-tight uppercase">SAP Personnel Onboarding</h2>
                      <p className="text-[10px] font-black text-blue-500 mt-1 uppercase tracking-widest">Global Master Data Environment | ID: {editingEmp.id}</p>
                   </div>
                   <button onClick={() => setShowEmpModal(false)} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400"><X size={24}/></button>
                </div>

                <div className="flex bg-white border-b overflow-x-auto no-scrollbar px-6 shadow-sm">
                   {onboardingTabs.map((tab, idx) => (
                      <button key={idx} onClick={() => setOnboardingTab(idx)} className={`flex items-center space-x-2 px-8 py-5 text-[11px] font-black uppercase transition-all relative shrink-0 ${onboardingTab === idx ? 'text-[#0854a0]' : 'text-gray-400 hover:text-gray-600'}`}>
                         <tab.icon size={16} /><span>{tab.label}</span>
                         {onboardingTab === idx && <div className="absolute bottom-0 left-6 right-6 h-1 bg-[#0854a0] rounded-t-full"></div>}
                      </button>
                   ))}
                </div>
                
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                   <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {onboardingTab === 0 && (
                         <div className="grid grid-cols-4 gap-8">
                            <div className="col-span-4 mb-6 flex items-center justify-center">
                                <div className="relative group">
                                    <div className="w-40 h-40 rounded-3xl bg-gray-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                                        {editingEmp.photoUrl ? <img src={editingEmp.photoUrl} className="w-full h-full object-cover" /> : <Camera size={48} className="text-gray-300" />}
                                    </div>
                                    <div className="mt-4">
                                        <label className="text-[10px] font-black uppercase text-gray-400 text-center block mb-2">Passport Photo URL</label>
                                        <input className="w-full h-10 bg-white border rounded-xl px-4 text-xs font-bold shadow-inner" placeholder="Paste image link here..." value={editingEmp.photoUrl} onChange={e => setEditingEmp({...editingEmp, photoUrl: e.target.value})}/>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Employee ID</label><input disabled className="w-full h-12 bg-gray-50 border rounded-2xl px-5 font-mono font-bold text-gray-800" value={editingEmp.id}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Full Name</label><input className="w-full h-12 bg-white border-2 border-gray-100 focus:border-blue-500 rounded-2xl px-5 font-bold outline-none" value={editingEmp.fullName} onChange={e => setEditingEmp({...editingEmp, fullName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Father's Name</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.fatherName} onChange={e => setEditingEmp({...editingEmp, fatherName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Mother's Name</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.motherName} onChange={e => setEditingEmp({...editingEmp, motherName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Date of Birth</label><input type="date" className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.dob} onChange={e => setEditingEmp({...editingEmp, dob: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Gender</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.gender} onChange={e => setEditingEmp({...editingEmp, gender: e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Marital Status</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.maritalStatus} onChange={e => setEditingEmp({...editingEmp, maritalStatus: e.target.value})}><option>Single</option><option>Married</option><option>Divorced</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Blood Group</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bloodGroup} onChange={e => setEditingEmp({...editingEmp, bloodGroup: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Nationality</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.nationality} onChange={e => setEditingEmp({...editingEmp, nationality: e.target.value})}/></div>
                         </div>
                      )}

                      {onboardingTab === 1 && (
                         <div className="grid grid-cols-3 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Mobile Number</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.mobile} onChange={e => setEditingEmp({...editingEmp, mobile: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Alternate Mobile</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.altMobile} onChange={e => setEditingEmp({...editingEmp, altMobile: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Official Email</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.officialEmail} onChange={e => setEditingEmp({...editingEmp, officialEmail: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Personal Email</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.personalEmail} onChange={e => setEditingEmp({...editingEmp, personalEmail: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Emergency Name</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.emergencyContactName} onChange={e => setEditingEmp({...editingEmp, emergencyContactName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Relation</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.emergencyContactRelation} onChange={e => setEditingEmp({...editingEmp, emergencyContactRelation: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Emergency Number</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.emergencyContactNumber} onChange={e => setEditingEmp({...editingEmp, emergencyContactNumber: e.target.value})}/></div>
                         </div>
                      )}

                      {onboardingTab === 2 && (
                         <div className="grid grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest border-b pb-2">Current Residence</h4>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Address Line</label><textarea rows={3} className="w-full bg-white border-2 border-gray-100 rounded-2xl p-5 font-bold outline-none" value={editingEmp.currentAddress.line1} onChange={e => setEditingEmp({...editingEmp, currentAddress: {...editingEmp.currentAddress, line1: e.target.value}})}/></div>
                                <div className="grid grid-cols-2 gap-6">
                                   <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">City</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.currentAddress.city} onChange={e => setEditingEmp({...editingEmp, currentAddress: {...editingEmp.currentAddress, city: e.target.value}})}/></div>
                                   <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">State</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.currentAddress.state} onChange={e => setEditingEmp({...editingEmp, currentAddress: {...editingEmp.currentAddress, state: e.target.value}})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                   <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Pincode</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.currentAddress.pincode} onChange={e => setEditingEmp({...editingEmp, currentAddress: {...editingEmp.currentAddress, pincode: e.target.value}})}/></div>
                                   <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Country</label><input className="w-full h-12 bg-gray-50 border rounded-2xl px-5 font-bold" value="INDIA" disabled/></div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center border-b pb-2"><h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Permanent Registry</h4><label className="flex items-center text-[10px] font-bold text-blue-600"><input type="checkbox" className="mr-2" checked={editingEmp.permSameAsCurrent} onChange={e => {
                                    const same = e.target.checked;
                                    setEditingEmp({...editingEmp, permSameAsCurrent: same, permanentAddress: same ? {...editingEmp.currentAddress} : {...editingEmp.permanentAddress}});
                                }}/> Same as current</label></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Address Line</label><textarea rows={3} className="w-full bg-white border-2 border-gray-100 rounded-2xl p-5 font-bold outline-none" value={editingEmp.permanentAddress.line1} onChange={e => setEditingEmp({...editingEmp, permanentAddress: {...editingEmp.permanentAddress, line1: e.target.value}})}/></div>
                                <div className="grid grid-cols-2 gap-6">
                                   <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">City</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.permanentAddress.city} onChange={e => setEditingEmp({...editingEmp, permanentAddress: {...editingEmp.permanentAddress, city: e.target.value}})}/></div>
                                   <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">State</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.permanentAddress.state} onChange={e => setEditingEmp({...editingEmp, permanentAddress: {...editingEmp.permanentAddress, state: e.target.value}})}/></div>
                                </div>
                            </div>
                         </div>
                      )}

                      {onboardingTab === 3 && (
                         <div className="space-y-10">
                            <div className="grid grid-cols-3 gap-8">
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">A/C Holder Name</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.accountHolderName} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, accountHolderName: e.target.value}})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Bank Name</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.bankName} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, bankName: e.target.value}})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Branch Name</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.branchName} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, branchName: e.target.value}})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Account Number</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-mono font-bold outline-none" value={editingEmp.bankDetails.accountNumber} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, accountNumber: e.target.value}})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">IFSC Code</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-mono font-bold outline-none uppercase" value={editingEmp.bankDetails.ifscCode} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, ifscCode: e.target.value}})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Account Type</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.accountType} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, accountType: e.target.value as any}})}><option>Salary</option><option>Savings</option><option>Current</option></select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Payment Mode</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.paymentMode} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, paymentMode: e.target.value as any}})}><option>Bank Transfer</option><option>Cheque</option><option>Cash</option></select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">UPI ID (Optional)</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.upiId} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, upiId: e.target.value}})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Cheque Proof URL</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.cancelledChequeUrl} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, cancelledChequeUrl: e.target.value}})}/></div>
                            </div>
                         </div>
                      )}

                      {onboardingTab === 4 && (
                         <div className="grid grid-cols-4 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Aadhaar Number</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.aadhaar} onChange={e => setEditingEmp({...editingEmp, aadhaar: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">PAN Number</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-mono font-bold outline-none uppercase" value={editingEmp.pan} onChange={e => setEditingEmp({...editingEmp, pan: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">PF UAN Number</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-mono font-bold outline-none" value={editingEmp.uan} onChange={e => setEditingEmp({...editingEmp, uan: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">PF Account No</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-mono font-bold outline-none" value={editingEmp.pfAccountNumber} onChange={e => setEditingEmp({...editingEmp, pfAccountNumber: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">ESI Number</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.esiNo} onChange={e => setEditingEmp({...editingEmp, esiNo: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">PT State</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.ptState} onChange={e => setEditingEmp({...editingEmp, ptState: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Tax Regime</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.taxRegime} onChange={e => setEditingEmp({...editingEmp, taxRegime: e.target.value as any})}><option>Old</option><option>New</option></select></div>
                         </div>
                      )}

                      {onboardingTab === 5 && (
                         <div className="grid grid-cols-4 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Date of Joining</label><input type="date" className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.dateOfJoining} onChange={e => setEditingEmp({...editingEmp, dateOfJoining: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Employee Type</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.employmentType} onChange={e => setEditingEmp({...editingEmp, employmentType: e.target.value as any})}><option>Permanent</option><option>Contract</option><option>Intern</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Department</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.department} onChange={e => setEditingEmp({...editingEmp, department: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Designation</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.designation} onChange={e => setEditingEmp({...editingEmp, designation: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Reporting Manager</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.reportingManager} onChange={e => setEditingEmp({...editingEmp, reportingManager: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Work Location/Branch</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.branchId} onChange={e => setEditingEmp({...editingEmp, branchId: e.target.value})}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Shift Type</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.shiftType} onChange={e => setEditingEmp({...editingEmp, shiftType: e.target.value as any})}><option>General</option><option>Rotational</option><option>Night</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Weekly Off</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.weeklyOff} onChange={e => setEditingEmp({...editingEmp, weeklyOff: e.target.value})}/></div>
                         </div>
                      )}

                      {onboardingTab === 6 && (
                         <div className="space-y-10">
                            <div className="grid grid-cols-4 gap-8 bg-[#1c2d3d] p-8 rounded-[32px] text-white">
                               <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Salary Type</label><select className="w-full h-11 bg-white/10 border-white/20 border rounded-xl px-4 font-black" value={editingEmp.salaryType} onChange={e => setEditingEmp({...editingEmp, salaryType: e.target.value as any})}><option className="bg-slate-900">Monthly</option><option className="bg-slate-900">Daily</option></select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Basic Salary</label><input type="number" className="w-full h-11 bg-white/10 border-white/20 border rounded-xl px-4 font-black" value={editingEmp.basicSalary} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, basicSalary: Number(e.target.value)}))}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">HRA Component</label><input type="number" className="w-full h-11 bg-white/10 border-white/20 border rounded-xl px-4 font-black" value={editingEmp.hra} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, hra: Number(e.target.value)}))}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Special Allowance</label><input type="number" className="w-full h-11 bg-white/10 border-white/20 border rounded-xl px-4 font-black" value={editingEmp.specialAllowance} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, specialAllowance: Number(e.target.value)}))}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Other Allowances</label><input type="number" className="w-full h-11 bg-white/10 border-white/20 border rounded-xl px-4 font-black" value={editingEmp.otherAllowances} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, otherAllowances: Number(e.target.value)}))}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">PF Logic</label><select className="w-full h-11 bg-white/10 border-white/20 border rounded-xl px-4 font-black" value={editingEmp.pfDeductionType} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, pfDeductionType: e.target.value as any})}><option className="bg-slate-900">Auto</option><option className="bg-slate-900">Manual</option></select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">TDS Override</label><input type="number" className="w-full h-11 bg-white/10 border-white/20 border rounded-xl px-4 font-black" value={editingEmp.tds} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, tds: Number(e.target.value)}))}/></div>
                            </div>
                            <div className="flex justify-between bg-white p-8 rounded-[32px] border border-dashed border-gray-300 shadow-inner">
                               <div className="text-center flex-1 border-r border-gray-100"><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Gross Computed</p><p className="text-2xl font-black text-gray-900 mt-1">₹ {(editingEmp.grossSalary || 0).toLocaleString('en-IN')}</p></div>
                               <div className="text-center flex-1"><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Net Disbursable</p><p className="text-2xl font-black text-[#0854a0] mt-1">₹ {(editingEmp.netSalary || 0).toLocaleString('en-IN')}</p></div>
                            </div>
                         </div>
                      )}

                      {onboardingTab === 7 && (
                         <div className="grid grid-cols-4 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Tracking Method</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.attendanceMethod} onChange={e => setEditingEmp({...editingEmp, attendanceMethod: e.target.value as any})}><option>Biometric</option><option>App</option><option>Manual</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Leave Policy</label><input className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.leavePolicy} onChange={e => setEditingEmp({...editingEmp, leavePolicy: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Opening Balance</label><input type="number" className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.openingLeaveBalance} onChange={e => setEditingEmp({...editingEmp, openingLeaveBalance: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Overtime Eligible</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.overtimeEligibility} onChange={e => setEditingEmp({...editingEmp, overtimeEligibility: e.target.value as any})}><option>Yes</option><option>No</option></select></div>
                         </div>
                      )}

                      {onboardingTab === 8 && (
                         <div className="grid grid-cols-4 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Login Creation</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.loginCreation} onChange={e => setEditingEmp({...editingEmp, loginCreation: e.target.value as any})}><option>Yes</option><option>No</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Role/Access</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.role} onChange={e => setEditingEmp({...editingEmp, role: e.target.value as any})}><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.HR}>HR Lead</option><option value={UserRole.ADMIN}>Super Admin</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Employee Status</label><select className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.status} onChange={e => setEditingEmp({...editingEmp, status: e.target.value as any})}><option>Active</option><option>Inactive</option><option>Resigned</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-800 uppercase">Last Working Day</label><input type="date" className="w-full h-12 bg-white border-2 border-gray-100 rounded-2xl px-5 font-bold outline-none" value={editingEmp.lastWorkingDay} onChange={e => setEditingEmp({...editingEmp, lastWorkingDay: e.target.value})}/></div>
                         </div>
                      )}
                   </div>
                </div>

                <div className="p-8 border-t bg-white flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                   <div className="flex space-x-4">
                      <button disabled={onboardingTab === 0} onClick={() => setOnboardingTab(t => t - 1)} className="px-6 py-4 bg-gray-50 border rounded-2xl text-[11px] font-black uppercase text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-all flex items-center"><ChevronLeft size={16} className="mr-2"/> Previous</button>
                      <button disabled={onboardingTab === 8} onClick={() => setOnboardingTab(t => t + 1)} className="px-10 py-4 bg-gray-50 border rounded-2xl text-[11px] font-black uppercase text-[#0854a0] hover:bg-blue-50 transition-all flex items-center">Next Step <ChevronRight size={16} className="ml-2"/></button>
                   </div>
                   <div className="flex space-x-4">
                      <button onClick={() => setShowEmpModal(false)} className="px-8 py-4 text-[11px] font-black uppercase text-gray-400 hover:text-gray-600 transition-all">Discard Entry</button>
                      <button onClick={handleSave} className="px-12 py-4 bg-[#0854a0] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-blue-100 hover:bg-[#064280] transition-all transform active:scale-95 flex items-center"><Save size={18} className="mr-2"/> Commit to Personnel Ledger</button>
                   </div>
                </div>
             </div>
          </div>
      )}

      {viewingPayslip && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-8 no-print overflow-y-auto backdrop-blur-xl">
              <div className="flex flex-col items-center py-10 w-full max-w-[210mm]">
                  <div className="flex space-x-4 mb-6 bg-white/10 p-4 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
                      <button onClick={() => { window.print(); }} className="px-8 py-4 bg-white text-gray-800 rounded-2xl text-[11px] font-black uppercase shadow-2xl transition-all hover:scale-105">Confirm Print Release (A4)</button>
                      <button onClick={() => setViewingPayslip(null)} className="p-4 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-xl"><X/></button>
                  </div>
                  <div className="shadow-[0_40px_120px_-16px_rgba(0,0,0,0.5)]"><PayslipDocument item={viewingPayslip} /></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Payroll;
