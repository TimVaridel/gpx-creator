import { useState, useCallback } from 'react';
import type { ExportOptions } from '../../utils/exportGenerator';

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

interface Props {
  onClose: () => void;
  onExport: (opts: ExportOptions) => void;
  hasGeometry: boolean;
  waypointCount: number;
}

export default function ExportModal({ onClose, onExport, hasGeometry, waypointCount }: Props) {
  const [format, setFormat]           = useState<ExportOptions['format']>('gpx');
  const [includeStart, setIncludeStart] = useState(true);
  const [includeEnd,   setIncludeEnd]   = useState(true);
  const [includeVia,   setIncludeVia]   = useState(true);
  const [hexInput, setHexInput]       = useState('3b82f6');
  const [rgb, setRgb]                 = useState<[number, number, number]>([59, 130, 246]);
  const [hexError, setHexError]       = useState(false);

  const applyHex = useCallback((hex: string) => {
    if (isValidHex(hex)) {
      setHexError(false);
      setRgb(hexToRgb(hex));
    } else {
      setHexError(true);
    }
  }, []);

  const handleHexInput = (val: string) => {
    setHexInput(val);
    applyHex(val);
  };

  const handlePreset = (hex: string) => {
    setHexInput(hex);
    setRgb(hexToRgb(hex));
    setHexError(false);
  };

  const handleRgbChange = (channel: 0 | 1 | 2, value: number) => {
    const next: [number, number, number] = [...rgb] as [number, number, number];
    next[channel] = Math.max(0, Math.min(255, value));
    setRgb(next);
    const h = rgbToHex(...next);
    setHexInput(h);
    setHexError(false);
  };

  const handleExport = () => {
    if (!isValidHex(hexInput)) return;
    onExport({ format, includeStart, includeEnd, includeVia, traceColor: hexInput });
    onClose();
  };

  const previewColor = `#${isValidHex(hexInput) ? hexInput : '3b82f6'}`;
  const hasVia = waypointCount > 2;

  // ── Toggle pill ───────────────────────────────────────────
  const Toggle = ({
    value, onChange, disabled = false,
  }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* ── Format ─────────────────────────────────────── */}
        <section className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Format
          </p>
          <div className="flex gap-2">
            {(['gpx', 'kml', 'csv'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all
                  ${format === f
                    ? 'bg-blue-500 text-white border-blue-500 shadow'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {/* ── Points à inclure ───────────────────────────── */}
        <section className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Points à inclure
          </p>
          <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-3">
            {([
              { label: '🟢 Point de départ',    value: includeStart, setter: setIncludeStart, disabled: false },
              { label: '🔵 Points de passage',  value: includeVia,   setter: setIncludeVia,   disabled: !hasVia },
              { label: "🔴 Point d'arrivée",    value: includeEnd,   setter: setIncludeEnd,   disabled: false },
            ] as const).map(({ label, value, setter, disabled }) => (
              <label key={label} className="flex items-center gap-3">
                <Toggle value={value} onChange={setter} disabled={disabled} />
                <span className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                  {label}
                  {disabled && <span className="ml-2 text-xs text-gray-400">(aucun point de passage)</span>}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* ── Couleur de la trace ────────────────────────── */}
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
                className="w-8 h-8 rounded-full border-2 border-white shadow-md
                           hover:scale-110 transition-transform"
                style={{
                  background: `#${hex}`,
                  outline: hexInput === hex ? '2px solid #1d4ed8' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>

          {/* Hex + aperçu */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-gray-500 font-mono">#</span>
            <input
              type="text"
              maxLength={6}
              value={hexInput}
              onChange={e => handleHexInput(e.target.value.toLowerCase())}
              className={`w-28 border rounded-lg px-2 py-1.5 text-sm font-mono uppercase
                ${hexError
                  ? 'border-red-400 bg-red-50 focus:ring-red-300'
                  : 'border-gray-300 focus:ring-blue-300'}
                focus:outline-none focus:ring-2`}
              placeholder="3b82f6"
            />
            {/* Aperçu couleur */}
            <div
              className="w-10 h-10 rounded-lg border border-gray-200 shadow-inner flex-shrink-0"
              style={{ background: previewColor }}
            />
            {hexError && (
              <span className="text-xs text-red-500">Code invalide</span>
            )}
          </div>

          {/* Sliders RGB */}
          <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
            {(['R', 'G', 'B'] as const).map((ch, i) => (
              <div key={ch} className="flex items-center gap-3">
                <span className={`w-4 text-xs font-bold
                  ${i === 0 ? 'text-red-500' : i === 1 ? 'text-green-600' : 'text-blue-500'}`}>
                  {ch}
                </span>
                <input
                  type="range" min={0} max={255}
                  value={rgb[i]}
                  onChange={e => handleRgbChange(i as 0|1|2, Number(e.target.value))}
                  className="flex-1 accent-blue-500 h-2"
                />
                <input
                  type="number" min={0} max={255}
                  value={rgb[i]}
                  onChange={e => handleRgbChange(i as 0|1|2, Number(e.target.value))}
                  className="w-14 border border-gray-300 rounded-lg px-2 py-0.5
                             text-sm text-center focus:outline-none focus:ring-1
                             focus:ring-blue-300"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Boutons ────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm
                       text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={waypointCount < 2 || hexError}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all
              ${waypointCount >= 2 && !hexError
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            ⬇️ Exporter en {format.toUpperCase()}
            {hasGeometry ? ' (trace)' : ' (points)'}
          </button>
        </div>
      </div>
    </>
  );
}
