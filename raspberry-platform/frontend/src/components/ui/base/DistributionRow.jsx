import { COLORS } from '../../../lib/tokens'

export default function DistributionRow({ label, data }) {
  if (!data) return null
  const pct = data.percent ?? 0
  const color = pct >= 85 ? COLORS.brand : pct >= 60 ? COLORS.brand : COLORS.info

  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
      <span className="text-[13px] font-medium w-20" style={{ color: COLORS.ink }}>{label}</span>
      <div className="flex-1 mx-3">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.hairline }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      <span className="text-[12px] w-24 text-right" style={{ color: COLORS.muted }}>
        {data.served}/{data.served + data.pending}
      </span>
      <span className="text-[12px] font-medium w-12 text-right" style={{ color: COLORS.brand }}>
        {pct}%
      </span>
    </div>
  )
}
