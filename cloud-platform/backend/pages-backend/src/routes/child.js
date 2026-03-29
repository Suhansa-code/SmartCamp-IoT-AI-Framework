'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/childController');
const { validateEnrol } = require('../middleware/validate');

// POST /api/child/enrol
router.post('/enrol', validateEnrol, ctrl.enrolChild);

// GET /api/child/:childId
router.get('/:childId', ctrl.getChild);

module.exports = router;