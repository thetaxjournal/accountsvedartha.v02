
import React, { useState } from 'react';
import { Lock, User, ShieldCheck, ArrowRight, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { COMPANY_LOGO, COMPANY_NAME, LOGO_DARK_BG } from '../constants';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
        if (!email.includes('@')) {
           const employeesRef = collection(db, 'employees');
           const empQ = query(employeesRef, where('id', '==', email), where('portalPassword', '==', password));
           const empSnapshot = await getDocs(empQ);

           if (!empSnapshot.empty) {
               const empData = empSnapshot.docs[0].data();
               const syntheticUser = {
                   uid: empData.id,
                   email: empData.officialEmail || `${empData.id}@vedartha.internal`,
                   displayName: empData.fullName,
                   role: UserRole.EMPLOYEE,
                   isEmployee: true
               };
               onLogin(syntheticUser);
               return;
           }

           const clientsRef = collection(db, 'clients');
           const q = query(clientsRef, where('id', '==', email), where('portalPassword', '==', password));
           const querySnapshot = await getDocs(q);

           if (!querySnapshot.empty) {
              const clientData = querySnapshot.docs[0].data();
              if (clientData.portalAccess) {
                 const syntheticUser = {
                    uid: clientData.id,
                    email: clientData.email,
                    displayName: clientData.name,
                    role: UserRole.CLIENT,
                    clientId: clientData.id,
                    isClient: true
                 };
                 onLogin(syntheticUser);
                 return;
              } else {
                 throw new Error('Portal access disabled.');
              }
           }
           throw new Error('Invalid Login ID or Password.');
        }

        const usersRef = collection(db, 'users');
        const userQ = query(usersRef, where('email', '==', email), where('password', '==', password));
        const userSnapshot = await getDocs(userQ);

        if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            const syntheticStaff = {
                uid: userSnapshot.docs[0].id,
                email: userData.email,
                displayName: userData.displayName,
                role: userData.role,
                allowedBranchIds: userData.allowedBranchIds || [],
                isStaff: true
            };
            onLogin(syntheticStaff);
            return;
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onLogin(userCredential.user);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-sans overflow-hidden">
      {/* LEFT SIDE: Branding & Video Sidebar (Width extended to 65%) */}
      <div className="hidden lg:flex lg:w-[65%] relative overflow-hidden bg-gray-900 shadow-2xl z-10">
        <video 
          src="https://res.cloudinary.com/dtgufvwb5/video/upload/q_auto,f_auto/10915129-hd_3840_2160_30fps_xy4way" 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-70 scale-105 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
        
        <div className="relative z-10 p-16 flex flex-col h-full">
          <div className="flex items-center">
             <img src={LOGO_DARK_BG} alt="Logo" className="h-20 object-contain brightness-0 invert" />
          </div>
          <div className="mt-auto">
             <div className="h-1 w-24 bg-blue-500 rounded-full mb-6"></div>
             <p className="text-white font-black text-xs uppercase tracking-[0.5em] opacity-60">Enterprise Solutions</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form (Width shrunk to 35% flex-1) */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 bg-white relative">
        <div className="w-full max-w-[380px] animate-in fade-in slide-in-from-right-8 duration-1000">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter uppercase">Login Here</h2>
            <div className="w-12 h-1 bg-gray-100 mx-auto rounded-full"></div>
          </div>

          {error && (
            <div className="mb-8 bg-rose-50 border border-rose-100 text-rose-600 p-5 rounded-2xl text-xs font-black uppercase tracking-tight flex items-center animate-in shake-in">
              <ShieldCheck size={18} className="mr-3 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Email or Personnel ID</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="text" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full h-14 bg-gray-50 border-2 border-gray-50 focus:border-blue-500 focus:bg-white rounded-2xl pl-14 pr-4 text-sm font-bold outline-none transition-all" 
                  placeholder="ID Number or Email" 
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Security Key</label>
                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors">Recover</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full h-14 bg-gray-50 border-2 border-gray-50 focus:border-blue-500 focus:bg-white rounded-2xl pl-14 pr-14 text-sm font-bold outline-none transition-all" 
                  placeholder="••••••••••••" 
                  required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Remember session</span>
              <button 
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-12 h-7 rounded-full transition-all flex items-center p-1.5 ${rememberMe ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${rememberMe ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full h-15 bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-gray-200 hover:bg-gray-800 transition-all flex items-center justify-center group disabled:opacity-70 active:scale-95"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : 'Authorize Access'}
            </button>
          </form>

          <div className="relative my-12">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-[9px] uppercase font-black tracking-[0.4em] text-gray-300 bg-white px-6">Third Party Auth</div>
          </div>

          <button className="w-full h-14 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center space-x-3 mb-8 shadow-sm">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            <span>Google SSO</span>
          </button>
        </div>

        <div className="absolute bottom-8 text-[9px] font-black text-gray-200 uppercase tracking-[0.5em]">
          Vedartha Systems & Solutions
        </div>
      </div>

      <style>{`
        .h-15 { height: 3.75rem; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .shake-in { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default Login;
