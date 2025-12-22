//
//  DataModels.swift
//  SSAAdminiPad
//
//  Shared data models matching TypeScript types from shared/types/models.ts
//

import Foundation

// MARK: - Status Types

enum Status: String, Codable, CaseIterable {
    case draft = "draft"
    case published = "published"
    case archived = "archived"
    
    var displayName: String {
        switch self {
        case .draft: return "📝 Draft"
        case .published: return "✅ Published"
        case .archived: return "📦 Archived"
        }
    }
}

enum Difficulty: String, Codable, CaseIterable {
    case easy = "easy"
    case moderate = "moderate"
    case challenging = "challenging"
    
    var displayName: String {
        switch self {
        case .easy: return "🟢 Easy"
        case .moderate: return "🟡 Moderate"
        case .challenging: return "🔴 Challenging"
        }
    }
}

// MARK: - Location Model

struct Location: Identifiable, Codable {
    let id: String
    var name: String
    var slug: String?
    var region: String?
    var shortDescription: String?
    var websiteUrl: String?
    var status: Status
    var sortOrder: Int?
    var createdBy: String?
    var createdAt: String
    var updatedAt: String
    var deletedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case region
        case shortDescription = "short_description"
        case websiteUrl = "website_url"
        case status
        case sortOrder = "sort_order"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
    }
}

// MARK: - Event Model

struct Event: Identifiable, Codable {
    var id: String?
    var name: String
    var slug: String?
    var description: String?
    var hostOrg: String?
    var startDate: String?
    var endDate: String?
    var startTime: String?
    var endTime: String?
    var location: String?
    var recurrence: String?
    var websiteUrl: String?
    var imageUrl: String?
    var ocrText: String?
    var status: String?
    var sortOrder: Int?
    var createdBy: String?
    var createdAt: String?
    var updatedAt: String?
    var deletedAt: String?
    var keywords: [String]?
    var isSignatureEvent: Bool?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case description
        case hostOrg = "host_org"
        case startDate = "start_date"
        case endDate = "end_date"
        case startTime = "start_time"
        case endTime = "end_time"
        case location
        case recurrence
        case websiteUrl = "website_url"
        case imageUrl = "image_url"
        case ocrText = "ocr_text"
        case status
        case sortOrder = "sort_order"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
        case keywords
        case isSignatureEvent = "is_signature_event"
    }
}

// MARK: - Route Model

struct Route: Identifiable, Codable {
    let id: String
    var name: String
    var slug: String?
    var gpxUrl: String?
    var durationMinutes: Int?
    var startPoint: String?
    var endPoint: String?
    var difficulty: Difficulty?
    var notes: String?
    var status: Status
    var sortOrder: Int?
    var createdBy: String?
    var createdAt: String
    var updatedAt: String
    var deletedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case gpxUrl = "gpx_url"
        case durationMinutes = "duration_minutes"
        case startPoint = "start_point"
        case endPoint = "end_point"
        case difficulty
        case notes
        case status
        case sortOrder = "sort_order"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
    }
}

