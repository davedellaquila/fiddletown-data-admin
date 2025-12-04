//
//  EventsView.swift
//  SSA-Admin
//
//  Events feature view matching web app Events.tsx structure
//  See docs/API_CONTRACTS.md for API patterns
//

import SwiftUI

struct EventsView: View {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var events: [Event] = []
    @State private var loading: Bool = false
    @State private var searchTerm: String = ""
    @State private var editingEvent: Event?
    @State private var showingEditDialog: Bool = false
    @State private var fromDate: String?
    @State private var toDate: String?
    
    let darkMode: Bool
    let sidebarCollapsed: Bool
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Toolbar
                EventsToolbarView(
                    onNew: { startNew() },
                    onRefresh: { Task { await load() } },
                    loading: loading
                )
                
                // Search and filters
                VStack(spacing: 8) {
                    SearchBar(text: $searchTerm)
                    
                    // Date filters
                    HStack {
                        DatePicker("From", selection: Binding(
                            get: { fromDate.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date() },
                            set: { fromDate = ISO8601DateFormatter().string(from: $0) }
                        ), displayedComponents: .date)
                        
                        DatePicker("To", selection: Binding(
                            get: { toDate.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date() },
                            set: { toDate = ISO8601DateFormatter().string(from: $0) }
                        ), displayedComponents: .date)
                        
                        Button("Clear") {
                            fromDate = nil
                            toDate = nil
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)
                
                // List
                if loading && events.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(events) { event in
                        EventRow(event: event) {
                            editingEvent = event
                            showingEditDialog = true
                        } onDelete: {
                            deleteEvent(event)
                        }
                    }
                }
            }
            .navigationTitle("📅 Events")
            .sheet(isPresented: $showingEditDialog) {
                if editingEvent != nil {
                    EventEditView(
                        event: editingEvent!,
                        onSave: { updatedEvent in
                            Task {
                                await saveEvent(updatedEvent)
                            }
                        },
                        onCancel: {
                            showingEditDialog = false
                            editingEvent = nil
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
                Task {
                    await load()
                }
            }
            .onChange(of: fromDate) {
                Task {
                    await load()
                }
            }
            .onChange(of: toDate) {
                Task {
                    await load()
                }
            }
        }
    }
    
    private func load() async {
        loading = true
        do {
            events = try await supabaseService.fetchEvents(
                searchTerm: searchTerm.isEmpty ? nil : searchTerm,
                fromDate: fromDate,
                toDate: toDate
            )
        } catch {
            print("Error loading events: \(error)")
        }
        loading = false
    }
    
    private func startNew() {
        let now = ISO8601DateFormatter().string(from: Date())
        editingEvent = Event(
            id: nil,
            name: "",
            slug: nil,
            description: nil,
            hostOrg: nil,
            startDate: nil,
            endDate: nil,
            startTime: nil,
            endTime: nil,
            location: nil,
            recurrence: nil,
            websiteUrl: nil,
            imageUrl: nil,
            ocrText: nil,
            status: "draft",
            sortOrder: nil,
            createdBy: nil,
            createdAt: now,
            updatedAt: now,
            deletedAt: nil,
            keywords: nil
        )
        showingEditDialog = true
    }
    
    private func saveEvent(_ event: Event) async {
        do {
            // Note: saveEvent method needs to be implemented in SupabaseService
            // For now, this is a placeholder
            showingEditDialog = false
            editingEvent = nil
            await load()
        } catch {
            print("Error saving event: \(error)")
        }
    }
    
    private func deleteEvent(_ event: Event) {
        Task {
            do {
                // Note: deleteEvent method needs to be implemented in SupabaseService
                await load()
            } catch {
                print("Error deleting event: \(error)")
            }
        }
    }
}

struct EventRow: View {
    let event: Event
    let onTap: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack {
            Button(action: onTap) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.name)
                        .font(.headline)
                    if let startDate = event.startDate {
                        Text(startDate)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    if let location = event.location {
                        Text(location)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)
            
            Spacer()
            
            if let status = event.status {
                Text(status.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor(status))
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
            
            Button("Delete", role: .destructive, action: onDelete)
                .buttonStyle(.bordered)
        }
    }
    
    private func statusColor(_ status: String) -> Color {
        switch status {
        case "published": return .green
        case "archived": return .orange
        default: return .gray
        }
    }
}

struct EventsToolbarView: View {
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

struct EventEditView: View {
    @State var event: Event
    let onSave: (Event) -> Void
    let onCancel: () -> Void
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Basic Information") {
                    TextField("Event Name", text: $event.name)
                    TextField("Host Organization", text: Binding(
                        get: { event.hostOrg ?? "" },
                        set: { event.hostOrg = $0.isEmpty ? nil : $0 }
                    ))
                    TextField("Location", text: Binding(
                        get: { event.location ?? "" },
                        set: { event.location = $0.isEmpty ? nil : $0 }
                    ))
                }
                
                Section("Dates & Times") {
                    DatePicker("Start Date", selection: Binding(
                        get: { event.startDate.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date() },
                        set: { event.startDate = ISO8601DateFormatter().string(from: $0) }
                    ), displayedComponents: .date)
                    
                    DatePicker("End Date", selection: Binding(
                        get: { event.endDate.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date() },
                        set: { event.endDate = ISO8601DateFormatter().string(from: $0) }
                    ), displayedComponents: .date)
                }
                
                Section("Details") {
                    TextEditor(text: Binding(
                        get: { event.description ?? "" },
                        set: { event.description = $0.isEmpty ? nil : $0 }
                    ))
                    TextField("Website URL", text: Binding(
                        get: { event.websiteUrl ?? "" },
                        set: { event.websiteUrl = $0.isEmpty ? nil : $0 }
                    ))
                }
            }
            .navigationTitle(event.id == nil ? "New Event" : "Edit Event")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if event.slug == nil && !event.name.isEmpty {
                            event.slug = slugify(event.name)
                        }
                        onSave(event)
                    }
                }
            }
        }
    }
}

#Preview {
    EventsView(darkMode: false, sidebarCollapsed: false)
}

