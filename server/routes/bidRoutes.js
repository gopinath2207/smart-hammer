const express = require('express');
const router  = express.Router();

const {
  placeBid,
  getMyBids,
  getWonAuctions,
} = require('../controllers/bidController');

const {
  authenticate,
  authorizeRoles,
} = require('../middleware/auth');

router.post('/',           authenticate, authorizeRoles('buyer'),  placeBid);
router.get ('/my-bids',    authenticate,                           getMyBids);
router.get ('/won',        authenticate, authorizeRoles('buyer'),  getWonAuctions);

module.exports = router;