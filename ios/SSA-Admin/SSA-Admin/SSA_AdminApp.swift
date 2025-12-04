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
    
    var body: some Scene {
        WindowGroup {
            Group {
                if session != nil {
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
        do {
            session = try await supabaseService.getCurrentSession()
        } catch {
            session = nil
        }
    }
}
