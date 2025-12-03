//
//  EventsView.swift
//  SSAAdminiPad
//
//  Events feature view - placeholder matching web app Events.tsx structure
//

import SwiftUI

struct EventsView: View {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var events: [Event] = []
    @State private var loading: Bool = false
    
    let darkMode: Bool
    let sidebarCollapsed: Bool
    
    var body: some View {
        NavigationStack {
            VStack {
                Text("Events View")
                    .font(.title)
                Text("Implementation in progress")
                    .foregroundColor(.secondary)
            }
            .navigationTitle("📅 Events")
        }
    }
}

#Preview {
    EventsView(darkMode: false, sidebarCollapsed: false)
}


