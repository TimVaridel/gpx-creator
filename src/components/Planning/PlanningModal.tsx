import { useState, useEffect, useCallback, useRef } from 'react';
import ExcelJS from 'exceljs';
import type { Waypoint, Group } from '../../types/route.types';

// ── Types ────────────────────────────────────────────────────
interface PlanningModalProps {
  waypoints:                Waypoint[];
  segmentDistances:         number[];
  groups:                   (Group & { distKm: number; durationH: number })[];
  onUpdateGroup:            (groupId: string, patch: Partial<Group>) => void;
  onRemoveGroup:            (groupId: string) => void;
  segmentSpeeds:            number[];
  manualSegmentDuration:    (number | null)[];
  onSegmentSpeedChange:     (index: number, speed: number) => void;
  onSegmentDurationChange:  (index: number, durationH: number) => void;
  segmentPause:             number[];
  segmentRemark:            string[];
  onSegmentPauseChange:     (index: number, pauseH: number) => void;
  onSegmentRemarkChange:    (index: number, remark: string) => void;
  maxSpeed:                 number;
  routeName:                string;
  onClose:                  () => void;
}

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
  return {
    date: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`,
    time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
  };
}

// ── Composant ────────────────────────────────────────────────
const PlanningModal = ({
  waypoints,
  segmentDistances,
  groups,
  onUpdateGroup,
  onRemoveGroup,
  segmentSpeeds,
  manualSegmentDuration,
  onSegmentSpeedChange,
  onSegmentDurationChange,
  segmentPause,
  segmentRemark,
  onSegmentPauseChange,
  onSegmentRemarkChange,
  maxSpeed,
  routeName,
  onClose,
}: PlanningModalProps) => {
  const today      = new Date().toISOString().slice(0, 10);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [globalDate, setGlobalDate] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) ?? '{}').date ?? today; }
    catch { return today; }
  });

  const [globalStart, setGlobalStart] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) ?? '{}').time ?? '07:00'; }
    catch { return '07:00'; }
  });

  // ── Persistance des paramètres ──────────────────────────
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY_SETTINGS,
      JSON.stringify({ date: globalDate, time: globalStart }),
    );
  }, [globalDate, globalStart]);

  // ── Calcul des lignes d'affichage ──────────────────────
  // Itération par segment : pour chaque segment segIdx entre waypoint[segIdx-1] et waypoint[segIdx] :
  //   si un groupe commence à segIdx-1 → afficher le groupe fusionné
  //   si le segment est dans un groupe → skip
  //   sinon → ligne individuelle
  interface DisplayRow {
    type: 'group' | 'segment';
    groupId?: string;
    fromIndex: number;
    toIndex: number;
    fromWp: Waypoint;
    toWp: Waypoint;
    distKm: number;
    durationH: number;
    speedKmh: number;
    isManual: boolean;
    pauseH: number;
    remark: string;
    beginDate: string;
    beginTime: string;
    endDate: string;
    endTime: string;
  }

  const displayRows: DisplayRow[] = [];
  let curDate = globalDate;
  let curTime = globalStart;

  for (let segIdx = 1; segIdx < waypoints.length; ) {
    // Vérifier si un groupe commence à segIdx-1 (le waypoint de départ du segment)
    const group = groups.find(g => g.fromWpIndex === segIdx - 1);
    if (group) {
      const distKm = routingDistanceKm(segmentDistances, group.fromWpIndex, group.toWpIndex);
      const durationH = group.manualDurationH ?? group.durationH;
      const end = addHoursToDateTime(curDate, curTime, durationH);

      displayRows.push({
        type: 'group',
        groupId: group.id,
        fromIndex: group.fromWpIndex,
        toIndex: group.toWpIndex,
        fromWp: waypoints[group.fromWpIndex],
        toWp: waypoints[group.toWpIndex],
        distKm,
        durationH,
        speedKmh: group.speedKmh,
        isManual: group.manualDurationH !== null,
        pauseH: group.pauseH,
        remark: group.remark,
        beginDate: curDate,
        beginTime: curTime,
        endDate: end.date,
        endTime: end.time,
      });

      const afterPause = addHoursToDateTime(end.date, end.time, group.pauseH);
      curDate = afterPause.date;
      curTime = afterPause.time;

      segIdx = group.toWpIndex + 1; // skip les segments du groupe
      continue;
    }

    // Segment individuel (hors groupe)
    const distKm = segmentDistances[segIdx] ?? 0;
    const segSpeed = segmentSpeeds[segIdx] ?? maxSpeed;
    const segManual = manualSegmentDuration[segIdx];
    const durationH = segManual ?? (distKm > 0 ? Math.round((distKm / segSpeed) * 100) / 100 : 0);
    const pauseH = segmentPause[segIdx] ?? 0;
    const remark = segmentRemark[segIdx] ?? '';
    const end = addHoursToDateTime(curDate, curTime, durationH);

    displayRows.push({
      type: 'segment',
      fromIndex: segIdx - 1,
      toIndex: segIdx,
      fromWp: waypoints[segIdx - 1],
      toWp: waypoints[segIdx],
      distKm,
      durationH,
      speedKmh: segSpeed,
      isManual: segManual !== null && segManual !== undefined,
      pauseH,
      remark,
      beginDate: curDate,
      beginTime: curTime,
      endDate: end.date,
      endTime: end.time,
    });

    const afterPause = addHoursToDateTime(end.date, end.time, pauseH);
    curDate = afterPause.date;
    curTime = afterPause.time;

    segIdx++;
  }

  // ── Fermeture au clic sur le backdrop ──────────────────
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  // ── Export Excel ────────────────────────────────────────
  const exportExcel = async () => {
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
      cell.border    = {
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    displayRows.forEach((row) => {
      const excelRow = worksheet.addRow({
        de:       wpLabel(row.fromWp, row.fromIndex),
        a:        wpLabel(row.toWp, row.toIndex),
        km:       Math.round(row.distKm * 10) / 10,
        duree:    row.durationH,
        vitesse:  row.speedKmh,
        debut:    formatDateTimeCH(row.beginDate, row.beginTime),
        fin:      formatDateTimeCH(row.endDate, row.endTime),
        pause:    row.pauseH,
        remarque: row.remark,
      });

      if (row.type === 'group') {
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
    const safeName = (routeName ?? 'itinéraire').replace(/[/\\?%*:|"<>]/g, '-');
    a.href         = url;
    a.download     = `${safeName} - planning.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Composant durée éditable avec affichage formaté ────
  function DurInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [focused, setFocused] = useState(false);
    const [text, setText] = useState('');

    const display = focused
      ? text
      : (value > 0 ? (() => {
          const h = Math.floor(value);
          const m = Math.round((value - h) * 60);
          return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
        })() : '');

    return (
      <input
        type="text"
        value={display}
        onChange={e => setText(e.target.value)}
        onFocus={e => {
          setFocused(true);
          setText(value > 0 ? value.toFixed(2) : '');
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          const v = parseFloat(text);
          if (!isNaN(v) && v >= 0) onChange(v);
        }}
        className="border rounded px-1 py-0.5 text-xs text-right w-16
                   focus:border-orange-400 focus:outline-none
                   border-orange-200 bg-orange-50"
      />
    );
  }

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
          {displayRows.length === 0 ? (
            <div className="text-center text-gray-400 py-16">
              <p className="text-4xl mb-3">🗓️</p>
              <p className="text-sm">Ajoutez des waypoints pour commencer.</p>
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
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">Début</th>
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">Fin</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500">Pause [h]</th>
                  <th className="px-2 py-2 text-left  text-xs font-semibold text-gray-500">Remarque</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr key={`${row.type}-${row.fromIndex}-${idx}`}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        row.type === 'group' ? 'bg-indigo-50/30' : ''
                      }`}>

                    {/* # */}
                    <td className={`px-2 py-2 text-xs font-medium ${
                      row.type === 'group' ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      {row.type === 'group' ? (
                        <span className="bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 text-[10px] font-bold">
                          G{row.fromIndex + 1}–{row.toIndex + 1}
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </td>

                    {/* De */}
                    <td className="px-2 py-2">
                      <span className="text-xs text-gray-700">{wpLabel(row.fromWp, row.fromIndex)}</span>
                    </td>

                    {/* À */}
                    <td className="px-2 py-2">
                      <span className="text-xs text-gray-700">{wpLabel(row.toWp, row.toIndex)}</span>
                    </td>

                    {/* km */}
                    <td className="px-2 py-2 text-right font-medium text-gray-700 text-xs">
                      {row.distKm > 0 ? row.distKm.toFixed(1) : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Durée */}
                    <td className="px-2 py-2 text-right">
                      {row.type === 'group' ? (
                        <DurInput
                          value={row.durationH}
                          onChange={v => onUpdateGroup(row.groupId!, { manualDurationH: v })}
                        />
                      ) : (
                        <DurInput
                          value={row.durationH}
                          onChange={v => onSegmentDurationChange(row.toIndex, v)}
                        />
                      )}
                    </td>

                    {/* Vitesse */}
                    <td className="px-2 py-2 text-right">
                      {row.type === 'group' ? (
                        <input
                          type="number"
                          min={1}
                          max={300}
                          step={1}
                          value={Math.round(row.speedKmh)}
                          onChange={e => onUpdateGroup(row.groupId!, {
                            speedKmh: Math.max(1, Math.round(Number(e.target.value))),
                          })}
                          onFocus={e => e.target.select()}
                          className="w-14 border border-gray-300 rounded px-1 py-0.5
                                     text-xs text-right focus:border-indigo-400 focus:outline-none"
                        />
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={300}
                          step={1}
                          value={Math.round(row.speedKmh)}
                          onChange={e => onSegmentSpeedChange(row.toIndex, Math.max(1, Math.round(Number(e.target.value))))}
                          onFocus={e => e.target.select()}
                          className="w-14 border border-gray-300 rounded px-1 py-0.5
                                     text-xs text-right focus:border-indigo-400 focus:outline-none"
                        />
                      )}
                    </td>

                    {/* Début */}
                    <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {formatDateTimeCH(row.beginDate, row.beginTime)}
                    </td>

                    {/* Fin */}
                    <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {formatDateTimeCH(row.endDate, row.endTime)}
                    </td>

                    {/* Pause */}
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={row.pauseH}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value));
                          if (row.type === 'group') {
                            onUpdateGroup(row.groupId!, { pauseH: v });
                          } else {
                            onSegmentPauseChange(row.toIndex, v);
                          }
                        }}
                        onFocus={e => e.target.select()}
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
                        onChange={e => {
                          if (row.type === 'group') {
                            onUpdateGroup(row.groupId!, { remark: e.target.value });
                          } else {
                            onSegmentRemarkChange(row.toIndex, e.target.value);
                          }
                        }}
                        placeholder="…"
                        onFocus={e => e.target.select()}
                        className="border border-gray-200 rounded px-1 py-0.5
                                   text-xs w-36
                                   focus:border-indigo-400 focus:outline-none"
                      />
                    </td>

                    {/* Supprimer (uniquement pour les groupes) */}
                    <td className="px-2 py-2 text-center">
                      {row.type === 'group' && (
                        <button
                          onClick={() => onRemoveGroup(row.groupId!)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4
                        border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            + Ajouter une étape (via groupes)
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-gray-600
                         hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={() => { exportExcel(); }}
              disabled={displayRows.length === 0}
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
