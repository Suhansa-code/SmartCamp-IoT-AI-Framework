'use client'

import { useParams } from 'next/navigation'
import ReliefTrack from '@/components/relief/ReliefTrack'

export default function ReliefTrackPage() {
  const params = useParams()
  const reference = Array.isArray(params?.reference) ? params.reference[0] : params?.reference
  return <ReliefTrack reference={reference} />
}
