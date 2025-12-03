//
//  SupabaseService.swift
//  SSAAdminiPad
//
//  Supabase client wrapper matching shared/lib/supabaseClient.ts
//

import Foundation
import Supabase

class SupabaseService: ObservableObject {
    static let shared = SupabaseService()
    
    let client: SupabaseClient
    
    private init() {
        // Get configuration from environment or Config.plist
        guard let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ProcessInfo.processInfo.environment["SUPABASE_URL"],
              let url = URL(string: urlString),
              let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] else {
            fatalError("Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in Info.plist or environment variables.")
        }
        
        self.client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }
    
    // MARK: - Authentication
    
    func signInWithOtp(email: String) async throws {
        try await client.auth.signInWithOtp(email: email)
    }
    
    func signOut() async throws {
        try await client.auth.signOut()
    }
    
    func getCurrentSession() async throws -> AuthSession? {
        let session = try await client.auth.session
        return session
    }
    
    // MARK: - Locations
    
    func fetchLocations(searchTerm: String? = nil) async throws -> [Location] {
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
        if let id = location.id, !id.isEmpty {
            // Update existing
            let updateData: [String: Any] = [
                "name": location.name,
                "slug": location.slug as Any,
                "region": location.region as Any,
                "short_description": location.shortDescription as Any,
                "website_url": location.websiteUrl as Any,
                "status": location.status.rawValue,
                "sort_order": location.sortOrder as Any
            ]
            
            let response: Location = try await client
                .from("locations")
                .update(updateData)
                .eq("id", value: id)
                .select()
                .single()
                .execute()
                .value
            return response
        } else {
            // Insert new
            let insertData: [String: Any] = [
                "name": location.name,
                "slug": location.slug as Any,
                "region": location.region as Any,
                "short_description": location.shortDescription as Any,
                "website_url": location.websiteUrl as Any,
                "status": location.status.rawValue,
                "sort_order": location.sortOrder as Any,
                "created_by": location.createdBy as Any
            ]
            
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
    
    func fetchEvents(searchTerm: String? = nil, fromDate: String? = nil, toDate: String? = nil) async throws -> [Event] {
        var filterQuery = client
            .from("events")
            .select()
            .is("deleted_at", value: nil)
        
        if let searchTerm = searchTerm, !searchTerm.isEmpty {
            filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
        }
        
        if let fromDate = fromDate {
            // Complex date filtering logic matching web app
            // Simplified here - full implementation would match TypeScript logic
            _ = fromDate
        }
        
        if let toDate = toDate {
            filterQuery = filterQuery.lte("start_date", value: toDate)
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
