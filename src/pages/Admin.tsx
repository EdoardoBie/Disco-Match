import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Question, Profile } from '@/types';
import { Plus, Trash2, ToggleLeft, ToggleRight, ArrowLeft, Users, Activity, Settings, LayoutDashboard, MessageSquare, Database, ShieldAlert, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Tab = 'overview' | 'questions' | 'users' | 'settings';

const StatCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: number | string }) => (
  <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl flex items-center gap-4 group hover:border-[#934517]/50 transition-colors">
    <div className="w-12 h-12 rounded-2xl bg-[#934517]/20 flex items-center justify-center text-[#934517] group-hover:scale-110 transition-transform">
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-3xl font-black tracking-tighter text-white">{value}</p>
    </div>
  </div>
);

export default function Admin() {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  
  // Auth State
  const [adminPassword, setAdminPassword] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard State
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState({ users: 0, answers: 0, questions: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'choice' | 'photo'>('text');
  
  // Users State
  const [usersList, setUsersList] = useState<Profile[]>([]);
  
  // Settings State
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchDashboardData();

      // Realtime subscription for overview stats
      if (activeTab === 'overview') {
        const channel = supabase.channel('admin_stats')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
             // Incremental update could be done, but refetching is safer for simple counts
             fetchDashboardData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, () => {
             fetchDashboardData();
          })
          .subscribe();
          
        return () => {
          supabase.removeChannel(channel);
        };
      }
    }
  }, [profile, activeTab]);

  const fetchDashboardData = async () => {
    if (activeTab === 'overview') {
      // Fetch Stats
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: answersCount } = await supabase.from('answers').select('*', { count: 'exact', head: true });
      const { count: questionsCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
      
      setStats({
        users: usersCount || 0,
        answers: answersCount || 0,
        questions: questionsCount || 0
      });

      // Fetch Chart Data (Answers per question)
      const { data: qData } = await supabase.from('questions').select('id, text');
      const { data: aData } = await supabase.from('answers').select('question_id');
      
      if (qData && aData) {
        const dist = qData.map(q => ({
          name: q.text.length > 15 ? q.text.substring(0, 15) + '...' : q.text,
          risposte: aData.filter(a => a.question_id === q.id).length
        })).sort((a, b) => b.risposte - a.risposte).slice(0, 5); // Top 5
        setChartData(dist);
      }
    } else if (activeTab === 'questions') {
      const { data } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
      setQuestions(data || []);
    } else if (activeTab === 'users') {
      const { data } = await supabase.from('profiles').select('*');
      setUsersList(data || []);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setAuthError(null);

    try {
      const { data: success, error: rpcError } = await supabase.rpc('verify_and_promote_admin', {
        input_password: adminPassword
      });

      if (rpcError) throw rpcError;

      if (success) {
        window.location.reload();
      } else {
        setAuthError('Password errata. Riprova.');
      }
    } catch (err: any) {
      setAuthError('Errore durante la verifica: ' + err.message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCreateQuestion = async () => {
    if (!newQuestionText.trim()) return;

    const { error } = await supabase.from('questions').insert([
      {
        text: newQuestionText,
        type: newQuestionType,
        is_active: true,
        options: newQuestionType === 'choice' ? ['Yes', 'No'] : null
      }
    ]);

    if (error) {
      console.error('Error creating question:', error);
    } else {
      setNewQuestionText('');
      fetchDashboardData();
    }
  };

  const toggleQuestionStatus = async (id: string, currentStatus: boolean) => {
    // Optimistic UI update
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, is_active: !currentStatus } : q));
    
    const { error } = await supabase
      .from('questions')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
       console.error('Error updating question:', error);
       // Revert on error
       setQuestions(prev => prev.map(q => q.id === id ? { ...q, is_active: currentStatus } : q));
    }
  };

  const deleteQuestion = async (id: string) => {
    // Optimistic UI update
    const previousQuestions = [...questions];
    setQuestions(prev => prev.filter(q => q.id !== id));
    
    if (!window.confirm("Sei sicuro di voler eliminare questa domanda? Tutte le risposte ad essa associate andranno perse.")) {
      setQuestions(previousQuestions);
      return;
    }

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      console.error('Error deleting question:', error);
      setQuestions(previousQuestions); // Revert on error
    } else {
      // Background refetch for other tabs if needed (stats)
      if (activeTab === 'overview') fetchDashboardData();
    }
  };

  const handleUpdatePassword = async () => {
    if (!newAdminPassword.trim()) return;
    const { error } = await supabase
      .from('system_settings')
      .update({ value: newAdminPassword })
      .eq('key', 'admin_password');
      
    if (error) {
      setSettingsMessage('Errore: ' + error.message);
    } else {
      setSettingsMessage('Password aggiornata con successo!');
      setNewAdminPassword('');
      setTimeout(() => setSettingsMessage(''), 3000);
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Caricamento...</div>;

  if (profile?.role !== 'admin') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[70vh] p-4"
      >
        <button 
          onClick={() => navigate('/dashboard')}
          className="absolute top-6 left-6 p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10 z-50"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>

        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#934517]/10 to-transparent opacity-50" />
          
          <div className="relative z-10 text-center space-y-3">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-[#934517]">Accesso Staff</h1>
            <p className="text-zinc-400 text-xs font-bold tracking-widest uppercase">Inserisci la chiave segreta</p>
          </div>

          <form onSubmit={handleAdminLogin} className="relative z-10 space-y-6">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="PASSWORD"
              className="w-full bg-black/50 backdrop-blur-md border border-white/10 focus:border-[#934517] rounded-xl p-4 text-center text-white font-bold tracking-widest uppercase placeholder:text-zinc-700 focus:outline-none transition-all"
            />
            
            {authError && (
              <p className="text-red-500 text-xs text-center font-bold uppercase tracking-widest">{authError}</p>
            )}

            <LiquidButton
              disabled={isChecking || !adminPassword}
              className="w-full bg-[#934517] text-black font-black uppercase tracking-widest hover:bg-[#a65220]"
            >
              {isChecking ? 'Verifica...' : 'Accedi'}
            </LiquidButton>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 p-4 pb-20 max-w-5xl mx-auto"
    >
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-[#934517]">Dashboard Staff</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gestione e Analisi</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 sm:pb-0 hide-scrollbar">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Panoramica' },
            { id: 'questions', icon: MessageSquare, label: 'Domande' },
            { id: 'users', icon: Users, label: 'Utenti' },
            { id: 'settings', icon: Settings, label: 'Impostazioni' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold uppercase tracking-widest text-xs whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#934517] text-black shadow-[0_0_15px_rgba(147,69,23,0.3)]' 
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={Users} label="Utenti Registrati" value={stats.users} />
              <StatCard icon={Activity} label="Risposte Totali" value={stats.answers} />
              <StatCard icon={Database} label="Domande Attive" value={stats.questions} />
            </div>
            
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6">Top 5 Domande più risposte</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    />
                    <Bar dataKey="risposte" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#934517' : 'rgba(147,69,23,0.5)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {/* QUESTIONS TAB */}
        {activeTab === 'questions' && (
          <motion.div key="questions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Crea Nuova Domanda</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Testo della domanda..."
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[#934517] outline-none transition-all placeholder:text-zinc-700"
                />
                <div className="flex gap-2">
                  <select
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value as any)}
                    className="bg-black/50 border border-white/10 rounded-xl p-4 text-white text-xs font-bold uppercase tracking-widest focus:border-[#934517] outline-none"
                  >
                    <option value="text">Testo</option>
                    <option value="choice">Scelta</option>
                    <option value="photo">Foto</option>
                  </select>
                  <button
                    onClick={handleCreateQuestion}
                    className="bg-[#934517] hover:bg-[#a65220] text-black p-4 rounded-xl transition-all shadow-lg"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Gestione Domande</h2>
              <div className="grid gap-3">
                {questions.map((q) => (
                  <div 
                    key={q.id} 
                    className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-all"
                  >
                    <div>
                      <p className="font-bold text-lg">{q.text}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-zinc-400 font-black uppercase tracking-widest">{q.type}</span>
                        {!q.is_active && <span className="text-[10px] bg-red-500/20 px-2 py-1 rounded text-red-400 font-black uppercase tracking-widest">Disattivata</span>}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => toggleQuestionStatus(q.id, q.is_active)}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        {q.is_active ? <ToggleRight className="text-[#934517] w-8 h-8" /> : <ToggleLeft className="text-zinc-700 w-8 h-8" />}
                      </button>
                      <button 
                        onClick={() => deleteQuestion(q.id)} 
                        className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-700 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/20">
                      <th className="p-4 text-xs font-black uppercase tracking-widest text-zinc-500">Utente</th>
                      <th className="p-4 text-xs font-black uppercase tracking-widest text-zinc-500">Ruolo</th>
                      <th className="p-4 text-xs font-black uppercase tracking-widest text-zinc-500 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden font-black uppercase">
                              {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-sm text-zinc-500">{u.nickname?.[0] || 'O'}</span>}
                            </div>
                            <span className="font-bold uppercase tracking-tight">{u.nickname || 'Ospite'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-[#934517]/20 text-[#934517]' : 'bg-white/10 text-zinc-400'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-500 hover:text-white" title="Settings">
                            <Settings className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <ShieldAlert className="w-6 h-6 text-[#934517]" />
                <h2 className="text-lg font-black uppercase tracking-tighter text-white">Sicurezza</h2>
              </div>
              
              <div className="space-y-4 max-w-md">
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Cambia Password Admin</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Nuova password..."
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[#934517] outline-none transition-all placeholder:text-zinc-700"
                  />
                  <button
                    onClick={handleUpdatePassword}
                    disabled={!newAdminPassword.trim()}
                    className="bg-[#934517] hover:bg-[#a65220] disabled:opacity-50 disabled:cursor-not-allowed text-black p-4 rounded-xl transition-all shadow-lg"
                  >
                    <Key className="w-6 h-6" />
                  </button>
                </div>
                {settingsMessage && (
                  <p className="text-xs font-bold uppercase tracking-widest text-[#934517]">{settingsMessage}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
