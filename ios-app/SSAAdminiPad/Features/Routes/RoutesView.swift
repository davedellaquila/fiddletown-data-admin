//
//  RoutesView.swift
//  SSAAdminiPad
//
//  Routes feature view - placeholder matching web app Routes.tsx structure
//

import SwiftUI

struct RoutesView: View {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var routes: [Route] = []
    @State private var loading: Bool = false
    
    let darkMode: Bool
    let sidebarCollapsed: Bool
    
    var body: some View {
        NavigationStack {
            VStack {
                Text("Routes View")
                    .font(.title)
                Text("Implementation in progress")
                    .foregroundColor(.secondary)
            }
            .navigationTitle("🗺️ Routes")
        }
    }
}

#Preview {
    RoutesView(darkMode: false, sidebarCollapsed: false)
}



