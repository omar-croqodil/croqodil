import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { motion } from 'motion/react';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import { SOCIAL_LINKS } from '../constants';

export const LandingPage = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141416] flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-5xl font-black text-cream tracking-tighter uppercase font-serif-logo">
            CROQODIL
          </h1>
          <p className="text-cream/60 text-[11px] font-medium leading-relaxed">
            Neural Synthesis Engine for Advanced Visual Analysis & Professional Generation.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/5 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute -inset-10 bg-cream/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-cream/10 rounded-full flex items-center justify-center">
                <UserIcon className="w-10 h-10 text-cream" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-cream">Welcome to the Core</h2>
              <p className="text-sm text-cream/40">Secure your sessions and synchronize your neural memory across devices.</p>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-cream text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-white active:scale-95 transition-all shadow-xl shadow-cream/10 disabled:opacity-50"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'INITIALIZING...' : 'LOGIN WITH GOOGLE'}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-6 py-4">
          {SOCIAL_LINKS.map((link) => (
            <a 
              key={link.name} 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#112250] hover:text-[#112250]/80 transition-all hover:scale-110 active:scale-95 group/link relative"
              title={link.name}
            >
              <div className="absolute -inset-2 bg-[#112250]/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <link.Icon className="w-5 h-5 relative z-10" />
            </a>
          ))}
        </div>

        <div className="pt-4 flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <div className="w-1.5 h-1.5 bg-cream/20 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-cream/40 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-cream/20 rounded-full"></div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-cream/20">
            AMOLED EDITION • SECURE ACCESS
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export const UserProfile = ({ user }: { user: any }) => {
  return (
    <div className="flex items-center gap-3 p-2 bg-white/5 rounded-full border border-white/5">
      <img 
        src={user.photoURL} 
        alt={user.displayName} 
        className="w-8 h-8 rounded-full border border-cream/20"
      />
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-cream truncate max-w-[80px]">{user.displayName}</span>
        <button 
          onClick={() => signOut(auth)}
          className="text-[8px] font-bold text-cream/40 hover:text-cream text-left flex items-center gap-1 transition-colors"
        >
          <LogOut className="w-2 h-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
