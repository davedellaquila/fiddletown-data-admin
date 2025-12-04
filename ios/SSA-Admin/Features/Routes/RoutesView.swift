//
//  RoutesView.swift
//  SSA-Admin
//
//  Routes feature view matching web app Routes.tsx structure
//  See docs/API_CONTRACTS.md for API patterns
//

import SwiftUI

struct RoutesView: View {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var routes: [Route] = []
    @State private var loading: Bool = false
    @State private var searchTerm: String = ""
    @State private var editingRoute: Route?
    @State private var showingEditDialog: Bool = false
    
    let darkMode: Bool
    let sidebarCollapsed: Bool
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Toolbar
                RoutesToolbarView(
                    onNew: { startNew() },
                    onRefresh: { Task { await load() } },
                    loading: loading
                )
                
                // Search bar
                SearchBar(text: $searchTerm)
                    .padding(.horizontal)
                
                // List
                if loading && routes.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(routes) { route in
                        RouteRow(route: route) {
                            editingRoute = route
                            showingEditDialog = true
                        } onDelete: {
                            deleteRoute(route)
                        }
                    }
                }
            }
            .navigationTitle("🗺️ Routes")
            .sheet(isPresented: $showingEditDialog) {
                if editingRoute != nil {
                    RouteEditView(
                        route: editingRoute!,
                        onSave: { updatedRoute in
                            Task {
                                await saveRoute(updatedRoute)
                            }
                        },
                        onCancel: {
                            showingEditDialog = false
                            editingRoute = nil
                        }
                    )
                }
            }
            .task(priority: .background) {
                #if DEBUG
                if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" { return }
                #endif
                await load()
            }
            .onChange(of: searchTerm) {
                #if DEBUG
                if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" { return }
                #endif
                Task {
                    await load()
                }
            }
        }
    }
    
    private func load() async {
        loading = true
        do {
            routes = try await supabaseService.fetchRoutes(searchTerm: searchTerm.isEmpty ? nil : searchTerm)
        } catch {
            print("Error loading routes: \(error)")
        }
        loading = false
    }
    
    private func startNew() {
        let now = ISO8601DateFormatter().string(from: Date())
        editingRoute = Route(
            id: UUID().uuidString,
            name: "",
            slug: nil,
            gpxUrl: nil,
            durationMinutes: nil,
            startPoint: nil,
            endPoint: nil,
            difficulty: nil,
            notes: nil,
            status: .draft,
            sortOrder: 1000,
            createdBy: nil,
            createdAt: now,
            updatedAt: now,
            deletedAt: nil
        )
        showingEditDialog = true
    }
    
    private func saveRoute(_ route: Route) async {
        do {
            _ = try await supabaseService.saveRoute(route)
            showingEditDialog = false
            editingRoute = nil
            await load()
        } catch {
            print("Error saving route: \(error)")
        }
    }
    
    private func deleteRoute(_ route: Route) {
        Task {
            do {
                // Note: deleteRoute method needs to be implemented in SupabaseService
                await load()
            } catch {
                print("Error deleting route: \(error)")
            }
        }
    }
}

struct RouteRow: View {
    let route: Route
    let onTap: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack {
            Button(action: onTap) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(route.name)
                        .font(.headline)
                    if let difficulty = route.difficulty {
                        Text(difficulty.displayName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    if let duration = route.durationMinutes {
                        Text("\(duration) minutes")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)
            
            Spacer()
            
            StatusBadge(status: route.status)
            
            Button("Delete", role: .destructive, action: onDelete)
                .buttonStyle(.bordered)
        }
    }
}

struct RoutesToolbarView: View {
    let onNew: () -> Void
    let onRefresh: () -> Void
    let loading: Bool
    
    var body: some View {
        HStack {
            Button("New", action: onNew)
            Button("Refresh", action: onRefresh)
                .disabled(loading)
            Spacer()
        }
        .padding()
    }
}

struct RouteEditView: View {
    @State var route: Route
    let onSave: (Route) -> Void
    let onCancel: () -> Void
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Basic Information") {
                    TextField("Route Name", text: $route.name)
                    TextField("Slug", text: Binding(
                        get: { route.slug ?? "" },
                        set: { route.slug = $0.isEmpty ? nil : $0 }
                    ))
                }
                
                Section("Route Details") {
                    TextField("Start Point", text: Binding(
                        get: { route.startPoint ?? "" },
                        set: { route.startPoint = $0.isEmpty ? nil : $0 }
                    ))
                    TextField("End Point", text: Binding(
                        get: { route.endPoint ?? "" },
                        set: { route.endPoint = $0.isEmpty ? nil : $0 }
                    ))
                    TextField("Duration (minutes)", value: Binding(
                        get: { route.durationMinutes ?? 0 },
                        set: { route.durationMinutes = $0 > 0 ? $0 : nil }
                    ), format: .number)
                    
                    Picker("Difficulty", selection: Binding(
                        get: { route.difficulty ?? .easy },
                        set: { route.difficulty = $0 }
                    )) {
                        ForEach(Difficulty.allCases, id: \.self) { difficulty in
                            Text(difficulty.displayName).tag(difficulty as Difficulty?)
                        }
                    }
                }
                
                Section("Additional") {
                    TextField("GPX URL", text: Binding(
                        get: { route.gpxUrl ?? "" },
                        set: { route.gpxUrl = $0.isEmpty ? nil : $0 }
                    ))
                    TextEditor(text: Binding(
                        get: { route.notes ?? "" },
                        set: { route.notes = $0.isEmpty ? nil : $0 }
                    ))
                }
                
                Section("Status") {
                    Picker("Status", selection: $route.status) {
                        ForEach(Status.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }
                    TextField("Sort Order", value: Binding(
                        get: { route.sortOrder ?? 1000 },
                        set: { route.sortOrder = $0 }
                    ), format: .number)
                }
            }
            .navigationTitle(route.id.isEmpty ? "New Route" : "Edit Route")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if route.slug == nil && !route.name.isEmpty {
                            route.slug = slugify(route.name)
                        }
                        onSave(route)
                    }
                }
            }
        }
    }
}

#Preview {
    RoutesView(darkMode: false, sidebarCollapsed: false)
}

