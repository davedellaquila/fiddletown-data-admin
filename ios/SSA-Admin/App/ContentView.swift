//
//  ContentView.swift
//  SSAAdminiPad
//
//  Main content view with navigation matching web app structure
//

import SwiftUI

enum ViewType: String, CaseIterable, Hashable {
    case locations = "locations"
    case events = "events"
    case routes = "routes"
    case ocrTest = "ocr-test"
    
    var title: String {
        switch self {
        case .locations: return "📍 Locations"
        case .events: return "📅 Events"
        case .routes: return "🗺️ Routes"
        case .ocrTest: return "🔍 OCR Test"
        }
    }
    
    var icon: String {
        switch self {
        case .locations: return "location"
        case .events: return "calendar"
        case .routes: return "map"
        case .ocrTest: return "camera"
        }
    }
}

struct ContentView: View {
    @State private var selectedView: ViewType = .locations
    @State private var sidebarCollapsed: Bool = false
    @State private var darkMode: Bool = false
    
    var body: some View {
        NavigationSplitView {
            // Sidebar
            SidebarView(
                selectedView: $selectedView,
                sidebarCollapsed: $sidebarCollapsed,
                darkMode: $darkMode
            )
        } detail: {
            // Main content
            Group {
                switch selectedView {
                case .locations:
                    LocationsView(darkMode: darkMode, sidebarCollapsed: sidebarCollapsed)
                case .events:
                    EventsView(darkMode: darkMode, sidebarCollapsed: sidebarCollapsed)
                case .routes:
                    RoutesView(darkMode: darkMode, sidebarCollapsed: sidebarCollapsed)
                case .ocrTest:
                    OCRTestView(darkMode: darkMode)
                }
            }
        }
        .preferredColorScheme(darkMode ? .dark : .light)
    }
}

struct SidebarView: View {
    @Binding var selectedView: ViewType
    @Binding var sidebarCollapsed: Bool
    @Binding var darkMode: Bool
    private let supabaseService = SupabaseService.shared
    
    var body: some View {
        List {
            ForEach(ViewType.allCases, id: \.self) { viewType in
                Button(action: { selectedView = viewType }) {
                    HStack {
                        Label(viewType.title, systemImage: viewType.icon)
                        Spacer()
                        if selectedView == viewType {
                            Image(systemName: "checkmark")
                                .foregroundColor(.accentColor)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("SSA Admin")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    darkMode.toggle()
                }) {
                    Image(systemName: darkMode ? "sun.max.fill" : "moon.fill")
                }
            }
            
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Sign Out") {
                    Task {
                        // In development mode, sign out is disabled
                        // Set isDevelopmentMode to false in SSA_AdminApp.swift for production
                        #if DEBUG
                        // Development mode: do nothing or show alert
                        #else
                        try? await supabaseService.signOut()
                        #endif
                    }
                }
            }
        }
    }
}

#Preview {
    ContentView()
}

