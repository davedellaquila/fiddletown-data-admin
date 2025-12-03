//
//  SSAAdminiPadApp.swift
//  SSAAdminiPad
//
//  Main app entry point
//

import SwiftUI
import Supabase

@main
struct SSAAdminiPadApp: App {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var session: AuthSession?
    
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
