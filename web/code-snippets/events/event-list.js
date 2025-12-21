// Event List Widget - Development Version
// This file can be edited and tested locally, then the code from event-list.html can be copied to Squarespace

(function() {
  function todayISO() { const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
  
  // Normalize date string to YYYY-MM-DD format for consistent date-only comparisons
  function normalizeDateString(dateStr) {
    if (!dateStr) return null;
    // Extract date part (YYYY-MM-DD) if timestamp format, or return as-is if already date-only
    const datePart = dateStr.split('T')[0];
    // Ensure it's in YYYY-MM-DD format (not MM/DD/YYYY or other formats)
    if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return datePart;
    }
    // If it's in a different format, try to parse and reformat
    const date = new Date(datePart);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return datePart; // Fallback to original if parsing fails
  }

  // Layout types
  const LAYOUTS = {
    LIST: 'list',
    GRID: 'grid',
    CALENDAR: 'calendar'
  };

  async function fetchEvents({ url, key, from = null, to = null, limit = 200 }) {
      // DEBUG: Log what we're receiving
      console.log('=== fetchEvents DEBUG ===');
      console.log('fetchEvents called with:', { from, to, fromType: typeof from, toType: typeof to });
      console.log('from value:', from, 'from is truthy:', !!from, 'from === null:', from === null, 'from === undefined:', from === undefined);
      console.log('to value:', to, 'to is truthy:', !!to, 'to === null:', to === null, 'to === undefined:', to === undefined);
      
      const api = new URL(url + '/rest/v1/events');
      api.searchParams.set('select','id,name,slug,host_org,start_date,end_date,start_time,end_time,location,website_url,image_url,recurrence,sort_order,description');
      api.searchParams.set('order','start_date.asc,name.asc');
      api.searchParams.set('limit', String(limit));

	  // Show upcoming events if FROM is set.
	  // Include rows where:
	  //  - start_date >= from (events starting on or after the selected date)
	  //  - OR (both dates are null) (undated events)
	  // Note: We exclude events that start before 'from' even if they span across it
	  
	  console.log('Checking date filters - from:', from, 'to:', to, 'from truthy:', !!from, 'to truthy:', !!to);
	  
	  // Build filters with proper PostgREST syntax
	  // Try using gt (greater than) with the day before for FROM
	  // This avoids timezone interpretation issues with gte
	  
	  let adjustedFrom = null;
	  let adjustedTo = null;
	  let fromOperator = 'gte';
	  
	  if (from) {
	    const fromDateStr = normalizeDateString(from);
	    const [year, month, day] = fromDateStr.split('-').map(Number);
	    const fromDate = new Date(year, month - 1, day);
	    // Use gt (greater than) with the day before: User selects Dec 5 -> use gt.2025-12-04
	    // This includes events starting Dec 5 and later, avoiding timezone issues
	    fromDate.setDate(fromDate.getDate() - 1); // Subtract 1 day: Dec 5 -> Dec 4
	    adjustedFrom = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
	    fromOperator = 'gt'; // Use gt instead of gte
	    console.log('FROM date - user selected:', fromDateStr, 'using gt with:', adjustedFrom);
	  }
	  
	  if (to) {
	    const toDateStr = normalizeDateString(to);
	    const [year, month, day] = toDateStr.split('-').map(Number);
	    const toDate = new Date(year, month - 1, day);
	    // Add 1 day and use lte: User selects Dec 7 -> use lte.2025-12-08
	    // This includes events ending Dec 7 and earlier
	    toDate.setDate(toDate.getDate() + 1); // Add 1 day: Dec 7 -> Dec 8
	    adjustedTo = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
	    console.log('TO date - user selected:', toDateStr, 'using lte with:', adjustedTo);
	  }
	  
	  // Build the combined filter with proper column names
	  // Flatten the or() filter to avoid deep nesting which PostgREST may not support
	  if (adjustedFrom && adjustedTo) {
	    // Both filters: Use gt for FROM, lte for TO
	    const orFilter = `or(and(start_date.${fromOperator}.${adjustedFrom},end_date.lte.${adjustedTo}),and(start_date.${fromOperator}.${adjustedFrom},end_date.is.null,start_date.lte.${adjustedTo}),and(start_date.is.null,end_date.is.null))`;
	    console.log('Setting combined OR filter:', orFilter);
	    api.searchParams.set('or', orFilter);
	  } else if (adjustedFrom) {
	    // Only from filter: events that start > from OR end >= from OR undated events
	    // This ensures we fetch events that span across the filter date
	    // Strategy: Fetch a broad range of events to ensure we get all events that might span the filter date
	    const fromDateStr = normalizeDateString(from);
	    
	    // Fetch events starting up to 60 days before the filter date (to catch long-spanning events)
	    const [startYear, startMonth, startDay] = fromDateStr.split('-').map(Number);
	    const startDateForQuery = new Date(startYear, startMonth - 1, startDay);
	    startDateForQuery.setDate(startDateForQuery.getDate() - 60); // Fetch events starting up to 60 days before filter date
	    const adjustedFromStartBefore = `${startDateForQuery.getFullYear()}-${String(startDateForQuery.getMonth() + 1).padStart(2, '0')}-${String(startDateForQuery.getDate()).padStart(2, '0')}`;
	    
	    // Also fetch events ending on or after the filter date
	    // To account for PostgREST's date interpretation, subtract one day from the filter date
	    const [endYear, endMonth, endDay] = fromDateStr.split('-').map(Number);
	    const endDateForQuery = new Date(endYear, endMonth - 1, endDay);
	    endDateForQuery.setDate(endDateForQuery.getDate() - 1); // Subtract one day to be more permissive
	    const adjustedFromEnd = `${endDateForQuery.getFullYear()}-${String(endDateForQuery.getMonth() + 1).padStart(2, '0')}-${String(endDateForQuery.getDate()).padStart(2, '0')}`;
	    
	    // Simplified approach: Fetch events starting 60 days before filter date
	    // This will catch events that span across the filter date
	    // Client-side filtering will then correctly filter by end_date
	    // Use start_date filter directly (simpler, avoids or() syntax issues)
	    // For undated events, we'll handle them client-side since we can't easily combine with or()
	    api.searchParams.set('start_date', `gte.${adjustedFromStartBefore}`);
	  } else if (adjustedTo) {
	    // Only to filter: events that end <= to OR (end_date IS NULL AND start_date <= to) OR undated events
	    const orFilter = `or(end_date.lte.${adjustedTo},and(end_date.is.null,start_date.lte.${adjustedTo}),and(start_date.is.null,end_date.is.null))`;
	    console.log('Setting TO OR filter:', orFilter);
	    api.searchParams.set('or', orFilter);
	  }
	  
	  console.debug('Events API URL:', api.toString());
	  console.debug('Date filters - from:', from, 'to:', to, 'normalized from:', from ? normalizeDateString(from) : null, 'normalized to:', to ? normalizeDateString(to) : null);
	  console.log('Final API URL params:', {
	    or: api.searchParams.get('or'),
	    start_date: api.searchParams.get('start_date'),
	    allParams: Array.from(api.searchParams.entries())
	  });
	  console.log('=== END fetchEvents DEBUG ===');

      const res = await fetch(api, { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }});
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const events = await res.json();
      
      // Fetch keywords for all events
      if (events && events.length > 0) {
        const eventIds = events.map(e => e.id).filter(id => id);
        if (eventIds.length > 0) {
          // Fetch event_keywords relationships - Supabase uses 'in' filter format: in.(id1,id2,id3)
          const relApi = new URL(url + '/rest/v1/event_keywords');
          relApi.searchParams.set('select', 'event_id,keyword_id');
          // Use PostgREST 'in' syntax: event_id=in.(uuid1,uuid2,...)
          const inFilter = eventIds.join(',');
          relApi.searchParams.set('event_id', `in.(${inFilter})`);
          
          const relRes = await fetch(relApi, { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }});
          if (relRes.ok) {
            const relations = await relRes.json();
            const keywordIds = [...new Set(relations.map(r => r.keyword_id))];
            
            if (keywordIds.length > 0) {
              // Fetch keyword names
              const kwApi = new URL(url + '/rest/v1/keywords');
              kwApi.searchParams.set('select', 'id,name');
              const kwInFilter = keywordIds.join(',');
              kwApi.searchParams.set('id', `in.(${kwInFilter})`);
              
              const kwRes = await fetch(kwApi, { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }});
              if (kwRes.ok) {
                const keywords = await kwRes.json();
                const keywordMap = new Map(keywords.map(kw => [kw.id, kw.name.toLowerCase()]));
                
                // Attach keywords to events
                const keywordsByEventId = new Map();
                relations.forEach(rel => {
                  const kwName = keywordMap.get(rel.keyword_id);
                  if (kwName) {
                    if (!keywordsByEventId.has(rel.event_id)) {
                      keywordsByEventId.set(rel.event_id, []);
                    }
                    keywordsByEventId.get(rel.event_id).push(kwName);
                  }
                });
                
                events.forEach(ev => {
                  ev.keywords = keywordsByEventId.get(ev.id) || [];
                });
              }
            }
          }
        }
      }
      
      return events;
    }

  function fmtRange(s, e){
    if (!s && !e) return '';
    if (s && !e) return s;
    if (!s && e) return e;
    return s === e ? s : `${s} – ${e}`;
  }

  function formatEventDate(dateString) {
    if (!dateString) return '';
    // Parse date string as local date to avoid timezone issues
    // Date strings like "2025-12-05" are interpreted as UTC, which can shift the day
    // Parse manually to ensure we use the exact date specified
    const parts = dateString.split('-');
    if (parts.length !== 3) {
      // Fallback to Date constructor if format is unexpected
      const date = new Date(dateString);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      const ordinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
        }
      };
      return `${dayName}, ${monthName} ${day}${ordinalSuffix(day)}`;
    }
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day); // Create date in local timezone
    
    // Get abbreviated day name
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Get abbreviated month name
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    
    // Get day number and add ordinal suffix
    const ordinalSuffix = (day) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    return `${dayName}, ${monthName} ${day}${ordinalSuffix(day)}`;
  }

  function getMonthName(dateString) {
    if (!dateString) return 'TBA';
    // Parse date string as local date to avoid timezone issues
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day); // Create date in local timezone
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    // Fallback to Date constructor if format is unexpected
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function formatTime(timeString) {
    if (!timeString) return '';
    // Time is stored as HH:MM or HH:MM:SS format
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString;
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeString;
    
    // Format as 12-hour time with AM/PM
    if (hours === 0) {
      return `12:${minutes} AM`;
    } else if (hours < 12) {
      return `${hours}:${minutes} AM`;
    } else if (hours === 12) {
      return `12:${minutes} PM`;
    } else {
      return `${hours - 12}:${minutes} PM`;
    }
  }

  function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return '';
    
    // Parse times (format: HH:MM or HH:MM:SS)
    const parseTime = (timeStr) => {
      const parts = timeStr.split(':');
      if (parts.length < 2) return null;
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (isNaN(hours) || isNaN(minutes)) return null;
      return hours * 60 + minutes; // Convert to minutes
    };
    
    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);
    
    if (startMinutes === null || endMinutes === null) return '';
    if (endMinutes < startMinutes) return ''; // Invalid time range
    
    const durationMinutes = endMinutes - startMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours === 0) {
      return `${minutes} min`;
    } else if (minutes === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${minutes} min`;
    }
  }

  function getAllKeywords(rows) {
    const keywordSet = new Set();
    rows.forEach(ev => {
      if (ev.keywords && ev.keywords.length > 0) {
        ev.keywords.forEach(kw => keywordSet.add(kw));
      }
    });
    return Array.from(keywordSet).sort();
  }

  // Calculate upcoming weekend dates (Friday, Saturday, and Sunday)
  function getUpcomingWeekend() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    let friday, sunday;
    
    if (dayOfWeek === 5) {
      // If today is Friday, use this weekend (today through Sunday)
      friday = new Date(today);
      sunday = new Date(today);
      sunday.setDate(today.getDate() + 2); // This Sunday
    } else if (dayOfWeek === 6) {
      // If today is Saturday, use this weekend (yesterday through tomorrow)
      friday = new Date(today);
      friday.setDate(today.getDate() - 1); // Yesterday (Friday)
      sunday = new Date(today);
      sunday.setDate(today.getDate() + 1); // Tomorrow (Sunday)
    } else if (dayOfWeek === 0) {
      // If today is Sunday, use this weekend (Friday through today)
      friday = new Date(today);
      friday.setDate(today.getDate() - 2); // Friday (2 days ago)
      sunday = new Date(today);
    } else {
      // Monday-Thursday: use this coming weekend
      const daysUntilFriday = 5 - dayOfWeek; // 1=Mon(4), 2=Tue(3), 3=Wed(2), 4=Thu(1)
      friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);
      sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2); // Sunday (2 days after Friday)
    }
    
    // Format dates as YYYY-MM-DD using local time to avoid timezone issues
    function formatLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return {
      from: formatLocalDate(friday),
      to: formatLocalDate(sunday)
    };
  }

  // Calculate next weekend dates (Friday, Saturday, and Sunday)
  function getNextWeekend() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    let friday, sunday;
    
    if (dayOfWeek === 5) {
      // If today is Friday, next weekend is 7 days from today
      friday = new Date(today);
      friday.setDate(today.getDate() + 7); // Next Friday
      sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2); // Next Sunday
    } else if (dayOfWeek === 6) {
      // If today is Saturday, next weekend is 6 days from today
      friday = new Date(today);
      friday.setDate(today.getDate() + 6); // Next Friday
      sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2); // Next Sunday
    } else if (dayOfWeek === 0) {
      // If today is Sunday, next weekend is 5 days from today
      friday = new Date(today);
      friday.setDate(today.getDate() + 5); // Next Friday
      sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2); // Next Sunday
    } else {
      // Monday-Thursday: next weekend is the weekend after this coming one
      const daysUntilThisFriday = 5 - dayOfWeek; // Days until this Friday
      friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilThisFriday + 7); // Next Friday (this Friday + 7 days)
      sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2); // Next Sunday
    }
    
    // Format dates as YYYY-MM-DD using local time to avoid timezone issues
    function formatLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return {
      from: formatLocalDate(friday),
      to: formatLocalDate(sunday)
    };
  }

  async function fetchAllKeywords({ url, key }) {
    try {
      const kwApi = new URL(url + '/rest/v1/keywords');
      kwApi.searchParams.set('select', 'id,name');
      kwApi.searchParams.set('order', 'name.asc');
      
      const kwRes = await fetch(kwApi, { 
        headers: { 
          apikey: key, 
          Authorization: 'Bearer ' + key, 
          Accept: 'application/json' 
        }
      });
      
      if (kwRes.ok) {
        const keywords = await kwRes.json();
        return keywords.map(kw => kw.name.toLowerCase()).sort();
      }
      return [];
    } catch (e) {
      console.error('Error fetching all keywords:', e);
      return [];
    }
  }

  function filterEventsByKeywords(events, selectedKeywords) {
    if (!selectedKeywords || selectedKeywords.length === 0) return events;
    return events.filter(ev => {
      if (!ev.keywords || ev.keywords.length === 0) return false;
      // AND logic: event must have ALL selected keywords
      return selectedKeywords.every(selectedKw => ev.keywords.includes(selectedKw));
    });
  }

  function filterEventsByDateRange(events, fromDate, toDate) {
    if (!fromDate && !toDate) return events;
    
    // Normalize date strings to YYYY-MM-DD format for consistent date-only comparison
    const normalizedFromDate = normalizeDateString(fromDate);
    const normalizedToDate = normalizeDateString(toDate);
    
    return events.filter(ev => {
      const startDate = normalizeDateString(ev.start_date);
      const endDate = normalizeDateString(ev.end_date);
      
      // If fromDate is set, include events that:
      // 1. Start on or after fromDate, OR
      // 2. End on or after fromDate (events that span across fromDate), OR
      // 3. Have no dates (undated events)
      if (normalizedFromDate) {
        if (!startDate && !endDate) {
          // Undated event - include it
          return true;
        }
        // Include if starts on or after fromDate
        if (startDate && startDate >= normalizedFromDate) {
          return true;
        }
        // Include if ends on or after fromDate (spans across fromDate)
        // This handles events like: start=12/20, end=12/21, filter from=12/21
        if (endDate && endDate >= normalizedFromDate) {
          return true;
        }
        // If event has startDate but no endDate, treat as single-day event
        // Include only if it starts on fromDate
        if (startDate && !endDate) {
          return startDate === normalizedFromDate;
        }
        // Exclude events that both start and end before fromDate
        if (startDate && endDate && startDate < normalizedFromDate && endDate < normalizedFromDate) {
          return false;
        }
        // If we get here, the event should be included (safety net)
        return true;
      }
      
      // If toDate is set, exclude events that start after toDate
      if (normalizedToDate && startDate && startDate > normalizedToDate) {
        return false;
      }
      
      return true;
    });
  }

  function groupEventsByMonth(events) {
    const grouped = {};
    events.forEach(event => {
      const month = getMonthName(event.start_date);
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push(event);
    });
    return grouped;
  }

  // Parse date string in local timezone to avoid timezone shifts
  // Date strings like "2025-12-20" are parsed as local dates, not UTC
  function parseLocalDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Format date to YYYY-MM-DD string using local date components
  // This avoids timezone shifts when converting dates to strings
  function formatLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDayHeader(dateString) {
    if (!dateString) return 'TBA';
    // Parse date in local timezone to avoid timezone shifts
    const date = parseLocalDate(dateString);
    if (!date) return 'TBA';
    
    // Get full day name
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Get full month name
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    
    // Get day number and add ordinal suffix
    const day = date.getDate();
    const ordinalSuffix = (day) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    return `${dayName}, ${monthName} ${day}${ordinalSuffix(day)}`;
  }

  function groupEventsByDay(events) {
    const grouped = {};
    
    events.forEach(event => {
      if (!event.start_date) {
        // Undated events go in a special group
        const key = 'TBA';
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(event);
        return;
      }
      
      // Parse dates in local timezone to avoid timezone shifts
      const startDate = parseLocalDate(event.start_date);
      const endDate = event.end_date ? parseLocalDate(event.end_date) : startDate;
      
      if (!startDate) return;
      
      // Iterate through each day the event is active
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        // Use local date components to create date key, avoiding timezone shifts
        const dateKey = formatLocalDateString(currentDate);
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        
        // Only add the event once per day (avoid duplicates if event already in this day)
        if (!grouped[dateKey].some(e => e.id === event.id)) {
          grouped[dateKey].push(event);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return grouped;
  }

  function renderListLayout(events, state) {
    const groupBy = state.groupBy || 'day';
    const { fromDate = null, toDate = null } = state;
    let grouped, groups, headerClass;
    
    if (groupBy === 'day') {
      grouped = groupEventsByDay(events);
      groups = Object.keys(grouped).sort((a, b) => {
        if (a === 'TBA') return 1;
        if (b === 'TBA') return -1;
        return a.localeCompare(b);
      });
      
      // Filter day groups to only include days within the date range
      if (fromDate || toDate) {
        groups = groups.filter(dayKey => {
          if (dayKey === 'TBA') {
            // Include TBA only if no fromDate is set (or if explicitly allowed)
            return !fromDate;
          }
          
          // Check if the day falls within the date range
          if (fromDate && dayKey < fromDate) return false;
          if (toDate && dayKey > toDate) return false;
          return true;
        });
      }
      
      headerClass = 'ssa-day-header';
    } else {
      grouped = groupEventsByMonth(events);
      groups = Object.keys(grouped).sort((a, b) => {
        const dateA = new Date(grouped[a][0].start_date);
        const dateB = new Date(grouped[b][0].start_date);
        return dateA - dateB;
      });
      headerClass = 'ssa-month-header';
    }

    if (groups.length === 0) {
      return '<div class="ssa-empty">No events found.</div>';
    }

    let html = '';
    groups.forEach(groupKey => {
      const headerText = groupBy === 'day' ? formatDayHeader(groupKey) : groupKey;
      html += `<h3 class="${headerClass}" style="color: #000000 !important;">${headerText}</h3>`;
      html += `<ul class="ssa-events-list">`;
      
      grouped[groupKey].forEach((event, idx) => {
        const startDate = formatEventDate(event.start_date);
        const endDate = event.end_date ? formatEventDate(event.end_date) : '';
        const dateRange = endDate && startDate !== endDate ? `${startDate} - ${endDate}` : startDate;
        
        // Check if website_url exists and is not empty
        const hasWebsiteUrl = event.website_url && event.website_url.trim();
        let eventUrl = hasWebsiteUrl ? event.website_url.trim() : null;
        
        // Normalize URL: if it doesn't start with http:// or https://, prepend https://
        // This prevents relative URLs from being treated as relative to the current domain
        if (eventUrl && !eventUrl.match(/^https?:\/\//i)) {
          eventUrl = 'https://' + eventUrl;
        }
        
        // Escape URL for HTML attribute (escape quotes and ampersands)
        if (eventUrl) {
          eventUrl = eventUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          // Debug: Log URL for specific event
          if (event.name && event.name.includes('Sutter Creek Flea Market')) {
            console.debug('Sutter Creek Flea Market URL:', {
              original: event.website_url,
              trimmed: event.website_url ? event.website_url.trim() : null,
              normalized: eventUrl.replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
              escaped: eventUrl,
              eventName: event.name
            });
          }
        }
        
        // Create unique event ID - use database ID if available, otherwise create hash
        const eventId = event.id ? `event-${event.id}` : `event-${btoa(event.name + (event.start_date || '')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`;
        const hasImageUrl = event.image_url && event.image_url.trim();
        const showImage = hasImageUrl && state.showImages;
        
        html += `<li class="ssa-event-item" data-event-id="${eventId}" data-event-image="${hasImageUrl ? event.image_url : ''}">`;
        html += `<div class="ssa-event-content">`;
        
        // Event image on the left (only if showImages is enabled)
        if (showImage) {
          html += `<div class="ssa-event-image-wrapper" data-event-id="${eventId}" data-image-url="${event.image_url}">`;
          html += `<img src="${event.image_url}" alt="${event.name}" class="ssa-event-image" />`;
          html += `</div>`;
        }
        // No placeholder when showImages is off - this reduces page height
        
        // Event details on the right
        html += `<div class="ssa-event-details">`;
        html += `<span class="ssa-event-name-wrapper">`;
        
        // Info icon for description (only if description exists)
        const hasDescription = event.description && event.description.trim();
        html += `<span class="ssa-icon-group">`;
        if (hasDescription) {
          html += `<span class="ssa-info-icon" data-event-id="${eventId}" data-description="${event.description.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" title="Hover to view description"></span>`;
        }
        
        // Image icon button - always show if image exists (regardless of showImages checkbox)
        if (hasImageUrl) {
          html += `<span class="ssa-image-icon-btn" data-event-id="${eventId}" data-image-url="${event.image_url}" title="Tap to view image">🖼️</span>`;
        }
        
        // Location icon button (only if location exists)
        if (event.location) {
          html += `<span class="ssa-location-icon-btn" data-location="${event.location.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" title="Tap to view map">📍</span>`;
        }
        html += `</span>`;
        
        // Event name - only make it a link if website_url exists
        const nameClasses = hasWebsiteUrl ? 'ssa-event-link' : 'ssa-event-name';
        
        if (hasWebsiteUrl) {
          html += `<a href="${eventUrl}" class="${nameClasses}" target="_blank" rel="noopener">`;
          html += `<strong>${event.name}</strong>`;
          html += `</a>`;
        } else {
          html += `<strong class="${nameClasses}">${event.name}</strong>`;
        }
        html += `</span>`;
        
        // Event metadata - each on its own line for better mobile readability
        html += `<div class="ssa-event-meta">`;
        if (dateRange) {
          let dateTimeDisplay = dateRange;
          // Add start time if available
          if (event.start_time) {
            dateTimeDisplay += `, ${formatTime(event.start_time)}`;
            // Add end time if available
            if (event.end_time) {
              dateTimeDisplay += ` - ${formatTime(event.end_time)}`;
              // Add duration in parentheses
              const duration = calculateDuration(event.start_time, event.end_time);
              if (duration) {
                dateTimeDisplay += ` (${duration})`;
              }
            }
          }
          html += `<div class="ssa-event-meta-item" style="color: #000000 !important;"><strong style="color: #000000 !important;">Date:</strong> ${dateTimeDisplay}</div>`;
        }
        if (event.location) {
          html += `<div class="ssa-event-meta-item" style="color: #000000 !important;"><strong style="color: #000000 !important;">Location:</strong> <span class="ssa-location" data-location="${event.location.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" title="Click to get directions">${event.location}</span></div>`;
        }
        if (event.host_org) {
          html += `<div class="ssa-event-meta-item" style="color: #000000 !important;"><strong style="color: #000000 !important;">Host:</strong> ${event.host_org}</div>`;
        }
        html += `</div>`;
        html += `</div>`;
        
        // Keywords on their own line
        if (event.keywords && event.keywords.length > 0) {
          html += `<div class="ssa-event-keywords">`;
          html += event.keywords.map(kw => {
            const isSelected = state.selectedKeywords.includes(kw);
            return `<span class="ssa-keyword-tag-clickable ${isSelected ? 'ssa-keyword-tag-active' : ''}" data-keyword="${kw}">${kw}</span>`;
          }).join('');
          html += `</div>`;
        }
        
        html += `</div>`;
        html += `</li>`;
      });
      
      html += `</ul>`;
    });

    return html;
  }

  function renderGridLayout(events, state) {
    if (events.length === 0) {
      return '<div class="ssa-empty">No events found.</div>';
    }

    const selectedKeywords = state?.selectedKeywords || [];
    const showImages = state?.showImages || false;
    const cards = events.map(ev => {
      const hasImageUrl = ev.image_url && ev.image_url.trim();
      const showImage = hasImageUrl && showImages;
      const imageUrl = hasImageUrl ? ev.image_url.trim() : '';
      const imageStyle = showImage ? `style="--card-bg-image: url('${imageUrl.replace(/'/g, "\\'")}');"` : '';
      const eventId = ev.id ? `event-${ev.id}` : `event-${btoa(ev.name + (ev.start_date || '')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`;
      return `
      <article class="ssa-card" ${showImage ? `data-has-image="true"` : ''} ${imageStyle}>
        <div class="ssa-card-content">
          <header class="ssa-card-head">
            ${showImage ? `<div class="ssa-card-image-icon" data-event-id="${eventId}" data-image-url="${imageUrl}" title="Click to preview image"><img src="${imageUrl}" alt="${ev.name}" class="ssa-card-icon-thumb" /></div>` : ''}
            <h3 class="ssa-title">
              <span class="ssa-icon-group">
                ${ev.description && ev.description.trim() ? `<span class="ssa-info-icon" data-event-id="${eventId}" data-description="${ev.description.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" title="Hover to view description"></span>` : ''}
                ${hasImageUrl ? `<span class="ssa-image-icon-btn" data-event-id="${eventId}" data-image-url="${imageUrl}" title="Tap to view image">🖼️</span>` : ''}
                ${ev.location ? `<span class="ssa-location-icon-btn" data-location="${ev.location.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" title="Tap to view map">📍</span>` : ''}
              </span>
              ${ev.website_url ? `<a href="${ev.website_url.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" class="ssa-event-link" target="_blank" rel="noopener">${ev.name}</a>` : `<span class="ssa-event-name">${ev.name}</span>`}
            </h3>
          </header>
          ${(() => {
            let dateTimeDisplay = fmtRange(ev.start_date, ev.end_date);
            // Add start time if available
            if (ev.start_time) {
              dateTimeDisplay += `, ${formatTime(ev.start_time)}`;
              // Add end time if available
              if (ev.end_time) {
                dateTimeDisplay += ` - ${formatTime(ev.end_time)}`;
                // Add duration in parentheses
                const duration = calculateDuration(ev.start_time, ev.end_time);
                if (duration) {
                  dateTimeDisplay += ` (${duration})`;
                }
              }
            }
            return `<p class="ssa-meta">${dateTimeDisplay}${ev.location ? ' · <span class="ssa-location" data-location="' + ev.location.replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '" title="Click to get directions">' + ev.location + '</span>' : ''}</p>`;
          })()}
          ${ev.recurrence ? `<p class="ssa-meta">${ev.recurrence}</p>` : ''}
          ${ev.keywords && ev.keywords.length > 0 ? `<p class="ssa-keywords">${ev.keywords.map(kw => {
            const isSelected = selectedKeywords.includes(kw);
            return `<span class="ssa-tag-clickable ${isSelected ? 'ssa-tag-active' : ''}" data-keyword="${kw}">${kw}</span>`;
          }).join('')}</p>` : ''}
        </div>
      </article>
    `;
    }).join('');

    return `<div class="ssa-grid">${cards}</div>`;
  }

  function renderCalendarLayout(events, state) {
    const { fromDate = null, toDate = null } = state;
    
    // Determine which month to display
    let displayDate;
    if (fromDate) {
      displayDate = parseLocalDate(fromDate) || new Date();
    } else if (toDate) {
      displayDate = parseLocalDate(toDate) || new Date();
    } else {
      displayDate = new Date();
    }
    
    // Get first day of month and number of days
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Group events by day
    const eventsByDay = {};
    events.forEach(event => {
      if (!event.start_date) {
        // Skip undated events for calendar view
        return;
      }
      
      // Parse dates in local timezone to avoid timezone shifts
      const startDate = parseLocalDate(event.start_date);
      const endDate = event.end_date ? parseLocalDate(event.end_date) : startDate;
      
      if (!startDate) return;
      
      // Only include events that fall within the displayed month
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      
      // Check if event overlaps with this month
      if (endDate < monthStart || startDate > monthEnd) {
        return;
      }
      
      // Iterate through each day the event is active within this month
      const currentDate = new Date(Math.max(startDate, monthStart));
      const maxDate = new Date(Math.min(endDate, monthEnd));
      
      while (currentDate <= maxDate) {
        const day = currentDate.getDate();
        // Use local date components to create date key, avoiding timezone shifts
        const dateKey = formatLocalDateString(currentDate);
        
        // Check if this day falls within the date range filter
        if (fromDate || toDate) {
          const dayDateStr = dateKey;
          if (fromDate && dayDateStr < fromDate) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
          if (toDate && dayDateStr > toDate) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
        }
        
        if (!eventsByDay[day]) {
          eventsByDay[day] = [];
        }
        
        // Only add the event once per day
        if (!eventsByDay[day].some(e => e.id === event.id)) {
          eventsByDay[day].push({
            ...event,
            _dateKey: dateKey
          });
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    // Build calendar HTML
    const monthName = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let html = `<div class="ssa-calendar-container">`;
    html += `<h3 class="ssa-calendar-month-header">${monthName}</h3>`;
    html += `<div class="ssa-calendar-grid">`;
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
      html += `<div class="ssa-calendar-day-header">${day}</div>`;
    });
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      html += `<div class="ssa-calendar-day ssa-calendar-day-empty"></div>`;
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Check if this day is outside the date filter range (only when both fromDate and toDate are set)
      let isOutOfRange = false;
      if (fromDate && toDate) {
        const normalizedFromDate = normalizeDateString(fromDate);
        const normalizedToDate = normalizeDateString(toDate);
        if (normalizedFromDate && normalizedToDate) {
          isOutOfRange = dateKey < normalizedFromDate || dateKey > normalizedToDate;
        }
      }
      
      // Filter dayEvents to only include events for days within the date range
      let dayEvents = eventsByDay[day] || [];
      if (fromDate || toDate) {
        dayEvents = dayEvents.filter(event => {
          const eventDateStr = event._dateKey || dateKey;
          if (fromDate && eventDateStr < fromDate) return false;
          if (toDate && eventDateStr > toDate) return false;
          return true;
        });
      }
      
      const outOfRangeClass = isOutOfRange ? ' ssa-calendar-day-out-of-range' : '';
      html += `<div class="ssa-calendar-day${outOfRangeClass}" data-date="${dateKey}">`;
      html += `<div class="ssa-calendar-day-number">${day}</div>`;
      
      if (dayEvents.length > 0) {
        html += `<div class="ssa-calendar-day-events">`;
        dayEvents.forEach(event => {
          const eventId = event.id ? `event-${event.id}` : `event-${btoa(event.name + (event.start_date || '')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`;
          const description = event.description ? event.description.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
          const name = event.name ? event.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
          const startDate = event.start_date || '';
          const endDate = event.end_date || '';
          const location = event.location ? event.location.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
          const startTime = event.start_time || '';
          const endTime = event.end_time || '';
          let websiteUrl = event.website_url ? event.website_url.trim() : '';
          // Normalize URL: if it doesn't start with http:// or https://, prepend https://
          if (websiteUrl && !websiteUrl.match(/^https?:\/\//i)) {
            websiteUrl = 'https://' + websiteUrl;
          }
          websiteUrl = websiteUrl ? websiteUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
          const keywords = event.keywords && event.keywords.length > 0 ? event.keywords.join(',') : '';

          // Always show info icon in calendar view (even without description)
          html += `<span class="ssa-calendar-info-icon ssa-info-icon" data-event-id="${eventId}" data-description="${description}" data-event-name="${name}" data-start-date="${startDate}" data-end-date="${endDate}" data-location="${location}" data-start-time="${startTime}" data-end-time="${endTime}" data-website-url="${websiteUrl}" data-keywords="${keywords}" data-calendar-view="true" title="Hover to view event details"></span>`;
        });
        html += `</div>`;
      }
      
      html += `</div>`;
    }
    
    // Empty cells for days after month ends
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days = 42 cells
    for (let i = 0; i < remainingCells && totalCells + i < 42; i++) {
      html += `<div class="ssa-calendar-day ssa-calendar-day-empty"></div>`;
    }
    
    html += `</div></div>`;
    
    return html;
  }

  async function renderEvents(mount, rows, state) {
    const { layout = LAYOUTS.LIST, selectedKeywords = [], fromDate = null, toDate = null, groupBy = 'day', showImages = false } = state;
    
    // DEBUG: Show date filters being used
    console.log('=== EVENT LIST DEBUG ===');
    console.log('From Date Filter:', fromDate);
    console.log('To Date Filter:', toDate);
    console.log('Total Events Before Filtering:', rows.length);
    console.log('First 3 Events Start Dates:', rows.slice(0, 3).map(e => e.start_date));
    
    // Store state on mount for handlers
    mount._currentState = state;
    
    // Apply filters
    let filteredRows = filterEventsByKeywords(rows, selectedKeywords);
    filteredRows = filterEventsByDateRange(filteredRows, fromDate, toDate);
    
    // DEBUG: Show filtered results
    console.log('Total Events After Filtering:', filteredRows.length);
    console.log('First 3 Filtered Events Start Dates:', filteredRows.slice(0, 3).map(e => e.start_date));
    console.log('=== END DEBUG ===');
    
    // Get keywords only from events that are actually loaded
    // This ensures we only show keywords that are used by at least one event
    const allKeywords = getAllKeywords(rows);
    
    // If no keywords found, log for debugging
    if (allKeywords.length === 0) {
      console.debug('No keywords found to display');
    }
    
    // Render controls
    let controlsHTML = '<div class="ssa-controls">';
    
    // Layout switcher with dark mode toggle and show images on the same row
    const isDarkMode = document.body && document.body.classList.contains('dark-mode');
    controlsHTML += '<div class="ssa-layout-switcher-wrapper">';
    controlsHTML += '<label class="ssa-control-label">View Types:</label>';
    controlsHTML += '<div class="ssa-layout-switcher">';
    controlsHTML += `<button class="ssa-layout-btn ${layout === LAYOUTS.LIST ? 'ssa-active' : ''}" data-layout="${LAYOUTS.LIST}" title="List view">📋</button>`;
    controlsHTML += `<button class="ssa-layout-btn ${layout === LAYOUTS.GRID ? 'ssa-active' : ''}" data-layout="${LAYOUTS.GRID}" title="Grid view">⊞</button>`;
    controlsHTML += `<button class="ssa-layout-btn ${layout === LAYOUTS.CALENDAR ? 'ssa-active' : ''}" data-layout="${LAYOUTS.CALENDAR}" title="Calendar view">📅</button>`;
    controlsHTML += '</div>';
    controlsHTML += `<button class="ssa-show-images-toggle ${showImages ? 'ssa-active' : ''}" id="ssa-show-images-btn" title="Toggle image display">🖼️ Show Images</button>`;
    controlsHTML += '<button class="ssa-dark-mode-toggle" title="Toggle dark mode">' + (isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode') + '</button>';
    controlsHTML += '</div>';
    
    // Grouping switcher (only show for list layout)
    if (layout === LAYOUTS.LIST) {
      controlsHTML += '<div class="ssa-group-switcher-wrapper">';
      controlsHTML += '<label class="ssa-control-label">Group By:</label>';
      controlsHTML += '<div class="ssa-group-switcher">';
      controlsHTML += `<button class="ssa-group-btn ${groupBy === 'day' ? 'ssa-active' : ''}" data-group="day" title="Group by day">📆 Day</button>`;
      controlsHTML += `<button class="ssa-group-btn ${groupBy === 'month' ? 'ssa-active' : ''}" data-group="month" title="Group by month">📅 Month</button>`;
      controlsHTML += '</div>';
      controlsHTML += '</div>';
    }
    
    // Date range filters
    controlsHTML += '<div class="ssa-date-filters">';
    controlsHTML += `<button class="ssa-weekend-btn" title="Set date range to upcoming weekend">📅 This Weekend</button>`;
    controlsHTML += `<button class="ssa-weekend-btn ssa-next-weekend-btn" title="Set date range to next weekend">📅 Next Weekend</button>`;
    controlsHTML += '<div class="ssa-date-inputs-row">';
    controlsHTML += `<label>From: <input type="date" class="ssa-date-input" id="ssa-from-date" value="${fromDate || ''}"></label>`;
    controlsHTML += `<label>To: <input type="date" class="ssa-date-input" id="ssa-to-date" value="${toDate || ''}"></label>`;
    controlsHTML += '</div>';
    controlsHTML += `<button class="ssa-clear-dates" title="Clear all filters">Clear</button>`;
    controlsHTML += '</div>';
    
    // Keyword filters - display all keywords from the system
    if (allKeywords.length > 0) {
      controlsHTML += '<div class="ssa-keyword-filters">';
      allKeywords.forEach(kw => {
        const isSelected = selectedKeywords.includes(kw);
        controlsHTML += `<button class="ssa-keyword-btn ${isSelected ? 'ssa-keyword-active' : ''}" data-keyword="${kw}">${kw}</button>`;
      });
      controlsHTML += '</div>';
    }
    
    controlsHTML += '</div>';
    
    // Render events based on layout
    let eventsHTML = '';
    if (layout === LAYOUTS.LIST) {
      eventsHTML = renderListLayout(filteredRows, state);
    } else if (layout === LAYOUTS.GRID) {
      eventsHTML = renderGridLayout(filteredRows, state);
    } else if (layout === LAYOUTS.CALENDAR) {
      eventsHTML = renderCalendarLayout(filteredRows, state);
    }
    
    mount.innerHTML = controlsHTML + eventsHTML;

    // Initialize dark mode toggle (wrap in try-catch to prevent breaking event loading)
    try {
      initDarkModeToggle();
    } catch (e) {
      console.error('Error initializing dark mode toggle:', e);
    }

    // Attach event handlers
    attachEventHandlers(mount, rows, state);
    
    // Inject styles if not already present
    injectStyles();
  }

  function attachEventHandlers(mount, rows, state) {
    // Layout switcher
    mount.querySelectorAll('.ssa-layout-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const newLayout = this.dataset.layout;
        await renderEvents(mount, rows, { ...state, layout: newLayout });
      });
    });
    
    // Group switcher
    mount.querySelectorAll('.ssa-group-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const newGroupBy = this.dataset.group;
        await renderEvents(mount, rows, { ...state, groupBy: newGroupBy });
      });
    });
    
    // Keyword filter buttons
    mount.querySelectorAll('.ssa-keyword-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const keyword = this.dataset.keyword;
        const isCurrentlySelected = state.selectedKeywords.includes(keyword);
        
        // Immediately toggle the active class for instant visual feedback
        if (isCurrentlySelected) {
          this.classList.remove('ssa-keyword-active');
        } else {
          this.classList.add('ssa-keyword-active');
        }
        
        const newSelected = isCurrentlySelected
          ? state.selectedKeywords.filter(k => k !== keyword)
          : [...state.selectedKeywords, keyword];
        await renderEvents(mount, rows, { ...state, selectedKeywords: newSelected });
      });
    });
    
    // Date inputs
    const fromInput = mount.querySelector('#ssa-from-date');
    const toInput = mount.querySelector('#ssa-to-date');
    const clearDatesBtn = mount.querySelector('.ssa-clear-dates');
    
    if (fromInput) {
      fromInput.addEventListener('change', async function() {
        const newFromDate = this.value || null;
        const newState = { ...state, fromDate: newFromDate };
        // Reload events if date filter changed
        if (mount._widgetOpts) {
          reloadEvents(mount, newState, mount._widgetOpts);
        } else {
          // Fallback: filter client-side if opts not available
          await renderEvents(mount, rows, newState);
        }
      });
    }
    
    if (toInput) {
      toInput.addEventListener('change', async function() {
        const newToDate = this.value || null;
        const newState = { ...state, toDate: newToDate };
        // Reload events if date filter changed
        if (mount._widgetOpts) {
          reloadEvents(mount, newState, mount._widgetOpts);
        } else {
          // Fallback: filter client-side if opts not available
          await renderEvents(mount, rows, newState);
        }
      });
    }
    
    // Image display toggle checkbox
    const showImagesBtn = mount.querySelector('#ssa-show-images-btn');
    if (showImagesBtn) {
      showImagesBtn.addEventListener('click', async function() {
        const newShowImages = !state.showImages;
        const newState = { ...state, showImages: newShowImages };
        // Re-render events with updated image display setting (no need to reload from server)
        await renderEvents(mount, rows, newState);
      });
    }
    
    if (clearDatesBtn) {
      clearDatesBtn.addEventListener('click', async function() {
        const newState = { ...state, fromDate: null, toDate: null, selectedKeywords: [] };
        // Reload events to show all
        if (mount._widgetOpts) {
          reloadEvents(mount, newState, mount._widgetOpts);
        } else {
          // Fallback: filter client-side if opts not available
          await renderEvents(mount, rows, newState);
        }
      });
    }
    
    // Weekend button handlers
    const weekendBtn = mount.querySelector('.ssa-weekend-btn:not(.ssa-next-weekend-btn)');
    if (weekendBtn) {
      weekendBtn.addEventListener('click', async function() {
        const weekend = getUpcomingWeekend();
        const newState = { ...state, fromDate: weekend.from, toDate: weekend.to };
        // Update the input values
        if (fromInput) fromInput.value = weekend.from;
        if (toInput) toInput.value = weekend.to;
        // Reload events with weekend filter
        if (mount._widgetOpts) {
          reloadEvents(mount, newState, mount._widgetOpts);
        } else {
          // Fallback: filter client-side if opts not available
          await renderEvents(mount, rows, newState);
        }
      });
    }
    
    // Next weekend button handler
    const nextWeekendBtn = mount.querySelector('.ssa-next-weekend-btn');
    if (nextWeekendBtn) {
      nextWeekendBtn.addEventListener('click', async function() {
        const weekend = getNextWeekend();
        const newState = { ...state, fromDate: weekend.from, toDate: weekend.to };
        // Update the input values
        if (fromInput) fromInput.value = weekend.from;
        if (toInput) toInput.value = weekend.to;
        // Reload events with next weekend filter
        if (mount._widgetOpts) {
          reloadEvents(mount, newState, mount._widgetOpts);
        } else {
          // Fallback: filter client-side if opts not available
          await renderEvents(mount, rows, newState);
        }
      });
    }
    
    // Shared image preview functionality
    let imagePreviewEl = null;
    
    function closeImagePreview() {
      if (imagePreviewEl) {
        imagePreviewEl.remove();
        imagePreviewEl = null;
      }
    }
    
    function showImagePreview(eventId, imageUrl, triggerElement) {
      if (!imageUrl || !imageUrl.trim()) return;
      
      // Close existing preview if clicking the same image
      if (imagePreviewEl && imagePreviewEl.dataset.eventId === eventId) {
        closeImagePreview();
        return;
      }
      
      // Close any existing preview
      closeImagePreview();
      
      const gap = 8;
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const maxH = Math.min(800, viewportH - gap * 2);
      const maxW = Math.min(800, viewportW - gap * 2);
      
      // Center the preview
      const previewW = maxW;
      const left = Math.max(gap, (viewportW - previewW) / 2);
      const top = Math.max(gap, (viewportH - maxH) / 2);
      
      // Create preview element with close button
      imagePreviewEl = document.createElement('div');
      imagePreviewEl.className = 'ssa-image-preview';
      imagePreviewEl.dataset.eventId = eventId;
      imagePreviewEl.style.cssText = `
        position: fixed;
        top: ${top}px;
        left: ${left}px;
        z-index: 10000;
        padding: 8px;
        background: rgba(255,255,255,0.98);
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        width: ${previewW}px;
      `;
      
      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(0,0,0,0.6);
        color: white;
        border-radius: 50%;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      `;
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeImagePreview();
      });
      closeBtn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(0,0,0,0.8)';
      });
      closeBtn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(0,0,0,0.6)';
      });
      
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = 'Event preview';
      img.style.cssText = `
        width: auto;
        height: auto;
        max-width: ${previewW}px;
        max-height: ${maxH}px;
        border-radius: 6px;
        display: block;
      `;
      
      imagePreviewEl.appendChild(closeBtn);
      imagePreviewEl.appendChild(img);
      document.body.appendChild(imagePreviewEl);
      
      // Close on backdrop click (clicking on the preview container itself)
      imagePreviewEl.addEventListener('click', function(e) {
        if (e.target === imagePreviewEl) {
          closeImagePreview();
        }
      });
      
      // Close when clicking outside the preview
      // Use setTimeout to avoid immediate closure when opening
      setTimeout(function() {
        const outsideClickHandler = function(e) {
          if (imagePreviewEl && imagePreviewEl.dataset.eventId === eventId) {
            // Check if click is outside the preview
            const clickedInsidePreview = imagePreviewEl.contains(e.target);
            const clickedOnTrigger = triggerElement && triggerElement.contains(e.target);
            if (!clickedInsidePreview && !clickedOnTrigger) {
              closeImagePreview();
              document.removeEventListener('click', outsideClickHandler);
            }
          } else {
            // Preview was closed another way, remove listener
            document.removeEventListener('click', outsideClickHandler);
          }
        };
        document.addEventListener('click', outsideClickHandler);
      }, 100);
    }
    
    // Image click preview for list view
    if (state.layout === LAYOUTS.LIST) {
      mount.querySelectorAll('.ssa-event-image-wrapper[data-image-url]').forEach(wrapper => {
        const eventId = wrapper.dataset.eventId;
        const imageUrl = wrapper.dataset.imageUrl;
        if (!imageUrl || !imageUrl.trim()) return;
        
        wrapper.addEventListener('click', function(e) {
          e.stopPropagation();
          showImagePreview(eventId, imageUrl, wrapper);
        });
      });
      
      // Image icon button handlers for list view
      mount.querySelectorAll('.ssa-image-icon-btn').forEach(btn => {
        const eventId = btn.dataset.eventId;
        const imageUrl = btn.dataset.imageUrl;
        if (!imageUrl || !imageUrl.trim()) return;
        
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          showImagePreview(eventId, imageUrl, btn);
        });
      });
    }
    
    // Keyword tag clicks in list view
    if (state.layout === LAYOUTS.LIST) {
      mount.querySelectorAll('.ssa-keyword-tag-clickable').forEach(tag => {
        tag.addEventListener('click', async function() {
          const keyword = this.dataset.keyword;
          if (!keyword) return;
          
          // Toggle keyword in selected keywords
          const newSelected = state.selectedKeywords.includes(keyword)
            ? state.selectedKeywords.filter(k => k !== keyword)
            : [...state.selectedKeywords, keyword];
          
          await renderEvents(mount, rows, { ...state, selectedKeywords: newSelected });
        });
      });
    }
    
    // Keyword tag clicks in grid view
    if (state.layout === LAYOUTS.GRID) {
      mount.querySelectorAll('.ssa-tag-clickable').forEach(tag => {
        tag.addEventListener('click', async function() {
          const keyword = this.dataset.keyword;
          if (!keyword) return;
          
          // Toggle keyword in selected keywords
          const newSelected = state.selectedKeywords.includes(keyword)
            ? state.selectedKeywords.filter(k => k !== keyword)
            : [...state.selectedKeywords, keyword];
          
          await renderEvents(mount, rows, { ...state, selectedKeywords: newSelected });
        });
      });
    }
    
    // Image click preview for grid view
    if (state.layout === LAYOUTS.GRID) {
      mount.querySelectorAll('.ssa-card-image-icon').forEach(icon => {
        const eventId = icon.dataset.eventId;
        const imageUrl = icon.dataset.imageUrl;
        if (!imageUrl || !imageUrl.trim()) return;
        
        icon.addEventListener('click', function(e) {
          e.stopPropagation();
          showImagePreview(eventId, imageUrl, icon);
        });
      });
      
      // Image icon button handlers for grid view
      mount.querySelectorAll('.ssa-image-icon-btn').forEach(btn => {
        const eventId = btn.dataset.eventId;
        const imageUrl = btn.dataset.imageUrl;
        if (!imageUrl || !imageUrl.trim()) return;
        
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          showImagePreview(eventId, imageUrl, btn);
        });
      });
    }
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && imagePreviewEl) {
        closeImagePreview();
      }
    });
    
    // Description popover on hover for info icons (list and grid views)
    let activePopover = null;
    let popoverTimeout = null;
    
    mount.querySelectorAll('.ssa-info-icon').forEach(element => {
      const description = element.dataset.description;
      const isCalendarView = element.dataset.calendarView === 'true';
      
      // For calendar view, always show popover even without description
      // For other views, require description
      if (!isCalendarView && (!description || !description.trim())) return;
      
      // Decode HTML entities
      let decodedDescription = '';
      if (description && description.trim()) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = description;
        decodedDescription = tempDiv.textContent || tempDiv.innerText || description;
      }
      
      element.addEventListener('mouseenter', function(e) {
        if (popoverTimeout) clearTimeout(popoverTimeout);
        
        // Remove any existing popover
        if (activePopover) {
          activePopover.remove();
          activePopover = null;
        }
        
        // Get element position
        const rect = element.getBoundingClientRect();
        
        // Create popover element
        const popover = document.createElement('div');
        popover.className = 'ssa-info-popover';
        if (isCalendarView) {
          popover.classList.add('ssa-calendar-popover');
        }
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'ssa-popover-close';
        closeBtn.style.cssText = `
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border: none;
          background: rgba(0,0,0,0.6);
          color: white;
          border-radius: 50%;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          z-index: 10003;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          padding: 0;
        `;
        closeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (activePopover) {
            activePopover.remove();
            activePopover = null;
          }
        });
        closeBtn.addEventListener('mouseenter', function() {
          this.style.background = 'rgba(0,0,0,0.8)';
        });
        closeBtn.addEventListener('mouseleave', function() {
          this.style.background = 'rgba(0,0,0,0.6)';
        });
        
        // Popover content - restructured for calendar view with fixed header/footer and scrollable middle
        const content = document.createElement('div');
        content.className = 'ssa-popover-content';
        
        if (isCalendarView) {
          // Calendar view: show full event details with fixed layout
          const isDarkMode = document.body.classList.contains('dark-mode');
          const eventName = element.dataset.eventName || '';
          const startDate = element.dataset.startDate || '';
          const endDate = element.dataset.endDate || '';
          const location = element.dataset.location || '';
          const startTime = element.dataset.startTime || '';
          const endTime = element.dataset.endTime || '';
          const websiteUrl = element.dataset.websiteUrl || '';
          const keywordsStr = element.dataset.keywords || '';
          
          // Set up flexbox layout for popover
          // The ssa-popover-content class already provides flex and overflow styles
          content.style.cssText = 'display: flex; flex-direction: column; height: 100%; max-height: 400px; padding-right: 8px; overflow: hidden;';
          
          // Header section (fixed at top)
          const headerDiv = document.createElement('div');
          headerDiv.style.cssText = 'flex-shrink: 0; padding-bottom: 8px;';
          
          // Event name
          if (eventName) {
            const nameDiv = document.createElement('div');
            nameDiv.style.cssText = 'font-weight: 600; font-size: 1rem; margin-bottom: 8px;';
            
            if (websiteUrl && websiteUrl.trim()) {
              // Make it a clickable link
              let url = websiteUrl.trim();
              // Normalize URL: if it doesn't start with http:// or https://, prepend https://
              if (!url.match(/^https?:\/\//i)) {
                url = 'https://' + url;
              }
              const nameLink = document.createElement('a');
              nameLink.href = url;
              nameLink.target = '_blank';
              nameLink.rel = 'noopener noreferrer';
              nameLink.textContent = eventName;
              nameLink.style.cssText = 'color: #3b82f6; text-decoration: none; cursor: pointer;';
              nameLink.addEventListener('mouseenter', function() {
                this.style.textDecoration = 'underline';
              });
              nameLink.addEventListener('mouseleave', function() {
                this.style.textDecoration = 'none';
              });
              nameDiv.appendChild(nameLink);
            } else {
              // Plain text if no URL
              nameDiv.style.color = isDarkMode ? '#f9fafb' : '#1f2937';
              nameDiv.textContent = eventName;
            }
            
            headerDiv.appendChild(nameDiv);
          }
          
          // Date range
          if (startDate || endDate) {
            const dateDiv = document.createElement('div');
            dateDiv.style.cssText = `margin-bottom: 6px; font-size: 0.875rem; color: ${isDarkMode ? '#d1d5db' : '#000000'};`;
            let dateText = '';
            if (startDate) {
              dateText = formatEventDate(startDate);
              if (endDate && endDate !== startDate) {
                dateText += ' - ' + formatEventDate(endDate);
              }
            } else if (endDate) {
              dateText = formatEventDate(endDate);
            }
            
            // Add times if available
            if (startTime) {
              dateText += ', ' + formatTime(startTime);
              if (endTime) {
                dateText += ' - ' + formatTime(endTime);
              }
            }
            
            const dateLabel = document.createElement('strong');
            dateLabel.textContent = 'Date: ';
            dateLabel.style.cssText = `color: ${isDarkMode ? '#f9fafb' : '#000000'}; margin-right: 4px;`;
            dateDiv.appendChild(dateLabel);
            dateDiv.appendChild(document.createTextNode(dateText));
            headerDiv.appendChild(dateDiv);
          }
          
          // Location
          if (location) {
            const locationDiv = document.createElement('div');
            locationDiv.style.cssText = 'margin-bottom: 6px; font-size: 0.875rem;';
            const locationLabel = document.createElement('strong');
            locationLabel.textContent = 'Location: ';
            locationLabel.style.cssText = `color: ${isDarkMode ? '#f9fafb' : '#000000'}; margin-right: 4px;`;
            locationDiv.appendChild(locationLabel);
            
            // Make location a clickable link for directions
            const locationLink = document.createElement('span');
            locationLink.textContent = location;
            locationLink.style.cssText = 'color: #3b82f6; text-decoration: none; cursor: pointer;';
            locationLink.addEventListener('mouseenter', function() {
              this.style.textDecoration = 'underline';
            });
            locationLink.addEventListener('mouseleave', function() {
              this.style.textDecoration = 'none';
            });
            locationLink.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              const encodedLocation = encodeURIComponent(location);
              const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`;
              window.open(mapUrl, '_blank', 'noopener,noreferrer');
              return false;
            }, true);
            
            locationDiv.appendChild(locationLink);
            headerDiv.appendChild(locationDiv);
          }
          
          content.appendChild(headerDiv);
          
          // Scrollable middle section (description)
          if (decodedDescription) {
            const scrollableDiv = document.createElement('div');
            scrollableDiv.style.cssText = `flex: 1; overflow-y: auto; min-height: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}; font-size: 0.875rem; color: ${isDarkMode ? '#d1d5db' : '#4b5563'}; line-height: 1.5;`;
            scrollableDiv.textContent = decodedDescription;
            content.appendChild(scrollableDiv);
          } else {
            // Empty scrollable area if no description
            const scrollableDiv = document.createElement('div');
            scrollableDiv.style.cssText = 'flex: 1; min-height: 0;';
            content.appendChild(scrollableDiv);
          }
          
          // Footer section (fixed at bottom - keywords)
          if (keywordsStr) {
            const keywords = keywordsStr.split(',').filter(k => k.trim());
            if (keywords.length > 0) {
              const footerDiv = document.createElement('div');
              footerDiv.style.cssText = `flex-shrink: 0; margin-top: 12px; padding-top: 12px; border-top: 1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}; display: flex; flex-wrap: wrap; gap: 6px;`;
              
              // Get current state from mount
              const mount = element.closest('#events-list') || document.querySelector('#events-list');
              const currentState = mount?._currentState || {};
              const selectedKeywords = currentState.selectedKeywords || [];
              
              keywords.forEach(keyword => {
                const keywordTag = document.createElement('span');
                const isSelected = selectedKeywords.includes(keyword);
                keywordTag.className = `ssa-keyword-tag-clickable ${isSelected ? 'ssa-keyword-tag-active' : ''}`;
                keywordTag.setAttribute('data-keyword', keyword);
                keywordTag.textContent = keyword;
                
                // Add hover styles (respect dark mode)
                const isDarkMode = document.body.classList.contains('dark-mode');
                keywordTag.addEventListener('mouseenter', function() {
                  if (!this.classList.contains('ssa-keyword-tag-active')) {
                    if (isDarkMode) {
                      this.style.background = '#4b5563';
                      this.style.borderColor = '#6b7280';
                    } else {
                      this.style.background = '#f9fafb';
                      this.style.borderColor = '#9ca3af';
                    }
                  }
                });
                keywordTag.addEventListener('mouseleave', function() {
                  if (!this.classList.contains('ssa-keyword-tag-active')) {
                    this.style.background = '';
                    this.style.borderColor = '';
                  }
                });
                
                // Click handler to toggle keyword filter
                keywordTag.addEventListener('click', async function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (!mount || !mount._currentState) return;
                  
                  const state = mount._currentState;
                  const rows = mount._allRows || [];
                  const keyword = this.dataset.keyword;
                  if (!keyword) return;
                  
                  // Toggle keyword in selected keywords
                  const newSelected = state.selectedKeywords.includes(keyword)
                    ? state.selectedKeywords.filter(k => k !== keyword)
                    : [...state.selectedKeywords, keyword];
                  
                  // Close popover
                  if (activePopover) {
                    activePopover.remove();
                    activePopover = null;
                  }
                  
                  // Update filters and re-render
                  await renderEvents(mount, rows, { ...state, selectedKeywords: newSelected });
                });
                
                footerDiv.appendChild(keywordTag);
              });
              
              content.appendChild(footerDiv);
            }
          }
        } else {
          // List/Grid view: show description only in scrollable container
          // Content already has the ssa-popover-content class which provides scrolling
          // But we need to ensure it has proper height constraints for scrolling to work
          // The popover has max-height: 400px with 12px padding, so content should be constrained
          // Use max-height instead of height so it only takes up needed space
          content.style.cssText = 'overflow-y: auto; overflow-x: hidden; max-height: 376px; word-wrap: break-word; white-space: normal; display: block;';
          content.textContent = decodedDescription;
        }
        
        popover.appendChild(closeBtn);
        popover.appendChild(content);
        document.body.appendChild(popover);
        
        // Get popover dimensions and viewport info
        const popoverRect = popover.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const gap = 8;
        const minGapFromEdge = 10;
        
        // Calculate horizontal position (centered on element, but keep within viewport)
        let left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
        if (left < minGapFromEdge) {
          left = minGapFromEdge;
        } else if (left + popoverRect.width > viewportWidth - minGapFromEdge) {
          left = viewportWidth - popoverRect.width - minGapFromEdge;
        }
        
        // Calculate vertical position - prefer above, but show below if not enough space
        let top = rect.top - popoverRect.height - gap;
        const spaceAbove = rect.top;
        const spaceBelow = viewportHeight - rect.bottom;
        
        // If not enough space above, position below instead
        if (top < minGapFromEdge || spaceAbove < popoverRect.height + gap + minGapFromEdge) {
          top = rect.bottom + gap;
          // If still doesn't fit below, position it at the top of viewport
          if (top + popoverRect.height > viewportHeight - minGapFromEdge) {
            top = minGapFromEdge;
          }
        }
        
        // Ensure popover doesn't go off bottom of viewport
        if (top + popoverRect.height > viewportHeight - minGapFromEdge) {
          top = viewportHeight - popoverRect.height - minGapFromEdge;
        }
        
        popover.style.position = 'fixed';
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.style.display = 'block';
        popover.style.zIndex = '10002';
        
        activePopover = popover;
        
        // Find all scrollable elements within the popover and attach listeners to them
        // This allows natural scrolling while preventing background scroll
        const scrollableElements = [];
        const findScrollableElements = function(element) {
          const style = window.getComputedStyle(element);
          const overflowY = style.overflowY;
          const overflow = style.overflow;
          const isScrollable = overflowY === 'auto' || overflowY === 'scroll' || 
                               overflow === 'auto' || overflow === 'scroll';
          const hasOverflow = element.scrollHeight > element.clientHeight;
          
          if (isScrollable && hasOverflow) {
            scrollableElements.push(element);
          }
          
          // Recursively check children
          for (let child of element.children) {
            findScrollableElements(child);
          }
        };
        
        findScrollableElements(popover);
        
        // Attach wheel event listeners to each scrollable element
        const scrollHandlers = [];
        scrollableElements.forEach(scrollableEl => {
          const handler = function(e) {
            const canScrollUp = scrollableEl.scrollTop > 0;
            const canScrollDown = scrollableEl.scrollTop < 
              (scrollableEl.scrollHeight - scrollableEl.clientHeight - 1);
            
            // If we can scroll, allow it and prevent background scroll
            if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
              // Allow natural scroll, just prevent it from reaching document
              e.stopPropagation();
              return;
            }
            // At boundary, prevent background scroll
            e.preventDefault();
            e.stopPropagation();
          };
          scrollableEl.addEventListener('wheel', handler, { passive: false });
          scrollHandlers.push({ element: scrollableEl, handler: handler });
        });
        
        // Also prevent scrolling on the popover itself (non-scrollable areas)
        const popoverScrollHandler = function(e) {
          // If the event target is not a scrollable element, prevent background scroll
          let isOnScrollable = false;
          for (let scrollableEl of scrollableElements) {
            if (scrollableEl.contains(e.target)) {
              isOnScrollable = true;
              break;
            }
          }
          
          if (!isOnScrollable) {
            e.preventDefault();
            e.stopPropagation();
          }
        };
        popover.addEventListener('wheel', popoverScrollHandler, { passive: false });
        
        // Also prevent touchmove events on mobile
        const preventTouchScroll = function(e) {
          const target = e.target;
          const isInsidePopover = popover.contains(target);
          if (isInsidePopover) {
            // Allow scrolling within scrollable elements
            let scrollableElement = target;
            while (scrollableElement && scrollableElement !== document.body) {
              const style = window.getComputedStyle(scrollableElement);
              if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
                  style.overflow === 'auto' || style.overflow === 'scroll') {
                // Check if we can scroll
                const canScrollUp = scrollableElement.scrollTop > 0;
                const canScrollDown = scrollableElement.scrollTop < 
                  (scrollableElement.scrollHeight - scrollableElement.clientHeight - 1);
                
                // If we can scroll, allow it
                if (canScrollUp || canScrollDown) {
                  return; // Allow the scroll
                }
                // At boundary, prevent background scroll
                e.preventDefault();
                return;
              }
              if (scrollableElement === popover) {
                break;
              }
              scrollableElement = scrollableElement.parentElement;
            }
            // If not on a scrollable element, prevent default to stop background scroll
            e.preventDefault();
          }
        };
        
        document.addEventListener('touchmove', preventTouchScroll, { passive: false });
        
        // Clean up event listeners when popover is removed
        const originalRemove = popover.remove;
        popover.remove = function() {
          // Remove handlers from scrollable elements
          scrollHandlers.forEach(({ element, handler }) => {
            element.removeEventListener('wheel', handler);
          });
          popover.removeEventListener('wheel', popoverScrollHandler);
          document.removeEventListener('touchmove', preventTouchScroll);
          originalRemove.call(this);
        };
        
        // Close when clicking outside the popover
        // Use setTimeout to avoid immediate closure when opening via hover
        setTimeout(function() {
          const outsideClickHandler = function(e) {
            if (activePopover && activePopover === popover) {
              // Check if click is outside the popover
              const clickedInsidePopover = popover.contains(e.target);
              const clickedOnTrigger = element.contains(e.target);
              if (!clickedInsidePopover && !clickedOnTrigger) {
                if (activePopover) {
                  activePopover.remove();
                  activePopover = null;
                }
                document.removeEventListener('click', outsideClickHandler);
              }
            } else {
              // Popover was closed another way, remove listener
              document.removeEventListener('click', outsideClickHandler);
            }
          };
          document.addEventListener('click', outsideClickHandler);
        }, 100);
      });
      
      element.addEventListener('mouseleave', function() {
        if (popoverTimeout) clearTimeout(popoverTimeout);
        popoverTimeout = setTimeout(() => {
          if (activePopover) {
            activePopover.remove();
            activePopover = null;
          }
        }, 100);
      });
      
      // Also handle mouseenter on popover itself
      document.addEventListener('mouseenter', function(e) {
        const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
        if (target && target.closest && target.closest('.ssa-info-popover')) {
          if (popoverTimeout) clearTimeout(popoverTimeout);
        }
      }, true);
      
      // Handle mouseleave on popover
      document.addEventListener('mouseleave', function(e) {
        const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
        if (target && target.closest && target.closest('.ssa-info-popover')) {
          if (popoverTimeout) clearTimeout(popoverTimeout);
          popoverTimeout = setTimeout(() => {
            if (activePopover) {
              activePopover.remove();
              activePopover = null;
            }
          }, 100);
        }
      }, true);
    });
    
    // Close description popover on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && activePopover) {
        activePopover.remove();
        activePopover = null;
      }
    });
    
    // Shared map popover functionality
    if (!window._ssaMapPopoverState) {
      window._ssaMapPopoverState = {
        activePopover: null
      };
    }
    
    const mapPopoverState = window._ssaMapPopoverState;
    
    function closeMapPopover() {
      if (mapPopoverState.activePopover) {
        mapPopoverState.activePopover.remove();
        mapPopoverState.activePopover = null;
      }
    }
    
    function showMapPopover(location, triggerElement) {
      if (!location || !location.trim()) return;
      
      // Close existing popover if clicking the same location
      if (mapPopoverState.activePopover && mapPopoverState.activePopover.dataset.location === location) {
        closeMapPopover();
        return;
      }
      
      // Close any existing popover
      closeMapPopover();
      
      const encodedLocation = encodeURIComponent(location);
      const popoverWidth = 400;
      const popoverHeight = 300;
      const gap = 8;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      
      // Get trigger element position (or center if no element provided)
      let left, top;
      if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        left = rect.left + (rect.width / 2) - (popoverWidth / 2);
        if (left < 10) left = 10;
        if (left + popoverWidth > viewportW - 10) {
          left = viewportW - popoverWidth - 10;
        }
        
        top = rect.top - popoverHeight - gap;
        if (top < 10) {
          top = rect.bottom + gap;
        }
        if (top + popoverHeight > viewportH - 10) {
          top = viewportH - popoverHeight - 10;
        }
      } else {
        // Center if no trigger element
        left = Math.max(10, (viewportW - popoverWidth) / 2);
        top = Math.max(10, (viewportH - popoverHeight) / 2);
      }
      
      // Create map popover element
      const mapPopover = document.createElement('div');
      mapPopover.className = 'ssa-map-popover';
      mapPopover.dataset.location = location;
      
      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(0,0,0,0.6);
        color: white;
        border-radius: 50%;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        z-index: 10004;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      `;
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeMapPopover();
      });
      closeBtn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(0,0,0,0.8)';
      });
      closeBtn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(0,0,0,0.6)';
      });
      
      // Create iframe with map
      const mapIframe = document.createElement('iframe');
      mapIframe.src = `https://www.google.com/maps?q=${encodedLocation}&output=embed`;
      mapIframe.style.width = '100%';
      mapIframe.style.height = '100%';
      mapIframe.style.border = '0';
      mapIframe.setAttribute('loading', 'lazy');
      mapIframe.setAttribute('allowfullscreen', '');
      mapIframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      mapIframe.setAttribute('frameborder', '0');
      mapIframe.style.pointerEvents = 'none'; // Disable iframe interactions so overlay works
      
      // Create clickable overlay for the map
      const mapOverlay = document.createElement('div');
      mapOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        cursor: pointer;
        z-index: 10003;
        background: transparent;
      `;
      mapOverlay.title = 'Click to open directions in Google Maps';
      
      mapPopover.style.cssText = `
        position: fixed;
        left: ${left}px;
        top: ${top}px;
        display: block;
        z-index: 10003;
        width: ${popoverWidth}px;
        height: ${popoverHeight}px;
        padding: 0;
        background: #fff;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        overflow: hidden;
      `;
      
      // Click handler for map overlay - open directions
      mapOverlay.addEventListener('click', function(e) {
        // Don't open directions if clicking the close button
        if (e.target === closeBtn || closeBtn.contains(e.target)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`;
        const newWindow = window.open(mapUrl, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          window.location.href = mapUrl;
        }
      });
      
      mapPopover.appendChild(closeBtn);
      mapPopover.appendChild(mapIframe);
      mapPopover.appendChild(mapOverlay);
      document.body.appendChild(mapPopover);
      
      mapPopoverState.activePopover = mapPopover;
      
      // Close when clicking outside the popover
      // Use setTimeout to avoid immediate closure when opening
      setTimeout(function() {
        const outsideClickHandler = function(e) {
          if (mapPopoverState.activePopover && mapPopoverState.activePopover === mapPopover) {
            // Check if click is outside the popover
            const clickedInsidePopover = mapPopover.contains(e.target);
            const clickedOnTrigger = triggerElement && triggerElement.contains(e.target);
            if (!clickedInsidePopover && !clickedOnTrigger) {
              closeMapPopover();
              document.removeEventListener('click', outsideClickHandler);
            }
          } else {
            // Popover was closed another way, remove listener
            document.removeEventListener('click', outsideClickHandler);
          }
        };
        document.addEventListener('click', outsideClickHandler);
      }, 100);
    }
    
    // Location icon button handlers
    mount.querySelectorAll('.ssa-location-icon-btn').forEach(btn => {
      const location = btn.dataset.location;
      if (!location || !location.trim()) return;
      
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        showMapPopover(location, btn);
      });
    });
    
    // Location text click handlers - open directions
    const locationElements = mount.querySelectorAll('.ssa-location');
    locationElements.forEach(locationEl => {
      const location = locationEl.dataset.location;
      if (!location || !location.trim()) {
        return;
      }
      
      // Skip if already has handler
      if (locationEl.dataset.mapHandlerAttached === 'true') {
        return;
      }
      
      locationEl.dataset.mapHandlerAttached = 'true';
      locationEl.style.cursor = 'pointer';
      
      // Click handler to open directions in new tab
      locationEl.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const encodedLocation = encodeURIComponent(location);
        // Use /dir/ endpoint for directions instead of /search/
        const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`;
        const newWindow = window.open(mapUrl, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          window.location.href = mapUrl;
        }
        return false;
      }, true);
      
      // Also handle clicks on parent elements
      const parent = locationEl.parentElement;
      if (parent && parent.tagName === 'STRONG') {
        parent.style.cursor = 'pointer';
        parent.addEventListener('click', function(e) {
          if (e.target === locationEl || locationEl.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            const encodedLocation = encodeURIComponent(location);
            const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`;
            const newWindow = window.open(mapUrl, '_blank', 'noopener,noreferrer');
            if (!newWindow) {
              window.location.href = mapUrl;
            }
            return false;
          }
        }, true);
      }
    });
    
    // Close map popover on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mapPopoverState.activePopover) {
        closeMapPopover();
      }
    });
  }

  function injectStyles() {
    if (document.getElementById('ssa-styles-events')) return;
    
    const css = document.createElement('style');
    css.id = 'ssa-styles-events';
    css.textContent = `
      .ssa-controls{display:flex;flex-direction:column;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;align-items:center}
      .ssa-layout-switcher-wrapper{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
      .ssa-group-switcher-wrapper{display:flex;align-items:center;gap:8px;justify-content:center}
      .ssa-control-label{font-size:0.875rem;font-weight:500;color:#374151;white-space:nowrap}
      body.dark-mode .ssa-control-label{color:#f9fafb!important}
      .ssa-show-images-toggle{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;white-space:nowrap}
      .ssa-show-images-toggle:hover{background:#f9fafb;border-color:#9ca3af}
      .ssa-show-images-toggle.ssa-active{background:#3b82f6;border-color:#3b82f6;color:#fff}
      .ssa-show-images-toggle.ssa-active:hover{background:#2563eb;border-color:#2563eb}
      body.dark-mode .ssa-show-images-toggle{background:#374151;border-color:#4b5563;color:#f9fafb}
      body.dark-mode .ssa-show-images-toggle:hover{background:#4b5563;border-color:#6b7280}
      body.dark-mode .ssa-show-images-toggle.ssa-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-show-images-toggle.ssa-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-layout-switcher{display:flex;gap:4px}
      .ssa-layout-btn{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;cursor:pointer;font-size:1.2rem;transition:all 0.2s}
      .ssa-layout-btn:hover{background:#f9fafb;border-color:#9ca3af}
      .ssa-layout-btn.ssa-active{background:#3b82f6;border-color:#3b82f6;color:#fff}
      body.dark-mode .ssa-layout-btn.ssa-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-layout-btn.ssa-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-group-switcher{display:flex;gap:4px}
      .ssa-group-btn{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s}
      .ssa-group-btn:hover{background:#f9fafb!important;border-color:#9ca3af}
      .ssa-group-btn.ssa-active{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .ssa-group-btn.ssa-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-group-btn.ssa-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-date-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center}
      .ssa-date-inputs-row{display:flex;gap:12px;align-items:center}
      .ssa-date-filters label{display:flex;align-items:center;gap:6px;font-size:0.875rem;color:#374151}
      .ssa-dark-mode-toggle{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;white-space:nowrap}
      .ssa-dark-mode-toggle:hover{background:#f9fafb;border-color:#9ca3af}
      body.dark-mode .ssa-dark-mode-toggle{background:#374151;border-color:#4b5563;color:#f9fafb}
      body.dark-mode .ssa-dark-mode-toggle:hover{background:#4b5563;border-color:#6b7280}
      .ssa-date-input{padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:0.875rem}
      .ssa-clear-dates{padding:6px 12px;border:1px solid #d1d5db;border-radius:4px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem}
      .ssa-clear-dates:hover{background:#f9fafb!important}
      .ssa-weekend-btn{padding:6px 12px;border:1px solid #d1d5db;border-radius:4px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;white-space:nowrap}
      .ssa-weekend-btn:hover{background:#f9fafb!important;border-color:#9ca3af}
      .ssa-keyword-filters{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;justify-content:center}
      .ssa-keyword-btn{padding:8px 16px;border:2px solid #d1d5db;border-radius:20px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s}
      .ssa-keyword-btn:hover{background:#f9fafb!important;border-color:#9ca3af!important;color:#374151!important}
      .ssa-keyword-active{background:#fff!important;border-color:#3b82f6!important;color:#3b82f6!important}
      .ssa-keyword-active:hover{background:#f0f9ff!important;border-color:#2563eb!important;color:#2563eb!important}
      body.dark-mode .ssa-keyword-filters{background:transparent!important}
      body.dark-mode .ssa-keyword-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-keyword-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      body.dark-mode .ssa-layout-btn{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-layout-btn:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-group-btn{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-group-btn:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-keyword-btn{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-keyword-btn:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-weekend-btn{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-weekend-btn:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-clear-dates{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-clear-dates:hover{background:#4b5563!important;border-color:#6b7280!important}
      .ssa-empty{color:#6b7280;padding:20px;text-align:center}
      .ssa-skel{height:110px;border-radius:14px;background:linear-gradient(90deg,#f4f4f5,#f9fafb,#f4f4f5);background-size:200% 100%;animation:ssaShimmer 1.1s linear infinite}
      @keyframes ssaShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .ssa-month-header{margin:24px 0 12px;font-size:1.25rem;font-weight:600;color:#1f2937}
      .ssa-day-header,.ssa-day-header *,#events-list .ssa-day-header,#events-list .ssa-day-header *{margin:24px 0 12px;font-size:1.25rem;font-weight:600;color:#000000!important;padding-bottom:8px;border-bottom:2px solid #e5e7eb}
      h3.ssa-day-header,h3.ssa-day-header *{color:#000000!important}
      .ssa-events-list{list-style:none;padding:0;margin:0 0 32px}
      .ssa-event-item{margin-bottom:12px;padding:12px 0;border-bottom:1px solid #f3f4f6}
      .ssa-event-item:last-child{border-bottom:none}
      .ssa-event-content{display:flex;gap:16px;align-items:flex-start}
      .ssa-event-image-wrapper{flex-shrink:0;width:60px;height:60px;border-radius:8px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity 0.2s}
      .ssa-event-image-wrapper:hover{opacity:0.8}
      .ssa-event-image-wrapper:active{opacity:0.6}
      .ssa-event-image-wrapper.ssa-event-image-placeholder{background:#f9fafb;border:1px dashed #d1d5db;cursor:default}
      .ssa-event-image{width:100%;height:100%;object-fit:cover;display:block}
      .ssa-event-details{flex:1;min-width:0}
      .ssa-event-name-wrapper{display:inline-flex;align-items:center;gap:6px}
      .ssa-event-meta{margin-top:8px;display:flex;flex-direction:column;gap:4px}
      .ssa-event-meta-item,.ssa-event-meta-item *,#events-list .ssa-event-meta-item,#events-list .ssa-event-meta-item *{font-size:0.9rem;line-height:1.5;color:#000000!important}
      .ssa-event-meta-item strong,#events-list .ssa-event-meta-item strong,.ssa-event-meta-item strong *,#events-list .ssa-event-meta-item strong *{color:#000000!important;margin-right:4px}
      div.ssa-event-meta-item,div.ssa-event-meta-item *{color:#000000!important}
      .ssa-event-link{color:#3b82f6;text-decoration:none;cursor:pointer}
      .ssa-event-link:hover{text-decoration:underline}
      .ssa-event-name{cursor:default}
      .ssa-icon-group{display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
      .ssa-info-icon{display:inline-flex!important;align-items:center;justify-content:center;font-size:0.7rem;opacity:0.8;cursor:help;transition:all 0.2s;flex-shrink:0;width:24px;height:24px;border-radius:50%;background:#3b82f6;color:#fff;font-weight:700;line-height:1;position:relative;vertical-align:middle;min-width:24px;min-height:24px}
      .ssa-info-icon::before{content:'i';font-style:normal;font-family:Georgia,serif;font-size:0.85rem}
      .ssa-info-icon:hover{opacity:1;background:#2563eb;transform:scale(1.1)}
      .ssa-image-icon-btn{display:none;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#10b981;color:#fff;cursor:pointer;transition:all 0.2s;flex-shrink:0;font-size:0.9rem;opacity:0.8;min-width:24px;min-height:24px}
      .ssa-image-icon-btn:hover{opacity:1;background:#059669;transform:scale(1.1)}
      .ssa-image-icon-btn:active{opacity:0.7}
      .ssa-location-icon-btn{display:none;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#f59e0b;color:#fff;cursor:pointer;transition:all 0.2s;flex-shrink:0;font-size:0.9rem;opacity:0.8;min-width:24px;min-height:24px}
      .ssa-location-icon-btn:hover{opacity:1;background:#d97706;transform:scale(1.1)}
      .ssa-location-icon-btn:active{opacity:0.7}
      .ssa-info-popover{padding:12px;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:200px;max-width:300px;max-height:400px;font-size:0.875rem;line-height:1.5;color:#374151;white-space:normal;word-wrap:break-word;pointer-events:auto;position:relative;display:flex;flex-direction:column;overflow:hidden}
      .ssa-info-popover .ssa-popover-content{overflow-y:auto;overflow-x:hidden;flex:1;min-height:0;max-height:100%;-webkit-overflow-scrolling:touch;position:relative}
      body.dark-mode .ssa-info-popover{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important;box-shadow:0 4px 12px rgba(0,0,0,0.3)!important}
      .ssa-calendar-popover{min-width:280px;max-width:400px}
      .ssa-popover-close{position:absolute;top:4px;right:4px;width:24px;height:24px;border:none;background:rgba(0,0,0,0.6);color:white;border-radius:50%;font-size:18px;line-height:1;cursor:pointer;z-index:10003;display:flex;align-items:center;justify-content:center;transition:background 0.2s;padding:0}
      .ssa-popover-close:hover{background:rgba(0,0,0,0.8)}
      .ssa-info-popover::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#fff}
      body.dark-mode .ssa-info-popover::after{border-top-color:#374151!important}
      .ssa-info-popover::before{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#d1d5db;margin-top:-1px}
      body.dark-mode .ssa-info-popover::before{border-top-color:#4b5563!important}
      .ssa-link-icon{display:inline-flex;align-items:center;justify-content:center;font-size:0.875rem;opacity:0.7;transition:opacity 0.2s;margin-left:4px}
      .ssa-link-icon:hover{opacity:1}
      .ssa-location{cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;color:#3b82f6;transition:color 0.2s}
      .ssa-location:hover{color:#2563eb;text-decoration-style:solid}
      .ssa-map-popover{width:400px;height:300px;padding:0;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);overflow:hidden;pointer-events:auto;position:fixed;z-index:10003}
      .ssa-map-popover::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#fff;z-index:1}
      .ssa-map-popover::before{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#d1d5db;margin-top:-1px;z-index:0}
      .ssa-keywords-inline{display:inline-flex;flex-wrap:wrap;gap:4px;margin-left:8px}
      .ssa-tag{display:inline-block;padding:2px 8px;background:#f3f4f6;border-radius:12px;font-size:0.75rem;color:#6b7280}
      .ssa-event-keywords{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
      .ssa-keyword-tag-clickable{display:inline-block;padding:8px 16px;border:2px solid #d1d5db;border-radius:20px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s}
      .ssa-keyword-tag-clickable:hover{background:#f9fafb;border-color:#9ca3af}
      .ssa-keyword-tag-clickable.ssa-keyword-tag-active{background:#374151;border-color:#374151;color:#fff}
      .ssa-keyword-tag-clickable.ssa-keyword-tag-active:hover{background:#1f2937;border-color:#1f2937}
      body.dark-mode .ssa-keyword-tag-clickable{background:var(--ssa-control-bg, #374151)!important;border-color:var(--ssa-control-border, #4b5563)!important;color:var(--ssa-text, #f9fafb)!important}
      body.dark-mode .ssa-keyword-tag-clickable:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-keyword-tag-clickable.ssa-keyword-tag-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-keyword-tag-clickable.ssa-keyword-tag-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-grid{display:grid;gap:16px}
      @media(min-width:720px){.ssa-grid{grid-template-columns:repeat(2,1fr)}}
      @media(min-width:1024px){.ssa-grid{grid-template-columns:repeat(3,1fr)}}
      .ssa-calendar-container{margin:24px 0}
      .ssa-calendar-month-header{margin:0 0 16px;font-size:1.5rem;font-weight:600;color:#1f2937;text-align:center}
      .ssa-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:#e5e7eb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
      .ssa-calendar-day-header{background:#f8f9fa;padding:8px 4px;text-align:center;font-size:0.75rem;font-weight:600;color:#6b7280;text-transform:uppercase}
      .ssa-calendar-day{background:#fff;min-height:80px;padding:4px;display:flex;flex-direction:column;position:relative}
      .ssa-calendar-day-empty{background:#f9fafb;opacity:0.5}
      .ssa-calendar-day-out-of-range{opacity:0.4;background:#f3f4f6}
      .ssa-calendar-day-out-of-range .ssa-calendar-day-number{color:#9ca3af}
      .ssa-calendar-day-number{font-size:0.875rem;font-weight:600;color:#374151;margin-bottom:4px}
      .ssa-calendar-day-events{display:flex;flex-wrap:wrap;gap:2px;align-items:flex-start}
      .ssa-calendar-info-icon{width:16px;height:16px;min-width:16px;min-height:16px;font-size:0.6rem;margin:0}
      .ssa-calendar-event-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;opacity:0.7}
      @media(max-width:768px){
        .ssa-calendar-day{min-height:60px;padding:2px}
        .ssa-calendar-day-number{font-size:0.75rem}
        .ssa-calendar-info-icon{width:14px;height:14px;min-width:14px;min-height:14px;font-size:0.55rem}
        .ssa-calendar-event-dot{width:6px;height:6px}
      }
      .ssa-card{border:1px solid #e5e7eb;border-radius:14px;padding:0;background:#fff;position:relative;overflow:hidden}
      .ssa-card[data-has-image="true"]{background-color:#fff}
      .ssa-card[data-has-image="true"]::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background-image:var(--card-bg-image);background-size:cover;background-position:center;background-repeat:no-repeat;opacity:0.2;z-index:0}
      .ssa-card[data-has-image="true"]::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,rgba(255,255,255,0.6) 0%,rgba(255,255,255,0.4) 50%,rgba(255,255,255,0.3) 100%);z-index:1}
      .ssa-card[data-has-image="true"] .ssa-card-content{position:relative;z-index:2;padding:14px}
      .ssa-card:not([data-has-image="true"]) .ssa-card-content{padding:14px}
      .ssa-card-content{min-height:120px}
      .ssa-card-head{display:flex;align-items:center;gap:8px;position:relative}
      .ssa-card-image-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:6px;overflow:hidden;cursor:pointer;opacity:0.8;transition:opacity 0.2s;flex-shrink:0;z-index:10;border:2px solid rgba(0,0,0,0.1)}
      .ssa-card-image-icon:hover{opacity:0.9;border-color:rgba(0,0,0,0.15)}
      .ssa-card-image-icon:active{opacity:0.7}
      .ssa-card-icon-thumb{width:100%;height:100%;object-fit:cover;display:block}
      .ssa-title{margin:0;font-size:1.05rem;line-height:1.3;color:#1f2937;font-weight:600;flex:1;display:inline-flex;align-items:center;gap:4px}
      .ssa-meta{margin:.35rem 0;color:#374151;font-weight:500}
      .ssa-keywords{margin:.5rem 0;display:flex;flex-wrap:wrap;gap:4px}
      .ssa-tag-clickable{display:inline-block;padding:8px 16px;border:2px solid #d1d5db;border-radius:20px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s}
      .ssa-tag-clickable:hover{background:#f9fafb;border-color:#9ca3af}
      .ssa-tag-clickable.ssa-tag-active{background:#374151;border-color:#374151;color:#fff}
      .ssa-tag-clickable.ssa-tag-active:hover{background:#1f2937;border-color:#1f2937}
      body.dark-mode .ssa-tag-clickable{background:var(--ssa-control-bg, #374151)!important;border-color:var(--ssa-control-border, #4b5563)!important;color:var(--ssa-text, #f9fafb)!important}
      body.dark-mode .ssa-tag-clickable:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-tag-clickable.ssa-tag-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-tag-clickable.ssa-tag-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-link{text-decoration:underline;color:#3b82f6;font-weight:500}
      @media(max-width:768px){
        #events-list{padding:0 12px;box-sizing:border-box;max-width:100%;overflow-x:hidden}
        *{box-sizing:border-box}
        .ssa-controls{padding-bottom:16px;gap:12px;padding-left:0;padding-right:0}
        .ssa-layout-switcher-wrapper{flex-direction:column;align-items:flex-start;gap:6px}
        .ssa-group-switcher-wrapper{flex-direction:column;align-items:flex-start;gap:6px}
        .ssa-control-label{font-size:0.9rem}
        .ssa-layout-btn{padding:10px 14px;font-size:1.1rem;min-height:44px}
        .ssa-group-switcher{gap:6px}
        .ssa-group-btn{padding:10px 14px;font-size:0.9rem;min-height:44px}
        .ssa-date-filters{flex-direction:column;align-items:stretch;gap:8px}
        .ssa-date-inputs-row{display:flex;flex-direction:row;gap:8px;width:100%}
        .ssa-date-filters label{flex-direction:row;align-items:center;gap:6px;font-size:0.9rem;flex:1}
        .ssa-date-input{flex:1;padding:10px;font-size:1rem;min-height:44px}
        .ssa-clear-dates{width:100%;padding:10px;font-size:0.9rem;min-height:44px}
        .ssa-weekend-btn{width:100%;padding:10px;font-size:0.9rem;min-height:44px}
        .ssa-keyword-filters{gap:6px}
        .ssa-keyword-btn{padding:10px 14px;font-size:0.9rem;min-height:44px;border-radius:22px}
        .ssa-month-header{font-size:1.1rem;margin:20px 0 10px}
        .ssa-event-item{padding:16px 0;margin-bottom:16px;max-width:100%;overflow-x:hidden}
        .ssa-event-content{flex-direction:column;gap:12px;max-width:100%}
        .ssa-event-image-wrapper{width:100%;height:200px;max-width:100%;box-sizing:border-box}
        .ssa-event-details{width:100%;max-width:100%;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-event-name-wrapper{flex-wrap:wrap;gap:8px;margin-bottom:8px;max-width:100%}
        .ssa-event-name-wrapper strong{font-size:1.1rem;line-height:1.4;display:block;width:100%;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-event-link{font-size:1.1rem;line-height:1.4;display:block;width:100%;margin-bottom:4px;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-icon-group{gap:8px;margin-right:10px}
        .ssa-info-icon{width:44px;height:44px;min-width:44px;min-height:44px;flex-shrink:0;padding:0}
        .ssa-info-icon::before{font-size:1.2rem}
        .ssa-image-icon-btn{display:inline-flex!important;width:44px;height:44px;min-width:44px;min-height:44px;font-size:1.2rem}
        .ssa-location-icon-btn{display:inline-flex!important;width:44px;height:44px;min-width:44px;min-height:44px;font-size:1.2rem}
        .ssa-event-meta{margin-top:12px;gap:6px;max-width:100%}
        .ssa-event-meta-item{font-size:0.95rem;line-height:1.6;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-event-meta-item strong{display:inline}
        .ssa-event-keywords{margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;flex-wrap:wrap;gap:6px;max-width:100%}
        .ssa-keyword-tag-clickable{padding:10px 14px;font-size:0.9rem;min-height:44px;border-radius:22px}
        .ssa-info-popover{max-width:calc(100vw - 20px);width:calc(100vw - 20px);left:10px!important;right:10px;font-size:1rem;line-height:1.6;max-height:60vh;padding:16px;display:flex!important;flex-direction:column!important;overflow:hidden!important}
        .ssa-info-popover .ssa-popover-content{overflow-y:auto!important;overflow-x:hidden!important;flex:1!important;min-height:0!important;max-height:calc(60vh - 32px)!important;-webkit-overflow-scrolling:touch!important}
        .ssa-popover-close{width:32px;height:32px;font-size:24px;top:8px;right:8px}
        .ssa-grid{gap:12px;max-width:100%}
        .ssa-card{max-width:100%;overflow:hidden}
        .ssa-card-content{padding:16px!important;min-height:auto;max-width:100%;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-title{font-size:1rem;line-height:1.4;flex-wrap:wrap;gap:6px;max-width:100%;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-title .ssa-info-icon{margin-bottom:4px}
        .ssa-meta{font-size:0.9rem;line-height:1.5;margin:8px 0}
        .ssa-keywords{margin:8px 0;gap:6px}
        .ssa-tag-clickable{padding:10px 14px;font-size:0.9rem;min-height:44px;border-radius:22px}
        .ssa-map-popover{width:calc(100vw - 20px)!important;height:250px;left:10px!important;right:10px}
      }
    `;
    document.head.appendChild(css);
  }

  // Helper function to reload events when filters change
  async function reloadEvents(mount, state, opts) {
    if (!opts || !opts.url || !opts.key) {
      console.error('reloadEvents: Missing required opts (url, key)', opts);
      // Fallback: try to use existing rows and filter client-side
      const existingRows = mount._allRows || [];
      await renderEvents(mount, existingRows, state);
      return;
    }
    
    try {
      console.log('=== reloadEvents DEBUG ===');
      console.log('state:', state);
      console.log('state.fromDate:', state.fromDate, 'type:', typeof state.fromDate);
      console.log('state.toDate:', state.toDate, 'type:', typeof state.toDate);
      
      const fetchOpts = {
        url: opts.url,
        key: opts.key,
        from: state.fromDate || null,
        to: state.toDate || null,
        limit: opts.limit || 200
      };
      console.log('fetchOpts:', fetchOpts);
      
      const key = `ssa_events:${opts.url}:${fetchOpts.from || 'all'}:${fetchOpts.to || ''}:${opts.limit||200}`;
      const rows = await fetchEvents(fetchOpts);
      console.log('=== END reloadEvents DEBUG ===');
      mount._allRows = rows; // Store for fallback
      sessionStorage.setItem(key, JSON.stringify(rows));
      await renderEvents(mount, rows, state);
    } catch (e) {
      console.error('Error reloading events:', e);
      // Fallback: try to use existing rows and filter client-side
      const existingRows = mount._allRows || [];
      if (existingRows.length > 0) {
        await renderEvents(mount, existingRows, state);
      } else {
        mount.innerHTML = `<div class="ssa-empty">Sorry, events are unavailable right now.</div>`;
      }
    }
  }

  async function renderEventsWidget(opts) {
    const mount = document.querySelector(opts.mount);
    if (!mount) return;
    
    // Initialize state - default fromDate to today
    const state = {
      layout: opts.layout || LAYOUTS.LIST,
      selectedKeywords: opts.selectedKeywords || [],
      fromDate: opts.fromDate !== undefined ? opts.fromDate : todayISO(),
      toDate: opts.toDate || null,
      showImages: opts.showImages !== undefined ? opts.showImages : false,
      groupBy: opts.groupBy || 'day'
    };
    
    // Store opts for reloadEvents
    mount._widgetOpts = opts;
    
    mount.innerHTML = `<div class="ssa-grid"><div class="ssa-skel"></div><div class="ssa-skel"></div><div class="ssa-skel"></div></div>`;
    
    try {
      // Fetch events with fromDate (or null if cleared)
      const fetchOpts = {
        ...opts,
        from: state.fromDate || null,
        to: state.toDate || null
      };
      const key = `ssa_events:${opts.url}:${fetchOpts.from || 'all'}:${fetchOpts.to || ''}:${opts.limit||200}`;
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const cachedData = JSON.parse(cached);
        mount._allRows = cachedData; // Store for fallback in reloadEvents
        await renderEvents(mount, cachedData, state);
      }
      const rows = await fetchEvents(fetchOpts);
      mount._allRows = rows; // Store for fallback in reloadEvents
      sessionStorage.setItem(key, JSON.stringify(rows));
      await renderEvents(mount, rows, state);
      
      // Initialize pull-to-refresh after events are rendered
      initPullToRefresh(mount, opts, state);
    } catch (e) {
      console.error(e);
      mount.innerHTML = `<div class="ssa-empty">Sorry, events are unavailable right now.</div>`;
    }
  }
  
  // Pull-to-refresh functionality
  function initPullToRefresh(mount, opts, state) {
    // Prevent duplicate initialization
    if (mount._pullToRefreshInitialized) {
      return;
    }
    mount._pullToRefreshInitialized = true;
    
    let touchStartY = 0;
    let touchCurrentY = 0;
    let isPulling = false;
    let pullDistance = 0;
    const pullThreshold = 80; // Distance in pixels to trigger refresh
    
    // Create refresh indicator element - attach to body for page-level pull-to-refresh
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'ssa-pull-to-refresh';
    refreshIndicator.style.cssText = `
      position: fixed;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      opacity: 0;
      transition: opacity 0.2s, top 0.2s;
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    refreshIndicator.innerHTML = '↻';
    document.body.appendChild(refreshIndicator);
    
    const handleTouchStart = function(e) {
      // Only start pull if we're at the top of the page
      if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
      }
    };
    
    const handleTouchMove = function(e) {
      if (!isPulling) return;
      
      touchCurrentY = e.touches[0].clientY;
      pullDistance = touchCurrentY - touchStartY;
      
      // Only allow pulling down
      if (pullDistance > 0 && window.scrollY === 0) {
        // Prevent default scrolling while pulling
        e.preventDefault();
        
        // Update indicator position and opacity
        const progress = Math.min(pullDistance / pullThreshold, 1);
        refreshIndicator.style.top = `${pullDistance - 60}px`;
        refreshIndicator.style.opacity = progress;
        
        // Rotate icon based on pull distance
        const rotation = pullDistance >= pullThreshold ? 180 : pullDistance * 2;
        refreshIndicator.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
      } else {
        // Reset if pulling up or scrolled away from top
        resetPullState();
      }
    };
    
    const handleTouchEnd = async function(e) {
      if (!isPulling) return;
      
      if (pullDistance >= pullThreshold && window.scrollY === 0) {
        // Trigger refresh
        refreshIndicator.style.top = '20px';
        refreshIndicator.style.opacity = '1';
        
        // Clear cache and reload events
        const fetchOpts = {
          ...opts,
          from: state.fromDate || null,
          to: state.toDate || null
        };
        const key = `ssa_events:${opts.url}:${fetchOpts.from || 'all'}:${fetchOpts.to || ''}:${opts.limit||200}`;
        sessionStorage.removeItem(key);
        
        try {
          const rows = await fetchEvents(fetchOpts);
          mount._allRows = rows;
          sessionStorage.setItem(key, JSON.stringify(rows));
          
          // Reset flag so pull-to-refresh can be re-initialized after render
          mount._pullToRefreshInitialized = false;
          await renderEvents(mount, rows, state);
          
          // Re-initialize pull-to-refresh after re-render
          setTimeout(() => {
            initPullToRefresh(mount, opts, state);
          }, 100);
        } catch (error) {
          console.error('Error refreshing events:', error);
          resetPullState();
        }
      } else {
        resetPullState();
      }
    };
    
    const resetPullState = function() {
      isPulling = false;
      pullDistance = 0;
      refreshIndicator.style.top = '-60px';
      refreshIndicator.style.opacity = '0';
      refreshIndicator.style.transform = 'translateX(-50%) rotate(0deg)';
    };
    
    // Add touch event listeners to document for page-level pull-to-refresh
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Store handlers for cleanup
    mount._pullToRefreshHandlers = {
      touchstart: handleTouchStart,
      touchmove: handleTouchMove,
      touchend: handleTouchEnd,
      indicator: refreshIndicator
    };
  }

  // Dark mode toggle functionality
  function toggleDarkMode() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    const button = document.querySelector('.ssa-dark-mode-toggle');
    
    if (button) {
      button.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
    
    localStorage.setItem('ssa-dark-mode', isDark ? 'true' : 'false');
  }
  
  function initDarkModeToggle() {
    // Attach event listener to existing toggle button in controls
    const button = document.querySelector('.ssa-dark-mode-toggle');
    if (button) {
      button.onclick = toggleDarkMode;
      
      // Check for saved preference and update button text
      const savedDarkMode = localStorage.getItem('ssa-dark-mode');
      if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
        button.textContent = '☀️ Light Mode';
      }
    }
  }

  window.SSWidgets = window.SSWidgets || {};
  window.SSWidgets.renderEvents = renderEventsWidget;
})();

