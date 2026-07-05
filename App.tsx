
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

    // Capture snapshot of current states BEFORE any potential race condition reset
    const leadSnapshot = {
      name: momName.trim() || null,
      mobile_number: mobileNumber.trim(),
      email: email.trim() || null,
      mrn: mrn ? parseFloat(mrn) : null,
      selected_items_count: selectedItems.size,
      selected_items: Array.from(selectedItems),
      stage: activeStage,
      language: lang,
      city: city || 'Riyadh'
    };

    // Save lead IMMEDIATELY to guarantee capture
    sendLeadToDatabase(leadSnapshot);

    generatePDFDownloadFlow();
  };

  const sendLeadToDatabase = (snapshot: {
    name: string | null;
    mobile_number: string;
    email: string | null;
    mrn: number | null;
    selected_items_count: number;
    selected_items: string[];
    stage: string;
    language: string;
    city: string;
  }) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        // Build payload matching EXACTLY the columns definition in Supabase to guarantee successful insert on the very first try!
        const payload = {
          name: snapshot.name,
          mobile_number: snapshot.mobile_number,
          email: snapshot.email,
          mrn: snapshot.mrn,
          selected_items_count: snapshot.selected_items_count,
          selected_items: snapshot.selected_items,
          stage: snapshot.stage,
          language: snapshot.language,
          city: snapshot.city
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
            console.warn("Retrying submission with default database columns fallback...");
            sendLeadToDatabaseFallback(snapshot);
          } else {
            console.log("Lead successfully stored in Supabase!");
          }
        }).catch(err => {
          clearTimeout(timeoutId);
          console.error("Network error communicating with Supabase:", err);
          sendLeadToDatabaseFallback(snapshot);
        });
      } catch (e) {
        console.error("Database connection exception:", e);
      }
    }
  };

  const sendLeadToDatabaseFallback = (snapshot: any) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const payload = {
          name: snapshot.name,
          mobile_number: snapshot.mobile_number,
          email: snapshot.email,
          selected_items_count: snapshot.selected_items_count,
          selected_items: snapshot.selected_items,
          stage: snapshot.stage,
          language: snapshot.language
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        fetch(`${supabaseUrl}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }).then(async (res) => {
          clearTimeout(timeoutId);
          if (!res.ok) {
            const errDetails = await res.text();
            console.error(`Supabase Submission Fallback Failed (Status ${res.status}):`, errDetails);
          } else {
            console.log("Lead successfully stored in Supabase via fallback!");
          }
        }).catch(err => {
          clearTimeout(timeoutId);
          console.error("Network error communicating with Supabase on fallback:", err);
        });
      } catch (e) {
        console.error("Fallback database connection exception:", e);
      }
    }
  };

  const sanitizePdfText = (str: string, fallback: string): string => {
    if (!str || !str.trim()) return fallback;
    // Remove any characters that cannot be drawn in standard PDF fonts (e.g. non-ASCII Arabic, cursive, etc.)
    const clean = str.replace(/[^\x00-\x7F]/g, '').trim();
    return clean.length > 0 ? clean : fallback;
  };

  const addArabicTextToPdf = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    isBold: boolean,
    colorStr: string,
    align: 'right' | 'left' | 'center' = 'right',
    maxWidth: number = 180
  ): number => {
    try {
      const scale = 4; // High definition scale factor
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const fontStyle = `${isBold ? 'bold' : 'normal'} ${fontSize * scale}px Cairo, "Cairo Regular", "Cairo Bold", Tahoma, Arial, sans-serif`;
      ctx.font = fontStyle;
      
      // Convert maxWidth from mm to points and then to pixels for canvas measurements
      const mmToPoints = 2.83464;
      const maxWidthPoints = maxWidth * mmToPoints;
      const maxWidthPixels = maxWidthPoints * scale;
      
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = words[0] || '';
      
      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidthPixels) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Measure actual maximum line width to avoid stretching empty canvas space
      let maxLineWidth = 0;
      lines.forEach(line => {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxLineWidth) {
          maxLineWidth = metrics.width;
        }
      });
      maxLineWidth = Math.max(maxLineWidth, 1);
      
      const lineHeightPoints = fontSize * 1.35;
      const canvasWidth = maxLineWidth + (2 * scale); // small padding
      const canvasHeight = lines.length * lineHeightPoints * scale + (2 * scale);
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Re-apply context font after canvas resize
      ctx.font = fontStyle;
      ctx.textBaseline = 'top';
      ctx.direction = 'rtl';
      ctx.fillStyle = colorStr;
      
      lines.forEach((line, index) => {
        const lineY = index * lineHeightPoints * scale + (1 * scale);
        
        if (align === 'center') {
          ctx.textAlign = 'center';
          ctx.fillText(line, canvasWidth / 2, lineY);
        } else if (align === 'left') {
          ctx.textAlign = 'left';
          ctx.fillText(line, 1 * scale, lineY);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(line, canvasWidth - (1 * scale), lineY);
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Convert actual canvas dimensions back to millimeters for jsPDF placement
      const docWidth = (canvasWidth / scale) * 0.352778;
      const docHeight = (canvasHeight / scale) * 0.352778;
      
      let docX = x;
      if (align === 'right') {
        docX = x - docWidth;
      } else if (align === 'center') {
        docX = x - (docWidth / 2);
      }
      
      doc.addImage(imgData, 'PNG', docX, y, docWidth, docHeight, undefined, 'FAST');
      return docHeight;
    } catch (e) {
      console.error("addArabicTextToPdf helper error:", e);
      return 0;
    }
  };

  const generatePDFWithoutLogoFallback = () => {
    try {
      const doc = new jsPDF();
      const themeColor = [6, 78, 59] as const; // Emerald
      const goldColor = [180, 138, 40] as const;

      // --- HEADER SECTION ---
      if (isRTL) {
        addArabicTextToPdf(doc, "مجموعة د. سليمان الحبيب الطبية", 195, 18, 16, true, "rgb(6, 78, 59)", "right", 180);
        addArabicTextToPdf(doc, "رحلة رعاية الأم والطفل", 195, 26, 12, true, "rgb(180, 138, 40)", "right", 180);
        addArabicTextToPdf(doc, "قائمة المستلزمات المخصصة", 195, 33, 9, false, "rgb(120, 120, 120)", "right", 180);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22); 
        doc.setTextColor(...themeColor);
        doc.text("DR. SULAIMAN AL HABIB", 15, 25);
        
        doc.setFontSize(14);
        doc.setTextColor(...goldColor);
        doc.text("MOM AND BABY JOURNEY", 15, 33);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text("PERSONALIZED ESSENTIALS CHECKLIST", 15, 39);
      }

      // User Info Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(6, 78, 59);
      doc.setLineWidth(0.1);
      doc.roundedRect(15, 48, 180, 25, 3, 3, 'FD');
      
      // User Info Content
      doc.setFontSize(9);
      
      if (isRTL) {
        // RTL columns (مجهزة لصالح, تفاصيل الاتصال, تاريخ الإنشاء)
        addArabicTextToPdf(doc, "مجهّز لصالح", 185, 53, 9, true, "rgb(6, 78, 59)", "right", 50);
        addArabicTextToPdf(doc, momName || "عميلنا العزيز", 185, 59, 9, false, "rgb(0, 0, 0)", "right", 50);
        if (mrn) {
          addArabicTextToPdf(doc, `الملف الطبي: ${mrn}`, 185, 65, 8, false, "rgb(0, 0, 0)", "right", 50);
        }

        addArabicTextToPdf(doc, "تفاصيل الاتصال", 130, 53, 9, true, "rgb(6, 78, 59)", "right", 50);
        addArabicTextToPdf(doc, mobileNumber, 130, 59, 9, false, "rgb(0, 0, 0)", "right", 50);
        if (email) {
          addArabicTextToPdf(doc, email, 130, 65, 8, false, "rgb(0, 0, 0)", "right", 50);
        }

        addArabicTextToPdf(doc, "تاريخ الإنشاء", 75, 53, 9, true, "rgb(6, 78, 59)", "right", 55);
        addArabicTextToPdf(doc, new Date().toLocaleDateString('en-US'), 75, 59, 9, false, "rgb(0, 0, 0)", "right", 55);
        addArabicTextToPdf(doc, new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 75, 65, 8, false, "rgb(0, 0, 0)", "right", 55);
      } else {
        // Column 1: Prepared For
        doc.setTextColor(...themeColor);
        doc.setFont("helvetica", "bold");
        doc.text("PREPARED FOR", 25, 57);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(sanitizePdfText(momName, "Valued Customer"), 25, 65);
        if (mrn) doc.text(`MRN: ${mrn}`, 25, 70);
        
        // Column 2: Contact
        doc.setTextColor(...themeColor);
        doc.setFont("helvetica", "bold");
        doc.text("CONTACT DETAILS", 85, 57);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(sanitizePdfText(mobileNumber, ""), 85, 65);
        if (email) doc.text(sanitizePdfText(email, ""), 85, 70);
        
        // Column 3: Date
        doc.setTextColor(...themeColor);
        doc.setFont("helvetica", "bold");
        doc.text("GENERATED ON", 145, 57);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(new Date().toLocaleDateString(), 145, 65);
        doc.text(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 145, 70);
      }

      let yOffset = 90;

      // --- CHECKLIST CONTENT ---
      if (selectedItems.size === 0) {
         doc.setFontSize(12);
         doc.setTextColor(100, 100, 100);
         if (isRTL) {
           addArabicTextToPdf(doc, "لم يتم اختيار أي مستلزمات. يرجى العودة والتحقق لتنزيل القائمة المخصصة.", 105, yOffset, 12, false, "rgb(100, 100, 100)", "center", 180);
         } else {
           doc.text("No essentials selected. Please select items to build your checklist.", 105, yOffset, { align: 'center' });
         }
      } else {
         const journeyDataToUse = isRTL ? JOURNEY_DATA_AR : JOURNEY_DATA;
         journeyDataToUse.forEach(milestone => {
            const stageItems = milestone.checklist.filter(item => selectedItems.has(item.id));
            
            if (stageItems.length > 0) {
               if (yOffset > 250) { 
                 doc.addPage(); 
                 yOffset = 20; 
               }
               
               doc.setFillColor(...themeColor);
               doc.rect(15, yOffset, 180, 8, 'F');
               
               if (isRTL) {
                 addArabicTextToPdf(doc, `المرحلة: ${milestone.title.toUpperCase()}`, 190, yOffset + 1.8, 10, true, "rgb(255, 255, 255)", "right", 170);
               } else {
                 doc.setTextColor(255, 255, 255);
                 doc.setFont("helvetica", "bold");
                 doc.setFontSize(10);
                 doc.text(`STAGE: ${milestone.title.toUpperCase()}`, 20, yOffset + 5.5);
               }
               
               yOffset += 15;
               
               stageItems.forEach(item => {
                  const descLinesCount = Math.ceil(item.description.length / 55) || 1;
                  const itemHeight = 10 + (descLinesCount * 4) + 6;
                  
                  if (yOffset + itemHeight > 280) { 
                    doc.addPage(); 
                    yOffset = 20; 
                    if (isRTL) {
                      addArabicTextToPdf(doc, `(تابع: ${milestone.title})`, 195, yOffset - 5, 8, false, "rgb(150, 150, 150)", "right", 180);
                    } else {
                      doc.setFontSize(8);
                      doc.setTextColor(150, 150, 150);
                      doc.text(`(Continuation: ${milestone.title})`, 15, yOffset - 5);
                    }
                  }
                  
                  if (isRTL) {
                    // Checkbox
                    doc.setDrawColor(...themeColor);
                    doc.setLineWidth(0.5);
                    doc.rect(191, yOffset - 3, 4, 4);

                    // Category text box on far left
                    doc.setFillColor(240, 240, 240);
                    doc.setDrawColor(200, 200, 200);
                    doc.roundedRect(15, yOffset - 4, 40, 6, 2, 2, 'FD');
                    addArabicTextToPdf(doc, item.category, 35, yOffset - 3, 7, true, "rgb(6, 78, 59)", "center", 40);

                    // Item title right side
                    const titleHeight = addArabicTextToPdf(doc, item.name, 184, yOffset - 4, 11, true, "rgb(0, 0, 0)", "right", 120);
                    yOffset += titleHeight + 2;
                    
                    // Item description
                    const descHeight = addArabicTextToPdf(doc, item.description, 184, yOffset, 9, false, "rgb(80, 80, 80)", "right", 165);
                    yOffset += descHeight + 6;

                    doc.setDrawColor(230, 230, 230);
                    doc.line(15, yOffset - 4, 195, yOffset - 4);
                  } else {
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(11);
                    doc.setFont("helvetica", "bold");
                    doc.text(item.name, 25, yOffset);
                    
                    doc.setFillColor(240, 240, 240);
                    doc.setDrawColor(200, 200, 200);
                    doc.roundedRect(155, yOffset - 4, 40, 6, 2, 2, 'FD');
                    doc.setTextColor(...themeColor);
                    doc.setFontSize(7);
                    doc.text(item.category.toUpperCase(), 175, yOffset, { align: 'center' });
                    
                    doc.setDrawColor(...themeColor);
                    doc.setLineWidth(0.5);
                    doc.rect(16, yOffset - 3, 4, 4);
                    
                    yOffset += 5;
                    doc.setTextColor(80, 80, 80);
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    const descLines = doc.splitTextToSize(item.description, 130);
                    doc.text(descLines, 25, yOffset);
                    
                    yOffset += (descLines.length * 4) + 8;
                    
                    doc.setDrawColor(230, 230, 230);
                    doc.line(25, yOffset - 4, 195, yOffset - 4);
                  }
               });
               
               yOffset += 5; 
            }
         });
      }

      // --- FOOTER ---
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (isRTL) {
          addArabicTextToPdf(doc, "مجموعة د. سليمان الحبيب الطبية", 105, 283, 8, true, "rgb(150, 150, 150)", "center", 100);
          addArabicTextToPdf(doc, "رحلة رعاية الأم والطفل", 105, 287, 8, false, "rgb(150, 150, 150)", "center", 100);
          addArabicTextToPdf(doc, `صفحة ${i} من ${totalPages}`, 195, 285, 8, false, "rgb(150, 150, 150)", "right", 40);
        } else {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text("Dr. Sulaiman Al Habib Medical Group", 105, 286, { align: 'center' });
          doc.text("Mom & Baby Journey Essentials", 105, 290, { align: 'center' });
          doc.text(`Page ${i} of ${totalPages}`, 195, 290, { align: 'right' });
        }
      }
      
      doc.save(`Al-Habib-Journey-${mobileNumber}.pdf`);
      
      // Reset selected items and customer details after successful generation
      setSelectedItems(new Set());
      setMomName('');
      setMobileNumber('');
      setEmail('');
      setMrn('');
      setViewMode('home');
    } catch (err) {
      console.error("Critical fallback PDF generation failed:", err);
    }
  };

  const generatePDFDownloadFlow = () => {
    // Load logo image for PDF
    const img = new Image();
    img.src = logo;
    img.onload = () => {
      try {
        const doc = new jsPDF();
        
        const themeColor = [6, 78, 59] as const; // Emerald
        const goldColor = [180, 138, 40] as const;
        
        // --- HEADER SECTION ---
        // Logo - matched in height to the text block beside it
        const logoRatio = img.width / img.height;
        const logoHeight = 17; // Matches the height of the two-line header text block perfectly
        const logoWidth = logoHeight * logoRatio;
        doc.addImage(img, 'PNG', 15, 17, logoWidth, logoHeight);

        // Header Text - shifted slightly to the right style (+8mm)
        const textStartX = 15 + logoWidth + 13;
        if (isRTL) {
          addArabicTextToPdf(doc, "مجموعة د. سليمان الحبيب الطبية", 195, 18, 14, true, "rgb(6, 78, 59)", "right", 110);
          addArabicTextToPdf(doc, "رحلة رعاية الأم والطفل - مستلزمات مخصصة", 195, 25, 9, false, "rgb(120, 120, 120)", "right", 110);
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(18); 
          doc.setTextColor(...themeColor);
          doc.text("MOM AND BABY JOURNEY", textStartX, 23);
          
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(120, 120, 120);
          doc.text("PERSONALIZED ESSENTIALS CHECKLIST", textStartX, 30);
        }

        // User Info Box
        doc.setFillColor(248, 250, 252); // Light Gray/Blueish background
        doc.setDrawColor(6, 78, 59); // Emerald border
        doc.setLineWidth(0.1);
        doc.roundedRect(15, 45, 180, 25, 3, 3, 'FD');
        
        // User Info Content
        doc.setFontSize(9);
        
        if (isRTL) {
          addArabicTextToPdf(doc, "مجهّز لصالح", 185, 50, 9, true, "rgb(6, 78, 59)", "right", 50);
          addArabicTextToPdf(doc, momName || "عميلنا العزيز", 185, 56, 9, false, "rgb(0, 0, 0)", "right", 50);
          if (mrn) {
            addArabicTextToPdf(doc, `الملف الطبي: ${mrn}`, 185, 61, 8, false, "rgb(0, 0, 0)", "right", 50);
          }

          addArabicTextToPdf(doc, "تفاصيل الاتصال", 130, 50, 9, true, "rgb(6, 78, 59)", "right", 50);
          addArabicTextToPdf(doc, mobileNumber, 130, 56, 9, false, "rgb(0, 0, 0)", "right", 50);
          if (email) {
            addArabicTextToPdf(doc, email, 130, 61, 8, false, "rgb(0, 0, 0)", "right", 50);
          }

          addArabicTextToPdf(doc, "تاريخ الإنشاء", 75, 50, 9, true, "rgb(6, 78, 59)", "right", 55);
          addArabicTextToPdf(doc, new Date().toLocaleDateString('en-US'), 75, 56, 9, false, "rgb(0, 0, 0)", "right", 55);
          addArabicTextToPdf(doc, new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 75, 61, 8, false, "rgb(0, 0, 0)", "right", 55);
        } else {
          // Column 1: Prepared For
          doc.setTextColor(...themeColor);
          doc.setFont("helvetica", "bold");
          doc.text("PREPARED FOR", 25, 54);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          doc.text(sanitizePdfText(momName, "Valued Customer"), 25, 62);
          if (mrn) doc.text(`MRN: ${mrn}`, 25, 67);
          
          // Column 2: Contact
          doc.setTextColor(...themeColor);
          doc.setFont("helvetica", "bold");
          doc.text("CONTACT DETAILS", 85, 54);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          doc.text(sanitizePdfText(mobileNumber, ""), 85, 62);
          if (email) doc.text(email, 85, 67);
          
          // Column 3: Date
          doc.setTextColor(...themeColor);
          doc.setFont("helvetica", "bold");
          doc.text("GENERATED ON", 145, 54);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          doc.text(new Date().toLocaleDateString(), 145, 62);
          doc.text(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 145, 67);
        }

        let yOffset = 85;

        // --- CHECKLIST CONTENT ---
        if (selectedItems.size === 0) {
           doc.setFontSize(12);
           doc.setTextColor(100, 100, 100);
           if (isRTL) {
             addArabicTextToPdf(doc, "لم يتم اختيار أي مستلزمات. يرجى العودة والتحقق لتنزيل القائمة المخصصة.", 105, yOffset, 12, false, "rgb(100, 100, 100)", "center", 180);
           } else {
             doc.text("No essentials selected. Please select items to build your checklist.", 105, yOffset, { align: 'center' });
           }
        } else {
           // Group items by Milestone for better organization
           const journeyDataToUse = isRTL ? JOURNEY_DATA_AR : JOURNEY_DATA;
           journeyDataToUse.forEach(milestone => {
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
                 
                 if (isRTL) {
                   addArabicTextToPdf(doc, `المرحلة: ${milestone.title.toUpperCase()}`, 190, yOffset + 1.8, 10, true, "rgb(255, 255, 255)", "right", 170);
                 } else {
                   doc.setTextColor(255, 255, 255);
                   doc.setFont("helvetica", "bold");
                   doc.setFontSize(10);
                   doc.text(`STAGE: ${milestone.title.toUpperCase()}`, 20, yOffset + 5.5);
                 }
                 
                 yOffset += 15;
                 
                 // Items in this section
                 stageItems.forEach(item => {
                    // Check page break for item
                    const descLinesCount = Math.ceil(item.description.length / 55) || 1;
                    const itemHeight = 10 + (descLinesCount * 4) + 6;
                    
                    if (yOffset + itemHeight > 280) { 
                      doc.addPage(); 
                      yOffset = 20; 
                      if (isRTL) {
                        addArabicTextToPdf(doc, `(تابع: ${milestone.title})`, 195, yOffset - 5, 8, false, "rgb(150, 150, 150)", "right", 180);
                      } else {
                        // Simplified header for continuation
                        doc.setFontSize(8);
                        doc.setTextColor(150, 150, 150);
                        doc.text(`(Continuation: ${milestone.title})`, 15, yOffset - 5);
                      }
                    }
                    
                    if (isRTL) {
                      // Checkbox
                      doc.setDrawColor(...themeColor);
                      doc.setLineWidth(0.5);
                      doc.rect(191, yOffset - 3, 4, 4);

                      // Category Text Box (Left side aligned)
                      doc.setFillColor(240, 240, 240);
                      doc.setDrawColor(200, 200, 200);
                      doc.roundedRect(15, yOffset - 4, 40, 6, 2, 2, 'FD');
                      addArabicTextToPdf(doc, item.category, 35, yOffset - 3, 7, true, "rgb(6, 78, 59)", "center", 40);

                      // Product Title (Right side aligned)
                      const titleHeight = addArabicTextToPdf(doc, item.name, 184, yOffset - 4, 11, true, "rgb(0, 0, 0)", "right", 120);
                      yOffset += titleHeight + 2;

                      // Product Description (Right side aligned)
                      const descHeight = addArabicTextToPdf(doc, item.description, 184, yOffset, 9, false, "rgb(80, 80, 80)", "right", 165);
                      yOffset += descHeight + 6;

                      // Light separator line at bottom
                      doc.setDrawColor(230, 230, 230);
                      doc.line(15, yOffset - 4, 195, yOffset - 4);
                    } else {
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
                      const descLines = doc.splitTextToSize(item.description, 130);
                      doc.text(descLines, 25, yOffset);
                      
                      // Spacing for next item
                      yOffset += (descLines.length * 4) + 8;
                      
                      // Light separator line
                      doc.setDrawColor(230, 230, 230);
                      doc.line(25, yOffset - 4, 195, yOffset - 4);
                    }
                 });
                 
                 yOffset += 5; // Extra gap after group
              }
           });
        }

        // --- FOOTER ---
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          
          if (isRTL) {
            // Footer text items for Arabic page with Cairo matching
            addArabicTextToPdf(doc, "مجموعة د. سليمان الحبيب الطبية", 105, 283, 8, true, "rgb(150, 150, 150)", "center", 100);
            addArabicTextToPdf(doc, "رحلة رعاية الأم والطفل", 105, 287, 8, false, "rgb(150, 150, 150)", "center", 100);
            addArabicTextToPdf(doc, `صفحة ${i} من ${totalPages}`, 195, 285, 8, false, "rgb(150, 150, 150)", "right", 40);
          } else {
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
        }
        
        doc.save(`Al-Habib-Journey-${mobileNumber}.pdf`);
        
        // Reset selected items and customer details after successful generation
        setSelectedItems(new Set());
        setMomName('');
        setMobileNumber('');
        setEmail('');
        setMrn('');
        setViewMode('home');
      } catch (err) {
        console.error("PDF generation with logo loaded exception:", err);
        generatePDFWithoutLogoFallback();
      }
    };

    img.onerror = (err) => {
      console.warn("Failed to load logo image, executing logo-free PDF fallback:", err);
      generatePDFWithoutLogoFallback();
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
            className={`flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-600/10 active:scale-95 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {isRTL ? <ChevronRight size={16} className="text-white" /> : <ChevronLeft size={16} className="text-white" />} 
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
              <div className="flex flex-wrap items-center gap-4">
                <h3 className="text-4xl font-serif font-bold gold-gradient-text italic rtl:font-sans rtl:not-italic">{t.essentialsTitle}</h3>
                <button
                  onClick={downloadPDF}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-full flex items-center gap-2.5 transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/10 whitespace-nowrap active:scale-95 shrink-0"
                >
                  <Printer size={14} />
                  <span>{t.exportList} ({selectedItems.size})</span>
                </button>
              </div>
              <div className="bg-emerald text-white px-6 py-2 rounded-full flex items-center gap-3 shadow-lg shadow-emerald-900/10 border border-emerald-400/30 w-fit">
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
                        <span className={`text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-full border-2 font-serif shadow-sm transition-all duration-300 ${
                          isSelected 
                            ? 'bg-white/20 text-white border-white/50' 
                            : 'bg-emerald-50 text-emerald-950 border-emerald-200/60'
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
          <div className="bg-white p-10 md:p-12 rounded-[4rem] shadow-2xl max-w-lg w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-emerald-900">
              <QrCode size={40} />
            </div>
            <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4 text-emerald-dark leading-snug rtl:font-sans">{t.mobileAccess}</h3>
            <p className="text-emerald-900/80 mb-10 text-sm md:text-base leading-relaxed font-semibold italic">{t.mobileSync}</p>
            
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

      {/* Geolocation Pre-Permission Card removed */}

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
