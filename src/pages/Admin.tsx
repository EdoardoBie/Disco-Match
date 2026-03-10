import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Question, Profile } from '@/types';
import { Plus, Trash2, ToggleLeft, ToggleRight, ArrowLeft, Users, Activity, Settings, LayoutDashboard, MessageSquare, Database, ShieldAlert, Key, X } from 'lucide-react';
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
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  
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

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    // Optimistic Update
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
      
    if (error) {
       console.error('Error updating user role:', error);
       alert('Errore durante l\'aggiornamento del ruolo.');
       fetchDashboardData(); // Revert on error
    }
    setSelectedUser(null);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo utente? Questa azione è irreversibile e cancellerà anche tutte le sue risposte e messaggi.')) return;
    
    // Optimistic Update
    setUsersList(prev => prev.filter(u => u.id !== userId));

    // Note: To fully delete an auth user requires service_role key or an RPC function bypassing RLS.
    // For now, deleting from 'profiles' will cascade to answers/messages, but the auth user remains.
    // Ideally, a secure RPC function should be used to delete the auth.user entirely.
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    
    if (error) {
       console.error('Error deleting user profile:', error);
       alert('Errore durante l\'eliminazione dell\'utente.');
       fetchDashboardData();
    }
    setSelectedUser(null);
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
      className="space-y-6 pb-20 w-full max-w-md mx-auto flex flex-col"
    >
      <header className="flex flex-col gap-4 pb-4 border-b border-white/10 w-full">
        <div className="flex flex-col items-center justify-center gap-2 text-center relative pt-2">
          <button 
            onClick={() => navigate('/dashboard')}
            className="absolute left-0 top-0 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-[#934517]">Dashboard Staff</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gestione e Analisi</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar w-full justify-start">
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
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6 w-full">
            <div className="grid grid-cols-1 gap-4">
              <StatCard icon={Users} label="Utenti Registrati" value={stats.users} />
              <StatCard icon={Activity} label="Risposte Totali" value={stats.answers} />
              <StatCard icon={Database} label="Domande Attive" value={stats.questions} />
            </div>
            
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl w-full">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6 text-center">Top 5 Domande più risposte</h2>
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
          <motion.div key="questions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6 w-full">
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl w-full">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 text-center">Crea Nuova Domanda</h2>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Testo della domanda..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[#934517] outline-none transition-all placeholder:text-zinc-700 text-center font-bold"
                />
                <div className="flex gap-2 w-full">
                  <select
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value as any)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 text-white text-xs font-bold uppercase tracking-widest focus:border-[#934517] outline-none text-center"
                  >
                    <option value="text">Testo</option>
                    <option value="choice">Scelta</option>
                    <option value="photo">Foto</option>
                  </select>
                  <button
                    onClick={handleCreateQuestion}
                    className="bg-[#934517] hover:bg-[#a65220] text-black p-4 rounded-xl transition-all shadow-lg flex items-center justify-center aspect-square"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 w-full">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 text-center">Gestione Domande</h2>
              <div className="flex flex-col gap-3">
                {questions.map((q) => (
                  <div 
                    key={q.id} 
                    className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center group hover:border-white/10 transition-all text-center gap-3"
                  >
                    <div>
                      <p className="font-bold text-lg leading-tight">{q.text}</p>
                      <div className="flex gap-2 mt-2 justify-center">
                        <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-zinc-400 font-black uppercase tracking-widest">{q.type}</span>
                        {!q.is_active && <span className="text-[10px] bg-red-500/20 px-2 py-1 rounded text-red-400 font-black uppercase tracking-widest">Disattivata</span>}
                      </div>
                    </div>
                    <div className="flex gap-3 justify-center w-full pt-3 border-t border-white/5">
                      <button 
                        onClick={() => toggleQuestionStatus(q.id, q.is_active)}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors flex flex-col items-center gap-1"
                      >
                        {q.is_active ? <ToggleRight className="text-[#934517] w-6 h-6" /> : <ToggleLeft className="text-zinc-700 w-6 h-6" />}
                      </button>
                      <div className="w-px bg-white/5"></div>
                      <button 
                        onClick={() => deleteQuestion(q.id)} 
                        className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-700 hover:text-red-400 transition-colors flex flex-col items-center gap-1"
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
          <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 w-full">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 text-center mb-4">Gestione Utenti</h2>
            <div className="flex flex-col gap-3">
              {usersList.map((u) => (
                <div key={u.id} className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 flex flex-col items-center justify-center gap-4 hover:border-white/20 transition-all">
                  <div className="flex flex-col items-center justify-center text-center gap-2 w-full">
                    <div className="w-16 h-16 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden font-black text-2xl uppercase relative">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-zinc-500">{u.nickname?.[0] || 'O'}</span>}
                      {u.role === 'admin' && (
                        <div className="absolute bottom-0 w-full h-1 bg-[#934517]" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg uppercase tracking-tight">{u.nickname || 'Ospite'}</h4>
                      <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest mt-1 block mx-auto w-fit ${u.role === 'admin' ? 'bg-[#934517]/20 text-[#934517]' : 'bg-white/10 text-zinc-400'}`}>
                        {u.role}
                      </span>
                    </div>
                  </div>
                  <div className="w-full pt-4 border-t border-white/5 flex justify-center">
                    <button 
                      onClick={() => setSelectedUser(u)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-zinc-400 hover:text-white flex items-center gap-2 font-bold uppercase tracking-widest text-xs w-full justify-center" 
                    >
                      <Settings className="w-4 h-4" />
                      Impostazioni Utente
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6 w-full">
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl space-y-6 w-full flex flex-col items-center text-center">
              <div className="flex flex-col items-center gap-3 border-b border-white/10 pb-4 w-full">
                <ShieldAlert className="w-8 h-8 text-[#934517]" />
                <h2 className="text-lg font-black uppercase tracking-tighter text-white">Sicurezza</h2>
              </div>
              
              <div className="space-y-4 w-full">
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Cambia Password Admin</label>
                <div className="flex flex-col gap-3 w-full">
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Nuova password..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[#934517] outline-none transition-all placeholder:text-zinc-700 text-center font-bold"
                  />
                  <button
                    onClick={handleUpdatePassword}
                    disabled={!newAdminPassword.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#934517] hover:bg-[#a65220] disabled:opacity-50 disabled:cursor-not-allowed text-black p-4 rounded-xl transition-all shadow-lg font-black uppercase tracking-widest text-xs"
                  >
                    <Key className="w-4 h-4" />
                    Aggiorna
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

      {/* USER SETTINGS MODAL */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1A1A] w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h3 className="font-black uppercase tracking-tighter text-lg">Impostazioni Utente</h3>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden font-black text-2xl uppercase">
                     {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <span className="text-zinc-500">{selectedUser.nickname?.[0] || 'O'}</span>}
                  </div>
                  <div>
                    <h4 className="font-bold text-xl uppercase tracking-tight">{selectedUser.nickname || 'Ospite'}</h4>
                    <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest mt-1 block w-fit ${selectedUser.role === 'admin' ? 'bg-[#934517]/20 text-[#934517]' : 'bg-white/10 text-zinc-400'}`}>
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Ruolo</label>
                    <div className="flex gap-2">
                       <button
                         onClick={() => handleUpdateUserRole(selectedUser.id, 'user')}
                         className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors ${selectedUser.role === 'user' ? 'bg-white/10 text-white border border-white/20' : 'bg-transparent text-zinc-500 border border-white/5 hover:bg-white/5'}`}
                       >
                         Utente
                       </button>
                       <button
                         onClick={() => handleUpdateUserRole(selectedUser.id, 'admin')}
                         className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors ${selectedUser.role === 'admin' ? 'bg-[#934517]/20 text-[#934517] border border-[#934517]/30' : 'bg-transparent text-zinc-500 border border-white/5 hover:bg-white/5'}`}
                       >
                         Admin
                       </button>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      onClick={() => handleDeleteUser(selectedUser.id)}
                      className="w-full py-4 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 border border-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Elimina Utente
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center mt-2 font-bold uppercase tracking-widest">
                       Attenzione: Eliminerà anche messaggi e risposte
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
