
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
  History, UserMinus, HardHat, Check, Clock, TrendingUp, CreditCard, Building2, Briefcase, UserCheck,
  /* Added missing icons to fix errors on lines 319, 352, 353, 477 */
  UserCircle, Mail, MapPin, CheckCircle2
} from 'lucide-react';
import { 
  Employee, AttendanceRecord, 
  PayrollItem, Branch, UserRole, 
  PayrollSettings, Address
} from '../types';
import { db, storage } from '../firebase';
import { collection, onSnapshot, setDoc, doc, writeBatch } from 'firebase/firestore';
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
      setEditingEmp({ ...editingEmp, [field]: downloadURL });
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload document.");
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

  const updateAddr = (type: 'currentAddress' | 'permanentAddress', field: keyof Address, value: string) => {
    if (!editingEmp) return;
    const newEmp = { ...editingEmp };
    newEmp[type] = { ...newEmp[type], [field]: value };
    
    // Auto-mirror logic
    if (type === 'currentAddress' && newEmp.permSameAsCurrent) {
        newEmp.permanentAddress = { ...newEmp.currentAddress };
    }
    
    setEditingEmp(newEmp);
  };

  const updateBank = (field: string, value: string) => {
      setEditingEmp({ ...editingEmp, bankDetails: { ...editingEmp.bankDetails, [field]: value }});
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
        }
        await batch.commit();
        alert(`${isOvertimeOnly ? 'Overtime' : 'Standard'} Payroll Computed.`);
    } catch (e: any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] font-sans">
      {isPrinting && printingItem && createPortal(
         printingType === 'PAYSLIP' ? (
           <div className="p-8">
              {/* Reuse the Payslip Template from the previous turn */}
              <div className="bg-white border-2 border-black p-8">
                 <h1 className="text-xl font-bold uppercase text-center border-b-2 border-black pb-4 mb-4">Vedartha Systems Payslip</h1>
                 <p className="text-center mb-8">System Generated Document</p>
                 <div className="grid grid-cols-2 gap-8 mb-8 border border-black p-4">
                    <div><p className="font-bold">Personnel: {printingItem.employeeName}</p><p>ID: {printingItem.employeeId}</p></div>
                    <div className="text-right"><p className="font-bold">Period: {printingItem.runId.split('-')[1]}</p><p>Net: ₹ {printingItem.netSalary.toLocaleString()}</p></div>
                 </div>
                 <div className="flex justify-center"><QRCode value={printingItem.qrCode} size={150} /></div>
              </div>
           </div>
         ) : null,
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
                          <tr><th className="px-8 py-5">Personnel ID</th><th className="px-8 py-5">Legal Name</th><th className="px-8 py-5">Department</th><th className="px-8 py-5">Designation</th><th className="px-8 py-5 text-right">System Action</th></tr>
                      </thead>
                      <tbody className="divide-y">
                          {employees.map(emp => (
                              <tr key={emp.id} className="hover:bg-gray-50">
                                  <td className="px-8 py-5 font-mono font-black text-black">{emp.id}</td>
                                  <td className="px-8 py-5">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border">
                                        {emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover" /> : <UserCircle size={18} className="m-1.5 text-gray-300" />}
                                      </div>
                                      <span className="font-black uppercase">{emp.fullName}</span>
                                    </div>
                                  </td>
                                  <td className="px-8 py-5 font-bold text-gray-500">{emp.department}</td>
                                  <td className="px-8 py-5 font-bold text-gray-500">{emp.designation}</td>
                                  <td className="px-8 py-5 text-right">
                                    <div className="flex justify-end space-x-2">
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

        {/* Dashboards and other tabs remain unchanged or similar to previous turn logic */}
      </div>

      {showEmpModal && editingEmp && (
          <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
             <div className="bg-white w-full max-w-7xl rounded-[48px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-black/10">
                <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-[#fcfcfc]">
                   <div><h2 className="text-3xl font-black uppercase tracking-tighter">Personnel Master Data</h2><p className="text-[11px] font-bold text-blue-500 uppercase tracking-[0.3em] mt-1">Unified Enterprise Resource Record: {editingEmp.id}</p></div>
                   <button onClick={() => setShowEmpModal(false)} className="p-4 hover:bg-gray-100 rounded-full border border-gray-100 text-gray-400"><X size={28}/></button>
                </div>
                <div className="flex bg-gray-50 border-b border-gray-200 overflow-x-auto no-scrollbar px-10">
                   {[
                    { label: 'Personal', icon: Users },
                    { label: 'Contact', icon: Mail },
                    { label: 'Address', icon: MapPin },
                    { label: 'Banking', icon: CreditCard },
                    { label: 'Statutory', icon: ShieldCheck },
                    { label: 'Employment', icon: Briefcase },
                    { label: 'Salary', icon: Banknote },
                    { label: 'Attendance', icon: Calendar },
                    { label: 'Access', icon: UserCheck }
                   ].map((item, idx) => (
                      <button key={idx} onClick={() => setOnboardingTab(idx)} className={`flex items-center space-x-3 px-8 py-6 text-[11px] font-black uppercase transition-all relative shrink-0 ${onboardingTab === idx ? 'text-[#0854a0]' : 'text-gray-400'}`}>
                         <item.icon size={14} /><span>{item.label}</span>
                         {onboardingTab === idx && <div className="absolute bottom-0 left-8 right-8 h-1 bg-[#0854a0] rounded-t-full shadow-[0_-4px_12px_rgba(8,84,160,0.3)]"></div>}
                      </button>
                   ))}
                </div>
                
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white">
                   {onboardingTab === 0 && (
                      <div className="grid grid-cols-4 gap-x-10 gap-y-8 animate-in fade-in duration-300">
                         <div className="col-span-1 flex flex-col items-center">
                             <div className="w-48 h-48 rounded-[40px] border-4 border-gray-50 overflow-hidden flex items-center justify-center relative bg-gray-50 shadow-inner group cursor-pointer hover:border-blue-100 transition-all">
                                 {isUploading && <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10"><Loader2 className="animate-spin text-blue-600" /></div>}
                                 {editingEmp.photoUrl ? <img src={editingEmp.photoUrl} className="w-full h-full object-cover" /> : <Camera size={48} className="text-gray-200" />}
                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                    <Upload className="text-white" size={24} />
                                 </div>
                                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'photoUrl')} />
                             </div>
                             <button onClick={() => fileInputRef.current?.click()} className="mt-4 text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">Upload Photograph</button>
                         </div>
                         <div className="col-span-3 grid grid-cols-2 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Employee ID</label><input disabled className="w-full h-14 bg-gray-100 border border-gray-200 rounded-2xl px-6 font-mono font-bold text-gray-400 text-lg" value={editingEmp.id || ''}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Full Name</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none uppercase" value={editingEmp.fullName || ''} onChange={e => setEditingEmp({...editingEmp, fullName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Father's Name</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none uppercase" value={editingEmp.fatherName || ''} onChange={e => setEditingEmp({...editingEmp, fatherName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Mother's Name</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none uppercase" value={editingEmp.motherName || ''} onChange={e => setEditingEmp({...editingEmp, motherName: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-6">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Date of Birth</label><input type="date" className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.dob || ''} onChange={e => setEditingEmp({...editingEmp, dob: e.target.value})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Gender</label><select className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.gender} onChange={e => setEditingEmp({...editingEmp, gender: e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Marital Status</label><select className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.maritalStatus} onChange={e => setEditingEmp({...editingEmp, maritalStatus: e.target.value})}><option>Single</option><option>Married</option><option>Divorced</option></select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Blood Group</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.bloodGroup || ''} onChange={e => setEditingEmp({...editingEmp, bloodGroup: e.target.value})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Nationality</label><input className="w-full h-14 border-2 border-gray-100 focus:border-[#0854a0] rounded-2xl px-6 font-bold outline-none" value={editingEmp.nationality || 'Indian'} onChange={e => setEditingEmp({...editingEmp, nationality: e.target.value})}/></div>
                            </div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 1 && (
                      <div className="grid grid-cols-2 gap-12 animate-in fade-in">
                         <div className="space-y-8">
                            <h3 className="text-[12px] font-black uppercase text-[#0854a0] border-b pb-4">Primary Contact</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Mobile Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.mobile || ''} onChange={e => setEditingEmp({...editingEmp, mobile: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Official Email</label><input type="email" className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.officialEmail || ''} onChange={e => setEditingEmp({...editingEmp, officialEmail: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Personal Email</label><input type="email" className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.personalEmail || ''} onChange={e => setEditingEmp({...editingEmp, personalEmail: e.target.value})}/></div>
                         </div>
                         <div className="space-y-8">
                            <h3 className="text-[12px] font-black uppercase text-rose-600 border-b pb-4">Emergency Support</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Emergency Name</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.emergencyContactName || ''} onChange={e => setEditingEmp({...editingEmp, emergencyContactName: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Relation</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.emergencyContactRelation || ''} onChange={e => setEditingEmp({...editingEmp, emergencyContactRelation: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Contact Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.emergencyContactNumber || ''} onChange={e => setEditingEmp({...editingEmp, emergencyContactNumber: e.target.value})}/></div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 2 && (
                      <div className="grid grid-cols-2 gap-12 animate-in fade-in">
                         <div className="space-y-6">
                            <h3 className="text-[12px] font-black uppercase text-[#0854a0] border-b pb-4">Current Mailing Site</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Street Address</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.currentAddress.line1} onChange={e => updateAddr('currentAddress', 'line1', e.target.value)}/></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">City</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.currentAddress.city} onChange={e => updateAddr('currentAddress', 'city', e.target.value)}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">State</label>
                                  <select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.currentAddress.state} onChange={e => updateAddr('currentAddress', 'state', e.target.value)}>
                                     {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                                  </select>
                               </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Pincode</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.currentAddress.pincode} onChange={e => updateAddr('currentAddress', 'pincode', e.target.value)}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Country</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.currentAddress.country} onChange={e => updateAddr('currentAddress', 'country', e.target.value)}/></div>
                            </div>
                         </div>
                         <div className="space-y-6">
                            <div className="flex justify-between items-center border-b pb-4">
                               <h3 className="text-[12px] font-black uppercase text-gray-400">Permanent Domicile</h3>
                               <label className="flex items-center space-x-2 cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4 accent-[#0854a0]" checked={editingEmp.permSameAsCurrent} onChange={e => setEditingEmp({...editingEmp, permSameAsCurrent: e.target.checked, permanentAddress: e.target.checked ? {...editingEmp.currentAddress} : editingEmp.permanentAddress})}/>
                                  <span className="text-[10px] font-black uppercase text-[#0854a0]">Same as Current</span>
                               </label>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Street Address</label><input disabled={editingEmp.permSameAsCurrent} className={`w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold ${editingEmp.permSameAsCurrent ? 'bg-gray-50' : ''}`} value={editingEmp.permanentAddress.line1} onChange={e => updateAddr('permanentAddress', 'line1', e.target.value)}/></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">City</label><input disabled={editingEmp.permSameAsCurrent} className={`w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold ${editingEmp.permSameAsCurrent ? 'bg-gray-50' : ''}`} value={editingEmp.permanentAddress.city} onChange={e => updateAddr('permanentAddress', 'city', e.target.value)}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">State</label>
                                  <select disabled={editingEmp.permSameAsCurrent} className={`w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold ${editingEmp.permSameAsCurrent ? 'bg-gray-50' : ''}`} value={editingEmp.permanentAddress.state} onChange={e => updateAddr('permanentAddress', 'state', e.target.value)}>
                                     {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                                  </select>
                               </div>
                            </div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 3 && (
                      <div className="grid grid-cols-2 gap-12 animate-in fade-in">
                         <div className="space-y-6">
                            <h3 className="text-[12px] font-black uppercase text-emerald-600 border-b pb-4">Bank Coordinates</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Account Holder Name</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.bankDetails.accountHolderName} onChange={e => updateBank('accountHolderName', e.target.value)}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Bank Name</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.bankDetails.bankName} onChange={e => updateBank('bankName', e.target.value)}/></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Branch Name</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.bankDetails.branchName} onChange={e => updateBank('branchName', e.target.value)}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">IFSC Code</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold font-mono" value={editingEmp.bankDetails.ifscCode} onChange={e => updateBank('ifscCode', e.target.value)}/></div>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Account Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold font-mono" value={editingEmp.bankDetails.accountNumber} onChange={e => updateBank('accountNumber', e.target.value)}/></div>
                         </div>
                         <div className="space-y-6">
                            <h3 className="text-[12px] font-black uppercase text-gray-400 border-b pb-4">Transfer Configuration</h3>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Account Type</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.bankDetails.accountType} onChange={e => updateBank('accountType', e.target.value)}><option>Salary</option><option>Savings</option><option>Current</option></select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Payment Mode</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.bankDetails.paymentMode} onChange={e => updateBank('paymentMode', e.target.value)}><option>Bank Transfer</option><option>Cheque</option><option>Cash</option></select></div>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">UPI ID (Optional)</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.bankDetails.upiId} onChange={e => updateBank('upiId', e.target.value)}/></div>
                            <div className="mt-4 p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center space-y-2 cursor-pointer hover:border-[#0854a0] transition-all" onClick={() => chequeInputRef.current?.click()}>
                                <input type="file" ref={chequeInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'cancelledChequeUrl')} />
                                {editingEmp.bankDetails.cancelledChequeUrl ? <div className="flex items-center text-emerald-600 font-bold text-xs"><CheckCircle2 size={16} className="mr-2"/> Document Uploaded</div> : <div className="flex flex-col items-center"><Upload className="text-gray-300 mb-2" size={24}/> <span className="text-[10px] font-black uppercase text-gray-400">Upload Cancelled Cheque</span></div>}
                            </div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 4 && (
                      <div className="grid grid-cols-2 gap-12 animate-in fade-in">
                         <div className="space-y-6">
                            <h3 className="text-[12px] font-black uppercase text-[#0854a0] border-b pb-4">Government ID Records</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Aadhaar Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold font-mono" value={editingEmp.aadhaar || ''} onChange={e => setEditingEmp({...editingEmp, aadhaar: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">PAN Card Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold font-mono uppercase" value={editingEmp.pan || ''} onChange={e => setEditingEmp({...editingEmp, pan: e.target.value})}/></div>
                         </div>
                         <div className="space-y-6">
                            <h3 className="text-[12px] font-black uppercase text-purple-600 border-b pb-4">Statutory Enrollment</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">PF UAN Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold font-mono" value={editingEmp.uan || ''} onChange={e => setEditingEmp({...editingEmp, uan: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">PF Account Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold font-mono" value={editingEmp.pfAccountNumber || ''} onChange={e => setEditingEmp({...editingEmp, pfAccountNumber: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">ESI Number</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold font-mono" value={editingEmp.esiNo || ''} onChange={e => setEditingEmp({...editingEmp, esiNo: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">PT State</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.ptState} onChange={e => setEditingEmp({...editingEmp, ptState: e.target.value})}>{INDIAN_STATES.map(s => <option key={s}>{s}</option>)}</select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Tax Regime</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.taxRegime} onChange={e => setEditingEmp({...editingEmp, taxRegime: e.target.value})}><option>Old</option><option>New</option></select></div>
                            </div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 5 && (
                      <div className="grid grid-cols-2 gap-12 animate-in fade-in">
                         <div className="space-y-6">
                            <h3 className="text-[12px] font-black uppercase text-[#0854a0] border-b pb-4">Corporate Alignment</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Date of Joining</label><input type="date" className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.dateOfJoining || ''} onChange={e => setEditingEmp({...editingEmp, dateOfJoining: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Employment Type</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.employmentType} onChange={e => setEditingEmp({...editingEmp, employmentType: e.target.value})}><option>Permanent</option><option>Contract</option><option>Intern</option></select></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Department</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.department || ''} onChange={e => setEditingEmp({...editingEmp, department: e.target.value})}/></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Designation</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.designation || ''} onChange={e => setEditingEmp({...editingEmp, designation: e.target.value})}/></div>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Reporting Manager</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.reportingManager || ''} onChange={e => setEditingEmp({...editingEmp, reportingManager: e.target.value})}/></div>
                         </div>
                         <div className="space-y-6">
                            <h3 className="text-[12px] font-black uppercase text-amber-600 border-b pb-4">Logistics & Shifts</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Work Location (Branch)</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.branchId} onChange={e => setEditingEmp({...editingEmp, branchId: e.target.value})}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Shift Type</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.shiftType} onChange={e => setEditingEmp({...editingEmp, shiftType: e.target.value})}><option>General</option><option>Rotational</option><option>Night</option></select></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Weekly Off</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.weeklyOff} onChange={e => setEditingEmp({...editingEmp, weeklyOff: e.target.value})}><option>Sunday</option><option>Monday</option><option>Saturday & Sunday</option></select></div>
                            </div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 6 && (
                      <div className="space-y-10 animate-in fade-in">
                         <div className="grid grid-cols-4 gap-8 bg-black p-10 rounded-[40px] text-white">
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Salary Type</label><select className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.salaryType} onChange={e => setEditingEmp({...editingEmp, salaryType: e.target.value})}><option>Monthly</option><option>Daily</option><option>Hourly</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Basic Component</label><input type="number" className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.basicSalary} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, basicSalary: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">House Rent (HRA)</label><input type="number" className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.basicSalary} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, basicSalary: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Special Allowance</label><input type="number" className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.specialAllowance} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, specialAllowance: Number(e.target.value)}))}/></div>
                         </div>
                         <div className="grid grid-cols-3 gap-8">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-500">Other Allowances</label><input type="number" className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.otherAllowances} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, otherAllowances: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-500">TDS (Tax At Source)</label><input type="number" className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.tds} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, tds: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-500">PF Calculation</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.pfDeductionType} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, pfDeductionType: e.target.value}))}><option>Auto</option><option>Manual</option></select></div>
                         </div>
                         <div className="flex justify-around bg-gray-50 p-10 rounded-[40px] border border-gray-100 shadow-inner">
                            <div className="text-center"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gross Computed</p><p className="text-3xl font-black text-gray-800">₹ {(editingEmp.grossSalary || 0).toLocaleString()}</p></div>
                            <div className="text-center"><p className="text-[10px] font-black text-[#0854a0] uppercase tracking-[0.2em] mb-1">Net Monthly Takehome</p><p className="text-3xl font-black text-[#0854a0]">₹ {(editingEmp.netSalary || 0).toLocaleString()}</p></div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 7 && (
                      <div className="grid grid-cols-2 gap-12 animate-in fade-in">
                         <div className="space-y-8">
                            <h3 className="text-[12px] font-black uppercase text-[#0854a0] border-b pb-4">Compliance Mapping</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Tracking Method</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.attendanceMethod} onChange={e => setEditingEmp({...editingEmp, attendanceMethod: e.target.value})}><option>Manual</option><option>Biometric</option><option>App</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Leave Policy</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.leavePolicy} onChange={e => setEditingEmp({...editingEmp, leavePolicy: e.target.value})}><option>Standard</option><option>Contractual</option><option>Probation</option></select></div>
                         </div>
                         <div className="space-y-8">
                            <h3 className="text-[12px] font-black uppercase text-emerald-600 border-b pb-4">Entitlements</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Opening Leave Balance</label><input type="number" className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.openingLeaveBalance} onChange={e => setEditingEmp({...editingEmp, openingLeaveBalance: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Overtime Eligibility</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.overtimeEligibility} onChange={e => setEditingEmp({...editingEmp, overtimeEligibility: e.target.value})}><option>Yes</option><option>No</option></select></div>
                         </div>
                      </div>
                   )}

                   {onboardingTab === 8 && (
                      <div className="grid grid-cols-2 gap-12 animate-in fade-in">
                         <div className="space-y-8">
                            <h3 className="text-[12px] font-black uppercase text-[#0854a0] border-b pb-4">Lifecycle Status</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Employee Status</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.status} onChange={e => setEditingEmp({...editingEmp, status: e.target.value})}><option>Active</option><option>Inactive</option><option>Resigned</option><option>Terminated</option></select></div>
                            {['Resigned', 'Terminated'].includes(editingEmp.status) && <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Last Working Day</label><input type="date" className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.lastWorkingDay || ''} onChange={e => setEditingEmp({...editingEmp, lastWorkingDay: e.target.value})}/></div>}
                         </div>
                         <div className="space-y-8">
                            <h3 className="text-[12px] font-black uppercase text-purple-600 border-b pb-4">System Credentials</h3>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Create Login Access</label><select className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.loginCreation} onChange={e => setEditingEmp({...editingEmp, loginCreation: e.target.value})}><option>Yes</option><option>No</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-600">Portal Security Passcode</label><input className="w-full h-14 border-2 border-gray-100 rounded-2xl px-6 font-bold" value={editingEmp.portalPassword} onChange={e => setEditingEmp({...editingEmp, portalPassword: e.target.value})}/></div>
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
