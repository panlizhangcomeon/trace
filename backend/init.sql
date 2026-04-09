-- Travel Route Planner Database Initialization
-- Database: trace
-- Run this file to initialize the database

CREATE DATABASE IF NOT EXISTS trace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE trace;

-- =====================================================
-- POIs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS pois (
    id CHAR(36) PRIMARY KEY,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    icon VARCHAR(100) NULL,
    note TEXT NULL,
    tags JSON DEFAULT ('[]'),
    created_at DATETIME NOT NULL,
    INDEX idx_pois_type (type),
    INDEX idx_pois_lat_lng (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Trips Table
-- =====================================================
CREATE TABLE IF NOT EXISTS trips (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NULL,
    destination VARCHAR(255) NULL,
    start_date DATE NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Routes Table
-- =====================================================
CREATE TABLE IF NOT EXISTS routes (
    id CHAR(36) PRIMARY KEY,
    trip_id CHAR(36) NULL,
    name VARCHAR(255) NULL,
    color VARCHAR(7) DEFAULT '#FF6B81',
    day_number INT DEFAULT 1,
    order_index INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    INDEX idx_routes_trip_day (trip_id, day_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- RoutePOIs Junction Table
-- =====================================================
CREATE TABLE IF NOT EXISTS route_pois (
    id CHAR(36) PRIMARY KEY,
    route_id CHAR(36) NOT NULL,
    poi_id CHAR(36) NOT NULL,
    order_index INT NOT NULL,
    stop_note TEXT NULL,
    segment_note TEXT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE,
    UNIQUE KEY unique_route_order (route_id, order_index),
    INDEX idx_route_pois_route_order (route_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 已有库升级（若列已存在会报错，可忽略或按需执行）:
-- ALTER TABLE route_pois ADD COLUMN stop_note TEXT NULL;
-- ALTER TABLE route_pois ADD COLUMN segment_note TEXT NULL;

-- =====================================================
-- Traffic Options Table
-- =====================================================
CREATE TABLE IF NOT EXISTS traffic_options (
    id CHAR(36) PRIMARY KEY,
    from_poi_id CHAR(36) NOT NULL,
    to_poi_id CHAR(36) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    duration_minutes INT NOT NULL,
    cost DECIMAL(10, 2) NULL,
    operating_hours VARCHAR(100) NULL,
    couple_friendly_tags JSON DEFAULT ('[]'),
    created_at DATETIME NOT NULL,
    FOREIGN KEY (from_poi_id) REFERENCES pois(id) ON DELETE CASCADE,
    FOREIGN KEY (to_poi_id) REFERENCES pois(id) ON DELETE CASCADE,
    INDEX idx_traffic_from_to (from_poi_id, to_poi_id),
    INDEX idx_traffic_mode (mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Django Migrations Table (for reference)
-- =====================================================
CREATE TABLE IF NOT EXISTS django_migrations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    app VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Sample Data (optional - uncomment to insert)
-- =====================================================

-- INSERT INTO pois (id, latitude, longitude, name, type, tags, created_at)
-- VALUES
--     (UUID(), 25.0968, 102.8463, '大理古城', 'attraction', '["local_secret", "couple_friendly"]', NOW()),
--     (UUID(), 25.6037, 100.2676, '洱海边', 'attraction', '["scenic_view", "couple_friendly"]', NOW()),
--     (UUID(), 25.0118, 100.5267, '双廊古镇', 'attraction', '["local_secret", "scenic_view"]', NOW());
