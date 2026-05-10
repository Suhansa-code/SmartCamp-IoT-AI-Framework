import express from 'express'
import {
  getDisasterCampById,
  getDisasterCampSummaries,
  getDisasterDashboardSummary,
  getDisasterMapNodes,
} from '../../disaster-management/disasterData.js'
import { predictFloodForCamp } from '../services/floodPredictionService.js'

export default function disasterRoutes() {
  const router = express.Router()

  router.get('/overview', (_req, res) => {
    res.json(getDisasterDashboardSummary())
  })

  router.get('/camps', (_req, res) => {
    res.json({ camps: getDisasterCampSummaries() })
  })

  router.get('/map-nodes', (_req, res) => {
    res.json({ nodes: getDisasterMapNodes() })
  })

  router.get('/camps/:campId', (req, res) => {
    const camp = getDisasterCampById(req.params.campId)

    if (!camp) {
      return res.status(404).json({
        error: 'Camp not found',
        campId: req.params.campId,
      })
    }

    try {
      const prediction = predictFloodForCamp(camp)
      return res.json({
        ...camp,
        prediction,
      })
    } catch (error) {
      return res.json({
        ...camp,
        prediction: null,
        prediction_error: error instanceof Error ? error.message : 'Failed to run flood prediction',
      })
    }
  })

  router.get('/camps/:campId/predict', (req, res) => {
    const camp = getDisasterCampById(req.params.campId)

    if (!camp) {
      return res.status(404).json({ error: 'Camp not found', campId: req.params.campId })
    }

    try {
      const result = predictFloodForCamp(camp)
      return res.json({ prediction: result })
    } catch (err) {
      console.error('[FloodPrediction] Error for', req.params.campId, err)
      return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  return router
}
