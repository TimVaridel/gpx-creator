import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ExcelJS from 'exceljs';
import type { Waypoint } from '../../types/route.types';

// ── Types ────────────────────────────────────────────────────
interface PlanningRow {
  id:             string;
  fromWpIndex:    number;
  toWpIndex:      number;
  durationH:      number;
  durationManual: boolean;
  speedKmh:       number;
  pauseH:         number;
  remark:         string;
}

interface PlanningModalProps {
  waypoints:        Waypoint[];
  segmentDistances: number[];
  routeName:        string;
  onClose:          () => void;
}

const STORAGE_KEY          = 'gpx-planning-rows';
const STORAGE_KEY_SETTINGS = 'gpx-planning-settings';

// ── Helpers ──────────────────────────────────────────────────
function routingDistanceKm(
  segmentDistances: number[],
  fromIdx: number,
  toIdx: number,
): number {
  const start = Math.min(fromIdx, toIdx);
  const end   = Math.max(fromIdx, toIdx);
  let total = 0;
  for (let i = start + 1; i <= end; i++) total += segmentDistances[i] ?? 0;
  return total;
}

function addHoursToDateTime(
  dateStr: string,
  timeStr: string,
  hours: number,
): { date: string; time: string } {
  const [h, m]     = timeStr.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const totalMin   = h * 60 + m + Math.round(hours * 60);
  const extraDays  = Math.floor(totalMin / (60 * 24));
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  const dateObj = new Date(y, mo - 1, d + extraDays);
  const newDate = [
    dateObj.getFullYear(),
    String(dateObj.getMonth() + 1).padStart(2, '0'),
    String(dateObj.getDate()).padStart(2, '0'),
  ].join('-');
  return {
    date: newDate,
    time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
  };
}

function formatDateTimeCH(dateStr: string, timeStr: string): string {
  if (!dateStr) return timeStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y} ${timeStr}`;
}

function wpLabel(wp: Waypoint | undefined, idx: number): string {
  if (!wp) return `Point ${idx + 1}`;
  if (wp.locality) return wp.locality;
  if (wp.name)     return wp.name;
  return `Point ${idx + 1}`;
}

function wpOptionLabel(wp: Waypoint | undefined, idx: number): string {
  return `${idx + 1} – ${wpLabel(wp, idx)}`;
}

function newRow(
  segmentDistances: number[],
  fromIdx: number,
  toIdx: number,
): PlanningRow {
  const dist      = routingDistanceKm(segmentDistances, fromIdx, toIdx);
  const speedKmh  = 60;
  const durationH = dist > 0 ? Math.round((dist / speedKmh) * 100) / 100 : 0;
  return {
    id:             crypto.randomUUID(),
    fromWpIndex:    fromIdx,
    toWpIndex:      toIdx,
    durationH,
    durationManual: false,
    speedKmh,
    pauseH:         0,
    remark:         '',
  };
}

// ── Composant ────────────────────────────────────────────────
const PlanningModal = ({
  waypoints,
  segmentDistances,
  routeName,
  onClose,
}: PlanningModalProps) => {
  const today       = new Date().toISOString().slice(0, 10);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [globalDate, setGlobalDate] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) ?? '{}').date ?? today; }
    catch { return today; }
  });

  const [globalStart, setGlobalStart] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) ?? '{}').time ?? '07:00'; }
    catch { return '07:00'; }
  });

  const [rows, setRows] = useState<PlanningRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      return (JSON.parse(saved) as PlanningRow[]).map(r => ({
        ...r,
        remark: r.remark ?? '',
      }));
    } catch { return []; }
  });

  // ── Fermeture au clic sur le backdrop ────────────────────
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  // ── Persistance ──────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY_SETTINGS,
      JSON.stringify({ date: globalDate, time: globalStart }),
    );
  }, [globalDate, globalStart]);

  // ── Rows dérivées (adaptation si waypoints changent) ─────
  const displayedRows = useMemo(() => {
    const maxIdx = waypoints.length - 1;
    return rows
      .filter(r => r.fromWpIndex <= maxIdx && r.toWpIndex <= maxIdx)
      .map(r => {
        const dist      = routingDistanceKm(segmentDistances, r.fromWpIndex, r.toWpIndex);
        const durationH = r.durationManual
          ? r.durationH
          : dist > 0 ? Math.round((dist / r.speedKmh) * 100) / 100 : 0;
        return { ...r, durationH };
      });
  }, [rows, waypoints.length, segmentDistances]);

  // ── Calcul des horaires ───────────────────────────────────
  const computedTimes = useCallback(() => {
    const times: {
      beginDate: string; beginTime: string;
      endDate:   string; endTime:   string;
    }[] = [];
    let curDate = globalDate;
    let curTime = globalStart;
    for (const row of displayedRows) {
      const beginDate = curDate;
      const beginTime = curTime;
      const endDt = addHoursToDateTime(beginDate, beginTime, row.durationH);
      times.push({ beginDate, beginTime, endDate: endDt.date, endTime: endDt.time });
      const nextDt = addHoursToDateTime(endDt.date, endDt.time, row.pauseH);
      curDate = nextDt.date;
      curTime = nextDt.time;
    }
    return times;
  }, [displayedRows, globalDate, globalStart]);

  const times = computedTimes();

  // ── Handlers ─────────────────────────────────────────────
  const addRow = () => {
    const lastTo = rows.length > 0 ? rows[rows.length - 1].toWpIndex : 0;
    const nextTo = Math.min(lastTo + 1, waypoints.length - 1);
    if (lastTo === nextTo && rows.length > 0) return;
    setRows(prev => [...prev, newRow(segmentDistances, lastTo, nextTo)]);
  };

  const removeRow = (id: string) =>
    setRows(prev => prev.filter(r => r.id !== id));

  const updateRow = (id: string, patch: Partial<PlanningRow>) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...patch };

        if (
          ('fromWpIndex' in patch || 'toWpIndex' in patch || 'speedKmh' in patch) &&
          !updated.durationManual
        ) {
          const dist = routingDistanceKm(
            segmentDistances,
            updated.fromWpIndex,
            updated.toWpIndex,
          );
          updated.durationH = dist > 0
            ? Math.round((dist / updated.speedKmh) * 100) / 100
            : 0;
        }

        if ('durationH' in patch) {
          updated.durationManual = true;
          const dist = routingDistanceKm(
            segmentDistances,
            updated.fromWpIndex,
            updated.toWpIndex,
          );
          updated.speedKmh = updated.durationH > 0 && dist > 0
            ? Math.round((dist / updated.durationH) * 10) / 10
            : updated.speedKmh;
        }

        return updated;
      }),
    );
  };

  // ── Export Excel ──────────────────────────────────────────
  const exportExcel = async () => {
    const t = computedTimes();

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Planning');

    worksheet.columns = [
      { header: 'De',             key: 'de',       width: 24 },
      { header: 'À',              key: 'a',        width: 24 },
      { header: 'km',             key: 'km',       width: 8  },
      { header: 'Durée [h]',      key: 'duree',    width: 11 },
      { header: 'Vitesse [km/h]', key: 'vitesse',  width: 15 },
      { header: 'Date début',     key: 'debut',    width: 20 },
      { header: 'Fin',            key: 'fin',      width: 20 },
      { header: 'Pause [h]',      key: 'pause',    width: 11 },
      { header: 'Remarque',       key: 'remarque', width: 32 },
    ];

    worksheet.getRow(1).eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });

    displayedRows.forEach((row, i) => {
      const dist = routingDistanceKm(segmentDistances, row.fromWpIndex, row.toWpIndex);
      const ti   = t[i];

      const excelRow = worksheet.addRow({
        de:       wpLabel(waypoints[row.fromWpIndex], row.fromWpIndex),
        a:        wpLabel(waypoints[row.toWpIndex],   row.toWpIndex),
        km:       Math.round(dist * 10) / 10,
        duree:    row.durationH,
        vitesse:  row.speedKmh,
        debut:    formatDateTimeCH(ti.beginDate, ti.beginTime),
        fin:      formatDateTimeCH(ti.endDate,   ti.endTime),
        pause:    row.pauseH,
        remarque: row.remark,
      });

      if (i % 2 === 0) {
        excelRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5FF' } };
        });
      }

      ['km', 'duree', 'vitesse', 'pause'].forEach(key => {
        excelRow.getCell(key).alignment = { horizontal: 'right' };
      });
    });

    const buffer   = await workbook.xlsx.writeBuffer();
    const blob     = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const safeName = (routeName ?? 'itinéraire').replace(/[\/\\?%*:|"<>]/g, '-');
    a.href         = url;
    a.download     = `${safeName} - planning.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────
  const hasRoutingDist = segmentDistances.some(d => d > 0);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh]
                      flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4
                        border-b border-gray-200 bg-indigo-600 text-white rounded-t-2xl">
          <h2 className="text-lg font-bold">📅 Planning de l'itinéraire</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Avertissement routing */}
        {!hasRoutingDist && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
            ⚠️ Calcule d'abord l'itinéraire pour obtenir les distances de routing précises.
          </div>
        )}

        {/* Paramètres globaux */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-3
                        border-b border-gray-100 bg-gray-50">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Date de départ :
            <input
              type="date"
              value={globalDate}
              onChange={e => setGlobalDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Heure de départ :
            <input
              type="time"
              value={globalStart}
              onChange={e => setGlobalStart(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {displayedRows.length === 0 ? (
            <div className="text-center text-gray-400 py-16">
              <p className="text-4xl mb-3">🗓️</p>
              <p className="text-sm">Aucune étape. Cliquez sur « + Ajouter une étape ».</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">De</th>
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">À</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500">km</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500">Durée [h]</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500">Vitesse [km/h]</th>
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">Date début</th>
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">Fin</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500">Pause [h]</th>
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">Remarque</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, i) => {
                  const dist = routingDistanceKm(
                    segmentDistances,
                    row.fromWpIndex,
                    row.toWpIndex,
                  );
                  const ti = times[i];

                  return (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">

                      {/* # */}
                      <td className="px-2 py-2 text-xs text-gray-400 font-medium">{i + 1}</td>

                      {/* De */}
                      <td className="px-2 py-2">
                        <select
                          value={row.fromWpIndex}
                          onChange={e => updateRow(row.id, { fromWpIndex: Number(e.target.value) })}
                          className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                        >
                          {waypoints.map((wp, idx) => (
                            <option key={idx} value={idx}>{wpOptionLabel(wp, idx)}</option>
                          ))}
                        </select>
                      </td>

                      {/* À */}
                      <td className="px-2 py-2">
                        <select
                          value={row.toWpIndex}
                          onChange={e => updateRow(row.id, { toWpIndex: Number(e.target.value) })}
                          className="border border-gray-200 rounded px-1 py-0.5 text-xs"
                        >
                          {waypoints.map((wp, idx) => (
                            <option key={idx} value={idx}>{wpOptionLabel(wp, idx)}</option>
                          ))}
                        </select>
                      </td>

                      {/* km */}
                      <td className="px-2 py-2 text-right font-medium text-gray-700 text-xs">
                        {dist > 0 ? dist.toFixed(1) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Durée */}
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.durationH}
                          onChange={e => updateRow(row.id, { durationH: Number(e.target.value) })}
                          className={`border rounded px-1 py-0.5 text-xs text-right w-16
                            focus:border-indigo-400 focus:outline-none
                            ${row.durationManual
                              ? 'border-indigo-300 bg-indigo-50'
                              : 'border-gray-200'}`}
                        />
                      </td>

                      {/* Vitesse — lecture seule */}
                      <td className="px-2 py-2 text-right">
                        <span className="text-xs text-gray-600 font-medium">
                          {row.speedKmh > 0 ? row.speedKmh.toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* Date début */}
                      <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {formatDateTimeCH(ti.beginDate, ti.beginTime)}
                      </td>

                      {/* Fin */}
                      <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {formatDateTimeCH(ti.endDate, ti.endTime)}
                      </td>

                      {/* Pause */}
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.pauseH}
                          onChange={e => updateRow(row.id, { pauseH: Number(e.target.value) })}
                          className="border border-gray-200 rounded px-1 py-0.5
                                     text-xs text-right w-16
                                     focus:border-indigo-400 focus:outline-none"
                        />
                      </td>

                      {/* Remarque */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.remark}
                          onChange={e => updateRow(row.id, { remark: e.target.value })}
                          placeholder="…"
                          className="border border-gray-200 rounded px-1 py-0.5
                                     text-xs w-36
                                     focus:border-indigo-400 focus:outline-none"
                        />
                      </td>

                      {/* Supprimer */}
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeRow(row.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4
                        border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={addRow}
            disabled={waypoints.length < 2}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       bg-indigo-100 text-indigo-700 hover:bg-indigo-200
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            + Ajouter une étape
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (confirm('Effacer toutes les étapes ?')) setRows([]); }}
              disabled={rows.length === 0}
              className="px-3 py-2 rounded-lg text-xs text-red-500
                         hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              🗑️ Tout effacer
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-gray-600
                         hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={exportExcel}
              disabled={displayedRows.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                         bg-green-500 text-white hover:bg-green-600 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              📊 Exporter Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanningModal;
