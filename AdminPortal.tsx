import React, { useState, useEffect } from 'react';
import { Download, Search, Lock, Users, Calendar, Award, RefreshCw, ChevronLeft, LogOut, Check, Star, Filter } from 'lucide-react';
import logo from './logo.png';
import hmgLogo from './hmg.png';
import mepLogo from './mep.png';

interface Lead {
  id: string;
  created_at: string;
  name: string;
  mobile_number: string;
  email: string;
  mrn?: string;
  selected_items_count: number;
  stage: string;
  language: string;
  city?: string;
  exact_address?: string;
}

export const AdminPortal: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  
  // Date filter state
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'habib2026';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === adminPassword) {
      setIsAuthenticated(true);
      setError('');
      fetchLeads();
    } else {
      setError('Incorrect administration credentials. Please try again.');
    }
  };

  const fetchLeads = async () => {
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase config is missing");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/leads?order=created_at.desc`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      } else {
        console.error("Failed to fetch leads");
      }
    } catch (err) {
      console.error("Error communicating with database:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (leads.length === 0) return;
    
    // Define columns
    const headers = ['ID', 'Date Created', "Mom's Name", 'Mobile Number', 'Email Address', 'Medical Record Number (MRN)', 'Selected Products Count', 'Target Stage', 'User Language', 'Approx City', 'Exact Address'];
    const csvRows = [headers.join(',')];

    leads.forEach(lead => {
      // Clean and sanitize text fields to prevent CSV formatting shifting
      const id = lead.id || '';
      const dateCreated = lead.created_at ? new Date(lead.created_at).toLocaleString().replace(/,/g, ' ') : '';
      const name = (lead.name || 'Valued Customer').replace(/"/g, '""');
      const mobile = (lead.mobile_number || '').replace(/"/g, '""');
      const email = (lead.email || '').replace(/"/g, '""');
      const mrnVal = (lead.mrn || '').replace(/"/g, '""');
      const itemsCount = lead.selected_items_count || 0;
      const targetStage = (lead.stage || '').replace(/"/g, '""');
      const userLang = lead.language || '';
      const approxCity = (lead.city || '').replace(/"/g, '""');
      const exactAddr = (lead.exact_address || '').replace(/"/g, '""');

      const row = [
        `"${id}"`,
        `"${dateCreated}"`,
        `"${name}"`,
        `"${mobile}"`,
        `"${email}"`,
        `"${mrnVal}"`,
        itemsCount,
        `"${targetStage}"`,
        `"${userLang}"`,
        `"${approxCity}"`,
        `"${exactAddr}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = "\uFEFF" + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Al-Habib-Leads-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      (lead.name && lead.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.mobile_number && lead.mobile_number.includes(searchTerm)) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.mrn && lead.mrn.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;

    // Date range filter matching
    let matchesDate = true;
    const leadDate = new Date(lead.created_at);
    
    if (startDateStr) {
      const start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
      if (leadDate < start) matchesDate = false;
    }
    
    if (endDateStr) {
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      if (leadDate > end) matchesDate = false;
    }

    return matchesSearch && matchesStage && matchesDate;
  });

  return (
    <div className="min-h-screen bg-[#faf8f5] font-serif selection:bg-emerald-100 selection:text-emerald-900 text-emerald-950">
      {!isAuthenticated ? (
        // Login Gate
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3.5rem] border border-emerald-100/50 shadow-2xl shadow-emerald-900/10 max-w-md w-full text-center">
            <div className="mb-6 flex justify-center items-center gap-2 bg-white p-2 rounded-lg border border-emerald-100 max-w-[200px] mx-auto">
              <img src={hmgLogo} alt="HMG Logo" className="h-16 w-16 object-contain" />
              <div className="h-10 w-0.5 bg-emerald-100/50 mx-2"></div>
              <img src={mepLogo} alt="MEP Logo" className="h-16 w-16 object-contain" />
            </div>
            <h2 className="text-3xl font-serif font-black text-emerald-950 mb-2">Dr.Sulaiman Al Habib Medical Group</h2>
            <p className="text-emerald-900/60 font-medium text-sm tracking-wider uppercase mb-8">Campaign Administrator Access</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <input 
                  type="password"
                  placeholder="Enter Administrator Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-emerald-50/20 border-2 border-emerald-100 rounded-2xl py-4 px-6 focus:border-emerald-900 outline-none font-bold text-center text-lg placeholder:text-gray-300"
                />
              </div>
              {error && (
                <p className="text-xs text-red-600 font-bold">{error}</p>
              )}
              <button 
                type="submit"
                className="w-full py-4 bg-emerald-900 text-white font-bold rounded-2xl hover:bg-emerald-950 transition-all uppercase tracking-widest text-xs"
              >
                Authenticate
              </button>
            </form>
          </div>
        </div>
      ) : (
        // Dashboard
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-emerald-100/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-100">
                <img src={hmgLogo} alt="HMG Logo" className="h-16 w-16 object-contain" />
                <div className="h-10 w-0.5 bg-emerald-100/50 mx-2"></div>
                <img src={mepLogo} alt="MEP Logo" className="h-16 w-16 object-contain" />
              </div>
              <div>
                <h1 className="text-3xl font-serif font-black text-emerald-950 flex items-center gap-3">
                  <span>Mom & Baby Journey Leads</span>
                </h1>
                <p className="text-emerald-900/65 font-bold uppercase tracking-wider text-[10px] mt-1">Dr.Sulaiman Al Habib Medical Group | Administration Portal</p>
              </div>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={fetchLeads} 
                className="px-5 py-3 border-2 border-emerald-100 rounded-xl hover:border-emerald-900 hover:bg-emerald-50/20 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-bold text-emerald-900"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button 
                onClick={exportToCSV}
                className="px-5 py-3 bg-emerald-900 text-white rounded-xl hover:bg-emerald-950 transition-all shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-bold"
              >
                <Download size={14} />
                <span>Export CSV ({filteredLeads.length})</span>
              </button>
              <button 
                onClick={() => {
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="px-5 py-3 border-2 border-red-100 rounded-xl text-red-600 hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider font-bold"
              >
                <LogOut size={14} />
                <span>Exit Portal</span>
              </button>
            </div>
          </div>

          {/* Filters Bar at the Top (Moved above Metrics Row!) */}
          <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-white p-5 rounded-3xl border border-emerald-100/40 gap-6 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-900/40" size={16} />
              <input 
                type="text"
                placeholder="Search leads by name, phone or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-emerald-50/10 border border-emerald-100 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-900 text-sm font-bold text-emerald-950 placeholder:text-emerald-900/30"
              />
            </div>

            {/* Calendar Range Picker */}
            <div className="flex flex-wrap items-center gap-3 bg-emerald-50/20 p-2.5 rounded-2xl border border-emerald-100/40">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900/60 uppercase tracking-wider pl-1.5">
                <Calendar size={14} className="text-emerald-900/70" />
                <span>Date Range:</span>
              </div>
              <input 
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="bg-white border border-emerald-100 rounded-lg px-3 py-1.5 font-bold text-xs text-emerald-900 outline-none focus:border-emerald-900 cursor-pointer"
              />
              <span className="text-xs font-bold text-emerald-900/40">to</span>
              <input 
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="bg-white border border-emerald-100 rounded-lg px-3 py-1.5 font-bold text-xs text-emerald-900 outline-none focus:border-emerald-900 cursor-pointer"
              />
              {(startDateStr || endDateStr) && (
                <button 
                  onClick={() => {
                    setStartDateStr('');
                    setEndDateStr('');
                  }}
                  className="px-2 py-1 text-[10px] uppercase font-black tracking-wider text-red-600 hover:bg-red-50 rounded"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-emerald-900/60 uppercase tracking-wider whitespace-nowrap">Filtered Stage:</span>
              <select 
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-white border-2 border-emerald-100 rounded-xl px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-emerald-900 outline-none focus:border-emerald-900 cursor-pointer"
              >
                <option value="all">All Journey Stages</option>
                <option value="pre_pregnancy">Pre-Pregnancy</option>
                <option value="early_pregnancy">Early Pregnancy</option>
                <option value="late_pregnancy">Late Pregnancy</option>
                <option value="post_delivery">Postpartum & New Baby</option>
                <option value="infant_care">Infants Care</option>
                <option value="toddler_care">Toddlers Care</option>
              </select>
            </div>
          </div>

          {/* Metrics Row (Moved below filters, so it calculates based on current active filters!) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-emerald-100/40 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest block">Total Registrations (Filtered)</span>
              <div className="text-4xl font-black text-emerald-900">{filteredLeads.length}</div>
            </div>
            <div className="bg-white border border-emerald-100/40 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest block">Today's Leads (Filtered)</span>
              <div className="text-4xl font-black text-emerald-900">
                {filteredLeads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length}
              </div>
            </div>
            <div className="bg-white border border-emerald-100/40 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest block">Average Checked Products</span>
              <div className="text-4xl font-black text-emerald-900">
                {filteredLeads.length > 0 ? (filteredLeads.reduce((acc, curr) => acc + curr.selected_items_count, 0) / filteredLeads.length).toFixed(1) : 0}
              </div>
            </div>
            <div className="bg-white border border-emerald-100/40 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-950/40 uppercase tracking-widest block">Primary Language</span>
              <div className="text-4xl font-black text-emerald-900">
                {filteredLeads.length > 0 
                  ? filteredLeads.filter(l => l.language === 'ar').length >= filteredLeads.filter(l => l.language === 'en').length 
                    ? 'العربية' 
                    : 'English' 
                  : 'N/A'
                }
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-emerald-100/40 rounded-3xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-20 text-center text-emerald-900/65 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                <RefreshCw className="animate-spin" size={18} />
                <span>Loading leads dataset...</span>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-20 text-center text-emerald-900/40 font-bold uppercase tracking-widest text-xs">
                No campaign leads found matching current criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-emerald-50/30 text-emerald-950/50 border-b border-emerald-100/20 text-[10px] tracking-widest uppercase font-black">
                      <th className="py-5 px-6">Timestamp</th>
                      <th className="py-5 px-6">Mom Name</th>
                      <th className="py-5 px-6">MRN</th>
                      <th className="py-5 px-6">Mobile Number</th>
                      <th className="py-5 px-6">Email Address</th>
                      <th className="py-5 px-6 shrink-0">Stage Scope</th>
                      <th className="py-5 px-6">Approx City</th>
                      <th className="py-5 px-6">Exact Address</th>
                      <th className="py-5 px-6 text-center">Items Saved</th>
                      <th className="py-5 px-6 text-center">Lang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50/20">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-emerald-50/10 transition-colors text-xs font-bold text-emerald-950">
                        <td className="py-4 px-6 text-emerald-900/60 font-mono">
                          {new Date(lead.created_at).toLocaleDateString()} {new Date(lead.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="py-4 px-6 text-emerald-dark font-sans text-sm">{lead.name || <span className="text-gray-400 italic font-light">Valued Customer</span>}</td>
                        <td className="py-4 px-6 font-mono text-emerald-900">{lead.mrn || <span className="text-gray-300 font-light">—</span>}</td>
                        <td className="py-4 px-6 font-mono text-emerald-dark">{lead.mobile_number}</td>
                        <td className="py-4 px-6 text-emerald-900/60">{lead.email || <span className="text-gray-400 font-light italic">not provided</span>}</td>
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 bg-emerald-50/80 text-emerald-800 rounded-full text-[10px] tracking-wider uppercase font-black">
                            {lead.stage ? lead.stage.replace('_', ' ') : 'General'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-emerald-950">{lead.city || <span className="text-gray-400 font-light italic">not loaded</span>}</td>
                        <td className="py-4 px-6 text-xs font-serif italic text-emerald-800/80 max-w-xs truncate" title={lead.exact_address || ''}>
                          {lead.exact_address || <span className="text-gray-400 font-light not-italic">permission denied</span>}
                        </td>
                        <td className="py-4 px-6 text-center text-emerald-900 font-bold font-mono">
                          {lead.selected_items_count} products
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="uppercase font-extrabold text-[10px] px-2 py-0.5 bg-emerald-100 rounded text-emerald-900 font-mono">
                            {lead.language}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
