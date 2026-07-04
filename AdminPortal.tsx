import React, { useState, useEffect } from 'react';
import { Download, Search, Lock, Users, Calendar, Award, RefreshCw, ChevronLeft, LogOut, Check, Star, Filter, Eye, X } from 'lucide-react';
import logo from './logo.png';
import hmgLogo from './hmg.png';
import mepLogo from './mep.png';
import { JOURNEY_DATA, JOURNEY_DATA_AR } from './constants';

interface Lead {
  id: string;
  created_at: string;
  name: string;
  mobile_number: string;
  email: string;
  mrn?: string;
  selected_items_count: number;
  selected_items?: string[];
  stage: string;
  language: string;
  city?: string;
}

export const AdminPortal: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  
  // Modal / Detail viewing state
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<Lead | null>(null);

  // Date filter state
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  const [fetchError, setFetchError] = useState<string | null>(null);

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
    setFetchError(null);
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase config is missing");
      setFetchError("Supabase configuration environment variables are missing on the server.");
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
        const errText = await response.text();
        console.error("Failed to fetch leads:", errText);
        setFetchError(`Database API returned error (${response.status}): ${errText || response.statusText}`);
      }
    } catch (err: any) {
      console.error("Error communicating with database:", err);
      setFetchError(`Network error communicating with database: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const getDetailedCheckedItemsList = (lead: Lead) => {
    if (!lead.selected_items || lead.selected_items.length === 0) return 'None';
    
    // Choose dataset matching lead language choice
    const masterChecklist = lead.language === 'ar' 
      ? JOURNEY_DATA_AR.flatMap(m => m.checklist) 
      : JOURNEY_DATA.flatMap(m => m.checklist);

    // Map lead's selected string IDs to their descriptive product names
    const resolvedItemNames = lead.selected_items.map(itemId => {
      const match = masterChecklist.find(item => item.id === itemId);
      return match ? match.name : itemId;
    });

    return resolvedItemNames.join('; ');
  };

  const exportToCSV = () => {
    if (leads.length === 0) return;
    
    // Define columns: Each selected item gets its own row!
    const headers = [
      'Lead UUID', 
      'Date Created', 
      "Mom's Name", 
      'Mobile Number', 
      'Email Address', 
      'Medical Record Number (MRN)', 
      'Target Stage', 
      'User Language', 
      'Approx City', 
      'Product ID Code', 
      'Product Name Description', 
      'Product Category'
    ];
    const csvRows = [headers.join(',')];

    leads.forEach(lead => {
      const id = lead.id || '';
      const dateCreated = lead.created_at ? new Date(lead.created_at).toLocaleString().replace(/,/g, ' ') : '';
      const name = (lead.name || 'Valued Customer').replace(/"/g, '""');
      const mobile = (lead.mobile_number || '').replace(/"/g, '""');
      const email = (lead.email || '').replace(/"/g, '""');
      const mrnVal = (lead.mrn || '').replace(/"/g, '""');
      const targetStage = (lead.stage || '').replace(/"/g, '""');
      const userLang = lead.language || '';
      const approxCity = (lead.city || '').replace(/"/g, '""');

      const masterChecklist = lead.language === 'ar' 
        ? JOURNEY_DATA_AR.flatMap(m => m.checklist) 
        : JOURNEY_DATA.flatMap(m => m.checklist);

      if (!lead.selected_items || lead.selected_items.length === 0) {
        // If a user submitted without choosing any items, export one blank product row
        const row = [
          `"${id}"`,
          `"${dateCreated}"`,
          `"${name}"`,
          `"${mobile}"`,
          `"${email}"`,
          `"${mrnVal}"`,
          `"${targetStage}"`,
          `"${userLang}"`,
          `"${approxCity}"`,
          '""',
          '"No products selected"',
          '""'
        ];
        csvRows.push(row.join(','));
      } else {
        // Create an individual row for every single checked product
        lead.selected_items.forEach(itemId => {
          const match = masterChecklist.find(item => item.id === itemId);
          const pNameDesc = match ? match.name : itemId;
          const pCategory = match ? match.category : 'Unknown';

          const row = [
            `"${id}"`,
            `"${dateCreated}"`,
            `"${name}"`,
            `"${mobile}"`,
            `"${email}"`,
            `"${mrnVal}"`,
            `"${targetStage}"`,
            `"${userLang}"`,
            `"${approxCity}"`,
            `"${itemId}"`,
            `"${pNameDesc.replace(/"/g, '""')}"`,
            `"${pCategory.replace(/"/g, '""')}"`
          ];
          csvRows.push(row.join(','));
        });
      }
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
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-emerald-100/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-100 shrink-0">
                <img src={hmgLogo} alt="HMG Logo" className="h-12 w-12 md:h-16 md:w-16 object-contain" />
                <div className="h-8 md:h-10 w-0.5 bg-emerald-100/50 mx-1 md:mx-2"></div>
                <img src={mepLogo} alt="MEP Logo" className="h-12 w-12 md:h-16 md:w-16 object-contain" />
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-serif font-black text-emerald-950 leading-tight">
                  Mom & Baby Journey Leads
                </h1>
                <p className="text-emerald-900/65 font-bold uppercase tracking-wider text-[9px] md:text-[10px] mt-1">Dr.Sulaiman Al Habib Medical Group | Administration Portal</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 w-full lg:flex lg:w-auto">
              <button 
                onClick={fetchLeads} 
                className="px-3 md:px-5 py-2.5 md:py-3 border border-emerald-100 rounded-xl hover:border-emerald-900 hover:bg-emerald-50/20 transition-all flex items-center justify-center gap-1.5 text-[10px] md:text-xs uppercase tracking-wider font-bold text-emerald-900"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button 
                onClick={exportToCSV}
                className="px-3 md:px-5 py-2.5 md:py-3 bg-emerald-900 text-white rounded-xl hover:bg-emerald-950 transition-all shadow-md flex items-center justify-center gap-1.5 text-[10px] md:text-xs uppercase tracking-wider font-bold"
              >
                <Download size={12} />
                <span>Export CSV</span>
              </button>
              <button 
                onClick={() => {
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="px-3 md:px-5 py-2.5 md:py-3 border border-red-100 rounded-xl text-red-600 hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-1.5 text-[10px] md:text-xs uppercase tracking-wider font-bold"
              >
                <LogOut size={12} />
                <span>Exit</span>
              </button>
            </div>
          </div>

          {/* Filters Bar at the Top (Moved above Metrics Row!) */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center bg-emerald-50/70 p-4 md:p-5 rounded-3xl border-2 border-emerald-900/60 gap-4 md:gap-6 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-900" size={16} />
              <input 
                type="text"
                placeholder="Search leads by name, phone or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-emerald-900/40 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-900 text-sm font-bold text-emerald-950 placeholder:text-emerald-900/40"
              />
            </div>

            {/* Calendar Range Picker */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-2.5 rounded-2xl border border-emerald-900/40">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-900 uppercase tracking-widest pl-1.5">
                <Calendar size={14} className="text-emerald-900 stroke-[3]" />
                <span>Date Range:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input 
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="bg-[#faf8f5] border border-emerald-900/30 rounded-lg px-3 py-1.5 font-bold text-xs text-emerald-950 outline-none focus:border-emerald-900 cursor-pointer flex-1 sm:flex-initial"
                />
                <span className="text-xs font-bold text-emerald-900">to</span>
                <input 
                  type="date"
                  value={endDateStr}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  className="bg-[#faf8f5] border border-emerald-900/30 rounded-lg px-3 py-1.5 font-bold text-xs text-emerald-950 outline-none focus:border-emerald-900 cursor-pointer flex-1 sm:flex-initial"
                />
              </div>
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

            <div className="flex items-center gap-4 w-full lg:w-auto">
              <span className="text-xs font-black text-emerald-900 uppercase tracking-widest whitespace-nowrap">Filtered Stage:</span>
              <select 
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-white border-2 border-emerald-900/40 rounded-xl px-4 py-2.5 font-black text-xs uppercase tracking-wider text-emerald-900 outline-none focus:border-emerald-900 cursor-pointer w-full lg:w-auto"
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
          {fetchError && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-3 text-sm font-semibold transition-all">
              <span className="font-extrabold uppercase text-[10px] tracking-wider bg-red-100 text-red-800 px-3 py-1 rounded-md shrink-0">FETCH ERROR</span>
              <p className="flex-1">{fetchError}</p>
              <button 
                onClick={fetchLeads} 
                className="text-xs bg-red-100 hover:bg-red-200 text-red-800 py-1.5 px-4 rounded-xl font-bold uppercase transition-all"
              >
                Retry Request
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-emerald-50/50 border-2 border-emerald-900/60 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-black text-emerald-900 uppercase tracking-widest block">Total Registrations (Filtered)</span>
              <div className="text-4xl font-black text-emerald-950">{filteredLeads.length}</div>
            </div>
            <div className="bg-emerald-50/50 border-2 border-emerald-900/60 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-black text-emerald-900 uppercase tracking-widest block">Today's Leads (Filtered)</span>
              <div className="text-4xl font-black text-emerald-950">
                {filteredLeads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length}
              </div>
            </div>
            <div className="bg-emerald-50/50 border-2 border-emerald-900/60 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-black text-emerald-900 uppercase tracking-widest block">Total Products Checked</span>
              <div className="text-4xl font-black text-emerald-950">
                {filteredLeads.reduce((acc, curr) => acc + (curr.selected_items_count || 0), 0)}
              </div>
            </div>
            <div className="bg-emerald-50/50 border-2 border-emerald-900/60 p-6 rounded-3xl shadow-sm space-y-1">
              <span className="text-[11px] font-black text-emerald-900 uppercase tracking-widest block">Average Checked Products</span>
              <div className="text-4xl font-black text-emerald-950">
                {filteredLeads.length > 0 ? (filteredLeads.reduce((acc, curr) => acc + curr.selected_items_count, 0) / filteredLeads.length).toFixed(1) : 0}
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
                    <tr className="bg-emerald-50/70 text-emerald-950 border-b-2 border-emerald-900/40 text-[11px] tracking-widest uppercase font-black">
                      <th className="py-5 px-6 font-black text-emerald-950">Timestamp</th>
                      <th className="py-5 px-6 font-black text-emerald-dark">Mom Name</th>
                      <th className="py-5 px-6 font-black text-emerald-dark">MRN</th>
                      <th className="py-5 px-6 font-black text-emerald-dark">Mobile Number</th>
                      <th className="py-5 px-6 font-black text-emerald-dark">Email Address</th>
                      <th className="py-5 px-6 shrink-0 font-black text-emerald-dark">Stage Scope</th>
                      <th className="py-5 px-6 font-black text-emerald-dark">Approx City</th>
                      <th className="py-5 px-6 text-center font-black text-emerald-dark">Items Saved</th>
                      <th className="py-5 px-6 text-center font-black text-emerald-dark">Lang</th>
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
                        <td className="py-4 px-6 text-center text-emerald-900 font-bold font-mono">
                          <button
                            onClick={() => setSelectedLeadDetails(lead)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 py-1.5 px-3 rounded-xl border border-emerald-100 font-bold text-xs inline-flex items-center gap-1.5 transition-all"
                          >
                            <Eye size={12} />
                            <span>{lead.selected_items_count} products</span>
                          </button>
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

      {/* Selected Products Detail Modal */}
      {selectedLeadDetails && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 bg-emerald-950/40 backdrop-blur-md" onClick={() => setSelectedLeadDetails(null)}>
          <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-emerald-100 shadow-2xl max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-emerald-100/60 pb-4 md:pb-5 mb-5 md:mb-6">
              <div>
                <span className="text-[9px] font-black text-emerald-950/40 uppercase tracking-widest block">Detailed Checklist Selection</span>
                <h3 className="text-lg md:text-xl font-bold text-emerald-dark font-sans tracking-tight">
                  {selectedLeadDetails.name || 'Valued Customer'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLeadDetails(null)}
                className="w-8 h-8 md:w-10 md:h-10 bg-emerald-50 text-emerald-900 border border-emerald-100/50 hover:bg-emerald-100 hover:text-emerald-950 rounded-full flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] md:max-h-[50vh] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
              {!selectedLeadDetails.selected_items || selectedLeadDetails.selected_items.length === 0 ? (
                <div className="text-center font-bold text-xs uppercase text-emerald-950/40 py-10 tracking-widest">
                  No products checked on this registration.
                </div>
              ) : (
                (() => {
                  const masterChecklist = selectedLeadDetails.language === 'ar' 
                    ? JOURNEY_DATA_AR.flatMap(m => m.checklist) 
                    : JOURNEY_DATA.flatMap(m => m.checklist);

                  const resolvedItems = selectedLeadDetails.selected_items.map(itemId => {
                    const match = masterChecklist.find(item => item.id === itemId);
                    return match || { id: itemId, name: itemId, category: 'Unknown', description: 'Selected code descriptor' };
                  });

                  // Group by category
                  const grouped: { [key: string]: typeof resolvedItems } = {};
                  resolvedItems.forEach(item => {
                    if (!grouped[item.category]) grouped[item.category] = [];
                    grouped[item.category].push(item);
                  });

                  return Object.keys(grouped).map(category => (
                    <div key={category} className="space-y-2 pb-2 mr-1">
                      <span className="text-[10px] font-black text-emerald-800/80 uppercase tracking-wider block font-sans">
                        {category}
                      </span>
                      <div className="space-y-2">
                        {grouped[category].map(item => (
                          <div key={item.id} className="bg-emerald-50/20 border border-emerald-50/50 rounded-2xl p-3 md:p-4 flex items-start gap-2.5 md:gap-3">
                            <div className="mt-0.5 w-4 h-4 bg-emerald-100 text-emerald-900 rounded-full flex items-center justify-center flex-shrink-0">
                              <Check size={10} className="stroke-[3]" />
                            </div>
                            <div>
                              <h4 className="text-xs md:text-sm font-semibold font-sans text-emerald-950 leading-tight">
                                {item.name}
                              </h4>
                              <p className="text-[11px] md:text-xs text-emerald-950/60 font-sans italic mt-1 font-light">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>

            <div className="mt-6 md:mt-8 pt-4 md:pt-5 border-t border-emerald-100/60 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center text-[9px] md:text-[10px] font-bold text-emerald-950/50 uppercase tracking-widest">
              <span>Mobile: {selectedLeadDetails.mobile_number}</span>
              <span>Total: {selectedLeadDetails.selected_items_count} items</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
