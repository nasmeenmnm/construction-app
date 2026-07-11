"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Advanced Financial State
  const [availableBalance, setAvailableBalance] = useState(0);
  const [myOutOfPocket, setMyOutOfPocket] = useState(0);
  const [pendingBills, setPendingBills] = useState(0);
  const [teamDebts, setTeamDebts] = useState<any[]>([]); // Tracks who is out of pocket
  
  // Ledgers
  const [activeTab, setActiveTab] = useState<'myLedger' | 'teamLedger'>('myLedger');
  const [myTransactions, setMyTransactions] = useState<any[]>([]);
  const [teamTransactions, setTeamTransactions] = useState<any[]>([]);

  // Modals State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseProject, setExpenseProject] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");

  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("worker");
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectBudget, setProjectBudget] = useState("");
  
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRecipient, setTransferRecipient] = useState("");

  // Modals State
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newDashboardPassword, setNewDashboardPassword] = useState("");

  const router = useRouter();
  const supabase = createClient();

  const fetchDashboardData = useCallback(async (currentUserId: string, currentRole: string) => {
    // 1. Fetch Team (Subordinates)
    const { data: teamData } = await supabase
      .from('profiles')
      .select('id, name, role, created_at')
      .neq('id', currentUserId);
    
    let teamIds: string[] = [];
    let tempTeamBalances: Record<string, { id: string, name: string, role: string, balance: number }> = {};
    
    if (teamData) {
      setTeamMembers(teamData);
      teamData.forEach(t => {
        teamIds.push(t.id);
        tempTeamBalances[t.id] = { id: t.id, name: t.name, role: t.role, balance: 0 };
      });
    }

    // 2. Fetch Projects
    const { data: projectData } = await supabase.from('projects').select('*');
    if (projectData) setProjects(projectData);

    // 3. Fetch Transactions for Ledgers & Math
    const { data: txData } = await supabase
      .from('transactions')
      .select('*, sender:profiles!transactions_sender_id_fkey(name), receiver:profiles!transactions_receiver_id_fkey(name)')
      .order('created_at', { ascending: false });
    
    if (txData) {
      let myCalculatedBalance = 0;
      let pendingCount = 0;
      const myTx: any[] = [];
      const teamTx: any[] = [];

      txData.forEach(tx => {
        const amount = Number(tx.amount);
        const isSender = tx.sender_id === currentUserId;
        const isReceiver = tx.receiver_id === currentUserId;
        
        // --- Populate Ledgers ---
        if (isSender || isReceiver) myTx.push(tx);
        
        if (teamIds.includes(tx.sender_id) && !isReceiver) {
          teamTx.push(tx);
          if (tx.status === 'pending') pendingCount++;
        }

        // --- Calculate MY Balance ---
        if (currentRole === 'owner') {
          if (isSender) myCalculatedBalance -= amount; // Owner tracks total disbursed (negative)
        } else {
          if (isReceiver && tx.status === 'approved') myCalculatedBalance += amount;
          if (isSender) myCalculatedBalance -= amount; // Deduct money spent
        }

        // --- Calculate TEAM Balances (To find out who is Out-of-Pocket) ---
        if (tempTeamBalances[tx.receiver_id] && tx.status === 'approved') {
          tempTeamBalances[tx.receiver_id].balance += amount;
        }
        if (tempTeamBalances[tx.sender_id]) {
          tempTeamBalances[tx.sender_id].balance -= amount;
        }
      });
      
      setMyTransactions(myTx);
      setTeamTransactions(teamTx);
      setPendingBills(pendingCount);

      // Handle My Pocket Math
      if (myCalculatedBalance < 0 && currentRole !== 'owner') {
        setMyOutOfPocket(Math.abs(myCalculatedBalance));
        setAvailableBalance(0);
      } else {
        setMyOutOfPocket(0);
        setAvailableBalance(myCalculatedBalance);
      }

      // Filter Team Balances to find people in debt (balance < 0)
      const debts = Object.values(tempTeamBalances).filter(member => member.balance < 0);
      setTeamDebts(debts);
    }
  }, [supabase]);

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/"); 
      
      setUserId(user.id);
      setUserEmail(user.email ?? "Unknown Email");

      // ADDED: Fetch is_first_login flag
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name, is_first_login')
        .eq('id', user.id)
        .single();

      if (profile) {
        // SECURITY CHECK: Force password reset if true
        if (profile.is_first_login) {
          router.push("/update-password");
          return; 
        }

        setUserRole(profile.role);
        setUserName(profile.name);
        await fetchDashboardData(user.id, profile.role);
      }
      setLoading(false);
    };
    initialize();
  }, [router, supabase, fetchDashboardData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // --- RESTORED HANDLERS ---
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail, password: newMemberPassword, name: newMemberName, role: newMemberRole, parent_id: userId }),
      });
      if (response.ok) {
        setIsAddMemberModalOpen(false);
        setNewMemberName(""); setNewMemberEmail(""); setNewMemberPassword("");
        fetchDashboardData(userId!, userRole!);
      } else {
        const result = await response.json();
        alert(`Error: ${result.error}`);
      }
    } catch (error) { alert("Network error."); }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('projects').insert({ name: projectName, budget: Number(projectBudget), manager_id: userId });
    if (!error) {
      setIsProjectModalOpen(false);
      setProjectName(""); setProjectBudget("");
      fetchDashboardData(userId!, userRole!);
    }
  };

  const handleTransferFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('transactions').insert({
      amount: Number(transferAmount), sender_id: userId, receiver_id: transferRecipient, status: 'approved' 
    });
    if (!error) {
      setIsTransferModalOpen(false);
      setTransferAmount(""); setTransferRecipient("");
      fetchDashboardData(userId!, userRole!);
    }
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalStatus = (userRole === 'owner' || userRole === 'supervisor') ? 'approved' : 'pending';
    const { error } = await supabase.from('transactions').insert({
      amount: Number(expenseAmount), description: expenseDescription, sender_id: userId, project_id: expenseProject === "overhead" ? null : expenseProject, status: finalStatus 
    });
    if (!error) {
      setIsExpenseModalOpen(false);
      setExpenseAmount(""); setExpenseProject(""); setExpenseDescription("");
      fetchDashboardData(userId!, userRole!);
      alert(finalStatus === 'pending' ? "Expense logged and pending approval!" : "Expense logged and approved.");
    }
  };

  const handleApproveExpense = async (transactionId: string) => {
    const { error } = await supabase.from('transactions').update({ status: 'approved' }).eq('id', transactionId);
    if (!error) fetchDashboardData(userId!, userRole!);
  };
  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newDashboardPassword.length < 6) return alert("Password must be at least 6 characters.");
      
      const { error } = await supabase.auth.updateUser({ password: newDashboardPassword });
      if (!error) {
        alert("Password updated successfully!");
        setIsChangePasswordModalOpen(false);
        setNewDashboardPassword("");
      } else {
        alert(error.message);
      }
    };
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-red-600"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        
        <header className="mb-8 flex flex-col items-start justify-between rounded-xl border-t-4 border-red-600 bg-white p-6 shadow-2xl sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">COMPANY<span className="text-red-600">PORTAL</span></h1>
            <p className="mt-1 text-sm text-zinc-500">Welcome back, <span className="font-semibold text-zinc-800">{userName}</span></p>
            <span className="mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase text-red-800">{userRole}</span>
          </div>
          <div className="mt-4 flex gap-2 sm:mt-0">
            <button onClick={() => setIsChangePasswordModalOpen(true)} className="rounded-md border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-zinc-700 transition-all hover:bg-zinc-50 focus:outline-none">
              Change Password
            </button>
            <button onClick={handleSignOut} className="rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-zinc-700 transition-all hover:bg-red-50 hover:text-red-700 focus:outline-none">
              Sign Out
            </button>
          </div> </header>

        {/* --- ADVANCED ANALYTICS GRID --- */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              {userRole === 'owner' ? 'Total Disbursed' : 'Available Balance'}
            </h3>
            <p className="mt-2 text-3xl font-bold text-white">Rs. {Math.abs(availableBalance).toLocaleString()}</p>
          </div>
          
          {/* DYNAMIC OUT OF POCKET CARD */}
          <div className={`rounded-xl border ${(myOutOfPocket > 0 || teamDebts.length > 0) ? 'border-red-600 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'} p-6 shadow-lg`}>
            <h3 className={`text-sm font-semibold uppercase tracking-wider ${(myOutOfPocket > 0 || teamDebts.length > 0) ? 'text-red-400' : 'text-zinc-400'}`}>
              Out of Pocket (Reimbursements)
            </h3>
            
            {/* Show MY debt if I am a worker/supervisor */}
            {myOutOfPocket > 0 && (
              <p className="mt-2 text-2xl font-bold text-red-500">I am owed: Rs. {myOutOfPocket.toLocaleString()}</p>
            )}

            {/* Show TEAM debts if I am Owner/Supervisor */}
            {teamDebts.length > 0 && (
              <div className="mt-4 border-t border-red-900/50 pt-4">
                <p className="mb-2 text-xs font-bold text-red-500 uppercase">Team Members Owed:</p>
                {teamDebts.map(debt => (
                  <div key={debt.id} className="flex justify-between text-sm text-white mb-1">
                    <span>{debt.name} <span className="text-zinc-500">({debt.role})</span></span>
                    <span className="font-bold text-red-400">Rs. {Math.abs(debt.balance).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            
            {myOutOfPocket === 0 && teamDebts.length === 0 && (
              <p className="mt-2 text-3xl font-bold text-white">Rs. 0</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Pending Approvals</h3>
            <p className={`mt-2 text-3xl font-bold ${pendingBills > 0 ? 'text-red-500' : 'text-zinc-500'}`}>{pendingBills}</p>
          </div>
        </div>

        {/* --- QUICK ACTIONS (RESTORED BUTTONS) --- */}
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-white">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            
            {(userRole === 'owner' || userRole === 'supervisor') && (
              <>
                <button onClick={() => setIsAddMemberModalOpen(true)} className="rounded bg-zinc-800 px-4 py-2 font-semibold text-white transition hover:bg-zinc-700">
                  + Add Team Member
                </button>
                <button onClick={() => setIsProjectModalOpen(true)} className="rounded bg-zinc-800 px-4 py-2 font-semibold text-white transition hover:bg-zinc-700">
                  + Create Project
                </button>
                <button onClick={() => setIsTransferModalOpen(true)} className="rounded bg-zinc-800 px-4 py-2 font-semibold text-white transition hover:bg-zinc-700">
                  Allocate Funds
                </button>
              </>
            )}

            <button onClick={() => setIsExpenseModalOpen(true)} className="rounded bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700">
              + Log Expense (Bill)
            </button>
          </div>
        </div>

        {/* --- DUAL LEDGER SYSTEM --- */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 shadow-lg overflow-hidden">
          <div className="flex border-b border-zinc-800 bg-zinc-950">
            <button onClick={() => setActiveTab('myLedger')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'myLedger' ? 'border-b-2 border-red-600 text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
              My Ledger
            </button>
            {(userRole === 'owner' || userRole === 'supervisor') && (
              <button onClick={() => setActiveTab('teamLedger')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'teamLedger' ? 'border-b-2 border-red-600 text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Team Ledger
                {pendingBills > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] text-white">{pendingBills}</span>}
              </button>
            )}
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Description</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    {activeTab === 'teamLedger' && <th className="px-6 py-4 font-medium">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {(activeTab === 'myLedger' ? myTransactions : teamTransactions).map((tx) => (
                    <tr key={tx.id} className="transition-colors hover:bg-zinc-800/50">
                      <td className="px-6 py-4 text-zinc-400">{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{tx.description || "No description"}</p>
                        <p className="text-xs text-zinc-500">
                          {activeTab === 'myLedger' ? (tx.sender_id === userId ? 'Spent by me' : `Received from ${tx.sender?.name}`) : `Logged by ${tx.sender?.name}`}
                        </p>
                      </td>
                      <td className={`px-6 py-4 font-bold ${tx.sender_id === userId ? 'text-zinc-300' : 'text-green-500'}`}>
                        {tx.sender_id === userId ? '-' : '+'}Rs. {tx.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tx.status === 'approved' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                          {tx.status}
                        </span>
                      </td>
                      {activeTab === 'teamLedger' && (
                        <td className="px-6 py-4">
                          {tx.status === 'pending' && (
                            <button onClick={() => handleApproveExpense(tx.id)} className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700">Approve</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {(activeTab === 'myLedger' ? myTransactions : teamTransactions).length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center italic text-zinc-500">No transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}
      
      {/* 1. Log Expense */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Log Expense</h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-zinc-400 hover:text-red-600">✕</button>
            </div>
            <form onSubmit={handleLogExpense} className="space-y-4">
              <select required value={expenseProject} onChange={(e) => setExpenseProject(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:border-red-600 focus:outline-none">
                <option value="" disabled>Select Cost Center...</option>
                <option value="overhead">General Overhead (No Project)</option>
                {projects.map(proj => <option key={proj.id} value={proj.id}>{proj.name}</option>)}
              </select>
              <input type="number" required value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:border-red-600 focus:outline-none" placeholder="Total Amount (Rs.)" />
              <textarea required value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:border-red-600 focus:outline-none" placeholder="Description (e.g., 5 bags of cement)" rows={3} />
              <button type="submit" className="w-full rounded bg-red-600 py-3 font-bold text-white hover:bg-red-700">
                {userRole === 'worker' ? 'Submit for Approval' : 'Log Approved Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Member */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Add New Member</h2>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="text-zinc-400 hover:text-red-600">✕</button>
            </div>
            <form onSubmit={handleCreateMember} className="space-y-4">
              <input type="text" required value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none" placeholder="Full Name" />
              <input type="email" required value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none" placeholder="Email Address" />
              <input type="text" required minLength={6} value={newMemberPassword} onChange={(e) => setNewMemberPassword(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none" placeholder="Temp Password (Min 6)" />
              <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none">
                <option value="supervisor">Supervisor</option>
                <option value="worker">Worker</option>
              </select>
              <button type="submit" className="w-full rounded bg-zinc-900 py-3 font-bold text-white hover:bg-zinc-800">Create Account</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Project */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Create Project</h2>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-zinc-400 hover:text-red-600">✕</button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <input type="text" required value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none" placeholder="Project Name" />
              <input type="number" required value={projectBudget} onChange={(e) => setProjectBudget(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none" placeholder="Estimated Budget (Rs.)" />
              <button type="submit" className="w-full rounded bg-zinc-900 py-3 font-bold text-white hover:bg-zinc-800">Initialize Project</button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Allocate Funds */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Allocate Funds</h2>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-zinc-400 hover:text-red-600">✕</button>
            </div>
            <form onSubmit={handleTransferFunds} className="space-y-4">
              <select required value={transferRecipient} onChange={(e) => setTransferRecipient(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none">
                <option value="" disabled>Select Recipient...</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
                ))}
              </select>
              <input type="number" required value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none" placeholder="Amount (Rs.)" />
              <button type="submit" className="w-full rounded bg-zinc-900 py-3 font-bold text-white hover:bg-zinc-800">Send Funds</button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Change Password Modal */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Change Password</h2>
              <button onClick={() => setIsChangePasswordModalOpen(false)} className="text-zinc-400 hover:text-red-600">✕</button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" required minLength={6} value={newDashboardPassword} onChange={(e) => setNewDashboardPassword(e.target.value)} className="w-full rounded border p-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-600" placeholder="Enter New Password" />
              <button type="submit" className="w-full rounded bg-zinc-900 py-3 font-bold text-white hover:bg-zinc-800">Update Securely</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}