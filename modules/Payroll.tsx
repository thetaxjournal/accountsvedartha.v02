import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, CreditCard, FileText, 
  ShieldCheck, Landmark, Plus, Search, 
  Download, Trash2, Edit2, 
  BarChart3, Calculator,
  X, User, Phone, MapPin, Briefcase, 
  ShieldAlert, Save, Banknote,
  ClipboardCheck, Power,
  ChevronLeft, Camera, RefreshCw, Settings as SettingsIcon, ChevronRight
} from 'lucide-react';
import { 
  Employee, AttendanceRecord, 
  PayrollItem, Branch, UserRole, 
  PayrollSettings
} from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, setDoc, doc, writeBatch } from 'firebase/firestore';
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

const Payroll: React.FC<{ branches: Branch[], userRole: UserRole }> = ({ branches = [] }) => {
  const [activeSubMenu, setActiveSubMenu] = useState<'Dashboard' | 'Employees' | 'Attendance' | 'Processing' | 'Payslips' | 'Settings'>('Dashboard');
  const [onboardingTab, setOnboardingTab] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [globalSettings, setGlobalSettings] = useState<PayrollSettings | null>(null);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [procMonth, setProcMonth] = useState(new Date().toISOString().slice(0, 7));
  const [viewingPayslip, setViewingPayslip] = useState<PayrollItem | null>(null);

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

  const runPayrollEngine = async () => {
    if (!confirm(`Run payroll computation for ${procMonth}?`)) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(db);
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
            const net = gross - (d_pf + d_pt + d_esi);
            const itemId = `PR-${procMonth}-${emp.id}`;
            batch.set(doc(db, 'payroll_items', itemId), {
                id: itemId, runId: `RUN-${procMonth}`, employeeId: emp.id, employeeName: emp.fullName, payableDays, standardDays: daysInMonth, lopDays,
                earnings: { basic: e_basic, hra: e_hra, special: e_special, bonus: 0, overtime: 0, others: e_others },
                deductions: { pf: d_pf, esi: d_esi, pt: d_pt, tds: 0, advance: 0, others: 0 },
                grossEarnings: gross, totalDeductions: d_pf + d_pt + d_esi, netSalary: net,
                qrCode: generateSecureQR({ type: 'PAYSLIP', empId: emp.id, month: procMonth, net, company: COMPANY_NAME })
            });
        }
        await batch.commit();
        alert("Payroll Computed successfully.");
    } catch (e: any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const PayslipDocument = ({ item }: { item: PayrollItem }) => {
    const emp = employees.find(e => e.id === item.employeeId);
    return (
      <div className="bg-white w-[210mm] min-h-[297mm] p-10 text-black font-sans flex flex-col border shadow-2xl relative print:shadow-none print:border-none">
        <div className="flex justify-between items-center border-2 border-black p-4 mb-4">
          <img src={LOGO_DARK_BG} alt="Logo" className="h-12 object-contain" />
          <div className="text-right flex-1">
            <h1 className="text-xl font-bold uppercase tracking-tight">{COMPANY_NAME}</h1>
            <p className="text-[10px] font-bold">Personnel Remuneration Voucher</p>
          </div>
        </div>
        <div className="text-center bg-gray-100 py-2 border-x-2 border-black font-bold uppercase text-sm">Payslip for {item.id.split('-').slice(1,3).join('-')}</div>
        <table className="w-full border-2 border-black text-[10px] mb-4">
           <tbody>
              <tr className="border-b border-black">
                 <td className="p-2 font-bold w-1/4">Personnel ID</td><td className="p-2 w-1/4">: {item.employeeId}</td>
                 <td className="p-2 font-bold w-1/4">Full Name</td><td className="p-2 w-1/4">: {item.employeeName}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 font-bold">Designation</td><td className="p-2">: {emp?.designation}</td>
                 <td className="p-2 font-bold">Department</td><td className="p-2">: {emp?.department}</td>
              </tr>
              <tr>
                 <td className="p-2 font-bold">Bank A/C No</td><td className="p-2">: {emp?.bankDetails.accountNumber}</td>
                 <td className="p-2 font-bold">Days Payable</td><td className="p-2">: {item.payableDays} / {item.standardDays}</td>
              </tr>
           </tbody>
        </table>
        <div className="flex border-2 border-black border-collapse text-[10px] flex-1">
           <div className="w-1/2 border-r-2 border-black p-0">
              <div className="bg-gray-50 p-2 font-bold border-b border-black">EARNINGS</div>
              <div className="p-2 space-y-1">
                 <div className="flex justify-between"><span>Basic Salary</span><span>{item.earnings.basic}</span></div>
                 <div className="flex justify-between"><span>HRA</span><span>{item.earnings.hra}</span></div>
                 <div className="flex justify-between"><span>Allowances</span><span>{item.earnings.others + item.earnings.special}</span></div>
              </div>
           </div>
           <div className="w-1/2 p-0">
              <div className="bg-gray-50 p-2 font-bold border-b border-black">DEDUCTIONS</div>
              <div className="p-2 space-y-1">
                 <div className="flex justify-between"><span>Provident Fund</span><span>{item.deductions.pf}</span></div>
                 <div className="flex justify-between"><span>ESI</span><span>{item.deductions.esi}</span></div>
                 <div className="flex justify-between"><span>Prof. Tax</span><span>{item.deductions.pt}</span></div>
              </div>
           </div>
        </div>
        <div className="border-2 border-black border-t-0 p-4 bg-gray-50 flex justify-between items-center">
           <div className="flex items-center space-x-4">
              <QRCode value={item.qrCode} size={60} />
              <div><p className="text-[10px] font-bold">NET SALARY DISBURSED</p><p className="text-xl font-black">₹ {item.netSalary.toLocaleString('en-IN')}</p></div>
           </div>
           <div className="text-right italic text-[10px]">{numberToWords(item.netSalary)}</div>
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
          { id: 'Processing', icon: Calculator },
          { id: 'Payslips', icon: FileText },
          { id: 'Settings', icon: SettingsIcon }
        ].map(item => (
          <button key={item.id} onClick={() => setActiveSubMenu(item.id as any)} className={`flex-1 min-w-[120px] py-5 text-[11px] font-black uppercase flex flex-col items-center space-y-2 transition-all ${activeSubMenu === item.id ? 'text-[#0854a0] border-b-2 border-[#0854a0] bg-blue-50/40' : 'text-gray-400 hover:bg-gray-50'}`}>
            <item.icon size={18} /><span>{item.id}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        {activeSubMenu === 'Dashboard' && (
           <div className="grid grid-cols-4 gap-6">
              <div className="bg-[#0854a0] p-8 rounded-[32px] text-white shadow-xl h-48 flex flex-col justify-between">
                 <h3 className="text-xs font-black uppercase opacity-60">Total Personnel</h3>
                 <p className="text-5xl font-black">{employees.length}</p>
                 <div className="flex items-center text-[10px] font-bold opacity-60"><ShieldCheck className="mr-2" size={14}/> Active Ledger</div>
              </div>
           </div>
        )}

        {activeSubMenu === 'Employees' && (
           <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
                  <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                      <input type="text" className="w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl text-xs font-bold" placeholder="Search Master Database..."/>
                  </div>
                  <button onClick={handleAdd} className="px-8 py-4 bg-[#0854a0] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center transition-all hover:bg-blue-800">
                      <Plus size={16} className="mr-2"/> New Personnel Entry
                  </button>
              </div>
              <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
                  <table className="w-full text-left text-[11px]">
                      <thead className="bg-gray-50 border-b text-gray-400 font-black uppercase">
                          <tr><th className="px-8 py-5">Personnel ID</th><th className="px-8 py-5">Full Name</th><th className="px-8 py-5">Designation</th><th className="px-8 py-5">Net Salary</th><th className="px-8 py-5 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y">
                          {employees.map(emp => (
                              <tr key={emp.id} className="hover:bg-blue-50/20">
                                  <td className="px-8 py-5 font-mono font-black text-[#0854a0]">{emp.id}</td>
                                  <td className="px-8 py-5 font-black uppercase">{emp.fullName}</td>
                                  <td className="px-8 py-5 text-gray-400 font-bold">{emp.designation}</td>
                                  <td className="px-8 py-5 font-black">₹ {(emp.netSalary || 0).toLocaleString()}</td>
                                  <td className="px-8 py-5 text-right"><button onClick={() => { setEditingEmp(emp); setShowEmpModal(true); }} className="p-2 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Edit2 size={14}/></button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
           </div>
        )}

        {activeSubMenu === 'Attendance' && (
           <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
              <input type="month" className="text-sm font-black text-[#0854a0] bg-gray-50 px-4 py-2 rounded-xl" value={procMonth} onChange={e => setProcMonth(e.target.value)}/>
              <div className="overflow-x-auto">
                 <table className="w-full text-[10px] border-collapse min-w-[1000px]">
                    <thead><tr className="bg-gray-50 border-b font-black uppercase text-gray-400"><th className="px-4 py-3 text-left">Personnel</th>{Array.from({length: 31}).map((_,i)=><th key={i} className="px-1 text-center w-8">{i+1}</th>)}</tr></thead>
                    <tbody className="divide-y">
                       {employees.map(emp => (
                          <tr key={emp.id} className="hover:bg-gray-50">
                             <td className="px-4 py-3 font-bold">{emp.fullName}</td>
                             {Array.from({length: 31}).map((_,i)=>(<td key={i} className="p-1 border text-center text-[9px] font-black cursor-pointer hover:bg-blue-50" onClick={async () => {
                                const id = `${emp.id}-${procMonth}`;
                                const rec = attendance.find(a => a.id === id) || { id, employeeId: emp.id, month: procMonth, days: {}, overtimeHours: 0, isLocked: false };
                                rec.days[i+1] = rec.days[i+1] === 'P' ? 'A' : 'P';
                                await setDoc(doc(db, 'attendance', id), rec);
                             }}>{attendance.find(a => a.id === `${emp.id}-${procMonth}`)?.days[i+1] || '-'}</td>))}
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeSubMenu === 'Processing' && (
           <div className="max-w-xl mx-auto bg-white p-12 rounded-[40px] shadow-xl border text-center mt-10">
              <Calculator size={64} className="mx-auto text-[#0854a0] mb-6" />
              <h3 className="text-2xl font-black uppercase">Run organization Payroll</h3>
              <p className="text-xs font-bold text-gray-400 my-6">Computed against attendance logs & statutory policies.</p>
              <input type="month" className="w-full h-14 bg-gray-50 border rounded-2xl px-6 text-xl font-black text-center mb-6" value={procMonth} onChange={e => setProcMonth(e.target.value)}/>
              <button onClick={runPayrollEngine} disabled={isProcessing} className="w-full py-5 bg-[#0854a0] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 disabled:opacity-50 transition-all">
                  {isProcessing ? 'Processing Matrix...' : 'Start engine execution'}
              </button>
           </div>
        )}

        {activeSubMenu === 'Payslips' && (
           <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50 border-b text-gray-400 font-black uppercase">
                      <tr><th className="px-8 py-5">Voucher ID</th><th className="px-8 py-5">Business Partner</th><th className="px-8 py-5">Net Value</th><th className="px-8 py-5 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y">
                      {payrollItems.map(item => (
                          <tr key={item.id} className="hover:bg-blue-50/20">
                              <td className="px-8 py-5 font-mono text-gray-400">{item.id}</td>
                              <td className="px-8 py-5 font-black uppercase">{item.employeeName}</td>
                              <td className="px-8 py-5 font-black text-emerald-600">₹ {item.netSalary.toLocaleString()}</td>
                              <td className="px-8 py-5 text-right"><button onClick={() => setViewingPayslip(item)} className="p-2 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Download size={16}/></button></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </div>
        )}

        {activeSubMenu === 'Settings' && globalSettings && (
           <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white p-10 rounded-[40px] border shadow-sm space-y-8">
                 <h3 className="text-xl font-black uppercase flex items-center"><SettingsIcon className="mr-3"/> Global statutory logic</h3>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">PF Threshold</label><input type="number" className="w-full h-12 bg-gray-50 border rounded-xl px-4 font-black" value={globalSettings.pfThreshold} onChange={e => setGlobalSettings({...globalSettings, pfThreshold: Number(e.target.value)})}/></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">PF Share %</label><input type="number" className="w-full h-12 bg-gray-50 border rounded-xl px-4 font-black" value={globalSettings.pfPercentage} onChange={e => setGlobalSettings({...globalSettings, pfPercentage: Number(e.target.value)})}/></div>
                 </div>
                 <button onClick={async () => { await setDoc(doc(db, 'payroll_settings', 'global'), globalSettings); alert("Settings Updated."); }} className="w-full py-4 bg-[#0854a0] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Commit system policies</button>
              </div>
           </div>
        )}
      </div>

      {showEmpModal && editingEmp && (
          <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
             <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-white/20">
                <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                   <div><h2 className="text-2xl font-black tracking-tight uppercase">SAP Personnel Onboarding</h2><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Master Data ID: {editingEmp.id}</p></div>
                   <button onClick={() => setShowEmpModal(false)} className="p-3 hover:bg-gray-200 rounded-full transition-all text-gray-400"><X size={24}/></button>
                </div>
                <div className="flex bg-white border-b overflow-x-auto no-scrollbar px-6 shadow-sm">
                   {['Personal', 'Contact', 'Address', 'Banking', 'Statutory', 'Employment', 'Salary', 'Attendance', 'System'].map((label, idx) => (
                      <button key={idx} onClick={() => setOnboardingTab(idx)} className={`flex items-center space-x-2 px-6 py-5 text-[11px] font-black uppercase transition-all relative shrink-0 ${onboardingTab === idx ? 'text-[#0854a0]' : 'text-gray-400 hover:text-gray-600'}`}>
                         <span>{label}</span>{onboardingTab === idx && <div className="absolute bottom-0 left-6 right-6 h-1 bg-[#0854a0] rounded-t-full"></div>}
                      </button>
                   ))}
                </div>
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                   {onboardingTab === 0 && (
                      <div className="grid grid-cols-4 gap-8">
                         <div className="col-span-4 mb-6 flex items-center justify-center">
                             <div className="w-32 h-32 rounded-[32px] bg-gray-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                                 {editingEmp.photoUrl ? <img src={editingEmp.photoUrl} className="w-full h-full object-cover" /> : <Camera size={32} className="text-gray-300" />}
                             </div>
                             <input className="ml-6 flex-1 h-12 bg-gray-50 border rounded-2xl px-5 text-xs font-bold" placeholder="Passport Size Photo URL" value={editingEmp.photoUrl} onChange={e => setEditingEmp({...editingEmp, photoUrl: e.target.value})}/>
                         </div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Employee ID</label><input disabled className="w-full h-12 bg-gray-100 border rounded-2xl px-5 font-mono font-bold" value={editingEmp.id}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Full Name</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none focus:border-blue-500" value={editingEmp.fullName} onChange={e => setEditingEmp({...editingEmp, fullName: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Father's Name</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.fatherName} onChange={e => setEditingEmp({...editingEmp, fatherName: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Mother's Name</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.motherName} onChange={e => setEditingEmp({...editingEmp, motherName: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">DOB</label><input type="date" className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.dob} onChange={e => setEditingEmp({...editingEmp, dob: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Gender</label><select className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.gender} onChange={e => setEditingEmp({...editingEmp, gender: e.target.value})}><option>Male</option><option>Female</option></select></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Marital Status</label><select className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.maritalStatus} onChange={e => setEditingEmp({...editingEmp, maritalStatus: e.target.value})}><option>Single</option><option>Married</option></select></div>
                      </div>
                   )}
                   {onboardingTab === 1 && (
                      <div className="grid grid-cols-3 gap-8">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Mobile Number</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.mobile} onChange={e => setEditingEmp({...editingEmp, mobile: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Official Email</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.officialEmail} onChange={e => setEditingEmp({...editingEmp, officialEmail: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Emergency Contact</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.emergencyContactNumber} onChange={e => setEditingEmp({...editingEmp, emergencyContactNumber: e.target.value})}/></div>
                      </div>
                   )}
                   {onboardingTab === 2 && (
                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Current Address</label><textarea className="w-full border-2 rounded-2xl px-5 py-3 font-bold outline-none" value={editingEmp.currentAddress.line1} onChange={e => setEditingEmp({...editingEmp, currentAddress: {...editingEmp.currentAddress, line1: e.target.value}})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Permanent Address</label><textarea className="w-full border-2 rounded-2xl px-5 py-3 font-bold outline-none" value={editingEmp.permanentAddress.line1} onChange={e => setEditingEmp({...editingEmp, permanentAddress: {...editingEmp.permanentAddress, line1: e.target.value}})}/></div>
                      </div>
                   )}
                   {onboardingTab === 3 && (
                      <div className="grid grid-cols-3 gap-8">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Bank Name</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.bankName} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, bankName: e.target.value}})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Account Number</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.accountNumber} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, accountNumber: e.target.value}})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">IFSC Code</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.bankDetails.ifscCode} onChange={e => setEditingEmp({...editingEmp, bankDetails: {...editingEmp.bankDetails, ifscCode: e.target.value}})}/></div>
                      </div>
                   )}
                   {onboardingTab === 4 && (
                      <div className="grid grid-cols-3 gap-8">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Aadhaar Number</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.aadhaar} onChange={e => setEditingEmp({...editingEmp, aadhaar: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">PAN Number</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none uppercase" value={editingEmp.pan} onChange={e => setEditingEmp({...editingEmp, pan: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">UAN Number</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.uan} onChange={e => setEditingEmp({...editingEmp, uan: e.target.value})}/></div>
                      </div>
                   )}
                   {onboardingTab === 5 && (
                      <div className="grid grid-cols-3 gap-8">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Joining Date</label><input type="date" className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.dateOfJoining} onChange={e => setEditingEmp({...editingEmp, dateOfJoining: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Department</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.department} onChange={e => setEditingEmp({...editingEmp, department: e.target.value})}/></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Designation</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.designation} onChange={e => setEditingEmp({...editingEmp, designation: e.target.value})}/></div>
                      </div>
                   )}
                   {onboardingTab === 6 && (
                      <div className="space-y-10">
                         <div className="grid grid-cols-4 gap-8 bg-gray-900 p-8 rounded-[32px] text-white">
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Basic Salary</label><input type="number" className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.basicSalary} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, basicSalary: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">HRA</label><input type="number" className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.hra} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, hra: Number(e.target.value)}))}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black opacity-60 uppercase">Other Allowance</label><input type="number" className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-4 font-black" value={editingEmp.otherAllowances} onChange={e => setEditingEmp(calculateSalaryFields({...editingEmp, otherAllowances: Number(e.target.value)}))}/></div>
                         </div>
                         <div className="flex justify-around bg-gray-50 p-8 rounded-[32px] border">
                            <div className="text-center"><p className="text-[10px] font-black text-gray-400 uppercase">Gross Salary</p><p className="text-2xl font-black">₹ {editingEmp.grossSalary}</p></div>
                            <div className="text-center"><p className="text-[10px] font-black text-[#0854a0] uppercase">Net Takehome</p><p className="text-2xl font-black text-[#0854a0]">₹ {editingEmp.netSalary}</p></div>
                         </div>
                      </div>
                   )}
                   {onboardingTab === 7 && (
                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Attendance Method</label><select className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.attendanceMethod} onChange={e => setEditingEmp({...editingEmp, attendanceMethod: e.target.value as any})}><option>Biometric</option><option>App</option><option>Manual</option></select></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Overtime Eligibility</label><select className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.overtimeEligibility} onChange={e => setEditingEmp({...editingEmp, overtimeEligibility: e.target.value as any})}><option>Yes</option><option>No</option></select></div>
                      </div>
                   )}
                   {onboardingTab === 8 && (
                      <div className="grid grid-cols-3 gap-8">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Role / Access</label><select className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.role} onChange={e => setEditingEmp({...editingEmp, role: e.target.value as any})}><option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.HR}>HR Lead</option><option value={UserRole.ADMIN}>Super Admin</option></select></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Emp Status</label><select className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.status} onChange={e => setEditingEmp({...editingEmp, status: e.target.value as any})}><option>Active</option><option>Inactive</option><option>Resigned</option></select></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase">Portal Passcode</label><input className="w-full h-12 border-2 rounded-2xl px-5 font-bold outline-none" value={editingEmp.portalPassword} onChange={e => setEditingEmp({...editingEmp, portalPassword: e.target.value})}/></div>
                      </div>
                   )}
                </div>
                <div className="p-8 border-t bg-gray-50 flex justify-between items-center">
                   <div className="flex space-x-4">
                      <button disabled={onboardingTab === 0} onClick={() => setOnboardingTab(t => t - 1)} className="px-6 py-4 bg-white border rounded-2xl text-[11px] font-black uppercase text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-all flex items-center"><ChevronLeft size={16} className="mr-2"/> Prev</button>
                      <button disabled={onboardingTab === 8} onClick={() => setOnboardingTab(t => t + 1)} className="px-8 py-4 bg-[#0854a0] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg flex items-center transition-all">Next Step <ChevronRight size={16} className="ml-2"/></button>
                   </div>
                   <button onClick={handleSave} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center hover:bg-emerald-700 transition-all"><Save size={18} className="mr-2"/> Commit Records</button>
                </div>
             </div>
          </div>
      )}

      {viewingPayslip && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-8 no-print overflow-y-auto backdrop-blur-xl">
              <div className="flex flex-col items-center py-10 w-full max-w-[210mm]">
                  <div className="flex space-x-4 mb-6 bg-white/10 p-4 rounded-3xl border border-white/10 backdrop-blur-xl">
                      <button onClick={() => window.print()} className="px-8 py-4 bg-white text-gray-800 rounded-2xl text-[11px] font-black uppercase shadow-2xl transition-all hover:scale-105">Confirm Print Release (A4)</button>
                      <button onClick={() => setViewingPayslip(null)} className="p-4 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-xl"><X/></button>
                  </div>
                  <div className="shadow-2xl"><PayslipDocument item={viewingPayslip} /></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Payroll;