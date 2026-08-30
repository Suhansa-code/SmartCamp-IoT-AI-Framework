import { COLORS } from '../../../lib/tokens'

export default function MedicalNotes({ notes }) {
  if (!notes) return null

  return (
    <div className="text-[12px] rounded-lg px-3 py-2.5" style={{ backgroundColor: COLORS.warningSoft, color: COLORS.body }}>
      <span className="font-medium" style={{ color: COLORS.warning }}>Notes: </span>
      {notes}
    </div>
  )
}
