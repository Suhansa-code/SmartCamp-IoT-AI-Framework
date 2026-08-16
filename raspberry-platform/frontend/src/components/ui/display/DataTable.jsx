import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";
import { COLORS, SHADOW_CARD } from "../../../lib/tokens";

function SortIcon({ direction }) {
  if (!direction) return <ChevronsUpDown className="w-3 h-3" style={{ color: "#D4D8D5" }} />;
  return direction === "asc"
    ? <ChevronUp className="w-3 h-3" style={{ color: COLORS.brand }} />
    : <ChevronDown className="w-3 h-3" style={{ color: COLORS.brand }} />;
}

function LoadingSkeleton({ columns, rows = 5, mobile }) {
  if (mobile) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3.5 rounded-xl border space-y-3" style={{ borderColor: COLORS.line, backgroundColor: "#FAFAF9" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg animate-pulse" style={{ backgroundColor: COLORS.line }} />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 rounded-md animate-pulse w-1/2" style={{ backgroundColor: COLORS.line }} />
                <div className="h-3 rounded-md animate-pulse w-1/3" style={{ backgroundColor: COLORS.line }} />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-5 rounded-md animate-pulse w-16" style={{ backgroundColor: COLORS.line }} />
              <div className="h-5 rounded-md animate-pulse w-20" style={{ backgroundColor: COLORS.line }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t" style={{ borderColor: COLORS.hairline }}>
          {columns.map((col, c) => (
            <td key={c} className="py-3 px-4">
              <div className="h-3.5 rounded-md animate-pulse" style={{ width: `${50 + (c % 3) * 15}%`, backgroundColor: "#F0F1EF" }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState({ message, mobile }) {
  const body = (
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-full border flex items-center justify-center" style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line }}>
        <Inbox className="w-6 h-6" style={{ color: "#D4D8D5" }} />
      </div>
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
      <span className="text-[11.5px] font-mono" style={{ color: COLORS.muted }}>
        {filteredLength} record{filteredLength !== 1 ? "s" : ""} total
      </span>
      <div className="flex items-center gap-1">
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
            className="w-7 h-7 rounded-md text-[11.5px] font-mono font-semibold transition-colors"
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
                className="w-full pl-9 pr-3 py-2 rounded-lg border focus:outline-none transition-colors text-[13px]"
                style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line, color: COLORS.ink }}
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
              className="px-3 py-2 rounded-lg border text-[13px] focus:outline-none transition-colors"
              style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line, color: COLORS.body }}
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
            <EmptyState message={emptyMessage} mobile />
          ) : (
            <div className="space-y-2.5">
              {paged.map((row, i) => (
                <motion.div
                  key={row.id ?? i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => onRowClick?.(row)}
                  className={`p-3.5 rounded-xl border transition-all ${onRowClick ? "active:scale-[0.98] cursor-pointer" : ""}`}
                  style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line }}
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

      <div className={`${mobileCard ? "hidden sm:block" : ""} overflow-x-auto rounded-xl border`} style={{ borderColor: COLORS.line }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: COLORS.hairline, backgroundColor: "#FAFAF9" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 font-mono font-semibold text-[10.5px] uppercase tracking-[0.06em] whitespace-nowrap ${col.sortable !== false ? "cursor-pointer select-none transition-colors" : ""}`}
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
            <EmptyState message={emptyMessage} />
          ) : (
            <tbody>
              {paged.map((row, i) => (
                <motion.tr
                  key={row.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => onRowClick?.(row)}
                  className={`border-t transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  style={{ borderColor: COLORS.hairline }}
                  onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.backgroundColor = `${COLORS.brand}08`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-4 whitespace-nowrap" style={{ color: COLORS.body }}>
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