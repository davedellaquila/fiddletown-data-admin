//
//  LoginView.swift
//  SSAAdminiPad
//
//  Magic link authentication view matching web app login flow
//

import SwiftUI

struct LoginView: View {
    @StateObject private var supabaseService = SupabaseService.shared
    @State private var email: String = ""
    @State private var isSending: Bool = false
    @State private var errorMessage: String?
    @State private var sent: Bool = false
    
    var body: some View {
        VStack(spacing: 24) {
            Text("SSA Admin")
                .font(.system(size: 28, weight: .semibold))
            
            Text("Sign in to edit datasets.")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
            }
            
            TextField("you@example.com", text: $email)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .autocorrectionDisabled()
            
            Button(action: sendMagicLink) {
                if isSending {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                } else if sent {
                    Label("Sent ✓", systemImage: "checkmark.circle.fill")
                } else {
                    Text("Send Magic Link")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSending || email.isEmpty)
            
            Text("Use your work email. Example: you@domain.com")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: 480)
    }
    
    private func sendMagicLink() {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        
        // Basic email validation
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        guard emailPredicate.evaluate(with: email.trimmingCharacters(in: .whitespaces)) else {
            errorMessage = "Please enter a valid email address"
            return
        }
        
        isSending = true
        errorMessage = nil
        
        Task {
            do {
                try await supabaseService.signInWithOtp(email: email.trimmingCharacters(in: .whitespaces))
                await MainActor.run {
                    sent = true
                    isSending = false
                    // Reset sent state after a delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                        sent = false
                    }
                }
            } catch {
                await MainActor.run {
                    // Suppress security/rate limit messaging - treat as soft success
                    let errorString = error.localizedDescription
                    if errorString.range(of: "security|rate|seconds|wait", options: .regularExpression) != nil {
                        errorMessage = nil
                    } else {
                        errorMessage = errorString
                    }
                    isSending = false
                }
            }
        }
    }
}

#Preview {
    LoginView()
}



