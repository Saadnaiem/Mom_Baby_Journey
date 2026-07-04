
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import logo from './logo.png';
import hmgLogo from './hmg.png';
import mepLogo from './mep.png';
import logoHMG from './logo HMG.png';
import webCoverImg from './web cover image.png';
import { 
  CheckCircle, 
  QrCode, 
  Stethoscope,
  Copy,
  Check,
  ShieldCheck,
  Printer,
  User,
  Phone,
  Mail,
  AlertCircle,
  Map,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Globe
} from 'lucide-react';
import { JOURNEY_DATA, JOURNEY_DATA_AR } from './constants';
import { MilestoneId } from './types';
import { translations } from './locales';
import { AdminPortal } from './AdminPortal';

const App: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [viewMode, setViewMode] = useState<'home' | 'details' | 'admin'>('home');
  const [activeStage, setActiveStage] = useState<MilestoneId>(MilestoneId.PRE_PREGNANCY);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // User details state
  const [momName, setMomName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [mrn, setMrn] = useState('');
  const [showError, setShowError] = useState(false);

  // Location / Geolocation state
  const [city, setCity] = useState<string>('');
  const [exactAddress, setExactAddress] = useState<string>('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>('');

  // Background silence IP lookup for City
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data && data.city) {
          setCity(data.city);
        }
      })
      .catch(() => {
        // Fallback silently if blocked/offline
        setCity('Riyadh');
      });
  }, []);

  // Hash-routing logic to detect admin portal view
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setViewMode('admin');
      } else {
        setViewMode('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial load check
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const journeyData = isRTL ? JOURNEY_DATA_AR : JOURNEY_DATA;
  const currentMilestone = journeyData.find(m => m.id === activeStage)!;

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const downloadPDF = async () => {
    if (!mobileNumber.trim()) {
      setShowError(true);
      setViewMode('home');
      setTimeout(() => {
        const element = document.getElementById('details-form');
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    setShowError(false);

    // If exact name is not collected yet (but user allowed / denied), trigger location popup
    if (!exactAddress && !showLocationModal) {
      setShowLocationModal(true);
      return;
    }

    sendLeadToDatabase();
    generatePDFDownloadFlow();
  };

  const sendLeadToDatabase = (forcedAddress?: string, retryWithoutNewFields = false) => {
    // Convert mrn value strictly to number if present
    const numericMrn = mrn ? parseFloat(mrn) : null;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const payload: any = retryWithoutNewFields ? {
          name: momName || null,
          mobile_number: mobileNumber,
          email: email || null,
          selected_items_count: selectedItems.size,
          selected_items: Array.from(selectedItems),
          stage: activeStage,
          language: lang
        } : {
          name: momName || null,
          mobile_number: mobileNumber,
          email: email || null,
          mrn: numericMrn,
          selected_items_count: selectedItems.size,
          selected_items: Array.from(selectedItems),
          stage: activeStage,
          language: lang,
          city: city || 'Riyadh',
          exact_address: forcedAddress !== undefined ? forcedAddress : (exactAddress || null)
        };

        // Fire and forget without holding back the user flow - fully non-blocking!
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        fetch(`${supabaseUrl}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal' // Keep payload roundtrip small for instant execution
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }).then(async (res) => {
          clearTimeout(timeoutId);
          if (!res.ok) {
            const errDetails = await res.text();
            console.error(`Supabase Submission Failed (Status ${res.status}):`, errDetails);
            if (!retryWithoutNewFields) {
              console.warn("Retrying submission with default database columns fallback...");
              sendLeadToDatabase(forcedAddress, true);
            }
          } else {
            console.log("Lead successfully stored in Supabase!");
          }
        }).catch(err => {
          clearTimeout(timeoutId);
          console.error("Network error communicating with Supabase:", err);
          if (!retryWithoutNewFields) {
            sendLeadToDatabase(forcedAddress, true);
          }
        });
      } catch (e) {
        console.error("Database connection exception:", e);
      }
    }
  };

  const handleFetchExactLocation = () => {
    if (!navigator.geolocation) {
      const fallbackMsg = "Coordinates service unavailable";
      setExactAddress(fallbackMsg);
      setShowLocationModal(false);
      sendLeadForced(fallbackMsg);
      return;
    }

    setIsLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Perform premium free reverse-geocoding via OpenStreetMap Nominatim
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
            headers: {
              'Accept-Language': lang // fetch in matching user language perspective
            }
          });
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            
            // Extract highly specific building/hospital names first
            const buildingOrHospitalName = addr.hospital || addr.amenity || addr.building || addr.healthcare || addr.office || addr.shop || addr.hotel;
            const roadName = addr.road || '';
            const district = addr.suburb || addr.neighbourhood || addr.city_district || '';
            const cityName = addr.city || addr.town || addr.village || 'Riyadh';
            
            let displayName = '';
            if (buildingOrHospitalName) {
              // Highlight the specific building (e.g., Dr. Sulaiman Al Habib Hospital) followed by district/city
              displayName = buildingOrHospitalName;
              if (district) {
                displayName += ` (${district})`;
              } else if (cityName) {
                displayName += ` - ${cityName}`;
              }
            } else {
              // Fallback to standard street address if no specific landmark/building is found
              const streetDesc = roadName && district ? `${roadName}, ${district}` : (roadName || district || '');
              displayName = streetDesc ? `${streetDesc} - ${cityName}` : (data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }

            setExactAddress(displayName);
            setShowLocationModal(false);
            sendLeadForced(displayName);
          } else {
            throw new Error();
          }
        } catch {
          const fallbackCoords = `Coords: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setExactAddress(fallbackCoords);
          setShowLocationModal(false);
          sendLeadForced(fallbackCoords);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        // Do NOT close the modal, and do NOT download the file until permission is successfully provided!
        setLocationError(t.locationRequired);
      },
      { timeout: 7000 }
    );
  };

  const sendLeadForced = (forcedAddress: string) => {
    // We send payload asynchronously so we NEVER block the PDF generation
    sendLeadToDatabase(forcedAddress);
    generatePDFDownloadFlow();
  };

  const generatePDFDownloadFlow = () => {
    // Load logo image for PDF
    const img = new Image();
    img.src = logo;
    img.onload = () => {
      const doc = new jsPDF();
      
      const themeColor = [6, 78, 59] as const; // Emerald
      const goldColor = [180, 138, 40] as const;
      
      // --- HEADER SECTION ---
      // Logo
      const logoRatio = img.width / img.height;
      const logoHeight = 24;
      const logoWidth = logoHeight * logoRatio;
      doc.addImage(img, 'PNG', 15, 15, logoWidth, logoHeight);

      // Header Text
      const textStartX = 15 + logoWidth + 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18); 
      doc.setTextColor(...themeColor);
      doc.text("MOM AND BABY JOURNEY", textStartX, 25);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("PERSONALIZED ESSENTIALS CHECKLIST", textStartX, 32);

      // User Info Box
      doc.setFillColor(248, 250, 252); // Light Gray/Blueish background
      doc.setDrawColor(6, 78, 59); // Emerald border
      doc.setLineWidth(0.1);
      doc.roundedRect(15, 45, 180, 25, 3, 3, 'FD');
      
      // User Info Content
      doc.setFontSize(9);
      
      // Column 1: Prepared For
      doc.setTextColor(...themeColor);
      doc.setFont("helvetica", "bold");
      doc.text("PREPARED FOR", 25, 54);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(momName || "Valued Customer", 25, 62);
      if (mrn) doc.text(`MRN: ${mrn}`, 25, 67);
      
      // Column 2: Contact
      doc.setTextColor(...themeColor);
      doc.setFont("helvetica", "bold");
      doc.text("CONTACT DETAILS", 85, 54);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(mobileNumber, 85, 62);
      if (email) doc.text(email, 85, 67);
      
      // Column 3: Date
      doc.setTextColor(...themeColor);
      doc.setFont("helvetica", "bold");
      doc.text("GENERATED ON", 145, 54);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(new Date().toLocaleDateString(), 145, 62);
      doc.text(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 145, 67);

      let yOffset = 85;

      // --- CHECKLIST CONTENT ---
      if (selectedItems.size === 0) {
         doc.setFontSize(12);
         doc.setTextColor(100, 100, 100);
         doc.text("No essentials selected. Please select items to build your checklist.", 105, yOffset, { align: 'center' });
      } else {
         // Group items by Milestone for better organization
         JOURNEY_DATA.forEach(milestone => {
            const stageItems = milestone.checklist.filter(item => selectedItems.has(item.id));
            
            if (stageItems.length > 0) {
               // Check if we need a new page for the header + at least one item
               if (yOffset > 250) { 
                 doc.addPage(); 
                 yOffset = 20; 
               }
               
               // Section Header (Milestone Title)
               doc.setFillColor(...themeColor);
               doc.rect(15, yOffset, 180, 8, 'F');
               doc.setTextColor(255, 255, 255);
               doc.setFont("helvetica", "bold");
               doc.setFontSize(10);
               doc.text(`STAGE: ${milestone.title.toUpperCase()}`, 20, yOffset + 5.5);
               
               yOffset += 15;
               
               // Items in this section
               stageItems.forEach(item => {
                  // Check page break for item
                  // Estimate height based on description length
                  const descLines = doc.splitTextToSize(item.description, 130);
                  const itemHeight = 10 + (descLines.length * 4) + 5;
                  
                  if (yOffset + itemHeight > 280) { 
                    doc.addPage(); 
                    yOffset = 20; 
                    // Repeat section header on new page? Optional, but good for context.
                    // Simplified header for continuation
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150);
                    doc.text(`(Continuation: ${milestone.title})`, 15, yOffset - 5);
                  }
                  
                  // Item Name
                  doc.setTextColor(0, 0, 0);
                  doc.setFontSize(11);
                  doc.setFont("helvetica", "bold");
                  doc.text(item.name, 25, yOffset);
                  
                  // Category Badge (Right aligned)
                  doc.setFillColor(240, 240, 240);
                  doc.setDrawColor(200, 200, 200);
                  doc.roundedRect(155, yOffset - 4, 40, 6, 2, 2, 'FD');
                  doc.setTextColor(...themeColor);
                  doc.setFontSize(7);
                  doc.text(item.category.toUpperCase(), 175, yOffset, { align: 'center' });
                  
                  // Checkbox Icon (Visual - Empty for manual check)
                  doc.setDrawColor(...themeColor);
                  doc.setLineWidth(0.5);
                  doc.rect(16, yOffset - 3, 4, 4);
                  
                  // Description
                  yOffset += 5;
                  doc.setTextColor(80, 80, 80);
                  doc.setFontSize(9);
                  doc.setFont("helvetica", "normal");
                  doc.text(descLines, 25, yOffset);
                  
                  // Spacing for next item
                  yOffset += (descLines.length * 4) + 8;
                  
                  // Light separator line
                  doc.setDrawColor(230, 230, 230);
                  doc.line(25, yOffset - 4, 195, yOffset - 4);
               });
               
               yOffset += 5; // Extra gap after group
            }
         });
      }

      // --- FOOTER ---
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer Logo
        const footerLogoHeight = 10;
        const footerLogoWidth = footerLogoHeight * logoRatio;
        doc.addImage(img, 'PNG', 15, 282, footerLogoWidth, footerLogoHeight);

        // Footer Text
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Dr. Sulaiman Al Habib Medical Group", 105, 286, { align: 'center' });
        doc.text("Mom & Baby Journey Essentials", 105, 290, { align: 'center' });
        
        doc.text(`Page ${i} of ${totalPages}`, 195, 290, { align: 'right' });
      }
      
      doc.save(`Al-Habib-Journey-${mobileNumber}.pdf`);
    };
  };

  if (viewMode === 'admin') {
    return <AdminPortal />;
  }

  return (
    <div className="min-h-screen selection:bg-emerald-100 selection:text-emerald-900 bg-[#faf8f5]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Banner Cover Image */}
      <div className="w-full relative overflow-hidden bg-[#faf8f5]">
        <img 
          src={webCoverImg} 
          alt="Dr. Sulaiman Al Habib Mom & Baby Journey web cover banner" 
          className="w-full h-auto object-cover" 
        />
      </div>

      {/* 1. HEADER */}
      <header className="relative pt-16 pb-12 px-6 border-b border-gray-100 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center">
          {/* Logo & Title */}
          <div className="flex flex-col items-center">
            <h1 className="text-4xl md:text-5xl lg:text-5xl font-serif font-extrabold text-emerald tracking-tighter mb-4 leading-tight">
              {isRTL ? 'رحلة رعاية الأم والطفل مجموعة د.سليمان الحبيب الطبية' : 'Dr.Sulaiman Al Habib Mom & Baby Care Journey'}
            </h1>
            <p className="text-emerald-900 opacity-80 max-w-xl text-lg font-medium leading-relaxed">
              {t.tagline}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
             <button 
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} 
              className="flex items-center gap-2 px-6 py-3 border-2 border-emerald text-emerald rounded-full font-bold text-xs uppercase tracking-widest hover:bg-emerald hover:text-white transition-all whitespace-nowrap group"
            >
              <Globe size={18} className="group-hover:rotate-180 transition-transform duration-500" />
              <span>{lang === 'en' ? 'العربية' : 'English'}</span>
            </button>
            <button onClick={() => setShowQR(true)} className="flex items-center gap-2 px-6 py-3 border-2 border-emerald text-emerald rounded-full font-bold text-xs uppercase tracking-widest hover:bg-emerald hover:text-white transition-all whitespace-nowrap group">
              <QrCode size={18} className="group-hover:scale-110 transition-transform" />
              <span>{t.mobilePortal}</span>
            </button>
            <button 
              onClick={downloadPDF} 
              className={`flex items-center gap-2 px-6 py-3 bg-emerald text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-emerald-dark transition-all shadow-xl shadow-emerald-900/20 whitespace-nowrap group`}
            >
              <Printer size={18} className="group-hover:scale-110 transition-transform" />
              <span>{t.exportList} ({selectedItems.size})</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. USER DETAILS FORM (MANDATORY FIELDS) */}
      <section id="details-form" className="py-12 px-6 bg-[#faf8f5] border-b border-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-emerald-50/30 p-8 md:p-12 rounded-[3rem] border border-emerald-100/50">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-emerald-900 rounded-full flex items-center justify-center text-white">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-2xl font-serif font-bold gold-gradient-text rtl:font-sans">{t.personalize}</h3>
                <p className="text-xs text-emerald-900 font-bold uppercase tracking-widest">{t.detailsHint}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {/* Mom's Name */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-emerald-900 ml-1">{t.momName}</label>
                <div className="relative">
                  <User className={`absolute top-1/2 -translate-y-1/2 text-emerald-900 ${isRTL ? 'right-4' : 'left-4'}`} size={20} />
                  <input 
                    type="text" 
                    placeholder={t.momNamePlaceholder}
                    value={momName}
                    onChange={(e) => setMomName(e.target.value)}
                    className={`w-full bg-white border-2 border-emerald-100 rounded-2xl py-4 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} focus:border-emerald-900 outline-none transition-all font-bold text-lg text-emerald-950 placeholder:text-emerald-900/40`}
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-emerald-900 ml-1 flex items-center">
                  <span>{t.mobile}</span>
                  <span className="text-red-500 font-extrabold text-sm ml-1 select-none">*</span>
                </label>
                <div className="relative">
                  <Phone className={`absolute top-1/2 -translate-y-1/2 ${showError && !mobileNumber ? 'text-red-600' : 'text-emerald-900'} ${isRTL ? 'right-4' : 'left-4'}`} size={20} />
                  <input 
                    type="tel" 
                    placeholder={t.mobilePlaceholder}
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value);
                      if(e.target.value) setShowError(false);
                    }}
                    className={`w-full bg-white border-2 rounded-2xl py-4 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} outline-none transition-all font-bold text-lg text-emerald-950 placeholder:text-emerald-900/40 ${showError && !mobileNumber ? 'border-red-200 focus:border-red-400 bg-red-50/30' : 'border-emerald-100 focus:border-emerald-900'}`}
                  />
                </div>
                {showError && !mobileNumber && (
                  <p className="text-[10px] text-red-600 font-bold ml-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {t.errorMobile}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-emerald-900 ml-1">{t.email}</label>
                <div className="relative">
                  <Mail className={`absolute top-1/2 -translate-y-1/2 text-emerald-900 ${isRTL ? 'right-4' : 'left-4'}`} size={20} />
                  <input 
                    type="email" 
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full bg-white border-2 border-emerald-100 rounded-2xl py-4 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} focus:border-emerald-900 outline-none transition-all font-bold text-lg text-emerald-950 placeholder:text-emerald-900/40`}
                  />
                </div>
              </div>

              {/* MRN */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-emerald-900 ml-1">{t.mrn}</label>
                <div className="relative">
                  <Stethoscope className={`absolute top-1/2 -translate-y-1/2 text-emerald-900 ${isRTL ? 'right-4' : 'left-4'}`} size={20} />
                  <input 
                    type="number" 
                    placeholder={t.mrnPlaceholder}
                    value={mrn}
                    onChange={(e) => setMrn(e.target.value)}
                    className={`w-full bg-white border-2 border-emerald-100 rounded-2xl py-4 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} focus:border-emerald-900 outline-none transition-all font-bold text-lg text-emerald-950 placeholder:text-emerald-900/40`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PROMINENT JOURNEY STAGES */}
      <section className="bg-emerald-50/20 py-16 px-6 border-b border-gray-100">
        <div className="max-w-7xl mx-auto">
            <div className="flex items-start gap-4 mb-10 justify-center md:justify-start">
              <div className="w-10 h-10 bg-emerald-900 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-900/20 shrink-0 mt-1">
                <Map size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-bold gold-gradient-text rtl:font-sans">{t.stagesTitle}</h2>
                <p className="text-emerald-900/70 mt-2 text-lg font-medium max-w-3xl leading-relaxed">
                  {t.stagesDescription}
                </p>
              </div>
            </div>
          
          <div className="relative py-12">
            {/* Wave Connector Line (Desktop) */}
            <div className="hidden xl:block absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-100 -translate-y-1/2 rounded-full" />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 relative z-10">
              {journeyData.map((milestone, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <button
                    key={milestone.id}
                    onClick={() => {
                      setActiveStage(milestone.id);
                      setViewMode('details');
                      // Scroll to specific product essentials list frame smoothly instead of top of the page
                      setTimeout(() => {
                        const element = document.getElementById('details-section-view');
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }, 100);
                    }}
                    className={`flex flex-col items-center p-6 rounded-[2.5rem] transition-all duration-500 border-2 text-center group relative ${
                      isEven ? 'xl:-translate-y-8' : 'xl:translate-y-8'
                    } ${
                      activeStage === milestone.id 
                        ? 'bg-emerald-900 border-emerald-900 active-stage-glow scale-110 z-20 shadow-2xl' 
                        : 'bg-white border-gray-100 hover:border-emerald-200'
                    }`}
                  >
                    {/* Connector Dots for Wave Effect */}
                    <div className={`hidden xl:block absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white transition-all duration-500 z-[-1] ${
                      isEven 
                        ? '-bottom-12 bg-emerald-200' 
                        : '-top-12 bg-emerald-200'
                    } ${activeStage === milestone.id ? 'bg-emerald-900 scale-125' : ''}`} />
                    
                    <div className={`hidden xl:block absolute left-1/2 -translate-x-1/2 w-[1px] bg-emerald-200 z-[-1] ${
                      isEven ? '-bottom-12 h-12' : '-top-12 h-12'
                    }`} />

                    <div className={`w-full aspect-square rounded-3xl overflow-hidden mb-6 transition-transform group-hover:scale-105 duration-700 shadow-md ${
                      activeStage === milestone.id ? 'ring-4 ring-emerald-400/30' : ''
                    }`}>
                      <img 
                        src={milestone.imageUrl} 
                        alt={milestone.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${
                      activeStage === milestone.id ? 'text-emerald-300' : 'text-emerald-700'
                    }`}>
                      {t.stagePrefix} 0{idx + 1}
                    </p>
                    <h4 className={`text-sm font-bold tracking-tight leading-tight ${
                      activeStage === milestone.id ? 'text-white' : 'text-black'
                    }`}>
                      {milestone.title}
                    </h4>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 4. ACTIVE STAGE DETAILS & LIST */}
      {viewMode === 'details' && (
      <main id="details-section-view" className="max-w-7xl mx-auto px-6 py-12 scroll-mt-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => setViewMode('home')}
            className={`flex items-center gap-2 text-[#E52B1E] font-bold uppercase tracking-widest text-xs hover:opacity-80 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {isRTL ? <ChevronRight size={20} className="text-[#E52B1E]" /> : <ChevronLeft size={20} className="text-[#E52B1E]" />} 
            <span className="font-extrabold">{t.backToOverview}</span>
          </button>

          <div className="flex gap-4">
            {journeyData.findIndex(m => m.id === activeStage) > 0 && (
              <button 
                onClick={() => {
                  const idx = journeyData.findIndex(m => m.id === activeStage);
                  setActiveStage(journeyData[idx - 1].id);
                  // Scroll to specific product essentials list frame smoothly instead of top of the page
                  setTimeout(() => {
                    const element = document.getElementById('details-section-view');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className={`flex items-center gap-3 px-6 py-3 rounded-full border-2 border-emerald-100 text-emerald-900 hover:bg-emerald-50 hover:border-emerald-300 transition-all font-bold uppercase tracking-widest text-xs ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {isRTL ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                <span>{t.previousStage}</span>
              </button>
            )}
            {journeyData.findIndex(m => m.id === activeStage) < journeyData.length - 1 && (
              <button 
                onClick={() => {
                  const idx = journeyData.findIndex(m => m.id === activeStage);
                  setActiveStage(journeyData[idx + 1].id);
                  // Scroll to specific product essentials list frame smoothly instead of top of the page
                  setTimeout(() => {
                    const element = document.getElementById('details-section-view');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className={`flex items-center gap-3 px-6 py-3 rounded-full bg-emerald-900 text-white hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-900/20 font-bold uppercase tracking-widest text-xs ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <span>{t.nextStage}</span>
                {isRTL ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
              </button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-16">
          
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-12">
            <div className="animate-reveal">
              <h2 className="text-4xl md:text-5xl font-serif font-extrabold gold-gradient-text mb-4 leading-tight">{currentMilestone.title}</h2>
              <div className="w-24 h-1.5 bg-emerald-900 rounded-full mb-8"></div>
              <h3 className="text-2xl font-serif text-emerald-900/80 font-medium mb-10 italic rtl:font-sans rtl:not-italic rtl:font-extrabold">{currentMilestone.subtitle}</h3>
              <p className="text-xl text-emerald-900 font-medium leading-relaxed mb-10 border-l-4 border-gold pl-6">
                {currentMilestone.description}
              </p>
              
              <div className="space-y-6">
                <div className="p-10 bg-emerald-dark text-white rounded-[3rem] shadow-xl relative overflow-hidden group">
                  <div className={`absolute top-0 p-4 opacity-10 group-hover:rotate-12 transition-transform ${isRTL ? 'left-0' : 'right-0'}`}>
                    <ShieldCheck size={120} />
                  </div>
                  <div className="flex items-center gap-3 mb-4 text-emerald-300">
                    <ShieldCheck size={28} />
                    <h5 className="font-bold text-xs uppercase tracking-widest">{t.clinicalInsight}</h5>
                  </div>
                  <p className="text-lg font-light leading-relaxed italic opacity-90 relative z-10">"{currentMilestone.clinicalInsight}"</p>
                </div>

                <div className="p-10 bg-emerald-50 rounded-[3rem] border border-emerald-100 group">
                  <div className="flex items-center gap-3 mb-4 text-emerald-900">
                    <Stethoscope size={28} />
                    <h5 className="font-bold text-xs uppercase tracking-widest">{t.expertTip}</h5>
                  </div>
                  <p className="text-lg font-light leading-relaxed italic text-emerald-950 opacity-80">"{currentMilestone.expertTip}"</p>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="lg:col-span-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <h3 className="text-4xl font-serif font-bold gold-gradient-text italic rtl:font-sans rtl:not-italic">{t.essentialsTitle}</h3>
              <div className="bg-emerald text-white px-6 py-2 rounded-full flex items-center gap-3 shadow-lg shadow-emerald-900/10 border border-emerald-400/30">
                 <span className="w-2 h-2 rounded-full bg-emerald-bright animate-pulse"></span>
                 <span className="text-xs font-black uppercase tracking-widest">
                  {currentMilestone.checklist.length} {t.productsAvailable}
                 </span>
              </div>
            </div>

            <div className="checklist-grid">
              {currentMilestone.checklist.map((item) => {
                const isSelected = selectedItems.has(item.id);
                return (
                  <div 
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`p-8 rounded-[2.5rem] cursor-pointer group flex flex-col justify-between h-full border-2 transition-all duration-500 hover:scale-[1.02] ${
                      isSelected 
                        ? 'bg-emerald-700 text-white border-emerald-700' 
                        : 'glass-card border-transparent'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border ${
                          isSelected ? 'bg-white/10 text-emerald-300 border-white/20' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                        }`}>
                          {item.category}
                        </span>
                        <div className={`transition-all duration-300 ${isSelected ? 'scale-110' : 'opacity-20 group-hover:opacity-100'}`}>
                          {isSelected 
                            ? <CheckCircle size={32} className="text-emerald-300" /> 
                            : <div className="w-8 h-8 rounded-full border-2 border-emerald-900"></div>
                          }
                        </div>
                      </div>
                      <h4 className={`text-xl font-bold mb-3 leading-tight tracking-tight ${isSelected ? 'text-white' : 'text-emerald-dark'}`}>
                        {item.name}
                      </h4>
                    </div>
                    <p className={`text-base font-semibold leading-relaxed ${isSelected ? 'text-white' : 'text-emerald-900'}`}>
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      )}

      {/* Mobile Portal Modal */}
      {showQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={() => setShowQR(false)}>
          <div className="bg-white p-12 rounded-[4rem] shadow-2xl max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-emerald-900">
              <QrCode size={40} />
            </div>
            <h3 className="text-3xl font-serif font-bold mb-4 text-emerald-dark rtl:font-sans">{t.mobileAccess}</h3>
            <p className="text-emerald-900/60 mb-10 text-sm leading-relaxed font-light italic">{t.mobileSync}</p>
            
            <div className="bg-white p-8 border border-gray-100 rounded-[3rem] inline-block mb-10">
              <QRCodeSVG value={window.location.href} size={200} level="H" includeMargin={false} fgColor="#064e3b" />
            </div>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full py-5 bg-emerald-dark text-white rounded-full font-bold hover:bg-emerald transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span>{copied ? t.linkCopied : t.copyLink}</span>
            </button>
          </div>
        </div>
      )}

      {/* Geolocation Pre-Permission Card */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-emerald-100/50 shadow-2xl shadow-emerald-900/20 max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-900 rounded-2xl flex items-center justify-center mx-auto text-center">
              <Map size={32} />
            </div>
            <h3 className="text-2xl font-serif font-extrabold text-emerald-950 tracking-tight leading-snug">
              {t.findNearestBranchTitle}
            </h3>
            <p className="text-sm text-emerald-900/60 leading-relaxed font-serif italic">
              {t.findNearestBranchDesc}
            </p>

            {locationError && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-3.5 rounded-2xl border border-red-100/60 transition-all flex items-center justify-center gap-2">
                <AlertCircle size={14} />
                <span>{locationError}</span>
              </div>
            )}
            
            <div className="pt-2">
              <button
                onClick={handleFetchExactLocation}
                disabled={isLocating}
                className="w-full py-4 bg-emerald-900 text-white font-bold rounded-2xl hover:bg-emerald-950 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                {isLocating ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>Locating...</span>
                  </>
                ) : (
                  <span>{t.allowLocation}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-emerald-900 text-white py-16 px-8 mt-20 border-t border-emerald-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12 border-b border-emerald-800 pb-12 mb-10">
            {/* Logos and Title */}
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-800">
                <img src={hmgLogo} alt="HMG Logo" className="h-10 w-10 object-contain" />
                <div className="h-6 w-[1px] bg-emerald-200 mx-1"></div>
                <img src={mepLogo} alt="MEP Logo" className="h-10 w-10 object-contain" />
              </div>
              <div className="text-center md:text-left rtl:text-right flex flex-col items-center md:items-start">
                <h4 className="font-serif text-xl font-extrabold text-white tracking-tighter">
                  {isRTL ? 'رحلة رعاية الأم والطفل مجموعة د.سليمان الحبيب الطبية' : 'Dr.Sulaiman Al Habib Mom & Baby Care Journey'}
                </h4>
                <p className="text-xs text-white font-bold mt-1 text-center w-full">
                  {isRTL ? 'المجموعة الطبية الرائدة في الشرق الأوسط' : 'Dr. Sulaiman Al Habib Medical Group'}
                </p>
              </div>
            </div>

            {/* Corporate Quote / Info */}
            <div className="text-center md:text-right max-w-md">
              <p className="font-serif text-lg text-emerald-100 font-medium italic leading-relaxed rtl:font-sans rtl:not-italic rtl:font-extrabold rtl:text-xl">
                "{t.footerQuote}"
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center text-emerald-300/60 text-xs gap-6">
            <p className="text-center md:text-left">
              © {new Date().getFullYear()} {t.rightsReserved}
            </p>
            <div className="flex gap-8">
              <span className="hover:text-white cursor-pointer transition-colors">{t.privacyPolicy}</span>
              <span className="hover:text-white cursor-pointer transition-colors">{t.safetyStandards}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
