import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";
import { COLORS } from "../../../lib/tokens";

function SortIcon({ direction }) {
  if (!direction) return <ChevronsUpDown className="w-3 h-3" style={{ color: COLORS.subtle }} />;
  return direction === "asc"
    ? <ChevronUp className="w-3 h-3" style={{ color: COLORS.brand }} />
    : <ChevronDown className="w-3 h-3" style={{ color: COLORS.brand }} />;
}

function LoadingSkeleton({ columns, rows = 5, mobile }) {
  if (mobile) {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 rounded-lg space-y-3" style={{ backgroundColor: COLORS.grid }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg animate-pulse" style={{ backgroundColor: COLORS.hairline }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded animate-pulse w-1/2" style={{ backgroundColor: COLORS.hairline }} />
                <div className="h-2.5 rounded animate-pulse w-1/3" style={{ backgroundColor: COLORS.hairline }} />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-4 rounded animate-pulse w-16" style={{ backgroundColor: COLORS.hairline }} />
              <div className="h-4 rounded animate-pulse w-20" style={{ backgroundColor: COLORS.hairline }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
          {columns.map((col, c) => (
            <td key={c} className="py-3 px-4">
              <div className="h-3 rounded animate-pulse" style={{ width: `${50 + (c % 3) * 15}%`, backgroundColor: COLORS.hairline }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function EmptyDataTable({ message, mobile }) {
  const body = (
    <div className="flex flex-col items-center gap-3">
      <Inbox className="w-6 h-6" style={{ color: COLORS.subtle }} />
      <p className="text-[13px] font-medium" style={{ color: COLORS.muted }}>{message}</p>
    </div>
  );
  if (mobile) return <div className="py-12">{body}</div>;
  return (
    <tbody>
      <tr>
        <td colSpan={99} className="py-16 text-center">{body}</td>
      </tr>
    </tbody>
  );
}

function Pagination({ page, totalPages, filteredLength, setPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-[11px]" style={{ color: COLORS.muted }}>
        {filteredLength} record{filteredLength !== 1 ? "s" : ""} total
      </span>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: COLORS.muted }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className="w-7 h-7 rounded-md text-[11px] font-medium transition-colors"
            style={i === page
              ? { backgroundColor: COLORS.brand, color: "#fff" }
              : { color: COLORS.muted }}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: COLORS.muted }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  searchPlaceholder = "Search...",
  searchKeys = [],
  pageSize = 10,
  emptyMessage = "No records found",
  onRowClick,
  filters = [],
  mobileCard,
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const [page, setPage] = useState(0);
  const [filterValues, setFilterValues] = useState(() =>
    Object.fromEntries(filters.map((f) => [f.key, ""]))
  );

  const timerRef = useRef(null);
  const handleSearch = useCallback((val) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearch(val);
      setPage(0);
    }, 250);
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = data;
    if (search && searchKeys.length > 0) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        searchKeys.some((key) => {
          const val = row[key];
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }
    for (const filter of filters) {
      const val = filterValues[filter.key];
      if (val) {
        result = result.filter((row) => String(row[filter.key]) === val);
      }
    }
    if (sortKey && sortDir) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, sortKey, sortDir, searchKeys, filterValues, filters]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-3">
      {(searchKeys.length > 0 || filters.length > 0) && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          {searchKeys.length > 0 && (
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4" style={{ color: COLORS.muted }} />
              </div>
              <input
                type="text"
                defaultValue=""
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-[13px]"
                style={{ backgroundColor: COLORS.grid, borderColor: COLORS.line, color: COLORS.ink }}
              />
            </div>
          )}
          {filters.map((filter) => (
            <select
              key={filter.key}
              value={filterValues[filter.key] || ""}
              onChange={(e) => {
                setFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }));
                setPage(0);
              }}
              className="px-3 py-2 rounded-lg border text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
              style={{ backgroundColor: COLORS.grid, borderColor: COLORS.line, color: COLORS.body }}
            >
              <option value="">{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}
        </div>
      )}

      {mobileCard ? (
        <div className="sm:hidden">
          {loading ? (
            <LoadingSkeleton mobile />
          ) : paged.length === 0 ? (
            <EmptyDataTable message={emptyMessage} mobile />
          ) : (
            <div className="space-y-2">
              {paged.map((row, i) => (
                <motion.div
                  key={row.id ?? i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => onRowClick?.(row)}
                  className={`p-3 rounded-lg transition-all ${onRowClick ? "cursor-pointer" : ""}`}
                  style={{ backgroundColor: COLORS.grid }}
                >
                  {mobileCard(row)}
                </motion.div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Pagination page={page} totalPages={totalPages} filteredLength={filtered.length} setPage={setPage} />
          </div>
        </div>
      ) : null}

      <div className={`${mobileCard ? "hidden sm:block" : ""} overflow-x-auto rounded-lg`} style={{ border: `1px solid ${COLORS.line}` }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.hairline}`, backgroundColor: COLORS.grid }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-2.5 px-4 font-medium text-[11px] uppercase tracking-wider whitespace-nowrap ${col.sortable !== false ? "cursor-pointer select-none" : ""}`}
                  style={{ color: COLORS.muted }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable !== false && <SortIcon direction={sortKey === col.key ? sortDir : null} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          {loading ? (
            <LoadingSkeleton columns={columns} />
          ) : paged.length === 0 ? (
            <EmptyDataTable message={emptyMessage} />
          ) : (
            <tbody>
              {paged.map((row, i) => (
                <motion.tr
                  key={row.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.015 }}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  style={{ borderBottom: `1px solid ${COLORS.hairline}` }}
                  onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.backgroundColor = `${COLORS.brand}06`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="py-2.5 px-4 whitespace-nowrap" style={{ color: COLORS.body }}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      <div className={`${mobileCard ? "hidden sm:block" : ""}`}>
        <Pagination page={page} totalPages={totalPages} filteredLength={filtered.length} setPage={setPage} />
      </div>
    </div>
  );
}
