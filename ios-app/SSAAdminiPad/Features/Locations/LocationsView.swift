//
//  LocationsView.swift
//  SSAAdminiPad
//
//  Locations feature view matching web app Locations.tsx
//

import SwiftUI

struct LocationsView: View {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var locations: [Location] = []
    @State private var loading: Bool = false
    @State private var searchTerm: String = ""
    @State private var editingLocation: Location?
    @State private var showingEditDialog: Bool = false
    
    let darkMode: Bool
    let sidebarCollapsed: Bool
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Toolbar
                ToolbarView(
                    onNew: { startNew() },
                    onRefresh: { load() },
                    onExport: { exportCSV() },
                    loading: loading
                )
                
                // Search bar
                SearchBar(text: $searchTerm)
                    .padding(.horizontal)
                
                // List
                if loading && locations.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(locations) { location in
                        LocationRow(location: location) {
                            editingLocation = location
                            showingEditDialog = true
                        } onPublish: {
                            publishLocation(location)
                        } onArchive: {
                            archiveLocation(location)
                        } onDelete: {
                            deleteLocation(location)
                        }
                    }
                }
            }
            .navigationTitle("📍 Locations")
            .sheet(isPresented: $showingEditDialog) {
                if let editing = editingLocation {
                    LocationEditView(
                        location: editing,
                        onSave: { updatedLocation in
                            saveLocation(updatedLocation)
                        },
                        onCancel: {
                            showingEditDialog = false
                            editingLocation = nil
                        }
                    )
                }
            }
            .task {
                await load()
            }
            .onChange(of: searchTerm) {
                Task {
                    await load()
                }
            }
        }
    }
    
    private func load() async {
        loading = true
        do {
            locations = try await supabaseService.fetchLocations(searchTerm: searchTerm.isEmpty ? nil : searchTerm)
        } catch {
            print("Error loading locations: \(error)")
        }
        loading = false
    }
    
    private func startNew() {
        editingLocation = Location(
            id: "",
            name: "",
            slug: nil,
            region: nil,
            shortDescription: nil,
            websiteUrl: nil,
            status: .draft,
            sortOrder: 1000,
            createdBy: nil,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            deletedAt: nil
        )
        showingEditDialog = true
    }
    
    private func saveLocation(_ location: Location) async {
        do {
            _ = try await supabaseService.saveLocation(location)
            showingEditDialog = false
            editingLocation = nil
            await load()
        } catch {
            print("Error saving location: \(error)")
        }
    }
    
    private func publishLocation(_ location: Location) {
        Task {
            do {
                try await supabaseService.updateLocationStatus(id: location.id, status: .published)
                await load()
            } catch {
                print("Error publishing location: \(error)")
            }
        }
    }
    
    private func archiveLocation(_ location: Location) {
        Task {
            do {
                try await supabaseService.updateLocationStatus(id: location.id, status: .archived)
                await load()
            } catch {
                print("Error archiving location: \(error)")
            }
        }
    }
    
    private func deleteLocation(_ location: Location) {
        Task {
            do {
                try await supabaseService.deleteLocation(id: location.id)
                await load()
            } catch {
                print("Error deleting location: \(error)")
            }
        }
    }
    
    private func exportCSV() {
        // CSV export implementation
        // Would match web app exportCSV functionality
    }
}

struct LocationRow: View {
    let location: Location
    let onTap: () -> Void
    let onPublish: () -> Void
    let onArchive: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(location.name)
                    .font(.headline)
                if let region = location.region {
                    Text(region)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            StatusBadge(status: location.status)
            
            if location.status != .published {
                Button("Publish", action: onPublish)
                    .buttonStyle(.borderedProminent)
            }
            
            if location.status != .archived {
                Button("Archive", action: onArchive)
                    .buttonStyle(.bordered)
            }
            
            Button("Delete", role: .destructive, action: onDelete)
                .buttonStyle(.bordered)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
    }
}

struct StatusBadge: View {
    let status: Status
    
    var body: some View {
        Text(status.displayName)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor(status))
            .foregroundColor(.white)
            .cornerRadius(8)
    }
    
    private func statusColor(_ status: Status) -> Color {
        switch status {
        case .published: return .green
        case .archived: return .orange
        case .draft: return .gray
        }
    }
}

struct ToolbarView: View {
    let onNew: () -> Void
    let onRefresh: () -> Void
    let onExport: () -> Void
    let loading: Bool
    
    var body: some View {
        HStack {
            Button("New", action: onNew)
            Button("Refresh", action: onRefresh)
                .disabled(loading)
            Button("Export", action: onExport)
            Spacer()
        }
        .padding()
    }
}

struct SearchBar: View {
    @Binding var text: String
    
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
            TextField("Search name…", text: $text)
            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                }
            }
        }
        .padding(8)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

struct LocationEditView: View {
    @State var location: Location
    let onSave: (Location) -> Void
    let onCancel: () -> Void
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Basic Information") {
                    TextField("Location Name", text: $location.name)
                    TextField("Slug", text: Binding(
                        get: { location.slug ?? "" },
                        set: { location.slug = $0.isEmpty ? nil : $0 }
                    ))
                    TextField("Region", text: Binding(
                        get: { location.region ?? "" },
                        set: { location.region = $0.isEmpty ? nil : $0 }
                    ))
                }
                
                Section("Details") {
                    TextField("Website URL", text: Binding(
                        get: { location.websiteUrl ?? "" },
                        set: { location.websiteUrl = $0.isEmpty ? nil : $0 }
                    ))
                    TextEditor(text: Binding(
                        get: { location.shortDescription ?? "" },
                        set: { location.shortDescription = $0.isEmpty ? nil : $0 }
                    ))
                }
                
                Section("Status") {
                    Picker("Status", selection: $location.status) {
                        ForEach(Status.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }
                    TextField("Sort Order", value: Binding(
                        get: { location.sortOrder ?? 1000 },
                        set: { location.sortOrder = $0 }
                    ), format: .number)
                }
            }
            .navigationTitle(location.id.isEmpty ? "New Location" : "Edit Location")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if location.slug == nil && !location.name.isEmpty {
                            location.slug = slugify(location.name)
                        }
                        onSave(location)
                    }
                }
            }
        }
    }
}

#Preview {
    LocationsView(darkMode: false, sidebarCollapsed: false)
}


