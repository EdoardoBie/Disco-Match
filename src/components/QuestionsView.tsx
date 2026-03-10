import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Question, Answer } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowRight, ArrowLeft, X } from 'lucide-react';

interface QuestionsViewProps {
  onComplete?: () => void;
  mode?: 'answer' | 'review';
  onClose?: () => void;
}

export default function QuestionsView({ onComplete, mode = 'answer', onClose }: QuestionsViewProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: questionsData } = await supabase
      .from('questions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    const { data: answersData } = await supabase
      .from('answers')
      .select('*')
      .eq('user_id', user.id);

    if (questionsData) {
      setQuestions(questionsData);
      
      // Find the appropriate starting index
      if (answersData) {
        const answersMap: Record<string, string> = {};
        answersData.forEach((a: Answer) => {
          answersMap[a.question_id] = a.answer_text;
        });
        setAnswers(answersMap);

        if (mode === 'review') {
           setCurrentIndex(0); // Start from the beginning in review mode
        } else {
           const firstUnansweredIndex = questionsData.findIndex(q => !answersMap[q.id]);
           if (firstUnansweredIndex !== -1) {
             setCurrentIndex(firstUnansweredIndex);
           } else {
             setCurrentIndex(questionsData.length); // All answered
           }
        }
      }
    }
    
    setLoading(false);
  };

  const handleAnswer = async (questionId: string, answerValue: string) => {
    if (!user) return;

    const existingAnswer = answers[questionId];
    
    let error;
    if (existingAnswer !== undefined) {
      const { error: updateError } = await supabase
        .from('answers')
        .update({ answer_text: answerValue })
        .eq('user_id', user.id)
        .eq('question_id', questionId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('answers')
        .insert({
          user_id: user.id,
          question_id: questionId,
          answer_text: answerValue
        });
      error = insertError;
    }

    if (!error) {
      setAnswers(prev => ({ ...prev, [questionId]: answerValue }));
      // Automatically move to next question after a short delay for feedback
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 400);
    }
  };

  const isFinished = !loading && questions.length > 0 && currentIndex >= questions.length && mode === 'answer';

  useEffect(() => {
    if (isFinished && onComplete) {
      // Small delay to let the user see the last interaction/animation if needed
      // But user requested "subito" (immediately), so keep it short
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFinished, onComplete]);

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Caricamento domande...</div>;

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-zinc-500/50 backdrop-blur-sm rounded-2xl border border-white/5">
        <div>
          <p className="font-bold uppercase tracking-widest text-sm">Nessuna domanda attiva.</p>
          <p className="text-xs mt-2">Torna più tardi!</p>
          {onComplete && (
            <button 
              onClick={onComplete}
              className="mt-4 text-xs text-[#934517] font-bold uppercase tracking-widest underline"
            >
              Vai ai Match
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-[#934517] font-black uppercase tracking-widest">
          Salvataggio risposte...
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] bg-[#934517] rounded-full blur-[150px] opacity-10" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[500px] h-[500px] bg-white rounded-full blur-[150px] opacity-5" />
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/5 z-20">
        <motion.div 
          className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
          transition={{ duration: 0.5, ease: "circOut" }}
        />
      </div>

      {/* Back/Nav Buttons - Top Left */}
      <div className="absolute top-6 left-6 z-20 flex gap-2">
        {mode === 'review' && onClose && (
          <button 
            onClick={onClose}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-all hover:text-white backdrop-blur-md border border-white/5"
            title="Chiudi rassegna"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button 
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-0 transition-all hover:text-white backdrop-blur-md border border-white/5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      
      {/* Forward Nav - Top Right for Review Mode Only */}
      {mode === 'review' && (
        <div className="absolute top-6 right-6 z-20">
          <button 
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIndex === questions.length - 1}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-0 transition-all hover:text-white backdrop-blur-md border border-white/5"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 100, filter: 'blur(10px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: -100, filter: 'blur(10px)' }}
          transition={{ 
            duration: 0.5, 
            ease: [0.22, 1, 0.36, 1] 
          }}
          className="flex-1 flex flex-col justify-center space-y-16 py-10 px-6 w-full max-w-xl mx-auto relative z-10"
        >
          <div className="space-y-6 text-center">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#934517] animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Domanda {currentIndex + 1} / {questions.length}
              </span>
            </motion.div>
            
            <motion.h3 
              layoutId={`question-text-${currentQuestion.id}`}
              className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9] text-white drop-shadow-2xl"
            >
              {currentQuestion.text}
            </motion.h3>
          </div>
          
          <div className="w-full">
            {currentQuestion.type === 'text' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-8"
              >
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="SCRIVI QUI..."
                    value={answers[currentQuestion.id] || ''}
                    readOnly={mode === 'review'}
                    onChange={(e) => {
                      if (mode === 'answer') {
                        setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && mode === 'answer') {
                        handleAnswer(currentQuestion.id, (e.target as HTMLInputElement).value);
                      }
                    }}
                    className={`w-full bg-transparent border-none p-0 text-white font-black tracking-tighter uppercase placeholder:text-zinc-800 focus:outline-none transition-all text-5xl md:text-6xl text-center caret-[#934517] ${mode === 'review' ? 'opacity-80' : ''}`}
                    autoFocus={mode === 'answer'}
                  />
                  {mode === 'answer' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-zinc-800 rounded-full group-focus-within:w-full group-focus-within:bg-white transition-all duration-500" />}
                </div>

                {mode === 'answer' && (
                  <button 
                    onClick={() => {
                        handleAnswer(currentQuestion.id, answers[currentQuestion.id] || '');
                    }}
                    disabled={!answers[currentQuestion.id]?.trim()}
                    className="mx-auto py-4 px-8 rounded-full bg-white text-black font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Conferma <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </motion.div>
            )}

            {currentQuestion.type === 'choice' && currentQuestion.options && (
              <div className="grid grid-cols-1 gap-4">
                {currentQuestion.options.map((option, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + (i * 0.05) }}
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => mode === 'answer' && handleAnswer(currentQuestion.id, option)}
                    disabled={mode === 'review'}
                    className={`group relative overflow-hidden p-6 md:p-8 rounded-2xl text-xl md:text-2xl font-black uppercase tracking-tight transition-all text-center flex justify-center items-center backdrop-blur-md border ${
                      answers[currentQuestion.id] === option
                        ? 'bg-white text-black border-white shadow-[0_0_40px_rgba(255,255,255,0.3)]'
                        : `bg-white/5 border-white/10 text-zinc-400 ${mode === 'answer' ? 'hover:text-white hover:border-white/30' : 'opacity-50 cursor-default'}`
                    }`}
                  >
                    <span className="relative z-10">{option}</span>
                    {answers[currentQuestion.id] === option && (
                      <motion.div 
                        layoutId="selected-glow"
                        className="absolute inset-0 bg-white mix-blend-overlay opacity-50"
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'photo' && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="text-center p-12 border border-white/10 rounded-[2rem] text-zinc-500 flex flex-col items-center gap-6 bg-white/5 backdrop-blur-md shadow-2xl"
               >
                 <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                    <ArrowRight className="w-8 h-8 rotate-[-45deg] text-zinc-600" />
                 </div>
                 <div className="space-y-2">
                   <h4 className="text-white font-bold uppercase tracking-widest">Foto in arrivo</h4>
                   <p className="text-xs text-zinc-500 max-w-[200px] mx-auto">Stiamo preparando la cabina fotografica.</p>
                 </div>
                 <button 
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="py-3 px-6 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-widest transition-colors"
                 >
                   {mode === 'review' ? 'Avanti' : 'Salta'}
                 </button>
               </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

