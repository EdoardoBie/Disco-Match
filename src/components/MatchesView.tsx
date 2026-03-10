import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Profile } from '@/types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, ArrowRight } from 'lucide-react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

type Match = {
  profile: Profile;
  score: number;
  commonAnswers: number;
};

export default function MatchesView() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealStep, setRevealStep] = useState<'loading' | 'animating' | 'revealed'>('loading');
  const [showAllMatches, setShowAllMatches] = useState(false);

  useEffect(() => {
    if (user) {
      findMatches();

      const subscription = supabase
        .channel('answers-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'answers',
          },
          () => {
            findMatches(true); // Pass true to indicate it's a background update
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [user]);

  const findMatches = async (isBackgroundUpdate = false) => {
    if (!isBackgroundUpdate) setLoading(true);
    
    const { data: myAnswers } = await supabase
      .from('answers')
      .select('question_id, answer_text')
      .eq('user_id', user!.id);

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user!.id);

    if (!allProfiles || allProfiles.length === 0) {
      setMatches([]);
      if (!isBackgroundUpdate) {
        setRevealStep('revealed');
        setLoading(false);
      }
      return;
    }

    const { data: otherAnswers } = await supabase
      .from('answers')
      .select('user_id, question_id, answer_text')
      .neq('user_id', user!.id);

    const userScores: Record<string, { score: number; common: number }> = {};
    
    allProfiles.forEach(profile => {
      userScores[profile.id] = { score: 0, common: 0 };
    });

    if (myAnswers && myAnswers.length > 0 && otherAnswers) {
      otherAnswers.forEach((oa: any) => {
        if (userScores[oa.user_id]) {
          const myAnswer = myAnswers.find(ma => ma.question_id === oa.question_id);
          if (myAnswer && 
              myAnswer.answer_text && 
              oa.answer_text && 
              String(myAnswer.answer_text).trim() === String(oa.answer_text).trim()) {
            userScores[oa.user_id].score += 1;
            userScores[oa.user_id].common += 1;
          }
        }
      });
    }

    const matchesList = allProfiles
      .map(p => ({
        profile: p,
        score: userScores[p.id]?.score || 0,
        commonAnswers: userScores[p.id]?.common || 0
      }))
      .filter(m => m.score > 3)
      .sort((a, b) => b.score - a.score);
    
    setMatches(matchesList);
    
    if (!isBackgroundUpdate) {
      if (matchesList.length > 0 && revealStep === 'loading') {
        setRevealStep('animating');
      } else {
        setRevealStep('revealed');
      }
      setLoading(false);
    }
  };

  const getFunSummary = (score: number) => {
    if (score >= 5) return "Siete praticamente la stessa persona. Fatevi un drink insieme, SUBITO.";
    if (score === 4) return "Un'ottima intesa! Avete molto di cui parlare stasera.";
    return "C'è del potenziale. Rompete il ghiaccio e scoprite il resto!";
  };

  if (loading && revealStep === 'loading') {
    return <div className="p-4 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Ricerca affinità...</div>;
  }

  if (revealStep === 'animating') {
    return (
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2.5, duration: 0.5 }}
        onAnimationComplete={() => setRevealStep('revealed')}
      >
        <div className="relative">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: 1 }}
            transition={{ duration: 0.8, ease: "backOut" }}
            className="w-40 h-40 bg-white rounded-full flex items-center justify-center text-8xl shadow-[0_0_100px_rgba(255,255,255,0.5)] z-10 relative"
          >
            <motion.span
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              🔥
            </motion.span>
          </motion.div>
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ delay: 0.2, duration: 1.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-white rounded-full blur-xl"
          />
        </div>
      </motion.div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="p-12 text-center text-zinc-500/50 backdrop-blur-md rounded-[2rem] border border-white/5 bg-white/5 mx-4">
        <Heart className="w-16 h-16 mx-auto mb-6 text-zinc-800" />
        <p className="font-black uppercase tracking-widest text-lg text-white">Nessun match ancora.</p>
        <p className="text-sm mt-3 text-zinc-400 font-medium">Rispondi a più domande per trovare la tua gente!</p>
      </div>
    );
  }

  if (!showAllMatches) {
    const topMatch = matches[0];
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center justify-center space-y-8 mt-4 px-4"
      >
        <div className="text-center space-y-3">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            It's a Match!
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-zinc-400 text-xs font-bold tracking-[0.2em] uppercase"
          >
            Il tuo match perfetto per stasera
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40, rotateX: 20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.6, type: "spring", bounce: 0.4, duration: 1.2 }}
          className="w-full max-w-sm bg-zinc-900/80 backdrop-blur-2xl p-1 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group perspective-1000"
        >
          {/* Inner Card */}
          <div className="bg-black/40 rounded-[2.3rem] p-8 relative overflow-hidden">
             {/* Background glow */}
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-50 pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center text-center space-y-8">
              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-zinc-800 border-4 border-white/10 flex items-center justify-center text-white font-black text-5xl uppercase overflow-hidden shadow-2xl ring-1 ring-white/20">
                  {topMatch.profile.avatar_url ? (
                    <img src={topMatch.profile.avatar_url} alt={topMatch.profile.nickname || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    topMatch.profile.nickname?.[0] || '?'
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-full flex items-center justify-center border-4 border-black text-2xl shadow-lg">
                  🔥
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-black text-4xl uppercase tracking-tighter text-white">{topMatch.profile.nickname}</h3>
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 border border-white/5 backdrop-blur-md">
                  <span className="text-xs text-white font-bold tracking-widest uppercase">
                    {topMatch.commonAnswers} Punti in comune
                  </span>
                </div>
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <p className="text-sm text-zinc-300 italic font-medium leading-relaxed px-4">
                "{getFunSummary(topMatch.commonAnswers)}"
              </p>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                Scrivi ora <MessageCircle className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {matches.length > 1 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            onClick={() => setShowAllMatches(true)}
            className="text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-white transition-colors underline underline-offset-4 flex items-center gap-2"
          >
            Vedi altri {matches.length - 1} match <ArrowRight className="w-3 h-3" />
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-4 px-2">
      <button 
        onClick={() => setShowAllMatches(false)}
        className="text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-white transition-colors mb-6 flex items-center gap-2 pl-2"
      >
        <ArrowLeft className="w-4 h-4" /> Torna al Top Match
      </button>
      <AnimatePresence>
        {matches.map((match, index) => (
          <motion.div
            key={match.profile.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: index * 0.05,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1]
            }}
            whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.08)" }}
            whileTap={{ scale: 0.98 }}
            className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 flex items-center justify-between transition-colors cursor-pointer group hover:border-white/20"
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white font-black text-xl uppercase overflow-hidden shadow-lg group-hover:border-white/30 transition-colors">
                {match.profile.avatar_url ? (
                  <img src={match.profile.avatar_url} alt={match.profile.nickname || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  match.profile.nickname?.[0] || '?'
                )}
              </div>
              <div>
                <h3 className="font-black text-xl uppercase tracking-tight text-white group-hover:text-white transition-colors">{match.profile.nickname}</h3>
                <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase mt-1">
                  <span className="text-white">{match.commonAnswers}</span> Punti in comune
                </p>
              </div>
            </div>
            
            <button className="p-3 bg-white text-black rounded-full hover:bg-zinc-200 transition-all shadow-lg group-hover:scale-110 duration-300">
              <MessageCircle className="w-5 h-5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
