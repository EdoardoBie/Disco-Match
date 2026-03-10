import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  const { user, signInAnonymously, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleEnter = async () => {
    await signInAnonymously();
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center space-y-16 relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#934517] rounded-full blur-[120px] opacity-20 pointer-events-none animate-pulse" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6 relative z-10"
      >
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85] mix-blend-difference">
          Disco<br/>Match
        </h1>
        <p className="text-zinc-400 text-sm md:text-base font-bold tracking-[0.2em] uppercase max-w-xs mx-auto leading-relaxed">
          Niente profili finti.<br/>Solo chi è qui, ora.
        </p>
      </motion.div>

      <div className="w-full max-w-xs relative z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleEnter}
          disabled={loading}
          className="w-full py-4 bg-white text-black font-black tracking-widest uppercase rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(255,255,255,0.15)]"
        >
          {loading ? (
            <span className="animate-pulse">Accesso...</span>
          ) : (
            <>
              Entra in pista <ArrowRight className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
