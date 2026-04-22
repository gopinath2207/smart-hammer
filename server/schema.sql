-- ============================================
-- SMART HAMMER - Online Auction System
-- PostgreSQL Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
    user_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(50) UNIQUE NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     VARCHAR(100),
    phone         VARCHAR(20),
    avatar_url    TEXT,
    role VARCHAR(15) NOT NULL DEFAULT 'buyer'
     CHECK (role IN ('buyer', 'seller', 'admin', 'employee')),
    is_verified   BOOLEAN DEFAULT FALSE,
    is_banned     BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. EMPLOYEE DETAILS TABLE
-- ============================================
CREATE TABLE employee_details (
    employee_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department      VARCHAR(100),
    designation     VARCHAR(100),
    employee_code   VARCHAR(50) UNIQUE NOT NULL,
    can_manage_auctions   BOOLEAN DEFAULT TRUE,
    can_manage_users      BOOLEAN DEFAULT FALSE,
    can_manage_payments   BOOLEAN DEFAULT FALSE,
    can_view_reports      BOOLEAN DEFAULT TRUE,
    joined_at       TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. CATEGORIES TABLE
-- ============================================
CREATE TABLE categories (
    category_id   SERIAL PRIMARY KEY,
    name          VARCHAR(100) UNIQUE NOT NULL,
    slug          VARCHAR(100) UNIQUE NOT NULL,
    description   TEXT,
    image_url     TEXT,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. AUCTIONS TABLE
-- ============================================
CREATE TABLE auctions (
    auction_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category_id       INT REFERENCES categories(category_id) ON DELETE SET NULL,
    title             VARCHAR(200) NOT NULL,
    description       TEXT,
    starting_price    NUMERIC(12, 2) NOT NULL CHECK (starting_price >= 0),
    reserve_price     NUMERIC(12, 2) DEFAULT 0,
    current_price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    bid_increment     NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    image_urls        TEXT[],
    status            VARCHAR(10) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'ended', 'cancelled')),
    start_time        TIMESTAMP NOT NULL,
    end_time          TIMESTAMP NOT NULL,
    winner_id         UUID REFERENCES users(user_id) ON DELETE SET NULL,
    total_bids        INT DEFAULT 0,
    views_count       INT DEFAULT 0,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),
    CONSTRAINT end_after_start CHECK (end_time > start_time),
    CONSTRAINT current_gte_starting CHECK (current_price >= 0)
);

-- ============================================
-- 4. BIDS TABLE
-- ============================================
CREATE TABLE bids (
    bid_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id    UUID NOT NULL REFERENCES auctions(auction_id) ON DELETE CASCADE,
    bidder_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    is_winning    BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW(),
    CONSTRAINT no_self_bid CHECK (
        bidder_id != (
            SELECT seller_id FROM auctions WHERE auction_id = bids.auction_id
        )
    )
);

-- ============================================
-- 5. PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
    payment_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id        UUID NOT NULL REFERENCES auctions(auction_id) ON DELETE CASCADE,
    payer_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount            NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency          VARCHAR(5) DEFAULT 'USD',
    status            VARCHAR(15) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_payment_id TEXT UNIQUE,
    stripe_session_id TEXT,
    paid_at           TIMESTAMP,
    created_at        TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. WATCHLIST TABLE
-- ============================================
CREATE TABLE watchlist (
    watchlist_id  SERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    auction_id    UUID NOT NULL REFERENCES auctions(auction_id) ON DELETE CASCADE,
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, auction_id)
);

-- ============================================
-- 7. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    notification_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    auction_id        UUID REFERENCES auctions(auction_id) ON DELETE CASCADE,
    type              VARCHAR(20) NOT NULL
                      CHECK (type IN (
    'outbid', 'auction_won', 'auction_ended',
    'auction_started', 'payment_due', 'payment_confirmed',
    'dispute_assigned', 'report_ready', 'user_flagged'
)),
    message           TEXT NOT NULL,
    is_read           BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. REVIEWS TABLE
-- ============================================
CREATE TABLE reviews (
    review_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id    UUID NOT NULL REFERENCES auctions(auction_id) ON DELETE CASCADE,
    reviewer_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reviewed_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT,
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE (auction_id, reviewer_id)
);

-- ============================================
-- 9. AUCTION DISPUTES TABLE
-- ============================================
CREATE TABLE auction_disputes (
    dispute_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id        UUID NOT NULL REFERENCES auctions(auction_id) ON DELETE CASCADE,
    raised_by         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_to       UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reason            TEXT NOT NULL,
    status            VARCHAR(15) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
    resolution_note   TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    resolved_at       TIMESTAMP
);


-- ============================================
-- INDEXES (Performance)
-- ============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

--Employee
CREATE INDEX idx_users_employee_code ON employee_details(employee_code);

--auction_Disputes
CREATE INDEX idx_disputes_auction ON auction_disputes(auction_id);
CREATE INDEX idx_disputes_assigned ON auction_disputes(assigned_to);
CREATE INDEX idx_disputes_status ON auction_disputes(status);



-- Auctions
CREATE INDEX idx_auctions_seller ON auctions(seller_id);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_category ON auctions(category_id);
CREATE INDEX idx_auctions_end_time ON auctions(end_time);
CREATE INDEX idx_auctions_start_time ON auctions(start_time);
CREATE INDEX idx_auctions_status_end ON auctions(status, end_time);

-- Bids
CREATE INDEX idx_bids_auction ON bids(auction_id);
CREATE INDEX idx_bids_bidder ON bids(bidder_id);
CREATE INDEX idx_bids_amount ON bids(auction_id, amount DESC);
CREATE INDEX idx_bids_created ON bids(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- Watchlist
CREATE INDEX idx_watchlist_user ON watchlist(user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at on users
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_auctions_updated_at
BEFORE UPDATE ON auctions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update auction current_price and total_bids when a new bid is placed
CREATE OR REPLACE FUNCTION update_auction_on_bid()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset previous winning bid
    UPDATE bids
    SET is_winning = FALSE
    WHERE auction_id = NEW.auction_id AND is_winning = TRUE;

    -- Mark new bid as winning
    NEW.is_winning = TRUE;

    -- Update auction current price and bid count
    UPDATE auctions
    SET current_price = NEW.amount,
        total_bids = total_bids + 1,
        updated_at = NOW()
    WHERE auction_id = NEW.auction_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bid_placed
BEFORE INSERT ON bids
FOR EACH ROW EXECUTE FUNCTION update_auction_on_bid();

-- Auto-set auction winner when status changes to 'ended'
CREATE OR REPLACE FUNCTION set_auction_winner()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        UPDATE auctions
        SET winner_id = (
            SELECT bidder_id FROM bids
            WHERE auction_id = NEW.auction_id AND is_winning = TRUE
            LIMIT 1
        )
        WHERE auction_id = NEW.auction_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auction_ended
AFTER UPDATE ON auctions
FOR EACH ROW EXECUTE FUNCTION set_auction_winner();

-- ============================================
-- SEED DATA — Categories
-- ============================================
INSERT INTO categories (name, slug, description) VALUES
('Electronics',     'electronics',      'Phones, laptops, gadgets and more'),
('Fashion',         'fashion',          'Clothing, shoes, and accessories'),
('Art & Collectibles', 'art',           'Paintings, sculptures, antiques'),
('Vehicles',        'vehicles',         'Cars, bikes, and spare parts'),
('Furniture',       'furniture',        'Home and office furniture'),
('Sports',          'sports',           'Sports equipment and memorabilia'),
('Jewellery',       'jewellery',        'Rings, necklaces, watches'),
('Books & Music',   'books-music',      'Rare books, vinyl, instruments');

-- ============================================
-- SEED DATA — Admin User (password: Admin@123)
-- ============================================
INSERT INTO users (username, email, password_hash, full_name, role, is_verified)
VALUES (
    'admin',
    'admin@smarthammer.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Smart Hammer Admin',
    'admin',
    TRUE
);

-- ============================================
-- SEED DATA — Default Employee (password: Employee@123)
-- ============================================
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    INSERT INTO users (username, email, password_hash, full_name, role, is_verified)
    VALUES (
        'employee1',
        'employee1@smarthammer.com',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'Smart Hammer Employee',
        'employee',
        TRUE
    ) RETURNING user_id INTO v_user_id;

    INSERT INTO employee_details (user_id, department, designation, employee_code)
    VALUES (
        v_user_id,
        'Operations',
        'Auction Moderator',
        'EMP-001'
    );
END $$;