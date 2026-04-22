const express = require('express');
const router  = express.Router();

const {
  placeBid,
  getMyBids,
  getWonAuctions,
  getNotifications,
  markNotificationsRead,
} = require('../controllers/bidController');

const {
  authenticate,
  authorizeRoles,
} = require('../middleware/auth');

router.post  ('/',                     authenticate,                           placeBid);
router.get   ('/my-bids',              authenticate,                           getMyBids);
router.get   ('/won',                  authenticate, authorizeRoles('buyer'),  getWonAuctions);
router.get   ('/notifications',        authenticate,                           getNotifications);
router.patch ('/notifications/read',   authenticate,                           markNotificationsRead);

module.exports = router;