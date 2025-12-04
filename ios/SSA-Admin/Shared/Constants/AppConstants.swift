//
//  AppConstants.swift
//  SSA-Admin
//
//  Shared constants matching web/shared/constants/index.ts
//  See docs/SHARED_CONSTANTS.md for documentation
//

import Foundation

struct AppConstants {
    // MARK: - Status Constants
    
    /// Valid status values for locations, events, and routes
    static let statusValues = ["draft", "published", "archived"]
    
    /// Default status for new records
    static let defaultStatus = "draft"
    
    /// Status display labels
    static let statusLabels: [String: String] = [
        "draft": "Draft",
        "published": "Published",
        "archived": "Archived"
    ]
    
    // MARK: - Difficulty Constants
    
    /// Valid difficulty values for routes
    static let difficultyValues = ["easy", "moderate", "challenging"]
    
    /// Difficulty display labels
    static let difficultyLabels: [String: String] = [
        "easy": "Easy",
        "moderate": "Moderate",
        "challenging": "Challenging"
    ]
    
    // MARK: - Table Names
    
    /// Database table names
    static let tables: [String: String] = [
        "locations": "locations",
        "events": "events",
        "routes": "routes",
        "keywords": "keywords"
    ]
    
    // MARK: - Validation Constants
    
    /// Maximum length for text fields
    static let maxLengths: [String: Int] = [
        "name": 255,
        "slug": 255,
        "description": 5000,
        "shortDescription": 500
    ]
    
    /// Default sort order for records
    static let defaultSortOrder = 0
}

