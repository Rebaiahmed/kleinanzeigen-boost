import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Upload,
  X,
  Check,
  Plus,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAdsActions } from '../hooks/useAdsActions';
import { useAiUsage } from '../hooks/useAiUsage';
import { PriceSuggestion } from '../components/ads/PriceSuggestion';

const CATEGORIES = [
  "Auto, Rad & Boot",
  "Elektronik",
  "Haus & Garten",
  "Freizeit, Hobby & Nachbarschaft",
  "Familie, Kind & Baby",
  "Mode & Beauty",
  "Eintrittskarten & Tickets",
  "Haustiere",
  "Immobilien",
  "Jobs",
  "Dienstleistungen",
  "Nachbarschaft",
  "Musik, Filme & Bücher",
  "Spielzeug",
  "Sport & Outdoor",
  "Büro & Schreibwaren",
  "Antiquitäten & Kunst",
  "Musik & Instrumente",
  "Beauty & Gesundheit",
  "Sonstiges"
];

const CONDITIONS = ["Neu", "Wie neu", "Gut", "In Ordnung", "Defekt"];

// Inline Vinted Logo (pink, 14px size)
const VintedLogo = () => (
  <svg 
    viewBox="0 0 100 100" 
    className="w-3.5 h-3.5 shrink-0" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M20 15 L45 80 L55 80 L80 15" 
      stroke="#EB6B9D" 
      strokeWidth="14" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Inline eBay Logo (small text-based multi-color SVG matching brand colors)
const EbayLogo = () => (
  <svg 
    viewBox="0 0 42 16" 
    className="h-3.5 shrink-0" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <text 
      x="0" 
      y="13" 
      fontWeight="bold" 
      fontSize="15" 
      fontFamily="Arial, Helvetica, sans-serif"
      letterSpacing="-0.5"
    >
      <tspan fill="#e53238">e</tspan>
      <tspan fill="#0064d2">b</tspan>
      <tspan fill="#f5af02">a</tspan>
      <tspan fill="#86b817">y</tspan>
    </text>
  </svg>
);

interface UploadedPhoto {
  file: File;
  preview: string;
}

export function CreateWithAi() {
  const navigate = useNavigate();
  const { saveDraft, handleVintedCrossPost, handleEbayCrossPost, handlePriceCheck } = useAdsActions();
  const { callsCount, limit, remaining, pct, isWarning, isBlocked, incrementUsage } = useAiUsage();

  // Navigation step
  const [step, setStep] = useState<'upload' | 'result'>('upload');
  
  // Step 1: Upload States
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [hint, setHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [upgradeLink, setUpgradeLink] = useState<string | null>(null);
  
  // Drag over dropzone state
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Form States (populated by API response)
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[2]); // Default 'Gut'
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState<string | null>(null);
  const [keyFeatures, setKeyFeatures] = useState<string[]>([]);
  const [remainingCalls, setRemainingCalls] = useState<number | null>(null);

  // Addition of custom key features
  const [showFeatureInput, setShowFeatureInput] = useState(false);
  const [newFeatureText, setNewFeatureText] = useState('');

  // Copy status banner state
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Platform Connection warnings / states
  const [vintedPrompt, setVintedPrompt] = useState(false);
  const [ebayPrompt, setEbayPrompt] = useState(false);
  const [vintedConnected, setVintedConnected] = useState(false);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [isPostingVinted, setIsPostingVinted] = useState(false);
  const [isPostingEbay, setIsPostingEbay] = useState(false);

  // Load platform connection status on mount
  useEffect(() => {
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    if (token) {
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      fetch(`${apiBase}/vinted/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setVintedConnected(!!data.connected);
        })
        .catch(() => {});

      fetch(`${apiBase}/ebay/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setEbayConnected(!!data.connected);
        })
        .catch(() => {});
    }
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.preview));
    };
  }, [photos]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const fileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const filtered = newFiles.filter(f => validTypes.includes(f.type));
    
    if (photos.length + filtered.length > 8) {
      setErrorMessage("Du kannst maximal 8 Fotos hochladen.");
      return;
    }

    const uploaded: UploadedPhoto[] = filtered.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setPhotos(prev => [...prev, ...uploaded]);
    setErrorMessage(null);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Submit flow
  const analyzePhotos = async () => {
    if (photos.length === 0) return;
    if (isBlocked) {
      setErrorMessage(`Tageslimit erreicht (${callsCount}/${limit}). Morgen wieder verfügbar.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setUpgradeLink(null);

    const formData = new FormData();
    photos.forEach(p => {
      formData.append('images', p.file);
    });
    if (hint) {
      formData.append('hint', hint);
    }

    try {
      const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${apiBase}/ai/analyze-photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.status === 429) {
        const code = data.code || '';
        if (code === 'PLAN_LIMIT_REACHED') {
          // User has exhausted their paid monthly quota → show upgrade prompt
          setErrorMessage(data.message || 'Dein monatliches KI-Limit wurde erreicht.');
          setUpgradeLink(data.upgradeLink || '/einstellungen');
        } else {
          // Temporary API quota (Gemini / all providers busy) → soft message, no upgrade prompt
          setErrorMessage('Die KI-Dienste sind momentan ausgelastet. Bitte versuche es in wenigen Minuten erneut.');
          setUpgradeLink(null);
        }
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Die Analyse ist fehlgeschlagen.');
      }

      // Populate results form
      setTitle(data.title || '');
      setCategory(CATEGORIES.includes(data.category) ? data.category : CATEGORIES[CATEGORIES.length - 1]);
      setCondition(CONDITIONS.includes(data.condition) ? data.condition : CONDITIONS[2]);
      setPrice(data.price || 0);
      setDescription(data.description || '');
      setBrand(data.brand || null);
      setKeyFeatures(data.keyFeatures || []);
      setRemainingCalls(data.remainingCallsThisMonth !== undefined ? data.remainingCallsThisMonth : null);

      incrementUsage(); // update usage counter immediately
      setStep('result');
    } catch (err: any) {
      setErrorMessage(err.message || 'Netzwerkfehler beim Analysieren der Fotos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy details action
  const copyToClipboard = () => {
    const text = `Titel: ${title}\nBeschreibung: ${description}\nPreis: ${price} €\nKategorie: ${category}\nZustand: ${condition}`;
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Save Draft in Firestore
  const handleSaveDraft = async () => {
    setIsSaving(true);
    
    const adDraft = {
      title,
      category,
      price: `${price} €`,
      description,
      brand,
      condition,
      keyFeatures,
      // Default placeholder image or first uploaded thumbnail
      image: photos.length > 0 ? photos[0].preview : 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=No+Image',
      date: new Date().toLocaleDateString('de-DE'),
      views: 0,
      favorites: 0,
      messages: 0,
      autoRepost: false
    };

    const draftResult = await saveDraft(adDraft);
    setIsSaving(false);
    
    if (draftResult && draftResult.success) {
      navigate('/meine-anzeigen');
    }
  };

  const handlePostVinted = async () => {
    if (!vintedConnected) {
      setVintedPrompt(true);
      return;
    }

    setIsPostingVinted(true);
    setErrorMessage(null);

    const adDraft = {
      title,
      category,
      price: `${price} €`,
      description,
      brand,
      condition,
      keyFeatures,
      image: photos.length > 0 ? photos[0].preview : 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=No+Image',
      date: new Date().toLocaleDateString('de-DE'),
      views: 0,
      favorites: 0,
      messages: 0,
      autoRepost: false
    };

    try {
      const draftResult = await saveDraft(adDraft);
      if (!draftResult || !draftResult.success) {
        throw new Error("Fehler beim Speichern des Entwurfs vor dem Posten auf Vinted.");
      }

      const adId = draftResult.ad.id;

      const crossPostResult = await handleVintedCrossPost(adId);
      if (crossPostResult.success) {
        navigate('/meine-anzeigen');
      } else {
        setErrorMessage(crossPostResult.error || "Fehler beim Posten auf Vinted.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Fehler beim Cross-Posting.");
    } finally {
      setIsPostingVinted(false);
    }
  };

  const handlePostEbay = async () => {
    if (!ebayConnected) {
      setEbayPrompt(true);
      return;
    }

    setIsPostingEbay(true);
    setErrorMessage(null);

    const adDraft = {
      title,
      category,
      price: `${price} €`,
      description,
      brand,
      condition,
      keyFeatures,
      image: photos.length > 0 ? photos[0].preview : 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=No+Image',
      date: new Date().toLocaleDateString('de-DE'),
      views: 0,
      favorites: 0,
      messages: 0,
      autoRepost: false
    };

    try {
      const draftResult = await saveDraft(adDraft);
      if (!draftResult || !draftResult.success) {
        throw new Error("Fehler beim Speichern des Entwurfs vor dem Posten auf eBay.");
      }

      const adId = draftResult.ad.id;

      const crossPostResult = await handleEbayCrossPost(adId);
      if (crossPostResult.success) {
        navigate('/meine-anzeigen');
      } else {
        setErrorMessage(crossPostResult.error || "Fehler beim Posten auf eBay.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Fehler beim Cross-Posting.");
    } finally {
      setIsPostingEbay(false);
    }
  };

  const handleAddFeature = () => {
    if (newFeatureText.trim() && keyFeatures.length < 4) {
      setKeyFeatures(prev => [...prev, newFeatureText.trim()]);
      setNewFeatureText('');
      setShowFeatureInput(false);
    }
  };

  const removeFeature = (index: number) => {
    setKeyFeatures(prev => prev.filter((_, i) => i !== index));
  };

  // RESET FLOW
  const resetFlow = () => {
    photos.forEach(p => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setHint('');
    setErrorMessage(null);
    setUpgradeLink(null);
    setStep('upload');
  };

  return (
    <div className="w-full max-w-[680px] mx-auto py-4">
      {isPostingVinted && (
        <div className="bg-pink-50 border border-pink-200 rounded-sm p-4 flex items-center justify-between shadow-sm animate-pulse mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-pink-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pink-800">
                Vinted Cross-Posting läuft...
              </p>
              <p className="text-xs text-pink-600">
                Bitte schließe dieses Fenster nicht. Der Browser-Automat veröffentlicht dein Inserat im Hintergrund.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Return Navigation Button */}
      <div className="mb-4">
        <button 
          onClick={() => step === 'result' ? resetFlow() : navigate('/meine-anzeigen')}
          className="inline-flex items-center text-[13px] font-semibold text-gray-600 hover:text-[#A8C300] transition-colors focus:outline-none"
        >
          &larr; Zurück zu Meine Anzeigen
        </button>
      </div>
      
      {/* Title Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#333]">Neue Anzeige mit KI erstellen</h1>
        <p className="text-[13px] text-gray-500">Analysiere deine Produktfotos vollautomatisch</p>
      </div>

      {errorMessage && (
        <div className={`mb-6 p-4 border rounded-lg text-sm flex gap-3 items-start animate-in fade-in duration-200 ${
          upgradeLink
            ? 'bg-[#fff0f0] border-red-200 text-red-600'
            : 'bg-orange-50 border-orange-200 text-orange-700'
        }`}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{upgradeLink ? 'Limit erreicht' : 'KI-Dienst vorübergehend ausgelastet'}</p>
            <p className="mt-0.5">{errorMessage}</p>
            {upgradeLink && (
              <button
                onClick={() => navigate(upgradeLink)}
                className="mt-2 inline-flex items-center font-bold text-red-700 hover:underline"
              >
                Jetzt upgraden →
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 1: UPLOAD CARD */}
      {step === 'upload' && (
        <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Fotos hochladen</h2>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerUpload}
            className={`w-full min-h-[180px] border-2 border-dashed rounded-lg p-6 flex flex-col justify-center items-center gap-3 cursor-pointer transition-colors ${
              isDragActive 
                ? "border-[#A8C300] bg-green-50/20" 
                : "border-[#A8C300]/60 hover:border-[#A8C300] hover:bg-gray-50/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={fileSelected}
            />
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-[#A8C300]">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-center">
              <span className="font-semibold text-gray-800 text-[14px]">Fotos hier ablegen oder klicken</span>
              <span className="block text-[12px] text-gray-400 mt-1">JPEG, PNG, WEBP (Maximal 4MB pro Foto)</span>
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 text-[12px] text-gray-500">
            <span>Unterstützt Drag & Drop</span>
            <span className="font-medium text-gray-700">{photos.length} / 8 Fotos</span>
          </div>

          {/* Grid of uploaded thumbnails */}
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-5">
              {photos.map((photo, i) => (
                <div key={i} className="relative aspect-square bg-gray-50 border border-gray-200 rounded-lg overflow-hidden group">
                  <img src={photo.preview} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(i);
                    }}
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full shadow-sm transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hint Area */}
          <div className="mt-6 border-t border-gray-100 pt-6">
            <label className="block text-[13px] font-semibold text-gray-800 mb-1.5">
              Zusätzlicher Hinweis für die KI (Optional)
            </label>
            <div className="relative">
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value.substring(0, 200))}
                placeholder="z.B. 'Größe M', 'leichte Gebrauchsspuren', 'mit OVP'"
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300] resize-none"
              />
              <div className="absolute right-2.5 bottom-2 text-[11px] text-gray-400">
                {hint.length} / 200
              </div>
            </div>
          </div>

          {/* AI Usage indicator */}
          <div className={`mt-4 rounded-lg px-4 py-2.5 flex items-center gap-3 text-[13px] ${
            isBlocked ? 'bg-red-50 border border-red-200' :
            isWarning ? 'bg-yellow-50 border border-yellow-200' :
            'bg-gray-50 border border-gray-200'
          }`}>
            <span className={`font-medium whitespace-nowrap ${isBlocked ? 'text-red-600' : isWarning ? 'text-yellow-700' : 'text-gray-500'}`}>
              {isBlocked ? '🚫 Tageslimit erreicht' : isWarning ? `⚠️ Noch ${remaining} KI-Anfragen` : `✨ ${remaining} von ${limit} verfügbar`}
            </span>
            <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isBlocked ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : 'bg-green-400'}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <span className="text-gray-400 font-mono whitespace-nowrap">{callsCount}/{limit}</span>
          </div>

          {/* Action button */}
          <button
            onClick={analyzePhotos}
            disabled={photos.length === 0 || isLoading || isBlocked}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded transition-colors text-sm shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analysiere Produktfotos... (Kann einen Moment dauern)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>Fotos mit KI analysieren</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* STEP 2: RESULT FORM CARD */}
      {step === 'result' && (
        <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden animate-in fade-in duration-300">
          
          {/* Success Banner */}
          <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-800 px-5 py-3 flex gap-2 items-center text-sm">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>KI hat deine Fotos analysiert — überprüfe die Daten unten.</span>
            {remainingCalls !== null && remainingCalls !== -1 && (
              <span className="ml-auto text-[11px] bg-emerald-100/60 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                {remainingCalls} Analysen übrig
              </span>
            )}
          </div>

          {/* Form wrapper */}
          <div className="p-6 space-y-6">

            {/* Horizontal photo strip */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Analysierte Fotos</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {photos.map((photo, i) => (
                  <div key={i} className="shrink-0 w-16 h-16 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                    <img src={photo.preview} alt={`Thumb Strip ${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Title field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[13px] font-semibold text-gray-800">Titel</label>
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] ${title.length <= 60 ? 'text-gray-400' : 'text-red-500 font-semibold'}`}>
                    {title.length} / 60
                  </span>
                  {title.length > 0 && title.length <= 60 ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : title.length > 60 ? (
                    <X className="w-3.5 h-3.5 text-red-500" />
                  ) : null}
                </div>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none transition-colors ${
                  title.length > 60 
                    ? "border-red-400 focus:border-red-500 bg-red-50/10" 
                    : "border-gray-300 focus:border-[#A8C300]"
                }`}
              />
            </div>

            {/* Grid for category & price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-[13px] font-semibold text-gray-800 mb-1.5">Kategorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300] bg-white cursor-pointer"
                >
                  {CATEGORIES.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-[13px] font-semibold text-gray-800 mb-1.5">Preis (€)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300]"
                />
                <span className="block text-[11px] text-gray-400 italic mt-1 leading-normal">
                  * KI-Schätzung basierend auf sichtbaren Merkmalen.
                </span>
                <div className="mt-2">
                  <PriceSuggestion
                    adId="new"
                    adTitle={title}
                    currentPrice={`${price}`}
                    onCheck={async (_adId, adTitle) => handlePriceCheck('new', adTitle)}
                    aiBlocked={isBlocked}
                  />
                </div>
              </div>
            </div>

            {/* Condition segmented control */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Zustand</label>
              <div className="grid grid-cols-5 border border-gray-200 rounded overflow-hidden">
                {CONDITIONS.map((cond, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCondition(cond)}
                    className={`py-2 px-1 text-center text-xs font-semibold border-r last:border-0 border-gray-100 relative transition-colors ${
                      condition === cond 
                        ? "text-gray-900 bg-green-50/40" 
                        : "text-gray-500 hover:bg-gray-50/50"
                    }`}
                  >
                    {cond}
                    {condition === cond && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#A8C300]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Description textarea */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[13px] font-semibold text-gray-800">Beschreibung</label>
                <span className={`text-[11px] ${description.length >= 80 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}`}>
                  {description.length} Zeichen (Min. 80 erforderlich)
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none transition-colors ${
                  description.length < 80 
                    ? "border-red-300 focus:border-red-400 bg-red-50/5" 
                    : "border-gray-300 focus:border-[#A8C300]"
                }`}
              />
            </div>

            {/* Key Features pills */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Hervorgehobene Merkmale (Max. 4)</label>
              <div className="flex flex-wrap gap-2 items-center">
                {keyFeatures.map((feat, idx) => (
                  <span 
                    key={idx} 
                    className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-semibold animate-in zoom-in-95 duration-100"
                  >
                    <span>{feat}</span>
                    <button 
                      onClick={() => removeFeature(idx)} 
                      className="p-0.5 rounded-full hover:bg-green-100 text-green-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                
                {keyFeatures.length < 4 && !showFeatureInput && (
                  <button
                    onClick={() => setShowFeatureInput(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A8C300] hover:text-[#96ae00] hover:underline px-2 py-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Merkmal
                  </button>
                )}

                {showFeatureInput && (
                  <div className="flex items-center gap-1.5 animate-in slide-in-from-left-2 duration-150">
                    <input
                      type="text"
                      maxLength={30}
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      placeholder="Neues Merkmal..."
                      className="border border-gray-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[#A8C300] w-36"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddFeature()}
                      autoFocus
                    />
                    <button 
                      onClick={handleAddFeature}
                      className="bg-[#A8C300] text-white p-1 rounded hover:bg-[#96ae00] text-xs font-bold"
                    >
                      Hinzufügen
                    </button>
                    <button 
                      onClick={() => { setShowFeatureInput(false); setNewFeatureText(''); }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* COPY CLIPBOARD SECTION */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
              <h4 className="text-[13px] font-bold text-gray-800 mb-2 uppercase tracking-wider">Anzeige kopieren</h4>
              <p className="text-[12px] text-gray-500 mb-3">
                Kopiere alle Felder als vorstrukturierten Text, um sie manuell auf Kleinanzeigen oder anderen Plattformen einzufügen.
              </p>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 px-4 rounded text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Alle Felder kopieren</span>
                </button>
                {isCopied && (
                  <span className="text-[12px] text-emerald-600 font-bold animate-in fade-in duration-200">
                    Kopiert!
                  </span>
                )}
              </div>
            </div>

            {/* CROSS-POST PLATFORMS SECTION */}
            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-[13px] font-bold text-gray-800 mb-2 uppercase tracking-wider">Cross-Posting</h4>
              <p className="text-[12px] text-gray-500 mb-4">
                Inseriere dieses Angebot per Mausklick zeitgleich auf weiteren Plattformen (entwirft und postet automatisch).
              </p>

              {vintedPrompt && (
                <div className="mb-3 p-3 bg-pink-50 border border-pink-200 text-pink-700 rounded-md text-xs font-medium animate-in slide-in-from-top-2 duration-200 flex justify-between items-center">
                  <span>Bitte verbinde zuerst dein Vinted-Konto in den Einstellungen.</span>
                  <button onClick={() => setVintedPrompt(false)} className="text-pink-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {ebayPrompt && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-xs font-medium animate-in slide-in-from-top-2 duration-200 flex justify-between items-center">
                  <span>Bitte verbinde zuerst dein eBay-Konto in den Einstellungen.</span>
                  <button onClick={() => setEbayPrompt(false)} className="text-blue-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Post Vinted */}
                <button
                  onClick={handlePostVinted}
                  disabled={isPostingVinted || isPostingEbay || isSaving || title.length === 0 || description.length < 80 || title.length > 60}
                  className="flex justify-center items-center gap-1.5 text-xs font-semibold text-pink-700 border border-pink-200 hover:border-pink-300 hover:bg-pink-50/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 rounded py-2.5 transition-colors"
                >
                  {isPostingVinted ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-600" />
                  ) : (
                    <VintedLogo />
                  )}
                  <span>{isPostingVinted ? 'Postet...' : 'Auf Vinted posten'}</span>
                </button>

                {/* Post eBay */}
                <button
                  onClick={handlePostEbay}
                  disabled={isPostingVinted || isPostingEbay || isSaving || title.length === 0 || description.length < 80 || title.length > 60}
                  className="flex justify-center items-center gap-1.5 text-xs font-semibold text-blue-700 border border-blue-200 hover:border-blue-300 hover:bg-blue-50/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 rounded py-2.5 transition-colors"
                >
                  {isPostingEbay ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <EbayLogo />
                  )}
                  <span>{isPostingEbay ? 'Inseriert...' : 'Auf eBay inserieren'}</span>
                </button>
              </div>
            </div>

            {/* SAVE AS DRAFT & RESET ACTIONS */}
            <div className="border-t border-gray-100 pt-6 flex flex-col items-center gap-4">
              <button
                onClick={handleSaveDraft}
                disabled={title.length === 0 || description.length < 80 || title.length > 60 || isSaving}
                className="w-full flex items-center justify-center bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded transition-colors text-sm shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Speichere Entwurf...</span>
                  </>
                ) : (
                  <span>Als Anzeige speichern (Entwurf)</span>
                )}
              </button>

              <button
                onClick={resetFlow}
                className="text-xs text-gray-500 hover:text-gray-800 hover:underline font-semibold"
              >
                Zurück zum Foto-Upload
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
