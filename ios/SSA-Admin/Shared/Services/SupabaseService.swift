//
//  SupabaseService.swift
//  SSAAdminiPad
//
//  Supabase client wrapper matching shared/lib/supabaseClient.ts
//

import Foundation
import Combine
import Supabase

class SupabaseService: ObservableObject {
    static let shared = SupabaseService()
    
    let client: SupabaseClient
    
    // Development mode: Set to true to bypass authentication
    // Set to false for production
    #if DEBUG
    private let isDevelopmentMode = true
    #else
    private let isDevelopmentMode = false
    #endif
    
    private init() {
        #if DEBUG
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            // Initialize a harmless placeholder client to make Previews safe.
            self.client = SupabaseClient(supabaseURL: URL(string: "https://example.com")!, supabaseKey: "preview")
            return
        }
        #endif
        // Get configuration from environment or Config.plist
        let urlStringOpt = (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String) ?? ProcessInfo.processInfo.environment["SUPABASE_URL"]
        let anonKeyOpt = (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String) ?? ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
        guard let urlString = urlStringOpt, let url = URL(string: urlString), let anonKey = anonKeyOpt else {
            fatalError("Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in Info.plist or environment variables.")
        }
        
        self.client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }
    
    // MARK: - Authentication
    
    func signInWithOtp(email: String) async throws {
        try await client.auth.signInWithOTP(email: email)
    }
    
    func signOut() async throws {
        try await client.auth.signOut()
    }
    
    func getCurrentSession() async throws -> Session? {
        // In development mode, return nil but allow app to proceed
        // The app will show ContentView even without a session
        if isDevelopmentMode {
            return nil
        }
        let session = try await client.auth.session
        return session
    }
    
    // MARK: - Locations
    
    struct LocationUpdateData: Encodable {
        let name: String
        let slug: String?
        let region: String?
        let short_description: String?
        let website_url: String?
        let status: String
        let sort_order: Int?
    }
    
    struct LocationInsertData: Encodable {
        let name: String
        let slug: String?
        let region: String?
        let short_description: String?
        let website_url: String?
        let status: String
        let sort_order: Int?
        let created_by: String?
    }
    
    func fetchLocations(searchTerm: String? = nil) async throws -> [Location] {
        #if DEBUG
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            let now = Date()
            let formatter = ISO8601DateFormatter()
            return [
                Location(
                    id: "loc-1",
                    name: "Preview Park",
                    slug: "preview-park",
                    region: "North",
                    shortDescription: "Sample location for previews",
                    websiteUrl: "https://example.com",
                    status: .draft,
                    sortOrder: 1,
                    createdBy: "preview",
                    createdAt: formatter.string(from: now),
                    updatedAt: formatter.string(from: now),
                    deletedAt: nil
                ),
                Location(
                    id: "loc-2",
                    name: "Demo Ridge",
                    slug: "demo-ridge",
                    region: "West",
                    shortDescription: "Another sample location",
                    websiteUrl: nil,
                    status: .published,
                    sortOrder: 2,
                    createdBy: "preview",
                    createdAt: formatter.string(from: now),
                    updatedAt: formatter.string(from: now),
                    deletedAt: nil
                ),
                Location(
                    id: "loc-3",
                    name: "Test Valley",
                    slug: "test-valley",
                    region: "South",
                    shortDescription: nil,
                    websiteUrl: nil,
                    status: .archived,
                    sortOrder: 3,
                    createdBy: "preview",
                    createdAt: formatter.string(from: now),
                    updatedAt: formatter.string(from: now),
                    deletedAt: nil
                )
            ]
        }
        #endif
        
        var filterQuery = client
            .from("locations")
            .select()
            .is("deleted_at", value: nil)
        
        if let searchTerm = searchTerm, !searchTerm.isEmpty {
            filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
        }
        
        let response: [Location] = try await filterQuery
            .order("sort_order", ascending: true)
            .order("name", ascending: true)
            .execute()
            .value
        return response
    }
    
    func saveLocation(_ location: Location) async throws -> Location {
        if !location.id.isEmpty {
            // Update existing
            let updateData = LocationUpdateData(
                name: location.name,
                slug: location.slug,
                region: location.region,
                short_description: location.shortDescription,
                website_url: location.websiteUrl,
                status: location.status.rawValue,
                sort_order: location.sortOrder
            )
            
            let response: Location = try await client
                .from("locations")
                .update(updateData)
                .eq("id", value: location.id)
                .select()
                .single()
                .execute()
                .value
            return response
        } else {
            // Insert new
            let insertData = LocationInsertData(
                name: location.name,
                slug: location.slug,
                region: location.region,
                short_description: location.shortDescription,
                website_url: location.websiteUrl,
                status: location.status.rawValue,
                sort_order: location.sortOrder,
                created_by: location.createdBy
            )
            
            let response: Location = try await client
                .from("locations")
                .insert(insertData)
                .select()
                .single()
                .execute()
                .value
            return response
        }
    }
    
    func deleteLocation(id: String) async throws {
        try await client
            .from("locations")
            .update(["deleted_at": ISO8601DateFormatter().string(from: Date())])
            .eq("id", value: id)
            .execute()
    }
    
    func updateLocationStatus(id: String, status: Status) async throws {
        try await client
            .from("locations")
            .update(["status": status.rawValue])
            .eq("id", value: id)
            .execute()
    }
    
    // MARK: - Events
    
    func fetchEvents(searchTerm: String? = nil, fromDate: String? = nil, toDate: String? = nil, signatureEventsOnly: Bool = false) async throws -> [Event] {
        #if DEBUG
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            return []
        }
        #endif
        
        var filterQuery = client
            .from("events")
            .select()
            .is("deleted_at", value: nil)
        
        if let searchTerm = searchTerm, !searchTerm.isEmpty {
            filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
        }
        
        if let fromDate = fromDate {
            _ = fromDate
        }
        
        if let toDate = toDate {
            filterQuery = filterQuery.lte("start_date", value: toDate)
        }
        
        if signatureEventsOnly {
            filterQuery = filterQuery.eq("is_signature_event", value: true)
        }
        
        let response: [Event] = try await filterQuery
            .order("start_date", ascending: true)
            .order("name", ascending: true)
            .execute()
            .value
        return response
    }
    
    func saveEvent(_ event: Event) async throws -> Event {
        // Similar to saveLocation but for events
        // Implementation would follow same pattern
        fatalError("Not yet implemented")
    }
    
    // MARK: - Routes
    
    func fetchRoutes(searchTerm: String? = nil) async throws -> [Route] {
        #if DEBUG
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            return []
        }
        #endif
        
        var filterQuery = client
            .from("routes")
            .select()
            .is("deleted_at", value: nil)
        
        if let searchTerm = searchTerm, !searchTerm.isEmpty {
            filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
        }
        
        let response: [Route] = try await filterQuery
            .order("sort_order", ascending: true)
            .order("name", ascending: true)
            .execute()
            .value
        return response
    }
    
    func saveRoute(_ route: Route) async throws -> Route {
        // Similar to saveLocation but for routes
        fatalError("Not yet implemented")
    }
}

