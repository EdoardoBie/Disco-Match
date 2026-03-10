import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, LogOut, MessageSquare, Camera, ArrowRight, Loader2 } from 'lucide-react';
import QuestionsView from '@/components/QuestionsView';
import MatchesView from '@/components/MatchesView';
import ChatView from '@/components/ChatView';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

type ViewState = 'onboarding' | 'questions' | 'matches';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [view, setView] = useState<ViewState>('questions'); // Default to questions check
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [chatWithProfile, setChatWithProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (profile) {
      if (!profile.nickname || profile.nickname === 'Ghost User') {
        setView('onboarding');
      } else {
        setNickname(profile.nickname);
      }
      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    }
  }, [profile]);

  const handleUpdateNickname = async () => {
    if (nickname.trim()) {
      await updateProfile({ nickname, avatar_url: avatarUrl });
      setView('questions');
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Devi selezionare un\'immagine.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Caricamento...</div>;
  }

  // ONBOARDING STATE
  if (view === 'onboarding') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-12 mt-[-5vh] relative z-10">
        <AnimatePresence mode="wait">
          <motion.div 
            key="onboarding-content"
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-12 w-full max-w-md mx-auto px-6"
          >
            <div className="text-center space-y-4">
              <h1 className="text-6xl font-black tracking-tighter uppercase text-white drop-shadow-2xl">Chi sei?</h1>
              <p className="text-zinc-400 text-sm font-bold tracking-widest uppercase">Scegli un nome per farti riconoscere.</p>
            </div>

            <div className="flex flex-col items-center gap-6">
              <label className="relative cursor-pointer group">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-32 h-32 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center overflow-hidden shadow-2xl relative group-hover:border-white/30 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Camera className="w-10 h-10 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  )}
                  
                  {/* Overlay for hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     <Camera className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
              </label>
              <span className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase">
                {avatarUrl ? 'Immagine caricata' : 'Tocca per caricare foto'}
              </span>
            </div>

            <div className="w-full space-y-8">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="NICKNAME"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-transparent border-none p-2 text-center text-white font-black tracking-tighter uppercase placeholder:text-zinc-800 focus:outline-none transition-all text-4xl caret-white"
                />
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-zinc-800 rounded-full group-focus-within:w-full group-focus-within:bg-white transition-all duration-500" />
              </div>

              <div className="flex justify-center w-full pt-4">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleUpdateNickname}
                  disabled={!nickname.trim()}
                  className="py-4 px-10 bg-white text-black font-black uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                >
                  Entra in pista <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // QUESTIONS STATE (Clean, Full Screen)
  if (view === 'questions') {
    return (
      <motion.div 
        key="questions-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-50 flex flex-col overflow-hidden overscroll-none touch-none bg-black"
      >
        <QuestionsView onComplete={() => setView('matches')} />
      </motion.div>
    );
  }

  // MATCHES STATE (With Header)
  return (
    <>
    <motion.div 
      key="matches-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex-1 flex flex-col space-y-6 pb-20"
    >
      <header className="flex justify-between items-center pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1A1A1A]/80 backdrop-blur-md flex items-center justify-center text-white font-bold uppercase border border-white/10 overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.nickname || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              profile?.nickname?.[0] || '?'
            )}
          </div>
          <div>
            <h2 className="font-bold text-lg uppercase tracking-tight">{profile?.nickname}</h2>
            <p className="text-xs text-[#934517] font-bold tracking-widest uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#934517] rounded-full animate-pulse" />
              In Pista
            </p>
          </div>
        </div>
        <button onClick={() => signOut()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <LogOut className="w-5 h-5 text-zinc-500" />
        </button>
      </header>

      <div className="flex items-center justify-between px-2">
         <h2 className="text-2xl font-black uppercase tracking-tighter">I tuoi Match</h2>
         <button 
           onClick={() => setView('questions')}
           className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
         >
           Rivedi risposte
         </button>
      </div>

      <div className="flex-1">
        <MatchesView onOpenChat={(profile) => setChatWithProfile(profile)} />
      </div>
    </motion.div>

    <AnimatePresence>
      {chatWithProfile && (
        <ChatView partner={chatWithProfile} onClose={() => setChatWithProfile(null)} />
      )}
    </AnimatePresence>
    </>
  );
}
