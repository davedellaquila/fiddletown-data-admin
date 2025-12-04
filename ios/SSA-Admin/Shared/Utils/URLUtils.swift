//
//  URLUtils.swift
//  SSA-Admin
//
//  URL utility functions matching web/shared/utils/urlUtils.ts
//  See docs/SHARED_LOGIC.md for business logic contracts
//

import Foundation

// MARK: - URL Normalization

/**
 * Normalize URL string (add https:// if missing)
 * 
 * Ensures URLs have a protocol prefix. If the URL already has http:// or https://,
 * it is returned as-is. Otherwise, https:// is prepended.
 * 
 * Contract: See docs/SHARED_LOGIC.md#url-normalization
 * 
 * - Parameter url: URL string to normalize, or nil
 * - Returns: Normalized URL string with protocol, or empty string for nil/empty input
 * 
 * Examples:
 * - "example.com" → "https://example.com"
 * - "https://example.com" → "https://example.com"
 * - "http://example.com" → "http://example.com"
 * - "  example.com  " → "https://example.com"
 * - nil → ""
 */
func normalizeUrl(_ url: String?) -> String {
    guard let url = url?.trimmingCharacters(in: .whitespacesAndNewlines),
          !url.isEmpty else {
        return ""
    }
    
    // Check if URL already has protocol (case-insensitive)
    if url.range(of: "^https?://", options: [.regularExpression, .caseInsensitive], range: nil, locale: nil) != nil {
        return url
    }
    
    return "https://\(url)"
}

