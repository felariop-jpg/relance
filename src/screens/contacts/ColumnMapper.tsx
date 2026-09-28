import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { inputClass } from '../../components/Field';
import {
  IMPORT_TARGETS,
  setMapping,
  type ColumnMapping,
  type ImportTarget,
  type ParsedCsv,
} from '../../lib/csv';

function examples(parsed: ParsedCsv, column: number): string[] {
  const found: string[] = [];
  for (const row of parsed.rows) {
    const value = row[column];
    if (value) found.push(value);
    if (found.length === 3) break;
  }
  return found;
}

export function ColumnMapper({
  parsed,
  mapping,
  onChange,
}: {
  parsed: ParsedCsv;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs text-stone-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {t('import.column')}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t('import.examples')}
            </th>
            <th scope="col" className="w-80 px-3 py-2 font-medium">
              {t('import.target')}
            </th>
          </tr>
        </thead>
        <tbody>
          {parsed.headers.map((header, i) => {
            const name = header || t('import.columnN', { n: i + 1 });
            const target = mapping[i] ?? null;
            return (
              <tr key={i} className={`border-t border-stone-100 ${target ? '' : 'text-stone-500'}`}>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <label htmlFor={`${id}-${i}`}>{name}</label>
                </th>
                <td className="max-w-xs px-3 py-2">
                  <ul className="space-y-0.5">
                    {examples(parsed, i).map((value, j) => (
                      <li key={j} className="truncate" title={value}>
                        {value}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2">
                  <select
                    id={`${id}-${i}`}
                    className={`${inputClass} py-1.5 ${target ? 'border-accent-600' : ''}`}
                    value={target ?? ''}
                    onChange={(e) =>
                      onChange(setMapping(mapping, i, (e.target.value || null) as ImportTarget | null))
                    }
                  >
                    <option value="">{t('import.skip')}</option>
                    {IMPORT_TARGETS.map((option) => (
                      <option key={option} value={option}>
                        {t(`fields.${option}`)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
