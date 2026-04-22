const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');

const {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  cancelAuction,
  getAuctionBids,
  toggleWatchlist,
} = require('../controllers/auctionController');

const {
  authenticate,
  authorizeRoles,
  optionalAuth,
  checkEmployeePermission,
} = require('../middleware/auth');

// Public
router.get ('/',              optionalAuth,  getAllAuctions);
router.get ('/:id',           optionalAuth,  getAuctionById);
router.get ('/:id/bids',                     getAuctionBids);

// Seller + Admin
router.post('/',
  authenticate,
  authorizeRoles('seller', 'admin'),
  upload.array('images', 5),   // up to 5 product images
  createAuction
);

// Seller (own) + Admin + Employee
router.put ('/:id',
  authenticate,
  authorizeRoles('seller', 'admin', 'employee'),
  checkEmployeePermission('can_manage_auctions'),
  updateAuction
);

router.patch('/:id/cancel',
  authenticate,
  authorizeRoles('seller', 'admin', 'employee'),
  cancelAuction
);

// Seller (own) + Admin only
router.delete('/:id',
  authenticate,
  authorizeRoles('seller', 'admin'),
  deleteAuction
);

// Authenticated users
router.post('/:id/watchlist',
  authenticate,
  toggleWatchlist
);

module.exports = router;