//
//  DateUtils.swift
//  SSAAdminiPad
//
//  Date utility functions matching shared/utils/dateUtils.ts
//

import Foundation

// MARK: - ISO Date Formatting

func formatISO(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withFullDate]
    return formatter.string(from: date)
}

// MARK: - Time Formatting

func formatTimeToAMPM(_ timeStr: String?) -> String {
    guard let timeStr = timeStr else { return "—" }
    
    // Handle both HH:MM and HH:MM:SS formats
    let pattern = "^([0-9]{1,2}):([0-9]{2})(?::[0-9]{2})?$"
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: timeStr, range: NSRange(timeStr.startIndex..., in: timeStr)),
          match.numberOfRanges >= 3,
          let hoursRange = Range(match.range(at: 1), in: timeStr),
          let minutesRange = Range(match.range(at: 2), in: timeStr),
          let hours = Int(timeStr[hoursRange]) else {
        return timeStr
    }
    let minutes = String(timeStr[minutesRange])
    
    if hours == 0 {
        return "12:\(minutes) AM"
    } else if hours < 12 {
        return "\(hours):\(minutes) AM"
    } else if hours == 12 {
        return "12:\(minutes) PM"
    } else {
        return "\(hours - 12):\(minutes) PM"
    }
}

func convertTo24Hour(_ timeStr: String?, isEndTime: Bool = false, startTime: String? = nil) -> String? {
    guard let timeStr = timeStr else { return nil }
    
    // Handle abbreviated formats (e.g., "2p", "9a", "2:30p", "12a")
    if timeStr.range(of: "^(\\d{1,2})(?::(\\d{2}))?\\s*([ap]m?)$", options: [.regularExpression, .caseInsensitive]) != nil {
        // TODO: Handle abbreviated formats like "2p" or "9a" if needed
    }
    
    // Handle 12-hour format (e.g., "2:30 PM", "9:15 AM")
    let ampmPattern = "^(\\d{1,2}):(\\d{2})\\s*(AM|PM|am|pm)$"
    if let regex = try? NSRegularExpression(pattern: ampmPattern),
       let match = regex.firstMatch(in: timeStr, range: NSRange(timeStr.startIndex..., in: timeStr)),
       match.numberOfRanges >= 4,
       let hoursRange = Range(match.range(at: 1), in: timeStr),
       let minutesRange = Range(match.range(at: 2), in: timeStr),
       let ampmRange = Range(match.range(at: 3), in: timeStr),
       var hours = Int(timeStr[hoursRange]) {
        
        let minutes = String(timeStr[minutesRange])
        let ampm = String(timeStr[ampmRange]).uppercased()
        
        if ampm == "AM" {
            if hours == 12 { hours = 0 }
        } else { // PM
            if hours != 12 { hours += 12 }
        }
        
        return String(format: "%02d:%@", hours, minutes)
    }
    
    // Handle 24-hour format or other patterns
    return handle24HourOrOther(timeStr, isEndTime: isEndTime, startTime: startTime)
}

private func handle24HourOrOther(_ timeStr: String, isEndTime: Bool, startTime: String?) -> String? {
    // Handle 24-hour format (e.g., "14:30", "09:15")
    let time24Pattern = "^(\\d{1,2}):(\\d{2})$"
    if let regex = try? NSRegularExpression(pattern: time24Pattern),
       let match = regex.firstMatch(in: timeStr, range: NSRange(timeStr.startIndex..., in: timeStr)),
       match.numberOfRanges >= 3,
       let hoursRange = Range(match.range(at: 1), in: timeStr),
       let minutesRange = Range(match.range(at: 2), in: timeStr),
       var hours = Int(timeStr[hoursRange]) {
        
        let minutes = String(timeStr[minutesRange])
        
        // For end_time, if the hour is 1-11, assume it's PM
        if isEndTime && hours >= 1 && hours <= 11 {
            hours += 12
        }
        
        return String(format: "%02d:%@", hours, minutes)
    }
    
    // Handle single numbers (simplified - full implementation would match TypeScript logic)
    if let hours = Int(timeStr), hours >= 1 && hours <= 12 {
        if isEndTime {
            // Smart AM/PM logic based on startTime
            if let startTime = startTime {
                let startHourString = startTime.split(separator: ":").first ?? ""
                let startHour = Int(startHourString) ?? -1
                if startHour >= 0 && startHour <= 11 {
                    if hours < startHour {
                        return String(format: "%02d:00", hours + 12)
                    }
                } else {
                    return String(format: "%02d:00", hours + 12)
                }
            } else {
                return String(format: "%02d:00", hours + 12)
            }
        }
        return String(format: "%02d:00", hours)
    }
    
    return nil
}
