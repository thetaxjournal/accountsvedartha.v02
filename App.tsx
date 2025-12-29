
import React, { useState, useEffect, useMemo } from 'react';
import { Module, Branch, Client, Invoice, Payment, UserProfile, AppNotification, UserRole, Employee, PayrollItem } from './types';
import { INITIAL_BRANCHES } from './constants';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './modules/Dashboard';
import InvoiceList from './modules/InvoiceList';
import InvoiceCreation from './modules/InvoiceCreation';
import Payments from './modules/Payments';
import Clients from './modules/Clients';
import Branches from './modules/Branches';
import Accounts from './modules/Accounts';
import Settings from './modules/Settings';
import Scanner from './modules/Scanner';
import Notifications from './modules/Notifications';
import Payroll from './modules/Payroll';
import Login from './components/Login';
import ClientPortal from './modules/ClientPortal';
import EmployeePortal from './modules/EmployeePortal';

import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
} from 'firebase/firestore';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null); 
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<Module>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [showCreation, setShowCreation] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Default mock profile for Firebase Auth users (Admin)
        const mockProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Administrator',
            role: UserRole.ADMIN, 
            allowedBranchIds: [] 
        };
        setUserProfile(mockProfile);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); 

  useEffect(() => {
    if (!user) return;

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Branch);
      if (data.length === 0) {
        INITIAL_BRANCHES.forEach(async (b) => {
          await setDoc(doc(db, 'branches', b.id), b);
        });
      } else {
        setBranches(data);
        if (!activeBranchId && data.length > 0) setActiveBranchId(data[0].id);
      }
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => doc.data() as Client));
    });

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => doc.data() as Invoice));
    });

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      setPayments(snapshot.docs.map(doc => doc.data() as Payment));
    });
    
    const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as AppNotification)));
    });

    const unsubPayroll = onSnapshot(collection(db, 'payroll_items'), (snapshot) => {
        setPayrollItems(snapshot.docs.map(doc => doc.data() as PayrollItem));
    });

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
        setEmployees(snapshot.docs.map(doc => doc.data() as Employee));
    });

    return () => {
      unsubBranches();
      unsubClients();
      unsubInvoices();
      unsubPayments();
      unsubNotifications();
      unsubPayroll();
      unsubEmployees();
    };
  }, [user]);

  const handleLogin = (userObj: any) => {
    setUser(userObj);
    if (userObj.isClient) {
        setUserProfile({
            uid: userObj.uid, email: userObj.email, displayName: userObj.displayName,
            role: UserRole.CLIENT, allowedBranchIds: [], clientId: userObj.clientId
        });
    } else if (userObj.isEmployee) {
        setUserProfile({
            uid: userObj.uid, email: userObj.email, displayName: userObj.displayName,
            role: UserRole.EMPLOYEE, allowedBranchIds: []
        });
    } else if (userObj.isStaff) {
        setUserProfile({
            uid: userObj.uid, email: userObj.email, displayName: userObj.displayName,
            role: userObj.role, allowedBranchIds: userObj.allowedBranchIds || []
        });
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const activeInvoices = useMemo(() => invoices.filter(i => !i.archived), [invoices]);
  const activePayments = useMemo(() => payments.filter(p => !p.archived), [payments]);
  const activeNotifications = useMemo(() => notifications.filter(n => !n.archived), [notifications]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 text-blue-600 font-bold animate-pulse">Loading Resources...</div>;

  if (!user) return <Login onLogin={handleLogin} />;

  // SEPARATE EMPLOYEE PORTAL
  if (user.isEmployee) {
    return (
      <EmployeePortal 
        user={user}
        branches={branches}
        payrollItems={payrollItems}
        onLogout={handleLogout}
      />
    );
  }

  // SEPARATE CLIENT PORTAL
  if (user.isClient) {
    const currentClient = clients.find(c => c.id === user.clientId);
    return (
      <ClientPortal 
         user={user} clientData={currentClient} invoices={invoices} payments={payments} branches={branches}
         notifications={notifications.filter(n => n.clientId === user.clientId)}
         onLogout={handleLogout} onSendMessage={async (s,m,t) => {}} onFeedback={async (id,r,f) => {}} onRevokeTicket={async id => {}}
      />
    );
  }

  const currentUserRole = userProfile?.role || UserRole.ADMIN;
  const allowedBranches = (userProfile?.role === UserRole.BRANCH_MANAGER || userProfile?.role === UserRole.ACCOUNTANT) && userProfile?.allowedBranchIds.length 
    ? branches.filter(b => userProfile.allowedBranchIds.includes(b.id)) 
    : branches;

  const renderModule = () => {
    switch (activeModule) {
      case 'Dashboard':
        return <Dashboard invoices={activeInvoices} clients={clients} branches={allowedBranches} payments={activePayments} onRecordPayment={async p => {}} />;
      case 'Payroll':
        return <Payroll branches={allowedBranches} userRole={currentUserRole} />;
      case 'Notifications':
        return <Notifications notifications={activeNotifications} onCloseTicket={async id => {}} onReplyTicket={async (id,r) => {}} />;
      case 'Invoices':
        if (showCreation) {
          return <InvoiceCreation branches={allowedBranches} activeBranchId={activeBranchId} clients={clients} initialInvoice={editingInvoice || undefined} onPost={async i => {}} onCancel={() => setShowCreation(false)} />;
        }
        return <InvoiceList invoices={activeInvoices} clients={clients} branches={allowedBranches} onNewInvoice={() => setShowCreation(true)} onEdit={i => { setEditingInvoice(i); setShowCreation(true); }} onRevoke={async id => {}} />;
      case 'Payments':
        return <Payments invoices={activeInvoices} payments={activePayments} branches={allowedBranches} onRecordPayment={async p => {}} />;
      case 'Clients':
        return <Clients clients={clients} setClients={async c => {}} branches={allowedBranches} onDeleteClient={async id => {}} />;
      case 'Branches':
        return <Branches branches={branches} setBranches={async b => {}} />;
      case 'Accounts':
        return <Accounts invoices={activeInvoices} payments={activePayments} clients={clients} />;
      case 'Scanner':
        return <Scanner invoices={activeInvoices} payments={activePayments} />;
      case 'Settings':
        return <Settings state={{ invoices, clients, branches, payments, notifications }} onAddUser={async u => {}} onPurgeData={async () => {}} onCloseFinancialYear={async () => {}} onRestoreData={async d => {}} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      <Sidebar 
        activeModule={activeModule} 
        onModuleChange={(m) => {
          setActiveModule(m);
          setShowCreation(false);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userRole={currentUserRole}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          branches={allowedBranches} activeBranchId={activeBranchId} onBranchChange={setActiveBranchId}
          title={activeModule === 'Invoices' && showCreation ? 'Create Invoice' : activeModule}
          onLogout={handleLogout} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <main className={`flex-1 overflow-y-auto ${(activeModule === 'Invoices' && showCreation) || activeModule === 'Payroll' ? 'p-0' : 'p-8'}`}>
          <div className={(activeModule === 'Invoices' && showCreation) || activeModule === 'Payroll' ? 'h-full' : 'max-w-7xl mx-auto'}>
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
