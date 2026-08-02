import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";

function SortIcon({ direction }) {
  if (!direction) return <ChevronsUpDown className="w-3 h-3 text-slate-300" />;
  return direction === "asc"
    ? <ChevronUp className="w-3 h-3 text-teal-600" />
    : <ChevronDown className="w-3 h-3 text-teal-600" />;
}

function LoadingSkeleton({ columns, rows = 5, mobile }) {
  if (mobile) {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded-md animate-pulse w-1/2" />
                <div className="h-3 bg-slate-200 rounded-md animate-pulse w-1/3" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 bg-slate-200 rounded-md animate-pulse w-16" />
              <div className="h-6 bg-slate-200 rounded-md animate-pulse w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-50">
          {columns.map((col, c) => (
            <td key={c} className="py-3 px-4">
              <div className="h-4 bg-slate-100 rounded-md animate-pulse" style={{ width: `${50 + (c % 3) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState({ message, mobile }) {
  if (mobile) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
          <Inbox className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-400">{message}</p>
      </div>
    );
  }
  return (
    <tbody>
      <tr>
        <td colSpan={99} className="py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
              <Inbox className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">{message}</p>
          </div>
        </td>
      </tr>
    </tbody>
  );
}

function Pagination({ page, totalPages, filteredLength, setPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-xs text-slate-400">
        {filteredLength} record{filteredLength !== 1 ? "s" : ""} total
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
              i === page ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                defaultValue=""
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm text-slate-800 placeholder-slate-400"
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
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-teal-500 transition-all"
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
                  className={`p-3.5 bg-slate-50 border border-slate-100 rounded-xl transition-all ${
                    onRowClick ? "active:scale-[0.98] cursor-pointer hover:border-teal-200 hover:bg-teal-50/30" : ""
                  }`}
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

      <div className={`${mobileCard ? "hidden sm:block" : ""} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`pb-2.5 px-4 font-semibold whitespace-nowrap ${
                    col.sortable !== false ? "cursor-pointer select-none hover:text-teal-600 transition-colors" : ""
                  }`}
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
                  className={`border-b border-slate-50 transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-teal-50/40" : "hover:bg-slate-50/60"
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
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
