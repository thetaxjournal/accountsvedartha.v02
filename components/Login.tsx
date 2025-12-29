
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
      {/* LEFT SIDE: Branding & Video Sidebar (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[40%] relative overflow-hidden bg-gray-900">
        <video 
          src="https://res.cloudinary.com/dtgufvwb5/video/upload/q_auto,f_auto/10915129-hd_3840_2160_30fps_xy4way" 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60 scale-105 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        
        <div className="relative z-10 p-12 flex flex-col h-full">
          <div className="flex items-center">
             <img src={LOGO_DARK_BG} alt="Logo" className="h-16 object-contain" />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-24 bg-white relative">
        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-right-4 duration-700">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Login Here</h2>
          </div>

          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-xs font-bold flex items-center animate-in shake-in">
              <ShieldCheck size={16} className="mr-3 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 ml-1">Email or Personnel ID</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full h-13 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-xl pl-12 pr-4 text-sm font-bold outline-none transition-all" 
                  placeholder="alex.jordan@gmail.com" 
                  required 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold text-gray-700">Password</label>
                <button type="button" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">Forgot password?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full h-13 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-xl pl-12 pr-12 text-sm font-bold outline-none transition-all" 
                  placeholder="••••••••••••" 
                  required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-bold text-gray-500">Remember sign in details</span>
              <button 
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-11 h-6 rounded-full transition-all flex items-center p-1 ${rememberMe ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${rememberMe ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full h-13 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center group disabled:opacity-70 active:scale-95"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : 'Log in'}
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-gray-400 bg-white px-4">or</div>
          </div>

          <button className="w-full h-13 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all flex items-center justify-center space-x-3 mb-8">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="absolute bottom-8 text-[10px] font-black text-gray-300 uppercase tracking-widest">
          Secured by Vedartha Systems & Solutions
        </div>
      </div>

      <style>{`
        .h-13 { height: 3.25rem; }
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
