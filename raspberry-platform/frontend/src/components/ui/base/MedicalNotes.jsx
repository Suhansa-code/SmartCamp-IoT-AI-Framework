export default function MedicalNotes({ notes }) {
  if (!notes) return null

  return (
    <div className="text-xs text-slate-500 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2.5">
      <span className="font-semibold text-amber-700">Notes: </span>
      {notes}
    </div>
  )
}
