//
//  SSA_AdminApp.swift
//  SSA-Admin
//
//  Main app entry point
//

import SwiftUI
import Supabase

@main
struct SSA_AdminApp: App {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var session: Session?
    
    // Development mode: Set to true to bypass authentication
    // Set to false for production
    #if DEBUG
    private let isDevelopmentMode = true
    #else
    private let isDevelopmentMode = false
    #endif
    
    var body: some Scene {
        WindowGroup {
            Group {
                if session != nil || isDevelopmentMode {
                    ContentView()
                } else {
                    LoginView()
                }
            }
            .task {
                await checkSession()
            }
            .onChange(of: session) { _, _ in
                // Handle session changes if needed in future
            }
        }
    }
    
    private func checkSession() async {
        if isDevelopmentMode {
            // In development mode, create a mock session to bypass authentication
            // This allows testing without magic links in the simulator
            session = createMockSession()
            return
        }
        
        do {
            session = try await supabaseService.getCurrentSession()
        } catch {
            session = nil
        }
    }
    
    // Create a mock session for development
    private func createMockSession() -> Session? {
        // Return nil to indicate no real session, but app will still show ContentView
        // The SupabaseService will handle development mode queries
        return nil
    }
}
