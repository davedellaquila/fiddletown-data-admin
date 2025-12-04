//
//  SSAAdminiPadApp.swift
//  SSAAdminiPad
//
//  Main app entry point
//

import SwiftUI
import Supabase

// Note: This file is kept for reference but SSA_AdminApp.swift is the main entry point
// @main removed to avoid conflicts - only SSA_AdminApp.swift should have @main
struct SSAAdminiPadApp: App {
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
