import { useState } from 'react';
import type { ExportOptions } from '../../utils/exportGenerator';

const STORAGE_KEY = 'gpx-export-options';

const PRESET_COLORS: { label: string; hex: string }[] = [
  { label: 'Bleu',   hex: '3b82f6' },
  { label: 'Rouge',  hex: 'ef4444' },
  { label: 'Vert',   hex: '22c55e' },
  { label: 'Orange', hex: 'f97316' },
  { label: 'Violet', hex: 'a855f7' },
  { label: 'Noir',   hex: '000000' },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function isValidHex(hex: string): boolean {
  return /^[0-9a-fA-F]{6}$/.test(hex);
}

interface SavedPrefs {
  format:       ExportOptions['format'];
  includeStart: boolean;
  includeEnd:   boolean;
  includeVia:   boolean;
  traceColor:   string;
  dualExport:   boolean;
}

function loadPrefs(): SavedPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error();
    return JSON.parse(raw) as SavedPrefs;
  } catch {
    return {
      format:       'gpx',
      includeStart: false,
      includeEnd:   false,
      includeVia:   false,
      traceColor:   '3b82f6',
      dualExport:   false,
    };
  }
}

function savePrefs(p: SavedPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// ── Toggle (défini hors du composant parent pour éviter la recréation) ──────
function Toggle({
  value, onChange, disabled = false,
}: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${value && !disabled ? 'bg-blue-500' : 'bg-gray-300'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow
        transition-transform ${value && !disabled ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </div>
  );
}

interface Props {
  onClose:       () => void;
  onExport:      (opts: ExportOptions) => void;
  waypointCount: number;
  routeName:     string;
}

export default function ExportModal({ onClose, onExport, waypointCount, routeName }: Props) {
  const prefs = loadPrefs();

  const [format,       setFormat]       = useState<ExportOptions['format']>(prefs.format);
  const [includeStart, setIncludeStart] = useState(prefs.includeStart);
  const [includeEnd,   setIncludeEnd]   = useState(prefs.includeEnd);
  const [includeVia,   setIncludeVia]   = useState(prefs.includeVia);
  const [hexInput,     setHexInput]     = useState(prefs.traceColor);
  const [rgb,          setRgb]          = useState<[number, number, number]>(hexToRgb(prefs.traceColor));
  const [hexError,     setHexError]     = useState(false);
  const [dualExport,   setDualExport]   = useState(prefs.dualExport ?? false);

  const safeFileName = routeName.trim().replace(/[/\\?%*:|"<>]/g, '-') || 'itinéraire';
  const hasVia = waypointCount > 2;

  // ── Persistance ────────────────────────────────────────
  const persist = (patch: Partial<SavedPrefs>) => {
    savePrefs({
      format,
      includeStart,
      includeEnd,
      includeVia,
      traceColor: hexInput,
      dualExport,
      ...patch,
    });
  };

  // ── Handlers ───────────────────────────────────────────
  const handleFormat = (f: ExportOptions['format']) => {
    setFormat(f);
    persist({ format: f });
  };

  const handleToggle = (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    key: keyof SavedPrefs,
    val: boolean,
  ) => {
    setter(val);
    persist({ [key]: val });
  };

  const handleDualExport = (val: boolean) => {
    setDualExport(val);
    persist({ dualExport: val });
  };

  const handlePreset = (hex: string) => {
    setHexInput(hex);
    setRgb(hexToRgb(hex));
    setHexError(false);
    persist({ traceColor: hex });
  };

  const handleHexInput = (val: string) => {
    setHexInput(val);
    if (isValidHex(val)) {
      setRgb(hexToRgb(val));
      setHexError(false);
      persist({ traceColor: val });
    } else {
      setHexError(true);
    }
  };

  const handleRgbChange = (channel: 0 | 1 | 2, val: number) => {
    const next = [...rgb] as [number, number, number];
    next[channel] = val;
    setRgb(next);
    const hex = rgbToHex(...next);
    setHexInput(hex);
    setHexError(false);
    persist({ traceColor: hex });
  };

  const handleExport = () => {
    if (hexError || !isValidHex(hexInput)) return;
    onExport({ format, includeStart, includeEnd, includeVia, traceColor: hexInput, dualExport });
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[1100]" onClick={onClose} />

      {/* Fenêtre */}
      <div className="fixed z-[1200] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      bg-white rounded-2xl shadow-2xl w-[480px] max-w-[95vw] p-6
                      max-h-[90vh] overflow-y-auto">

        {/* Titre */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">⚙️ Options d'export</h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Nom du fichier */}
        <section className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Nom du fichier
          </p>
          {dualExport ? (
            <div className="flex flex-col gap-1.5">
              <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-mono truncate">
                {safeFileName}.{format}
                <span className="ml-2 text-xs text-gray-400 font-sans">(sans waypoints)</span>
              </div>
              <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-sm text-blue-700 font-mono truncate">
                {safeFileName} wp.{format}
                <span className="ml-2 text-xs text-blue-400 font-sans">(avec tous les waypoints)</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-mono truncate">
              {safeFileName}.{format}
            </div>
          )}
        </section>

        {/* Format */}
        <section className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Format
          </p>
          <div className="flex gap-2">
            {(['gpx', 'kml', 'csv'] as const).map(f => (
              <button key={f}
                onClick={() => handleFormat(f)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors
                  ${format === f
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Points à inclure */}
        <section className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Points à inclure
          </p>
          <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-3">

            {/* Toggle export double — séparé visuellement */}
            <label className="flex items-center gap-3 pb-2.5 border-b border-gray-200">
              <Toggle
                value={dualExport}
                onChange={handleDualExport}
              />
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                📂 Exporter 2 fichiers
              </span>
              {dualExport && (
                <span className="ml-auto text-[10px] text-blue-500 bg-blue-50 rounded px-1.5 py-0.5 font-medium">
                  actif
                </span>
              )}
            </label>

            {dualExport ? (
              /* Description du mode dual */
              <div className="text-xs text-gray-500 space-y-1 px-1">
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">📄</span>
                  <span><span className="font-mono text-gray-600">{safeFileName}.{format}</span> — trace seule, sans waypoints</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">📄</span>
                  <span><span className="font-mono text-blue-600">{safeFileName} wp.{format}</span> — trace + tous les waypoints</span>
                </div>
              </div>
            ) : (
              /* Toggles individuels — désactivés si dualExport */
              ([
                { label: '🟢 Point de départ',   value: includeStart, setter: setIncludeStart, key: 'includeStart' as const, disabled: false },
                { label: '🔵 Points de passage', value: includeVia,   setter: setIncludeVia,   key: 'includeVia'   as const, disabled: !hasVia },
                { label: "🔴 Point d'arrivée",   value: includeEnd,   setter: setIncludeEnd,   key: 'includeEnd'   as const, disabled: false },
              ]).map(({ label, value, setter, key, disabled }) => (
                <label key={label} className="flex items-center gap-3">
                  <Toggle
                    value={value}
                    onChange={v => handleToggle(setter, key, v)}
                    disabled={disabled}
                  />
                  <span className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                    {label}
                    {disabled && (
                      <span className="ml-2 text-xs text-gray-400">(aucun point de passage)</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </section>

        {/* Couleur de la trace */}
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Couleur de la trace
          </p>

          {/* Présets */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {PRESET_COLORS.map(({ label, hex }) => (
              <button
                key={hex}
                title={label}
                onClick={() => handlePreset(hex)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                  ${hexInput === hex ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: `#${hex}` }}
              />
            ))}
          </div>

          {/* Sliders RGB */}
          <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2 mb-3">
            {(['R', 'G', 'B'] as const).map((ch, i) => (
              <div key={ch} className="flex items-center gap-3">
                <span className="w-4 text-xs font-bold text-gray-500">{ch}</span>
                <input
                  type="range" min={0} max={255}
                  value={rgb[i]}
                  onChange={e => handleRgbChange(i as 0 | 1 | 2, Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="w-8 text-xs text-right text-gray-600">{rgb[i]}</span>
              </div>
            ))}
          </div>

          {/* Saisie HEX */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg border border-gray-200 flex-shrink-0"
              style={{ backgroundColor: isValidHex(hexInput) ? `#${hexInput}` : '#ccc' }}
            />
            <div className="flex items-center gap-1">
              <span className="text-gray-400 font-mono">#</span>
              <input
                type="text"
                maxLength={6}
                value={hexInput}
                onChange={e => handleHexInput(e.target.value)}
                className={`w-24 px-2 py-1 rounded-lg border font-mono text-sm uppercase
                  focus:outline-none focus:ring-2
                  ${hexError
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-gray-200 focus:ring-blue-300'}`}
              />
            </div>
            {hexError && <span className="text-xs text-red-500">Code invalide</span>}
          </div>
        </section>

        {/* Bouton export */}
        <button
          onClick={handleExport}
          disabled={waypointCount < 2}
          className="w-full py-3 rounded-xl font-semibold text-white text-sm
                     bg-blue-500 hover:bg-blue-600 transition-colors shadow-md
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {dualExport
            ? `Exporter 2 fichiers ${format.toUpperCase()}`
            : `Exporter en ${format.toUpperCase()}`}
        </button>
      </div>
    </>
  );
}
