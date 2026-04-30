
import React, { useState, useEffect } from "react";
import { filterData, requestSort, formatDataIT, parseItalianDate } from "../utils/gridUtils";

export default function BaseGrid({ data, columns, filters: defaultFilters }) {
  const [gridData, setGridData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState(defaultFilters || {});

  useEffect(() => {
    let filtered = filterData(data, filters);
    if (sortConfig.key) filtered = requestSort(filtered, sortConfig.key, sortConfig.direction);
    setGridData(filtered);
  }, [data, filters, sortConfig]);

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="base-grid">
      {/* Filtri */}
      {columns.filter(c => c.filterable).map(col => (
        <div key={col.key}>
          <input
            placeholder={`Filtra ${col.label}`}
            value={filters[col.key] || ""}
            onChange={e => handleFilterChange({ [col.key]: e.target.value })}
          />
        </div>
      ))}

      {/* Tabella */}
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => handleSort(col.key)}>
                {col.label} {sortConfig.key === col.key ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gridData.map((row, idx) => (
            <tr key={idx}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}