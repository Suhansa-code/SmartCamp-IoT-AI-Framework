import express from 'express';
import {
  listResources, getResource, createResource, updateResource, deactivateResource,
  createResourceUsage, listResourceUsage, getPersonResourceHistory,
  getInventorySummary, getCategories, getAuditLogs,
} from '../../controllers/resource/resources.js';

const router = express.Router();

router.get('/', listResources);
router.get('/categories', getCategories);
router.get('/usage', listResourceUsage);
router.post('/usage', createResourceUsage);
router.get('/summary', getInventorySummary);
router.post('/', createResource);
router.get('/:id', getResource);
router.put('/:id', updateResource);
router.delete('/:id', deactivateResource);

export default router;
