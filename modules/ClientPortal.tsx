
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, Receipt, Download, Clock, CheckCircle2, AlertCircle, LogOut, Printer, X, ScanLine, MessageCircle, Send, Mail, Ticket, Star, ThumbsUp, ArrowLeft, Plus, Ban, Settings as SettingsIcon, ShieldCheck, Key,
  LayoutDashboard, Wallet, Calendar, ShieldAlert, Award, Camera, UserCircle
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { Invoice, Payment, Client, Branch, AppNotification, PayrollItem, Employee } from '../types';
import { LOGO_DARK_BG, COMPANY_NAME, INITIAL_BRANCHES, generateSecureQR, COMPANY_LOGO, APP_CONFIG } from '../constants';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

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

interface ClientPortalProps {
  user: any;
  clientData: any; 
  invoices: Invoice[];
  payments: Payment[];
  branches: Branch[];
  notifications?: AppNotification[]; 
  payrollItems?: PayrollItem[]; 
  onLogout: () => void;
  onSendMessage: (subject: string, message: string, generatedTicketNumber: string) => Promise<void>;
  onFeedback: (ticketId: string, rating: number, feedback: string) => Promise<void>;
  onRevokeTicket: (ticketId: string) => Promise<void>;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ user, clientData, invoices, payments, branches, notifications = [], payrollItems = [], onLogout, onSendMessage, onFeedback, onRevokeTicket }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payslips' | 'security'>('dashboard');
  const [viewingPayslip, setViewingPayslip] = useState<any | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [myEmpData, setMyEmpData] = useState<Employee | null>(null);
  
  const isEmployee = user.role === 'Employee';

  useEffect(() => {
    const fetchMe = async () => {
        if (isEmployee) {
            const d = await getDoc(doc(db, 'employees', user.uid));
            if (d.exists()) setMyEmpData(d.data() as Employee);
        }
    };
    fetchMe();
  }, [user, isEmployee]);

  const myPayslips = useMemo(() => {
    return payrollItems.filter(p => p.employeeId === user.uid);
  }, [payrollItems, user]);

  const ytdEarnings = useMemo(() => {
    return myPayslips.reduce((acc, p) => acc + (p.netSalary || 0), 0);
  }, [myPayslips]);

  const handlePrintPayslip = (item: any) => {
    const month = new Date(item.runId.split('-')[1] + "-01").toLocaleString('default', { month: 'long' });
    const originalTitle = document.title;
    document.title = `Payslip_${item.employeeId}_${month}`;
    setViewingPayslip(item);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      document.title = originalTitle;
    }, 500);
  };

  const PayslipDocument = ({ item }: { item: any }) => {
    const monthYear = new Date(item.runId.split('-')[1] + "-01");
    const monthLong = monthYear.toLocaleString('default', { month: 'long' }).toUpperCase();
    const yearLong = monthYear.getFullYear();
    const branch = branches.find(b => b.id === myEmpData?.branchId) || branches[0];

    return (
      <div className="bg-white w-[210mm] min-h-[297mm] p-[10mm] text-black font-sans flex flex-col border border-gray-300 relative print:border-none print:p-0">
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
                 <td className="p-2 border-r border-black">: {myEmpData?.dob ? new Date(myEmpData.dob).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase() : ''}</td>
                 <td className="p-2 border-r border-black font-bold">Joining Date</td>
                 <td className="p-2">: {myEmpData?.dateOfJoining ? new Date(myEmpData.dateOfJoining).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase() : ''}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 border-r border-black font-bold">Designation</td>
                 <td className="p-2 border-r border-black">: {myEmpData?.designation}</td>
                 <td className="p-2 border-r border-black font-bold">Location</td>
                 <td className="p-2">: {branch?.address.city}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 border-r border-black font-bold">UAN Number</td>
                 <td className="p-2 border-r border-black">: {myEmpData?.uan}</td>
                 <td className="p-2 border-r border-black font-bold">Pan Number</td>
                 <td className="p-2">: {myEmpData?.pan}</td>
              </tr>
              <tr className="border-b border-black">
                 <td className="p-2 border-r border-black font-bold">PF Number</td>
                 <td className="p-2 border-r border-black">: {myEmpData?.pfAccountNumber}</td>
                 <td className="p-2 border-r border-black font-bold">LOS</td>
                 <td className="p-2">: {item.lopDays}</td>
              </tr>
              <tr className="border-b-2 border-black">
                 <td className="p-2 border-r border-black font-bold">Regime Type</td>
                 <td className="p-2 border-r border-black">: {myEmpData?.taxRegime} Regime</td>
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
                    <tr className="h-14"><td className="border-r border-black"></td><td></td></tr>
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
                    <tr className="border-b border-black"><td className="p-2 font-bold w-1/2 border-r border-black">STANDARD DAYS</td><td className="p-2">: {item.standardDays}</td></tr>
                    <tr className="border-b border-black"><td className="p-2 font-bold border-r border-black">DAYS WORKED</td><td className="p-2">: {item.payableDays}</td></tr>
                    <tr className="border-b border-black bg-gray-50"><td className="p-2 font-bold border-r border-black">PAYMENT</td><td className="p-2">: {myEmpData?.bankDetails.paymentMode?.toUpperCase()}</td></tr>
                    <tr className="border-b border-black"><td className="p-2 font-bold border-r border-black">BANK</td><td className="p-2">: {myEmpData?.bankDetails.bankName.toUpperCase()}</td></tr>
                    <tr><td className="p-2 font-bold border-r border-black">A/C No.</td><td className="p-2 font-mono">: {myEmpData?.bankDetails.accountNumber}</td></tr>
                 </tbody>
              </table>
           </div>
        </div>
        <div className="mt-4 text-[9px] font-bold border-2 border-black p-4 space-y-2">
           <p>Note: This is a system generated report. This does not require any signature.</p>
           <p className="leading-relaxed">Private and Confidential Disclaimer: This payslip has been generated by the Vedartha Systems & Solution payroll service provider. All compensation information has been treated as confidential.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f3f4f7] font-sans">
      {isPrinting && viewingPayslip && createPortal(<PayslipDocument item={viewingPayslip} />, document.getElementById('print-portal')!)}
      <header className="bg-[#1c2d3d] text-white py-4 px-8 shadow-2xl sticky top-0 z-50">
         <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-6">
               <img src={LOGO_DARK_BG} alt="Logo" className="h-10 object-contain" />
               <div className="hidden md:block">
                   <h1 className="text-sm font-black uppercase tracking-widest">Self-Service Terminal</h1>
                   <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">{myEmpData?.fullName || user.displayName}</p>
               </div>
            </div>
            <button onClick={onLogout} className="flex items-center px-4 py-2 bg-white/10 hover:bg-rose-500 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10"><LogOut size={14} className="mr-2"/> End Session</button>
         </div>
      </header>
      <main className="max-w-6xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
         <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
            <div className="flex border-b border-gray-100 bg-gray-50/30">
                <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'text-[#0854a0] border-b-2 border-[#0854a0] bg-white' : 'text-gray-400 hover:text-gray-600'}`}>My Dashboard</button>
                <button onClick={() => setActiveTab('payslips')} className={`flex-1 py-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'payslips' ? 'text-[#0854a0] border-b-2 border-[#0854a0] bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Salary Archive</button>
                <button onClick={() => setActiveTab('security')} className={`flex-1 py-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'security' ? 'text-[#0854a0] border-b-2 border-[#0854a0] bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Account Guard</button>
            </div>
            <div className="p-10 flex-1">
               {activeTab === 'dashboard' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                     <div className="flex items-center space-x-10 bg-gray-50/50 p-8 rounded-[40px] border border-gray-100">
                        <div className="w-32 h-32 rounded-3xl bg-white border-4 border-white shadow-xl overflow-hidden flex items-center justify-center shrink-0">
                           {myEmpData?.photoUrl ? <img src={myEmpData.photoUrl} className="w-full h-full object-cover" /> : <UserCircle size={64} className="text-gray-200" />}
                        </div>
                        <div className="flex-1">
                           <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight">{myEmpData?.fullName}</h2>
                           <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">{myEmpData?.designation} | {myEmpData?.id}</p>
                           <div className="mt-4 flex items-center space-x-4">
                              <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-full border border-emerald-100">Employment Status: {myEmpData?.status}</span>
                              <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full border border-blue-100">Regime: {myEmpData?.taxRegime}</span>
                           </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-[#0854a0] p-8 rounded-[40px] text-white shadow-2xl flex flex-col justify-between h-56 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                           <div className="relative z-10"><LayoutDashboard size={32} className="mb-4 text-blue-300"/><h3 className="text-xs font-black uppercase opacity-60">YTD Net Earnings</h3><p className="text-4xl font-black mt-2">₹ {(ytdEarnings || 0).toLocaleString('en-IN')}</p></div>
                           <p className="text-[10px] font-bold opacity-60 uppercase">Verified Fiscal Record</p>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] border shadow-sm h-56 flex flex-col justify-between group hover:shadow-xl transition-all">
                           <div><Calendar size={32} className="mb-4 text-emerald-500"/><h3 className="text-xs font-black uppercase text-gray-400">Leave Balance</h3><p className="text-4xl font-black text-gray-800 mt-2">{myEmpData?.openingLeaveBalance || 0} Days</p></div>
                           <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full w-fit uppercase">Standard Policy</p>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] border shadow-sm h-56 flex flex-col justify-between group hover:shadow-xl transition-all">
                           <div><ShieldAlert size={32} className="mb-4 text-rose-500"/><h3 className="text-xs font-black uppercase text-gray-400">Emergency Contact</h3><p className="text-xl font-black text-gray-800 mt-2">{myEmpData?.emergencyContactName || 'N/A'}</p><p className="text-[10px] text-gray-400 font-bold">{myEmpData?.emergencyContactNumber}</p></div>
                           <p className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full w-fit uppercase">Security Protocol</p>
                        </div>
                     </div>
                  </div>
               )}
               {/* ... payslips same ... */}
               {activeTab === 'payslips' && (
                  <div className="grid gap-6 animate-in fade-in">
                     <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Released Vouchers</h3>
                     {myPayslips.length === 0 ? (
                        <div className="text-center py-32 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-100 flex flex-col items-center">
                            <Clock size={48} className="text-gray-200 mb-4" /><p className="text-gray-400 font-black uppercase tracking-widest text-xs">No Released Vouchers in Archive</p>
                        </div>
                     ) : (
                        myPayslips.map(item => (
                           <div key={item.id} className="bg-white border-2 border-gray-50 p-8 rounded-[32px] flex items-center justify-between hover:border-blue-100 hover:shadow-xl transition-all group">
                              <div className="flex items-center space-x-8">
                                 <div className="p-5 bg-emerald-50 text-emerald-600 rounded-[24px] shadow-inner group-hover:bg-[#0854a0] group-hover:text-white transition-all"><FileText size={24}/></div>
                                 <div><h4 className="font-black text-gray-900 text-lg uppercase tracking-tight">PAYSLIP - {item.runId.split('-')[1]}</h4><p className="text-[10px] font-mono text-gray-400 font-bold">VOUCHER ID: {item.id}</p></div>
                              </div>
                              <div className="flex items-center space-x-12">
                                 <div className="text-right"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Net Disbursed</p><p className="text-2xl font-black text-gray-900 tracking-tighter">₹ {(item.netSalary || 0).toLocaleString('en-IN')}</p></div>
                                 <button onClick={() => handlePrintPayslip(item)} className="p-5 bg-[#0854a0] text-white rounded-2xl hover:scale-110 transition-all shadow-xl shadow-blue-100"><Download size={20}/></button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               )}
            </div>
         </div>
      </main>
    </div>
  );
};

export default ClientPortal;
