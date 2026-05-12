import { useRef } from 'react';
import { parseGpx, parseKml } from '../../services/importParser';
import type { ParsedRoute } from '../../services/importParser';

interface ImportButtonProps {
  onImport: (parsed: ParsedRoute) => void;
}

const ImportButton = ({ onImport }: ImportButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        let parsed: ParsedRoute;
        if (file.name.toLowerCase().endsWith('.kml')) {
          parsed = parseKml(text);
        } else {
          parsed = parseGpx(text);
        }

        if (parsed.waypoints.length === 0) {
          alert('Aucun point trouvé dans le fichier.');
          return;
        }
        onImport(parsed);
      } catch (err) {
        alert('Erreur lors de la lecture du fichier.');
        console.error(err);
      }
      // Reset pour permettre re-import du même fichier
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,.kml"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-1.5
                   w-full py-1.5 rounded text-xs font-medium
                   bg-amber-100 text-amber-700 hover:bg-amber-200
                   transition-colors"
        title="Importer un fichier GPX ou KML"
      >
        📂 Importer GPX / KML
      </button>
    </>
  );
};

export default ImportButton;
