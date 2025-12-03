//
//  StringUtils.swift
//  SSAAdminiPad
//
//  Utility functions matching shared/utils/slugify.ts and dateUtils.ts
//

import Foundation

// MARK: - Slugify

func slugify(_ s: String) -> String {
    return s
        .lowercased()
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: "[''`]", with: "", options: .regularExpression)
        .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
        .replacingOccurrences(of: "(^-|-$)", with: "", options: .regularExpression)
}

// MARK: - URL Normalization

func normalizeUrl(_ url: String?) -> String {
    guard let url = url?.trimmingCharacters(in: .whitespacesAndNewlines),
          !url.isEmpty else {
        return ""
    }
    
    if url.range(of: "^https?://", options: .regularExpression, range: nil, locale: nil) != nil {
        return url
    }
    
    return "https://\(url)"
}


