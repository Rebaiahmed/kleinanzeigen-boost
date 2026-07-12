import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Upload,
  X,
  Check,
  Plus,
  AlertCircle,
  Loader2,
  Copy
} from 'lucide-react';
import { useAdsActions } from '../hooks/useAdsActions';
import { useAds } from '../hooks/useAds';
import { useAiUsage } from '../hooks/useAiUsage';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { saveDraftPhotos, loadDraftPhotos } from '../lib/draftPhotoStore';
import { PriceSuggestion } from '../components/ads/PriceSuggestion';
import { compressImage } from '../utils/compressImage';
import {
  DISCLAIMER_TEXT,
  DISCLAIMER_LEARN_MORE_URL,
  formatVerifiedDateLabel,
} from '../config/legalDisclaimer';
import categoryTreeData from '../config/kleinanzeigen-categories.json';

const CATEGORY_TREE: Record<string, string[]> = categoryTreeData;

// Appended verbatim to the end of the description. The leading separator
// keeps it visually distinct from the user's own text in the raw textarea
// content (which is what actually gets posted to Kleinanzeigen — a plain
// textarea can't render partial rich-text styling, so this plus the amber
// preview block below are the two ways this stays "visually set apart").
const DISCLAIMER_BLOCK = `\n\n---\n${DISCLAIMER_TEXT}`;

const CATEGORIES = Object.keys(CATEGORY_TREE);

const CONDITIONS = ["Neu", "Wie neu", "Gut", "In Ordnung", "Defekt"];

const VINTED_CONDITIONS = ["Neu mit Preisschild", "Neu ohne Preisschild", "Sehr gut", "Gut", "Zufriedenstellend"];

// Inline Vinted Logo (teal/green brand color, 14px size)
const VintedLogo = () => (
  <svg 
    viewBox="0 0 100 100" 
    className="w-3.5 h-3.5 shrink-0" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 15 L45 80 L55 80 L80 15"
      stroke="#09B1BA"
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
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
  const { ads } = useAds();
  const { saveDraft, handleEbayCrossPost, handlePriceCheck } = useAdsActions();
  const { callsCount, limit, remaining, pct, isWarning, isBlocked, unlimited, incrementUsage } = useAiUsage();
  const { enableDisclaimer } = useFeatureFlags();

  // Navigation step
  const [step, setStep] = useState<'upload' | 'result'>('upload');
  // Firestore doc id of the draft currently being edited (null until the first
  // successful save, or hydrated immediately when opened via ?draftId=).
  const [draftDocId, setDraftDocId] = useState<string | null>(null);
  
  // Step 1: Upload States
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [hint, setHint] = useState('');
  const [language, setLanguage] = useState<'de' | 'en'>('de');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [upgradeLink, setUpgradeLink] = useState<string | null>(null);
  
  // Drag over dropzone state
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Form States (populated by API response)
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState<string>(CATEGORY_TREE[CATEGORIES[0]]?.[0] || '');
  // The AI already picks a category/subcategory silently — this only shows
  // the fuller two-dropdown picker when the user clicks "Ändern" to override.
  const [isEditingCategory, setIsEditingCategory] = useState(false);
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
  const [ebayPrompt, setEbayPrompt] = useState(false);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [isPostingEbay, setIsPostingEbay] = useState(false);

  // Result tab + Vinted template states
  const [activeTab, setActiveTab] = useState<'kleinanzeigen' | 'vinted'>('kleinanzeigen');
  const [vintedTitle, setVintedTitle] = useState('');
  const [vintedDescription, setVintedDescription] = useState('');
  const [vintedPrice, setVintedPrice] = useState<number>(0);
  const [vintedCondition, setVintedCondition] = useState('Gut');
  const [vintedSize, setVintedSize] = useState<string | null>(null);
  const [vintedBrand, setVintedBrand] = useState<string | null>(null);
  const [vintedColor, setVintedColor] = useState<string | null>(null);
  const [vintedMaterial, setVintedMaterial] = useState<string | null>(null);
  const [showAllVintedFields, setShowAllVintedFields] = useState(false);
  const [isVintedCopied, setIsVintedCopied] = useState(false);

  // Per-field copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyField = (key: string, value: string | number) => {
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };
  const renderCopyBtn = (key: string, value: string | number, accent = '#A8C300') => (
    <button
      type="button"
      onClick={() => copyField(key, value)}
      title="Feld kopieren"
      className="text-gray-400 transition-colors"
      style={{ ['--tw' as any]: accent }}
      onMouseEnter={(e) => (e.currentTarget.style.color = accent)}
      onMouseLeave={(e) => (e.currentTarget.style.color = '')}
    >
      {copiedField === key
        ? <Check className="w-3.5 h-3.5 text-emerald-600" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  // Legal disclaimer insert (Gewährleistungsausschluss). This is a FREE
  // trust/safety feature, not a premium convenience one — it must never be
  // wired into useAiUsage / credit deduction. Detection is a plain string
  // match against the current placeholder/verified text; insert/remove just
  // append/strip DISCLAIMER_BLOCK from the raw description.
  const disclaimerInserted = description.includes(DISCLAIMER_TEXT);
  const insertDisclaimer = () => setDescription((prev) => prev.trimEnd() + DISCLAIMER_BLOCK);
  const removeDisclaimer = () => setDescription((prev) => prev.replace(DISCLAIMER_BLOCK, '').trimEnd());

  // Load platform connection status on mount
  useEffect(() => {
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    if (token) {
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
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

  // Hydrate from an existing draft when opened via ?draftId=... (e.g. "Öffnen"
  // from Meine Entwürfe). Text fields come from the already-cached /ads list;
  // photos come from IndexedDB — they never left the browser that saved them.
  useEffect(() => {
    if (!draftIdParam || draftDocId === draftIdParam) return;
    const draft = ads.find((a: any) => a.id === draftIdParam);
    if (!draft) return;

    setTitle(draft.title || '');
    const draftCategory = CATEGORIES.includes(draft.category) ? draft.category : CATEGORIES[CATEGORIES.length - 1];
    setCategory(draftCategory);
    const draftSubcats = CATEGORY_TREE[draftCategory] || [];
    setSubcategory(draftSubcats.includes(draft.subcategory) ? draft.subcategory : draftSubcats[0] || '');
    setIsEditingCategory(false);
    setCondition(CONDITIONS.includes(draft.condition) ? draft.condition : CONDITIONS[2]);
    setPrice(typeof draft.price === 'number' ? draft.price : parseFloat(draft.price) || 0);
    setDescription(draft.description || '');
    setBrand(draft.brand || null);
    setKeyFeatures(Array.isArray(draft.keyFeatures) ? draft.keyFeatures : []);

    const v = draft.vinted || {};
    setVintedTitle(v.title || draft.title || '');
    setVintedDescription(v.description || draft.description || '');
    setVintedPrice(v.price || 0);
    setVintedCondition(VINTED_CONDITIONS.includes(v.condition) ? v.condition : 'Gut');
    setVintedSize(v.size || null);
    setVintedBrand(v.brand || draft.brand || null);
    setVintedColor(v.color || null);
    setVintedMaterial(v.material || null);
    setShowAllVintedFields(false);

    loadDraftPhotos(draftIdParam).then((files) => {
      if (files.length > 0) {
        setPhotos(files.map((file) => ({ file, preview: URL.createObjectURL(file) })));
      }
    });

    setActiveTab('kleinanzeigen');
    setDraftDocId(draftIdParam);
    setStep('result');
  }, [draftIdParam, ads, draftDocId]);

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

  const addFiles = async (newFiles: File[]) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const filtered = newFiles.filter(f => validTypes.includes(f.type));

    if (photos.length + filtered.length > 8) {
      setErrorMessage("Du kannst maximal 8 Fotos hochladen.");
      return;
    }

    // Compress/downscale in the browser before they ever leave the device — keeps
    // uploads small (faster, no 413s) with no meaningful quality loss for ad photos.
    const compressed = await Promise.all(
      filtered.map(async (file) => {
        try { return await compressImage(file); } catch { return file; }
      }),
    );

    const uploaded: UploadedPhoto[] = compressed.map(file => ({
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
      setErrorMessage(`Monatslimit erreicht (${callsCount}/${limit}). Nächsten Monat wieder verfügbar.`);
      return;
    }
    const files = photos.map(p => p.file);

    // Pre-upload size guard. The server (and nginx in front) rejects oversized
    // uploads with a 413 that the browser surfaces as an opaque "Failed to fetch"
    // / CORS error. Catch it here with a clear, actionable message instead.
    const MB = 1024 * 1024;
    const MAX_PER_FILE = 4 * MB;   // matches backend per-photo limit
    const MAX_TOTAL = 30 * MB;     // stay safely under the server body limit
    const tooBig = files.find((f) => f.size > MAX_PER_FILE);
    if (tooBig) {
      setErrorMessage(`Ein Foto ist zu groß (max. 4 MB pro Foto). Bitte ersetze „${tooBig.name}" durch ein kleineres Bild.`);
      return;
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL) {
      setErrorMessage(`Die Fotos sind zusammen zu groß (${(totalBytes / MB).toFixed(1)} MB). Bitte verwende weniger oder kleinere Fotos.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setUpgradeLink(null);

    const formData = new FormData();
    files.forEach(f => {
      formData.append('images', f);
    });
    if (hint) {
      formData.append('hint', hint);
    }
    formData.append('language', language);

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
        } else if (code === 'AI_TIMEOUT') {
          // AI request timed out → retryable, no upgrade needed
          setErrorMessage('Die KI-Analyse dauert länger als erwartet. Bitte versuche es in wenigen Minuten erneut.');
          setUpgradeLink(null);
        } else {
          // Temporary API quota (Gemini / all providers busy) → soft message, no upgrade prompt
          setErrorMessage('Die KI-Dienste sind momentan ausgelastet. Bitte versuche es in wenigen Minuten erneut.');
          setUpgradeLink(null);
        }
        setIsLoading(false);
        return;
      }

      if (data.code === 'PHOTOS_NOT_RECOGNIZED') {
        // The AI couldn't identify a product in the photos (or returned an
        // unusable result) — show a clear error instead of populating the
        // form with placeholder/garbage text. No credit was charged for this.
        setErrorMessage('Konnte Fotos nicht analysieren — bitte erneut versuchen.');
        setUpgradeLink(null);
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Die Analyse ist fehlgeschlagen.');
      }

      // Populate results form
      setTitle(data.title || '');
      const aiCategory = CATEGORIES.includes(data.category) ? data.category : CATEGORIES[CATEGORIES.length - 1];
      setCategory(aiCategory);
      const aiSubcats = CATEGORY_TREE[aiCategory] || [];
      setSubcategory(aiSubcats.includes(data.subcategory) ? data.subcategory : aiSubcats[0] || '');
      setIsEditingCategory(false);
      setCondition(CONDITIONS.includes(data.condition) ? data.condition : CONDITIONS[2]);
      setPrice(data.price || 0);
      setDescription(data.description || '');
      setBrand(data.brand || null);
      setKeyFeatures(data.keyFeatures || []);
      setRemainingCalls(data.remainingCallsThisMonth !== undefined ? data.remainingCallsThisMonth : null);

      // Vinted template (same single AI call — no extra cost)
      const v = data.vinted || {};
      setVintedTitle(v.title || data.title || '');
      setVintedDescription(v.description || data.description || '');
      setVintedPrice(v.price || data.price || 0);
      setVintedCondition(VINTED_CONDITIONS.includes(v.condition) ? v.condition : 'Gut');
      setVintedSize(v.size || null);
      setVintedBrand(v.brand || data.brand || null);
      setVintedColor(v.color || null);
      setVintedMaterial(v.material || null);
      setShowAllVintedFields(false);
      setActiveTab('kleinanzeigen');

      incrementUsage(); // update usage counter immediately
      setStep('result');
    } catch (err: any) {
      // A 413 (payload too large) from nginx has no CORS header, so the browser
      // blocks reading it and fetch rejects with a TypeError "Failed to fetch" —
      // there's no status to inspect. Treat that opaque network failure as the
      // most likely cause (oversized upload) with an actionable message.
      const isNetwork = err?.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(err?.message || '');
      setErrorMessage(
        isNetwork
          ? 'Upload fehlgeschlagen – die Fotos sind vermutlich zu groß. Bitte verwende weniger oder kleinere Fotos und versuche es erneut.'
          : err.message || 'Netzwerkfehler beim Analysieren der Fotos.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Copy details action
  const copyToClipboard = () => {
    const text = `Titel: ${title}\nBeschreibung: ${description}\nPreis: ${price} €\nKategorie: ${category} → ${subcategory}\nZustand: ${condition}`;
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Copy Vinted fields
  const copyVintedToClipboard = () => {
    const lines = [
      `Titel: ${vintedTitle}`,
      `Beschreibung: ${vintedDescription}`,
      `Preis: ${vintedPrice} €`,
      `Zustand: ${vintedCondition}`,
    ];
    if (vintedBrand) lines.push(`Marke: ${vintedBrand}`);
    if (vintedSize) lines.push(`Größe: ${vintedSize}`);
    if (vintedColor) lines.push(`Farbe: ${vintedColor}`);
    if (vintedMaterial) lines.push(`Material: ${vintedMaterial}`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setIsVintedCopied(true);
      setTimeout(() => setIsVintedCopied(false), 2000);
    });
  };

  // Builds the JSON payload for POST /ads/draft. Images are never included —
  // they're saved separately to IndexedDB, keyed by the same draft id.
  const buildDraftPayload = (id: string) => ({
    id,
    title,
    category,
    subcategory,
    price,
    description,
    brand,
    condition,
    keyFeatures,
    vinted: {
      title: vintedTitle,
      description: vintedDescription,
      price: vintedPrice,
      condition: vintedCondition,
      size: vintedSize,
      brand: vintedBrand,
      color: vintedColor,
      material: vintedMaterial,
    },
    autoRepost: false,
  });

  // Save Draft in Firestore
  const handleSaveDraft = async () => {
    setIsSaving(true);

    const id = draftDocId || `draft_${crypto.randomUUID()}`;
    await saveDraftPhotos(id, photos.map(p => p.file));
    const draftResult = await saveDraft(buildDraftPayload(id));
    setIsSaving(false);

    if (draftResult && draftResult.success) {
      setDraftDocId(id);
      navigate('/meine-entwuerfe');
    }
  };

  const handlePostEbay = async () => {
    if (!ebayConnected) {
      setEbayPrompt(true);
      return;
    }

    setIsPostingEbay(true);
    setErrorMessage(null);

    try {
      const id = draftDocId || `draft_${crypto.randomUUID()}`;
      await saveDraftPhotos(id, photos.map(p => p.file));
      const draftResult = await saveDraft(buildDraftPayload(id));
      if (!draftResult || !draftResult.success) {
        throw new Error("Fehler beim Speichern des Entwurfs vor dem Posten auf eBay.");
      }
      setDraftDocId(id);

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
      {/* Return Navigation Button */}
      <div className="mb-4">
        <button
          onClick={() => step === 'result' ? resetFlow() : navigate(draftDocId ? '/meine-entwuerfe' : '/meine-anzeigen')}
          className="inline-flex items-center text-[13px] font-semibold text-gray-600 hover:text-[#A8C300] transition-colors focus:outline-none"
        >
          &larr; Zurück zu {draftDocId ? 'Meine Entwürfe' : 'Meine Anzeigen'}
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

          {/* Language selector */}
          <div className="mt-5">
            <label className="block text-[13px] font-semibold text-gray-800 mb-1.5">
              Sprache für Titel & Beschreibung
            </label>
            <div className="inline-flex border border-gray-200 rounded overflow-hidden">
              {([['de', '🇩🇪 Deutsch'], ['en', '🇬🇧 English']] as const).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`px-4 py-2 text-[13px] font-semibold transition-colors ${
                    language === code
                      ? 'bg-[#A8C300] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Usage indicator — hidden bar/counter when usage is unlimited */}
          {unlimited ? (
            <div className="mt-4 rounded-lg px-4 py-2.5 flex items-center gap-2 text-[13px] bg-gray-50 border border-gray-200">
              <span className="font-medium text-gray-500">✨ Unbegrenzte KI-Analysen</span>
            </div>
          ) : (
            <div className={`mt-4 rounded-lg px-4 py-2.5 flex items-center gap-3 text-[13px] ${
              isBlocked ? 'bg-red-50 border border-red-200' :
              isWarning ? 'bg-yellow-50 border border-yellow-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <span className={`font-medium whitespace-nowrap ${isBlocked ? 'text-red-600' : isWarning ? 'text-yellow-700' : 'text-gray-500'}`}>
                {isBlocked ? '🚫 Monatslimit erreicht' : isWarning ? `⚠️ Noch ${remaining} KI-Anfragen` : `✨ ${remaining} von ${limit} verfügbar`}
              </span>
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isBlocked ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : 'bg-green-400'}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className="text-gray-400 font-mono whitespace-nowrap">{callsCount}/{limit}</span>
            </div>
          )}

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
            <div className="ml-auto flex items-center gap-2">
              {remainingCalls !== null && remainingCalls !== -1 && (
                <span className="text-[11px] bg-emerald-100/60 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  {remainingCalls} Analysen übrig
                </span>
              )}
              {/* Regenerate: re-run the same photos through the AI. Uses one more
                  AI analysis (counts against the quota), hence the title hint. */}
              <button
                type="button"
                onClick={analyzePhotos}
                disabled={isLoading || isBlocked}
                title={isBlocked ? 'Monatslimit erreicht' : 'Erneut generieren (verbraucht eine weitere KI-Analyse)'}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#86b817] hover:text-[#6f8f00] disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
                <span>Neu generieren</span>
              </button>
            </div>
          </div>

          {/* Platform tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50/50 px-2">
            <button
              type="button"
              onClick={() => setActiveTab('kleinanzeigen')}
              className={`px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === 'kleinanzeigen'
                  ? 'border-[#A8C300] text-[#86b817]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="font-bold">kleinanzeigen</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vinted')}
              className={`px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === 'vinted'
                  ? 'border-[#09B1BA] text-[#09B1BA]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <VintedLogo />
              <span>Vinted</span>
            </button>
          </div>

          {/* Form wrapper */}
          {activeTab === 'kleinanzeigen' && (
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
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] ${title.length <= 60 ? 'text-gray-400' : 'text-red-500 font-semibold'}`}>
                    {title.length} / 60
                  </span>
                  {title.length > 0 && title.length <= 60 ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : title.length > 60 ? (
                    <X className="w-3.5 h-3.5 text-red-500" />
                  ) : null}
                  {renderCopyBtn('ka-title', title)}
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
              {/* Category — AI picks category+subcategory silently; shown as a single
                  confirmable line. Clicking "Ändern" reveals the full two-dropdown
                  picker instead of showing it by default (fewer default decisions
                  for the target audience). */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[13px] font-semibold text-gray-800">Kategorie</label>
                  {renderCopyBtn('ka-category', `${category} → ${subcategory}`)}
                </div>
                {!isEditingCategory ? (
                  <div className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white flex items-center justify-between gap-2">
                    <span className="text-gray-800 truncate">
                      {category} <span className="text-gray-400">→</span> {subcategory}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Check className="w-4 h-4 text-[#A8C300]" aria-label="Bestätigt" />
                      <button
                        type="button"
                        onClick={() => setIsEditingCategory(true)}
                        className="text-[12px] font-semibold text-gray-500 hover:text-gray-800 underline underline-offset-2"
                      >
                        Ändern
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={category}
                      onChange={(e) => {
                        const nextCategory = e.target.value;
                        setCategory(nextCategory);
                        setSubcategory(CATEGORY_TREE[nextCategory]?.[0] || '');
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300] bg-white cursor-pointer"
                    >
                      {CATEGORIES.map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300] bg-white cursor-pointer"
                    >
                      {(CATEGORY_TREE[category] || []).map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsEditingCategory(false)}
                      className="text-[12px] font-semibold text-[#A8C300] hover:text-[#8fa600] underline underline-offset-2"
                    >
                      ✓ Bestätigen
                    </button>
                  </div>
                )}
              </div>

              {/* Price */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[13px] font-semibold text-gray-800">Preis (€)</label>
                  {renderCopyBtn('ka-price', price)}
                </div>
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
              <div className="flex justify-between items-center mb-2">
                <label className="text-[13px] font-semibold text-gray-800">Zustand</label>
                {renderCopyBtn('ka-condition', condition)}
              </div>
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
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] ${description.length >= 80 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}`}>
                    {description.length} Zeichen (Min. 80 erforderlich)
                  </span>
                  {renderCopyBtn('ka-desc', description)}
                </div>
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

              {/* Legal disclaimer insert — free trust/safety feature, never
                  credit-gated. Flag-gated because the shipped text is a
                  placeholder until legally verified (see legalDisclaimer.ts). */}
              {enableDisclaimer && (
                <div className="mt-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {!disclaimerInserted ? (
                      <button
                        type="button"
                        onClick={insertDisclaimer}
                        className="inline-flex items-center gap-1 bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-medium py-1 px-2.5 rounded-sm text-[12px] transition-colors"
                      >
                        🛡️ Rechtstext einfügen
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center text-[11px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                          EINGEFÜGT
                        </span>
                        <button
                          type="button"
                          onClick={removeDisclaimer}
                          className="text-[12px] text-gray-500 hover:text-red-600 font-medium underline hover:no-underline"
                        >
                          Entfernen
                        </button>
                      </div>
                    )}
                    <span className="text-[11px] text-gray-400">
                      Geprüft: {formatVerifiedDateLabel()}
                    </span>
                  </div>

                  {/* Distinct preview block — the raw textarea already has this
                      exact text appended (that's what actually gets posted);
                      this is purely the "visually set apart" affordance a
                      plain textarea can't render inline. */}
                  {disclaimerInserted && (
                    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-sm text-[12px] text-amber-900 whitespace-pre-wrap">
                      {DISCLAIMER_TEXT}
                    </div>
                  )}

                  <p className="mt-1.5 text-[11px] text-gray-400 leading-snug">
                    Dieser Text wird regelmäßig von uns überprüft. Ersetzt keine individuelle Rechtsberatung.{' '}
                    <a
                      href={DISCLAIMER_LEARN_MORE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      Mehr erfahren
                    </a>
                  </p>
                </div>
              )}
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

              {ebayPrompt && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-xs font-medium animate-in slide-in-from-top-2 duration-200 flex justify-between items-center">
                  <span>Bitte verbinde zuerst dein eBay-Konto in den Einstellungen.</span>
                  <button onClick={() => setEbayPrompt(false)} className="text-blue-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Vinted — coming soon */}
                <button
                  disabled
                  title="Vinted-Integration kommt in Kürze"
                  className="flex justify-center items-center gap-1.5 text-xs font-semibold text-gray-400 border border-gray-200 bg-gray-50 rounded py-2.5 cursor-not-allowed"
                >
                  <span>Vinted 🚧</span>
                </button>

                {/* Post eBay — coming soon */}
                <button
                  disabled
                  title="eBay-Integration kommt in Kürze"
                  className="flex justify-center items-center gap-1.5 text-xs font-semibold text-gray-400 border border-gray-200 bg-gray-100 rounded py-2.5 cursor-not-allowed"
                >
                  <EbayLogo />
                  <span>eBay 🚧 (kommt bald)</span>
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
          )}

          {/* VINTED PANEL */}
          {activeTab === 'vinted' && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-2 bg-[#e6f7f8] border border-[#b8e8ea] rounded-lg p-3 text-[12px] text-[#0a7a80]">
              <VintedLogo />
              <span>
                Diese Vorlage ist für Vinted optimiert (kürzer, lockerer Stil). Kopiere die Felder und füge sie beim Erstellen deiner Vinted-Anzeige ein — Vinted füllt Kategorie & weitere Felder automatisch aus deinen Fotos aus.
              </span>
            </div>

            {/* Vinted Title */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[13px] font-semibold text-gray-800">Titel</label>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] ${vintedTitle.length <= 50 ? 'text-gray-400' : 'text-red-500 font-semibold'}`}>
                    {vintedTitle.length} / 50
                  </span>
                  {renderCopyBtn('v-title', vintedTitle, '#09B1BA')}
                </div>
              </div>
              <input
                type="text"
                value={vintedTitle}
                onChange={(e) => setVintedTitle(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#09B1BA]"
              />
            </div>

            {/* Vinted price */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[13px] font-semibold text-gray-800">Preis (€)</label>
                {renderCopyBtn('v-price', vintedPrice, '#09B1BA')}
              </div>
              <input
                type="number"
                value={vintedPrice}
                onChange={(e) => setVintedPrice(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#09B1BA]"
              />
              <span className="block text-[11px] text-gray-400 italic mt-1">* Vinted-Käufer erwarten oft etwas niedrigere Preise.</span>
            </div>

            {/* Vinted Condition */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[13px] font-semibold text-gray-800">Zustand</label>
                {renderCopyBtn('v-condition', vintedCondition, '#09B1BA')}
              </div>
              <div className="flex flex-wrap gap-2">
                {VINTED_CONDITIONS.map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setVintedCondition(cond)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      vintedCondition === cond
                        ? 'bg-[#e6f7f8] border-[#09B1BA] text-[#09B1BA]'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            {/* Vinted extra fields — full set for fashion, lite + toggle otherwise */}
            {(() => {
              const isFashion = /mode|beauty|kleidung|schuhe|accessoir/i.test(category || '');
              const showExtras = isFashion || showAllVintedFields;
              return (
                <div>
                  {!isFashion && (
                    <button
                      type="button"
                      onClick={() => setShowAllVintedFields((v) => !v)}
                      className="text-[12px] font-semibold text-[#09B1BA] hover:underline mb-3"
                    >
                      {showAllVintedFields ? '− Weniger Vinted-Felder' : '+ Mehr Vinted-Felder (Marke, Größe, Farbe, Material)'}
                    </button>
                  )}
                  {showExtras && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Marke */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-[13px] font-semibold text-gray-800">Marke</label>
                          {vintedBrand && renderCopyBtn('v-brand', vintedBrand, '#09B1BA')}
                        </div>
                        <input
                          type="text"
                          value={vintedBrand || ''}
                          onChange={(e) => setVintedBrand(e.target.value || null)}
                          placeholder="z.B. Nike, Zara — wichtig für Vinted-Suche"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#09B1BA]"
                        />
                      </div>
                      {/* Größe */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-[13px] font-semibold text-gray-800">Größe</label>
                          {vintedSize && renderCopyBtn('v-size', vintedSize, '#09B1BA')}
                        </div>
                        <input
                          type="text"
                          value={vintedSize || ''}
                          onChange={(e) => setVintedSize(e.target.value || null)}
                          placeholder="z.B. M, 42, EU 38"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#09B1BA]"
                        />
                      </div>
                      {/* Farbe */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-[13px] font-semibold text-gray-800">Farbe</label>
                          {vintedColor && renderCopyBtn('v-color', vintedColor, '#09B1BA')}
                        </div>
                        <input
                          type="text"
                          value={vintedColor || ''}
                          onChange={(e) => setVintedColor(e.target.value || null)}
                          placeholder="z.B. Schwarz, Blau"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#09B1BA]"
                        />
                      </div>
                      {/* Material */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-[13px] font-semibold text-gray-800">Material</label>
                          {vintedMaterial && renderCopyBtn('v-material', vintedMaterial, '#09B1BA')}
                        </div>
                        <input
                          type="text"
                          value={vintedMaterial || ''}
                          onChange={(e) => setVintedMaterial(e.target.value || null)}
                          placeholder="z.B. Baumwolle, Leder"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#09B1BA]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Vinted Description */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[13px] font-semibold text-gray-800">Beschreibung</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">{vintedDescription.length} Zeichen</span>
                  {renderCopyBtn('v-desc', vintedDescription, '#09B1BA')}
                </div>
              </div>
              <textarea
                value={vintedDescription}
                onChange={(e) => setVintedDescription(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#09B1BA] resize-none"
              />
            </div>

            {/* Copy all */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={copyVintedToClipboard}
                  className="bg-[#09B1BA] hover:bg-[#079aa2] text-white font-semibold py-2 px-4 rounded text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Alle Felder für Vinted kopieren</span>
                </button>
                {isVintedCopied && (
                  <span className="text-[12px] text-[#09B1BA] font-bold animate-in fade-in duration-200">Kopiert!</span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">📷 Die Fotos lädst du bei Vinted selbst hoch – Vinted erlaubt kein automatisches Übertragen von Bildern.</p>
            </div>

            {/* SAVE AS DRAFT & RESET ACTIONS — same draft (both platform formats) as the Kleinanzeigen tab */}
            <div className="border-t border-gray-100 pt-6 flex flex-col items-center gap-4">
              <button
                onClick={handleSaveDraft}
                disabled={title.length === 0 || description.length < 80 || title.length > 60 || isSaving}
                className="w-full flex items-center justify-center bg-[#09B1BA] hover:bg-[#079aa2] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded transition-colors text-sm shadow-sm"
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
          )}
        </div>
      )}

    </div>
  );
}
