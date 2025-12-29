
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, LogOut, Download, Clock, ShieldCheck, 
  LayoutDashboard, Calendar, UserCircle, HardHat, Award,
  ShieldAlert, Landmark, Wallet, Camera, Key, Printer,
  MapPin, Phone, Mail, Building2, User, CreditCard, Briefcase, FileSearch
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { PayrollItem, Employee, Branch } from '../types';
import { LOGO_DARK_BG, COMPANY_NAME } from '../constants';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

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

interface EmployeePortalProps {
  user: any;
  branches: Branch[];
  payrollItems: PayrollItem[];
  onLogout: () => void;
}

const EmployeePortal: React.FC<EmployeePortalProps> = ({ user, branches, payrollItems, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'payslips' | 'security'>('dashboard');
  const [viewingItem, setViewingItem] = useState<PayrollItem | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [myEmpData, setMyEmpData] = useState<Employee | null>(null);
  const [printingType, setPrintingType] = useState<'PAYSLIP' | 'OT'>('PAYSLIP');

  useEffect(() => {
    const fetchMe = async () => {
        const d = await getDoc(doc(db, 'employees', user.uid));
        if (d.exists()) setMyEmpData(d.data() as Employee);
    };
    fetchMe();
  }, [user]);

  const myPayslips = useMemo(() => {
    return payrollItems.filter(p => p.employeeId === user.uid);
  }, [payrollItems, user]);

  const ytdEarnings = useMemo(() => {
    return myPayslips.reduce((acc, p) => acc + (p.netSalary || 0), 0);
  }, [myPayslips]);

  const handleDirectPrint = (item: PayrollItem, type: 'PAYSLIP' | 'OT') => {
    const originalTitle = document.title;
    const monthStr = new Date(item.runId.split('-')[1] + "-01").toLocaleString('default', { month: 'long' });
    document.title = `${type === 'PAYSLIP' ? 'Payslip' : 'OT_Slip'}_${item.employeeId}_${monthStr}`;

    setViewingItem(item);
    setPrintingType(type);
    setIsPrinting(true);

    setTimeout(() => {
        window.print();
        setIsPrinting(false);
        setViewingItem(null);
        document.title = originalTitle;
    }, 400);
  };

  /** SAP/PWC Mirror Layout for Printing */
  const BW_PayslipDocument = ({ item }: { item: PayrollItem }) => {
    const branch = branches.find(b => b.id === myEmpData?.branchId) || branches[0];
    const monthYear = new Date(item.runId.split('-')[1] + "-01");
    const monthStr = monthYear.toLocaleString('default', { month: 'long' }).toUpperCase();

    return (
      <div className="bg-white w-[210mm] min-h-[297mm] p-12 text-black font-sans flex flex-col border border-black relative print:border-none print:p-8">
        <div className="flex justify-between items-start border-b border-black pb-4 mb-4">
          <img src={LOGO_DARK_BG} alt="Logo" className="h-16 grayscale brightness-0 object-contain" />
          <div className="text-right flex-1 ml-10">
            <h1 className="text-xl font-bold uppercase tracking-tight leading-tight">{COMPANY_NAME.toUpperCase()}</h1>
            <p className="text-sm font-bold uppercase tracking-widest">Service Delivery Center</p>
            <p className="text-[10px] font-medium uppercase opacity-60">(Private Limited)</p>
          </div>
        </div>
        <div className="text-center mb-6">
           <h2 className="text-md font-bold text-black border-b border-black inline-block px-4 pb-0.5">
             Payslip for the month of {monthStr} {monthYear.getFullYear()}
           </h2>
        </div>
        <div className="grid grid-cols-2 gap-x-0 border border-black mb-6">
           <div className="border-r border-black">
              {[
                { l: 'Employee ID', v: item.employeeId },
                { l: 'Date of Birth', v: myEmpData?.dob },
                { l: 'Designation', v: myEmpData?.designation?.toUpperCase() },
                { l: 'UAN Number', v: myEmpData?.uan },
                { l: 'PF Number', v: myEmpData?.pfAccountNumber }
              ].map((row, i) => (
                <div key={i} className={`flex px-3 py-1 text-[10px] ${i < 4 ? 'border-b border-black' : ''}`}>
                   <span className="w-[120px] font-bold">{row.l}</span><span>: {row.v}</span>
                </div>
              ))}
           </div>
           <div>
              {[
                { l: 'Employee Name', v: item.employeeName?.toUpperCase() },
                { l: 'Joining Date', v: myEmpData?.dateOfJoining },
                { l: 'Location', v: branch.address.city?.toUpperCase() },
                { l: 'PAN Number', v: myEmpData?.pan?.toUpperCase() },
                { l: 'LOS', v: item.lopDays }
              ].map((row, i) => (
                <div key={i} className={`flex px-3 py-1 text-[10px] ${i < 4 ? 'border-b border-black' : ''}`}>
                   <span className="w-[120px] font-bold">{row.l}</span><span>: {row.v}</span>
                </div>
              ))}
           </div>
        </div>
        <div className="flex border border-black flex-1 max-h-[340px]">
           <div className="w-1/2 border-r border-black flex flex-col">
              <div className="bg-gray-100 p-2 font-bold border-b border-black text-[11px] flex justify-between uppercase"><span>EARNINGS</span><span>Amount (Rs.)</span></div>
              <div className="flex-1 p-3 space-y-1 text-[10px]">
                 <div className="flex justify-between"><span>Basic Salary</span><span>{item.earnings.basic.toLocaleString()}</span></div>
                 <div className="flex justify-between"><span>House Rent Allowance</span><span>{item.earnings.hra.toLocaleString()}</span></div>
                 <div className="flex justify-between"><span>Special Pay</span><span>{item.earnings.special.toLocaleString()}</span></div>
              </div>
              <div className="bg-gray-100 p-2 font-bold border-t border-black text-[11px] flex justify-between uppercase"><span>Total Earnings Rs.</span><span>{item.grossEarnings.toLocaleString()}</span></div>
           </div>
           <div className="w-1/2 flex flex-col">
              <div className="bg-gray-100 p-2 font-bold border-b border-black text-[11px] flex justify-between uppercase"><span>DEDUCTIONS</span><span>Amount (Rs.)</span></div>
              <div className="flex-1 p-3 space-y-1 text-[10px]">
                 <div className="flex justify-between"><span>Provident Fund</span><span>{item.deductions.pf.toLocaleString()}</span></div>
                 <div className="flex justify-between"><span>Professional Tax</span><span>{item.deductions.pt.toLocaleString()}</span></div>
                 {item.deductions.esi > 0 && <div className="flex justify-between"><span>ESI Deduction</span><span>{item.deductions.esi.toLocaleString()}</span></div>}
              </div>
              <div className="bg-gray-100 p-2 font-bold border-t border-black text-[11px] flex justify-between uppercase"><span>Total Deductions Rs.</span><span>{item.totalDeductions.toLocaleString()}</span></div>
           </div>
        </div>
        <div className="border-x border-b border-black p-4 flex items-center justify-between">
           <div className="flex items-center space-x-6">
              <QRCode value={item.qrCode} size={70} />
              <div><p className="text-[12px] font-black uppercase">Net Salary Rs. {item.netSalary.toLocaleString()}</p><p className="text-[9px] font-bold italic mt-1">{numberToWords(item.netSalary)}</p></div>
           </div>
        </div>
        <div className="mt-8 border border-black p-4 text-[9px] font-bold bg-gray-50 uppercase">
           Note: System generated. No physical signature required.
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans">
      {isPrinting && viewingItem && createPortal(<BW_PayslipDocument item={viewingItem} />, document.getElementById('print-portal')!)}
      
      <header className="bg-black text-white py-4 px-8 shadow-2xl sticky top-0 z-50">
         <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-6">
               <img src={LOGO_DARK_BG} alt="Logo" className="h-10 object-contain brightness-0 invert" />
               <div className="hidden md:block">
                   <h1 className="text-sm font-black uppercase tracking-widest">Self-Service Terminal</h1>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{myEmpData?.fullName || user.displayName}</p>
               </div>
            </div>
            <button onClick={onLogout} className="flex items-center px-4 py-2 bg-white/10 hover:bg-rose-600 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
               <LogOut size={14} className="mr-2"/> End Session
            </button>
         </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
         <div className="bg-white rounded-[40px] shadow-2xl border border-black/5 overflow-hidden min-h-[600px] flex flex-col">
            <div className="flex border-b border-black/5 bg-gray-50/50 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-6 min-w-[150px] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'text-black border-b-2 border-black bg-white' : 'text-gray-400 hover:text-gray-600'}`}>My Dashboard</button>
                <button onClick={() => setActiveTab('profile')} className={`flex-1 py-6 min-w-[150px] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'text-black border-b-2 border-black bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Full Master Profile</button>
                <button onClick={() => setActiveTab('payslips')} className={`flex-1 py-6 min-w-[150px] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'payslips' ? 'text-black border-b-2 border-black bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Salary & OT Vouchers</button>
                <button onClick={() => setActiveTab('security')} className={`flex-1 py-6 min-w-[150px] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'security' ? 'text-black border-b-2 border-black bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Guard & Privacy</button>
            </div>

            <div className="p-10 flex-1">
               {activeTab === 'dashboard' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                     <div className="flex items-center space-x-10 bg-gray-50/50 p-8 rounded-[40px] border border-black/5">
                        <div className="w-32 h-32 rounded-3xl bg-white border-4 border-white shadow-xl overflow-hidden flex items-center justify-center shrink-0 border-black/10">
                           {myEmpData?.photoUrl ? <img src={myEmpData.photoUrl} className="w-full h-full object-cover" /> : <UserCircle size={64} className="text-gray-200" />}
                        </div>
                        <div className="flex-1">
                           <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{myEmpData?.fullName}</h2>
                           <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">{myEmpData?.designation} | {myEmpData?.id}</p>
                           <div className="mt-4 flex items-center space-x-4">
                              <span className="px-4 py-1.5 bg-black text-white text-[10px] font-black uppercase rounded-full">Status: {myEmpData?.status}</span>
                              <span className="px-4 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-black uppercase rounded-full">Unit: {branches.find(b => b.id === myEmpData?.branchId)?.address.city}</span>
                           </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-black p-8 rounded-[40px] text-white shadow-2xl flex flex-col justify-between h-56 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                           <div className="relative z-10"><LayoutDashboard size={32} className="mb-4 text-gray-400"/><h3 className="text-xs font-black uppercase opacity-60">YTD Net Takehome</h3><p className="text-4xl font-black mt-2">₹ {(ytdEarnings || 0).toLocaleString('en-IN')}</p></div>
                           <p className="text-[10px] font-bold opacity-60 uppercase">Verified Ledger Count</p>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm h-56 flex flex-col justify-between group hover:shadow-xl transition-all">
                           <div><Calendar size={32} className="mb-4 text-black"/><h3 className="text-xs font-black uppercase text-gray-400">Leave Balance</h3><p className="text-4xl font-black text-gray-900 mt-2">{myEmpData?.openingLeaveBalance || 0} D</p></div>
                           <p className="text-[10px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full w-fit uppercase tracking-tighter">Accrued Entitlement</p>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm h-56 flex flex-col justify-between group hover:shadow-xl transition-all">
                           <div><Landmark size={32} className="mb-4 text-black"/><h3 className="text-xs font-black uppercase text-gray-400">Advance Status</h3><p className="text-2xl font-black text-rose-600 mt-2">₹ {(myEmpData?.outstandingAdvance || 0).toLocaleString()}</p></div>
                           <p className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full w-fit uppercase tracking-tighter">Outstanding Loan</p>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'profile' && myEmpData && (
                  <div className="space-y-12 animate-in fade-in">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* 1. Personal Information */}
                        <div className="space-y-6">
                           <div className="flex items-center space-x-3 text-[#0854a0] border-b border-blue-50 pb-4">
                              <User size={20}/><h3 className="text-[12px] font-black uppercase tracking-widest">Personal Identification</h3>
                           </div>
                           <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Full Name</p><p className="text-sm font-bold uppercase">{myEmpData.fullName}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Date of Birth</p><p className="text-sm font-bold">{myEmpData.dob}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Father's Name</p><p className="text-sm font-bold uppercase">{myEmpData.fatherName}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Mother's Name</p><p className="text-sm font-bold uppercase">{myEmpData.motherName}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Gender / Status</p><p className="text-sm font-bold uppercase">{myEmpData.gender} / {myEmpData.maritalStatus}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Nationality / Blood</p><p className="text-sm font-bold uppercase">{myEmpData.nationality} / {myEmpData.bloodGroup}</p></div>
                           </div>
                        </div>

                        {/* 2. Contact & Address */}
                        <div className="space-y-6">
                           <div className="flex items-center space-x-3 text-emerald-600 border-b border-emerald-50 pb-4">
                              <Phone size={20}/><h3 className="text-[12px] font-black uppercase tracking-widest">Connectivity & Domicile</h3>
                           </div>
                           <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Mobile</p><p className="text-sm font-bold">{myEmpData.mobile}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Official Email</p><p className="text-sm font-bold lowercase">{myEmpData.officialEmail}</p></div>
                              <div className="col-span-2"><p className="text-[9px] font-black uppercase text-gray-400">Permanent Site</p><p className="text-sm font-bold uppercase">{myEmpData.permanentAddress.line1}, {myEmpData.permanentAddress.city}, {myEmpData.permanentAddress.state} - {myEmpData.permanentAddress.pincode}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Emergency Lead</p><p className="text-sm font-bold uppercase">{myEmpData.emergencyContactName}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Emergency Cell</p><p className="text-sm font-bold">{myEmpData.emergencyContactNumber}</p></div>
                           </div>
                        </div>

                        {/* 3. Professional & Banking */}
                        <div className="space-y-6">
                           <div className="flex items-center space-x-3 text-amber-600 border-b border-amber-50 pb-4">
                              <Briefcase size={20}/><h3 className="text-[12px] font-black uppercase tracking-widest">Professional & Financial Unit</h3>
                           </div>
                           <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Joining Date</p><p className="text-sm font-bold">{myEmpData.dateOfJoining}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Personnel Type</p><p className="text-sm font-bold uppercase">{myEmpData.employmentType}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Work Location</p><p className="text-sm font-bold uppercase">{branches.find(b=>b.id===myEmpData.branchId)?.name}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Department / Desig</p><p className="text-sm font-bold uppercase">{myEmpData.department} / {myEmpData.designation}</p></div>
                              <div className="col-span-2 p-6 bg-gray-50 rounded-3xl border border-gray-100 grid grid-cols-2 gap-6">
                                 <div><p className="text-[8px] font-black uppercase text-gray-400">Salary Mode / Bank</p><p className="text-xs font-bold uppercase">{myEmpData.bankDetails.paymentMode} - {myEmpData.bankDetails.bankName}</p></div>
                                 <div><p className="text-[8px] font-black uppercase text-gray-400">A/C / IFSC</p><p className="text-xs font-bold font-mono">{myEmpData.bankDetails.accountNumber} / {myEmpData.bankDetails.ifscCode}</p></div>
                              </div>
                           </div>
                        </div>

                        {/* 4. Statutory Records */}
                        <div className="space-y-6">
                           <div className="flex items-center space-x-3 text-purple-600 border-b border-purple-50 pb-4">
                              <ShieldCheck size={20}/><h3 className="text-[12px] font-black uppercase tracking-widest">Compliance & Statutory Ledger</h3>
                           </div>
                           <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Aadhaar Number</p><p className="text-sm font-bold font-mono">{myEmpData.aadhaar}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">PAN Record</p><p className="text-sm font-bold font-mono uppercase">{myEmpData.pan}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">UAN (Universal Account)</p><p className="text-sm font-bold font-mono">{myEmpData.uan}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">ESI Identity</p><p className="text-sm font-bold font-mono">{myEmpData.esiNo}</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">Fiscal Regime</p><p className="text-sm font-bold uppercase">{myEmpData.taxRegime} Tax System</p></div>
                              <div><p className="text-[9px] font-black uppercase text-gray-400">PT State</p><p className="text-sm font-bold uppercase">{myEmpData.ptState}</p></div>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'payslips' && (
                  <div className="grid gap-6 animate-in fade-in">
                     <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Payroll & OT Vouchers</h3>
                     {myPayslips.length === 0 ? (
                        <div className="text-center py-32 bg-gray-50 rounded-[40px] border-2 border-dashed border-black/5 flex flex-col items-center">
                            <Clock size={48} className="text-gray-200 mb-4" /><p className="text-gray-400 font-black uppercase tracking-widest text-xs">No Released Vouchers in Archive</p>
                        </div>
                     ) : (
                        myPayslips.map(item => (
                           <div key={item.id} className="bg-white border-2 border-gray-50 p-8 rounded-[32px] flex items-center justify-between hover:border-black/10 hover:shadow-xl transition-all group">
                              <div className="flex items-center space-x-8">
                                 <div className="p-5 bg-black text-white rounded-[24px] shadow-inner group-hover:scale-110 transition-all"><FileText size={24}/></div>
                                 <div>
                                    <h4 className="font-black text-gray-900 text-lg uppercase tracking-tight">
                                        {new Date(item.runId.split('-')[1]+"-01").toLocaleString('default', {month:'long'})} Settlement
                                    </h4>
                                    <p className="text-[10px] font-mono text-gray-400 font-bold uppercase">VOUCHER: {item.id}</p>
                                 </div>
                              </div>
                              <div className="flex items-center space-x-12">
                                 <div className="text-right"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Cleared</p><p className="text-2xl font-black text-gray-900 tracking-tighter">₹ {(item.netSalary || 0).toLocaleString('en-IN')}</p></div>
                                 <div className="flex space-x-3">
                                    <button onClick={() => handleDirectPrint(item, 'PAYSLIP')} className="p-5 bg-black text-white rounded-2xl hover:bg-gray-800 transition-all shadow-xl" title="Print Standard Payslip"><Download size={20}/></button>
                                    {(item.overtimeHours || 0) > 0 && (
                                        <button onClick={() => handleDirectPrint(item, 'OT')} className="p-5 border-2 border-black text-black rounded-2xl hover:bg-black hover:text-white transition-all shadow-lg" title="Print Separate Overtime Slip"><Printer size={20}/></button>
                                    )}
                                 </div>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               )}

               {activeTab === 'security' && (
                  <div className="animate-in fade-in flex flex-col items-center justify-center py-20">
                     <div className="bg-gray-50 p-16 rounded-[48px] border border-black/5 text-center max-w-md shadow-inner">
                        <Key size={64} className="mx-auto text-black mb-8" />
                        <h3 className="text-2xl font-black uppercase text-gray-900 mb-4 tracking-tighter">Account Passcode</h3>
                        <p className="text-sm text-gray-500 font-medium leading-relaxed mb-10">
                            Your portal access is controlled via a unique passcode assigned during onboarding. For security resets, contact the branch HR Lead.
                        </p>
                        <div className="p-6 bg-white rounded-3xl border border-black/10 shadow-lg text-left">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Active Login ID</label>
                            <p className="text-xl font-mono font-black text-black mt-1">{myEmpData?.id}</p>
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </main>
    </div>
  );
};

export default EmployeePortal;
