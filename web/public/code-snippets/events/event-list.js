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
  
  // Adjust date for PostgREST query to account for timezone boundaries
  // PostgREST may interpret date strings as UTC midnight, causing off-by-one errors
  // This function adjusts the date to ensure correct comparison
  function adjustDateForQuery(dateStr, isStartDate) {
    if (!dateStr) return null;
    const normalized = normalizeDateString(dateStr);
    if (!normalized) return null;
    
    // Parse the date in local timezone to avoid UTC conversion issues
    const [year, month, day] = normalized.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    // For start date: we want events >= this date, so use the date as-is
    // For end date: we want events <= this date, so we need to include the full day
    // Add one day to the end date to ensure we include events on that date
    if (!isStartDate) {
      localDate.setDate(localDate.getDate() + 1);
    }
    
    // Format back to YYYY-MM-DD
    const adjustedYear = localDate.getFullYear();
    const adjustedMonth = String(localDate.getMonth() + 1).padStart(2, '0');
    const adjustedDay = String(localDate.getDate()).padStart(2, '0');
    return `${adjustedYear}-${adjustedMonth}-${adjustedDay}`;
  }

  // Layout types
  const LAYOUTS = {
    LIST: 'list',
    GRID: 'grid',
    CALENDAR: 'calendar'
  };
  const SIGNATURE_EVENT_KEYWORD = 'signature event';
  const SSA_HOME_URL = 'https://sportscaradventures.com/';
  const SSA_LOGO_URL = 'https://static1.squarespace.com/static/5461a83be4b02a78c5fde7d7/t/66c61c7415d203318d4a220d/1724259446656/Sports+Car+Adventures+logo.png?format=1000w';
  const DEFAULT_WEATHER_REGION = {
    name: 'Gold Country',
    slug: 'gold-country',
    weatherSlug: 'sutter-creek',
    weatherState: 'ca',
    lat: 38.4819,
    lng: -120.8447,
    timezone: 'America/Los_Angeles'
  };
  const WEATHER_CACHE_TTL_MS = 45 * 60 * 1000;
  const WEATHER_UNDERGROUND_BASE_URL = 'https://www.wunderground.com/forecast/us';

  async function fetchEvents({ url, key, from = null, to = null, limit = 200 }) {
      const api = new URL(url + '/rest/v1/events');
      api.searchParams.set('select','id,name,slug,host_org,start_date,end_date,start_time,end_time,location,website_url,image_url,recurrence,sort_order,description,is_signature_event,status,created_at');
      api.searchParams.set('order','start_date.asc,name.asc');
      api.searchParams.set('limit', String(limit));
      api.searchParams.set('status', 'eq.published');

	  // Show upcoming events if FROM is set.
	  // Include rows where:
	  //  - start_date >= from (events starting on or after the selected date), OR
	  //  - end_date >= from (events that span across the selected date), OR
	  //  - (both dates are null) (undated events)
	  // Handle date filters - PostgREST DATE column comparison appears to have an off-by-one issue
	  // When comparing date strings, it seems to interpret them as one day earlier
	  // Solution: Adjust dates to compensate for PostgREST's interpretation
	  
	  if (from) {
	    // Normalize date string to ensure YYYY-MM-DD format
	    const fromDateStr = normalizeDateString(from);
	    
	    // Strategy: Fetch a broad range of events to ensure we get all events that might span the filter date
	    // We'll fetch events that:
	    // 1. Start up to 60 days before the filter date (to catch long-spanning events), OR
	    // 2. End on or after the filter date (to catch events ending on/after the filter date), OR
	    // 3. Are undated (both dates null)
	    // The client-side filter will then correctly filter to only events that end on/after the filter date
	    // This approach avoids PostgREST date interpretation issues by being very permissive server-side
	    
	    // Fetch events starting up to 60 days before the filter date
	    const [startYear, startMonth, startDay] = fromDateStr.split('-').map(Number);
	    const startDateForQuery = new Date(startYear, startMonth - 1, startDay);
	    startDateForQuery.setDate(startDateForQuery.getDate() - 60); // Fetch events starting up to 60 days before filter date
	    const adjustedFromStartBefore = `${startDateForQuery.getFullYear()}-${String(startDateForQuery.getMonth() + 1).padStart(2, '0')}-${String(startDateForQuery.getDate()).padStart(2, '0')}`;
	    
	    // Also fetch events ending on or after the filter date
	    // To account for PostgREST's date interpretation, subtract one day from the filter date
	    // This ensures we fetch events ending on the filter date itself
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
	  }
	  
	  if (to) {
	    // Normalize date string
	    const toDateStr = normalizeDateString(to);
	    
	    // Since events one day BEFORE the end date are the last ones showing,
	    // PostgREST is interpreting dates as one day earlier
	    // To fix: Add two days to the to date, then use lte (less than or equal)
	    // This way: lte.2025-12-09 will be interpreted as lte.2025-12-08, which includes Dec 7th
	    const [year, month, day] = toDateStr.split('-').map(Number);
	    const endDate = new Date(year, month - 1, day);
	    endDate.setDate(endDate.getDate() + 2); // Add 2 days: 1 for timezone shift + 1 for inclusion
	    const adjustedTo = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
	    
	    // For 'to' filter, we need to combine with existing 'or' filter if 'from' is also set
	    // Include events that:
	    // 1. Start on or before the to date, OR
	    // 2. End on or before the to date (events that span across the to date), OR
	    // 3. Are undated
	    // Note: PostgREST doesn't easily support combining AND/OR filters, so we'll filter client-side
	    // For now, we'll set a simple filter and rely on client-side filtering for the 'to' date
	    // For 'to' filter, if 'from' is also set, skip server-side filtering
	    // PostgREST has issues with complex 'or' filters when both dates are set
	    // We'll rely on client-side filtering for the 'to' date when both filters are present
	    const existingStartDate = api.searchParams.get('start_date');
	    if (existingStartDate) {
	      // If we already have a 'from' filter, skip 'to' filter server-side
	      // Client-side filtering will handle the 'to' date
	      // This avoids PostgREST 400 errors from malformed 'or' filters
	    } else {
	      // Only 'to' filter (no 'from'): use simple end_date filter
	      // Don't use complex 'or' filter - just filter by end_date
	      api.searchParams.set('end_date', `lte.${adjustedTo}`);
	    }
	  }
	  
	  console.debug('Events API URL:', api.toString());
	  console.debug('Date filter params:', { from, to, fromDateStr: from ? normalizeDateString(from) : null });

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
      
      return dedupeEventsBySchedule(events);
    }

  function getWeatherRegion(opts = {}) {
    if (opts.weather === false) return null;
    const supplied = opts.weatherRegion || {};
    return {
      ...DEFAULT_WEATHER_REGION,
      ...supplied,
      lat: Number.isFinite(Number(supplied.lat)) ? Number(supplied.lat) : DEFAULT_WEATHER_REGION.lat,
      lng: Number.isFinite(Number(supplied.lng)) ? Number(supplied.lng) : DEFAULT_WEATHER_REGION.lng
    };
  }

  function weatherCacheKey(region) {
    return `ssa_weather_v20260628:${region.slug || region.name}:${region.lat},${region.lng}`;
  }

  function slugifyWeatherLocation(value) {
    return `${value || ''}`
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getWeatherDetailUrl(region) {
    const activeRegion = region || DEFAULT_WEATHER_REGION;
    if (activeRegion.weatherUrl) return activeRegion.weatherUrl;
    const stateSlug = slugifyWeatherLocation(activeRegion.weatherState || activeRegion.state || DEFAULT_WEATHER_REGION.weatherState);
    const citySlug = slugifyWeatherLocation(activeRegion.weatherSlug || activeRegion.citySlug || activeRegion.city || activeRegion.name || DEFAULT_WEATHER_REGION.weatherSlug);
    return `${WEATHER_UNDERGROUND_BASE_URL}/${encodeURIComponent(stateSlug)}/${encodeURIComponent(citySlug)}`;
  }

  function getWeatherLinkAttributes(region) {
    const detailUrl = getWeatherDetailUrl(region);
    return `href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener" data-ssa-weather-link="true"`;
  }

  function getWeatherPeriodDate(period, timezone) {
    if (!period || !period.startTime) return null;
    const date = new Date(period.startTime);
    if (Number.isNaN(date.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || DEFAULT_WEATHER_REGION.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return `${lookup.year}-${lookup.month}-${lookup.day}`;
    } catch (error) {
      return period.startTime.slice(0, 10);
    }
  }

  function makeWeatherDrivingNote(summary) {
    const condition = `${summary.condition || ''} ${summary.wind || ''}`.toLowerCase();
    if ((summary.precipChance || 0) >= 50 || /rain|shower|thunder|storm/.test(condition)) {
      return 'Watch for wet roads.';
    }
    if (/fog|haze|smoke/.test(condition)) {
      return 'Visibility may vary.';
    }
    if ((summary.high || 0) >= 95) {
      return 'Hot afternoon driving.';
    }
    if (/wind|breezy|gust/.test(condition)) {
      return 'Expect breezy driving.';
    }
    if (/sun|clear|fair/.test(condition)) {
      return 'Good driving weather.';
    }
    return 'Check conditions before heading out.';
  }

  function summarizeWeatherDay(day) {
    const dayPeriod = day.daytime || day.periods.find(period => period.isDaytime) || day.periods[0];
    const nightPeriod = day.nighttime || [...day.periods].reverse().find(period => !period.isDaytime);
    const temps = day.periods.map(period => Number(period.temperature)).filter(Number.isFinite);
    const precipValues = day.periods
      .map(period => period.probabilityOfPrecipitation && period.probabilityOfPrecipitation.value)
      .filter(value => Number.isFinite(Number(value)))
      .map(Number);
    const summary = {
      condition: dayPeriod?.shortForecast || 'Forecast available',
      high: Number.isFinite(Number(dayPeriod?.temperature)) ? Number(dayPeriod.temperature) : (temps.length ? Math.max(...temps) : null),
      low: Number.isFinite(Number(nightPeriod?.temperature)) ? Number(nightPeriod.temperature) : (temps.length ? Math.min(...temps) : null),
      precipChance: precipValues.length ? Math.max(...precipValues) : null,
      wind: dayPeriod?.windSpeed || ''
    };
    summary.note = makeWeatherDrivingNote(summary);
    return summary;
  }

  function normalizeWeatherPeriods(periods, region) {
    const days = {};
    (periods || []).forEach(period => {
      const dateKey = getWeatherPeriodDate(period, region.timezone);
      if (!dateKey) return;
      if (!days[dateKey]) days[dateKey] = { periods: [] };
      days[dateKey].periods.push(period);
      if (period.isDaytime) days[dateKey].daytime = period;
      if (!period.isDaytime) days[dateKey].nighttime = period;
    });

    return Object.fromEntries(
      Object.entries(days)
        .filter(([, day]) => day.periods.length > 0)
        .map(([dateKey, day]) => [dateKey, summarizeWeatherDay(day)])
    );
  }

  async function fetchRegionalWeather(region) {
    if (!region) return {};
    const cacheKey = weatherCacheKey(region);
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (cached && cached.savedAt && Date.now() - cached.savedAt < WEATHER_CACHE_TTL_MS && cached.weatherByDate) {
        return cached.weatherByDate;
      }
    } catch (error) {
      // Ignore malformed cache entries.
    }

    try {
      const pointRes = await fetch(`https://api.weather.gov/points/${region.lat},${region.lng}`, {
        headers: { Accept: 'application/geo+json' }
      });
      if (!pointRes.ok) throw new Error(`NWS point lookup failed: ${pointRes.status}`);
      const point = await pointRes.json();
      const forecastUrl = point?.properties?.forecast;
      if (!forecastUrl) throw new Error('NWS point lookup did not include a forecast URL');

      const forecastRes = await fetch(forecastUrl, {
        headers: { Accept: 'application/geo+json' }
      });
      if (!forecastRes.ok) throw new Error(`NWS forecast failed: ${forecastRes.status}`);
      const forecast = await forecastRes.json();
      const weatherByDate = normalizeWeatherPeriods(forecast?.properties?.periods || [], region);
      sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), weatherByDate }));
      return weatherByDate;
    } catch (error) {
      console.warn('Weather forecast unavailable:', error);
      return {};
    }
  }

  function renderWeatherSummary(weather, region = DEFAULT_WEATHER_REGION) {
    if (!weather) return '';
    const tempText = weather.high !== null && weather.low !== null
      ? `${weather.high} / ${weather.low}`
      : weather.high !== null
        ? `High ${weather.high}`
        : weather.low !== null
          ? `Low ${weather.low}`
          : '';
    const rainText = weather.precipChance !== null ? `${weather.precipChance}% rain` : '';
    const pieces = [weather.condition, tempText, rainText, weather.note].filter(Boolean);
    return `<a class="ssa-day-weather" ${getWeatherLinkAttributes(region)} aria-label="${escapeHtml(`${pieces.join('. ')}. Open detailed weather forecast`)}"><span class="ssa-weather-icon-link" aria-hidden="true"><span class="ssa-weather-icon"></span></span><span>${escapeHtml(pieces.join('. '))}</span></a>`;
  }

  function getWeatherBadgeIcon(weather) {
    if (!weather) return '';
    const condition = `${weather.condition || ''}`.toLowerCase();
    if ((weather.precipChance || 0) >= 40 || /rain|shower|thunder|storm/.test(condition)) return '🌧';
    if (/snow|sleet|ice/.test(condition)) return '❄';
    if (/cloud|overcast/.test(condition)) return '☁';
    if (/fog|haze|smoke/.test(condition)) return '🌫';
    if (/wind|breezy|gust/.test(condition)) return '💨';
    if (/sun|clear|fair/.test(condition)) return '☀';
    return '🌤';
  }

  function getStickyWeatherChance(weather) {
    if (!weather) return null;
    const condition = `${weather.condition || ''}`.toLowerCase();
    const precipChance = Number(weather.precipChance);
    if (Number.isFinite(precipChance) && (precipChance >= 30 || /rain|shower|thunder|storm/.test(condition))) {
      return {
        value: Math.round(precipChance),
        label: 'precipitation'
      };
    }
    if (/sun|clear|fair/.test(condition)) {
      return {
        value: Number.isFinite(precipChance) ? Math.max(0, Math.round(100 - precipChance)) : 100,
        label: 'sunny'
      };
    }
    return null;
  }

  function renderStickyWeatherBadge(weather, region = DEFAULT_WEATHER_REGION, asLink = true) {
    if (!weather) return '';
    const icon = getWeatherBadgeIcon(weather);
    const chance = getStickyWeatherChance(weather);
    const chanceText = chance
      ? `<span class="ssa-sticky-weather-chance">${chance.value}%</span>`
      : '';
    const label = [weather.condition, chance ? `${chance.value}% ${chance.label}` : ''].filter(Boolean).join(', ');
    const content = `<span aria-hidden="true">${icon}</span>${chanceText}`;
    if (!asLink) {
      return `<span class="ssa-sticky-weather-badge" aria-label="${escapeHtml(label || 'Weather forecast')}">${content}</span>`;
    }
    return `<a class="ssa-sticky-weather-badge" ${getWeatherLinkAttributes(region)} aria-label="${escapeHtml(label ? `${label}. Open detailed weather forecast` : 'Open detailed weather forecast')}">${content}</a>`;
  }

  function fmtRange(s, e){
    if (!s && !e) return '';
    if (s && !e) return s;
    if (!s && e) return e;
    return s === e ? s : `${s} – ${e}`;
  }

  function formatEventDate(dateString) {
    if (!dateString) return '';
    // Parse date in local timezone to avoid timezone shifts
    // Date strings like "2025-12-20" should be parsed as local dates, not UTC
    const date = parseLocalDate(dateString);
    if (!date) return '';
    
    // Get abbreviated day name
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Get abbreviated month name
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    
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

  function getMonthName(dateString) {
    if (!dateString) return 'TBA';
    // Parse date in local timezone to avoid timezone shifts
    const date = parseLocalDate(dateString);
    if (!date) return 'TBA';
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

  function isSignatureEvent(ev) {
    return ev.is_signature_event === true ||
           ev.is_signature_event === 'true' ||
           ev.is_signature_event === 1 ||
           (typeof ev.is_signature_event === 'string' && ev.is_signature_event.toLowerCase() === 'true');
  }

  function getEventKeywords(ev) {
    const keywordSet = new Set();
    if (ev.keywords && ev.keywords.length > 0) {
      ev.keywords.forEach(kw => {
        const normalized = (kw || '').toLowerCase().trim();
        if (normalized) keywordSet.add(normalized);
      });
    }
    if (isSignatureEvent(ev)) {
      keywordSet.add(SIGNATURE_EVENT_KEYWORD);
    }
    return Array.from(keywordSet).sort();
  }

  function getAllKeywords(rows) {
    const keywordSet = new Set();
    rows.forEach(ev => {
      getEventKeywords(ev).forEach(kw => keywordSet.add(kw));
    });
    return Array.from(keywordSet).sort();
  }

  // Calculate this weekend, starting with today once the weekend is underway.
  function getUpcomingWeekend() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    let startDate, sunday;
    
    if (dayOfWeek === 5) {
      // If today is Friday, use this weekend (today through Sunday)
      startDate = new Date(today);
      sunday = new Date(today);
      sunday.setDate(today.getDate() + 2); // This Sunday
    } else if (dayOfWeek === 6) {
      // If today is Saturday, show the remaining weekend (today through Sunday)
      startDate = new Date(today);
      sunday = new Date(today);
      sunday.setDate(today.getDate() + 1); // Tomorrow (Sunday)
    } else if (dayOfWeek === 0) {
      // If today is Sunday, show only the remaining day in this weekend
      startDate = new Date(today);
      sunday = new Date(today);
    } else {
      // Monday-Thursday: use this coming weekend
      const daysUntilFriday = 5 - dayOfWeek; // 1=Mon(4), 2=Tue(3), 3=Wed(2), 4=Thu(1)
      startDate = new Date(today);
      startDate.setDate(today.getDate() + daysUntilFriday);
      sunday = new Date(startDate);
      sunday.setDate(startDate.getDate() + 2); // Sunday (2 days after Friday)
    }
    
    // Format dates as YYYY-MM-DD using local time to avoid timezone issues
    function formatLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return {
      from: formatLocalDate(startDate),
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

  // Calculate current week dates (Monday to Sunday of the week containing today)
  function getUpcomingWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Calculate days back to Monday of the current week
    // If today is Sunday (0), Monday is 6 days ago
    // If today is Monday (1), Monday is today (0 days ago)
    // If today is Tuesday-Saturday (2-6), Monday is (dayOfWeek - 1) days ago
    let daysBackToMonday;
    if (dayOfWeek === 0) {
      daysBackToMonday = 6; // Monday is 6 days ago (last Monday)
    } else {
      daysBackToMonday = dayOfWeek - 1; // Days back to Monday of current week
    }
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysBackToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Sunday is 6 days after Monday
    
    // Format dates as YYYY-MM-DD using local time to avoid timezone issues
    function formatLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return {
      from: formatLocalDate(monday),
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

  /** Decode HTML entities from scraped titles (e.g. &#8211; → –). */
  function decodeHtmlEntities(text) {
    if (!text || text.indexOf('&') === -1) return text || '';
    const el = document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
  }

  /**
   * Normalize title for comparison: HTML entities, punctuation, spacing.
   * Treats "Rombauer Vineyards - Dinner" and "Rombauer Vineyards; Dinner" as equal.
   */
  function normalizeEventName(name) {
    return decodeHtmlEntities(name || '')
      .toLowerCase()
      .replace(/[''`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Normalize listing URL for dedup fingerprint (ignore www, trailing slash, query/hash). */
  function normalizeEventUrlForDedup(raw) {
    const s = (raw || '').trim();
    if (!s) return '';
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      const host = u.hostname.replace(/^www\./i, '').toLowerCase();
      const path = u.pathname.replace(/\/+$/, '') || '';
      return `${host}${path}`.toLowerCase();
    } catch {
      return s
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '')
        .split(/[?#]/)[0];
    }
  }

  function normalizeEventTime(value) {
    if (!value) return '';
    const part = String(value).trim().split(/[T\s]/).pop() || '';
    const match = part.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return part.slice(0, 5);
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  function scheduleFingerprint(ev) {
    const startDate = normalizeDateString(ev.start_date) || '';
    const endDate = normalizeDateString(ev.end_date) || startDate;
    return [
      startDate,
      endDate,
      normalizeEventTime(ev.start_time),
      normalizeEventTime(ev.end_time),
    ].join('|');
  }

  /**
   * Fingerprint near-duplicate events — common when the same listing is published
   * multiple times with scraped title variants (- vs ; vs |, HTML entities, etc.).
   *
   * Primary: same website URL + same date/time (title ignored when URL present).
   * Fallback: normalized title + schedule + location when no URL.
   */
  function dedupeFingerprint(ev) {
    const schedule = scheduleFingerprint(ev);
    const url = normalizeEventUrlForDedup(ev.website_url);
    if (url) return `url:${url}|${schedule}`;
    return `name:${normalizeEventName(ev.name)}|${schedule}|${normalizeEventName(ev.location || '')}`;
  }

  function unionEventKeywordsInto(target, source) {
    const merged = new Set(getEventKeywords(target));
    getEventKeywords(source).forEach((kw) => merged.add(kw));
    target.keywords = Array.from(merged).sort();
  }

  function scoreDuplicateEvent(ev) {
    return {
      kwCount: getEventKeywords(ev).length,
      descLen: (ev.description || '').length + (ev.short_description || '').length,
      cleanName: (ev.name || '').includes('&') ? 0 : 1,
    };
  }

  function pickBestDuplicateEvent(group) {
    const ranked = [...group].sort((a, b) => {
      const sa = scoreDuplicateEvent(a);
      const sb = scoreDuplicateEvent(b);
      if (sb.kwCount !== sa.kwCount) return sb.kwCount - sa.kwCount;
      if (sb.descLen !== sa.descLen) return sb.descLen - sa.descLen;
      if (sb.cleanName !== sa.cleanName) return sb.cleanName - sa.cleanName;
      return String(a.created_at || a.id).localeCompare(String(b.created_at || b.id));
    });
    const best = { ...ranked[0] };
    ranked.slice(1).forEach((other) => unionEventKeywordsInto(best, other));
    return best;
  }

  /**
   * Collapse duplicate published events. Keeps the richest row (most keywords,
   * then longest description) and merges keywords from dropped duplicates.
   */
  function dedupeEventsBySchedule(events) {
    const groups = new Map();
    (events || []).forEach((ev) => {
      const key = dedupeFingerprint(ev);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    });

    const deduped = [];
    let collapsed = 0;
    groups.forEach((group) => {
      if (group.length === 1) {
        deduped.push(group[0]);
        return;
      }
      collapsed += group.length - 1;
      deduped.push(pickBestDuplicateEvent(group));
    });

    if (collapsed > 0) {
      console.debug(`dedupeEventsBySchedule: collapsed ${collapsed} near-duplicate event(s)`);
    }
    return deduped;
  }

  function filterEventsByKeywords(events, selectedKeywords) {
    if (!selectedKeywords || selectedKeywords.length === 0) return events;
    // Normalize selected keywords to lowercase for consistent comparison
    const normalizedSelected = selectedKeywords.map(kw => (kw || '').toLowerCase().trim()).filter(kw => kw);
    return events.filter(ev => {
      // Normalize event keywords to lowercase for consistent comparison
      const normalizedEventKeywords = getEventKeywords(ev);
      if (normalizedEventKeywords.length === 0) return false;
      // AND logic: event must have ALL selected keywords
      return normalizedSelected.every(selectedKw => normalizedEventKeywords.includes(selectedKw));
    });
  }

  function filterEventsByDateRange(events, fromDate, toDate) {
    if (!fromDate && !toDate) return events;
    
    // Normalize date strings to YYYY-MM-DD format for consistent date-only comparison
    const normalizedFromDate = normalizeDateString(fromDate);
    const normalizedToDate = normalizeDateString(toDate);
    
    console.log('🔍 filterEventsByDateRange called:', {
      fromDate,
      toDate,
      normalizedFromDate,
      normalizedToDate,
      totalEvents: events.length
    });
    
    return events.filter(ev => {
      const startDate = normalizeDateString(ev.start_date);
      const endDate = normalizeDateString(ev.end_date);
      
      // Undated events: include them if no filters are set, otherwise exclude
      if (!startDate && !endDate) {
        return !normalizedFromDate && !normalizedToDate;
      }
      
      // Proper date range overlap logic:
      // An event overlaps with [fromDate, toDate] if:
      // event.start_date <= toDate AND event.end_date >= fromDate
      
      // Handle single-day events (no end_date)
      if (startDate && !endDate) {
        const eventDate = startDate;
        // Event overlaps if it falls within the range
        if (normalizedFromDate && normalizedToDate) {
          return eventDate >= normalizedFromDate && eventDate <= normalizedToDate;
        } else if (normalizedFromDate) {
          return eventDate >= normalizedFromDate;
        } else if (normalizedToDate) {
          return eventDate <= normalizedToDate;
        }
        return true;
      }
      
      // Handle events with end_date but no start_date (shouldn't happen, but handle it)
      if (!startDate && endDate) {
        const eventDate = endDate;
        if (normalizedFromDate && normalizedToDate) {
          return eventDate >= normalizedFromDate && eventDate <= normalizedToDate;
        } else if (normalizedFromDate) {
          return eventDate >= normalizedFromDate;
        } else if (normalizedToDate) {
          return eventDate <= normalizedToDate;
        }
        return true;
      }
      
      // Handle events with both start_date and end_date
      if (startDate && endDate) {
        // Event overlaps with [fromDate, toDate] if:
        // event.start_date <= toDate AND event.end_date >= fromDate
        if (normalizedFromDate && normalizedToDate) {
          // Both filters set: check for overlap
          const check1 = startDate <= normalizedToDate;
          const check2 = endDate >= normalizedFromDate;
          const overlaps = check1 && check2;
          // Debug logging for troubleshooting
          if (!overlaps && ev.name && (ev.name.toLowerCase().includes('irish') || ev.name.toLowerCase().includes('dancing'))) {
            console.log('🔍 Date overlap check (EXCLUDED):', {
              eventName: ev.name,
              startDate,
              endDate,
              normalizedFromDate,
              normalizedToDate,
              check1: `${startDate} <= ${normalizedToDate}`,
              check1Result: check1,
              check2: `${endDate} >= ${normalizedFromDate}`,
              check2Result: check2,
              overlaps
            });
          }
          if (overlaps && ev.name && (ev.name.toLowerCase().includes('irish') || ev.name.toLowerCase().includes('dancing'))) {
            console.log('✅ Date overlap check (INCLUDED):', {
              eventName: ev.name,
              startDate,
              endDate,
              normalizedFromDate,
              normalizedToDate,
              overlaps
            });
          }
          return overlaps;
        } else if (normalizedFromDate) {
          // Only fromDate: event must end on or after fromDate
          return endDate >= normalizedFromDate;
        } else if (normalizedToDate) {
          // Only toDate: event must start on or before toDate
          return startDate <= normalizedToDate;
        }
        return true;
      }
      
      // Fallback: include if we can't determine
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeEventUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function eventAppearsOnDate(event, dateKey) {
    if (!event.start_date || !dateKey) return false;
    const startDate = normalizeDateString(event.start_date);
    const endDate = normalizeDateString(event.end_date || event.start_date);
    return startDate && endDate && startDate <= dateKey && endDate >= dateKey;
  }

  function getCalendarEventsForDate(rows, state, dateKey) {
    const dateFilteredRows = filterEventsByDateRange(rows || [], state.fromDate || null, state.toDate || null);
    const keywordFilteredRows = filterEventsByKeywords(dateFilteredRows, state.selectedKeywords || []);
    return keywordFilteredRows
      .filter(event => eventAppearsOnDate(event, dateKey))
      .sort((a, b) => {
        const timeA = a.start_time || '99:99';
        const timeB = b.start_time || '99:99';
        return timeA.localeCompare(timeB) || (a.name || '').localeCompare(b.name || '');
      });
  }

  function formatAgendaTime(event) {
    if (!event.start_time && !event.end_time) return 'Time TBA';
    if (event.start_time && event.end_time) {
      return `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`;
    }
    return formatTime(event.start_time || event.end_time);
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

  function renderListLayout(events, state, weatherByDate = {}, weatherRegion = DEFAULT_WEATHER_REGION) {
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
        // Normalize date strings for comparison
        const normalizedFromDate = normalizeDateString(fromDate);
        const normalizedToDate = normalizeDateString(toDate);
        
        groups = groups.filter(dayKey => {
          if (dayKey === 'TBA') {
            // Include TBA only if no fromDate is set (or if explicitly allowed)
            return !normalizedFromDate;
          }
          
          // Check if the day falls within the date range (dayKey is already YYYY-MM-DD format)
          if (normalizedFromDate && dayKey < normalizedFromDate) return false;
          if (normalizedToDate && dayKey > normalizedToDate) return false;
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
      html += `<h3 class="${headerClass} ssa-list-date-anchor" data-current-date-label="${escapeHtml(headerText)}" data-date-key="${escapeHtml(groupKey)}">${headerText}</h3>`;
      if (groupBy === 'day' && weatherByDate[groupKey]) {
        html += renderWeatherSummary(weatherByDate[groupKey], weatherRegion);
      }
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
        } else {
          html += `<div class="ssa-event-image-wrapper ssa-event-image-placeholder" aria-hidden="true"></div>`;
        }
        
        // Event details on the right
        html += `<div class="ssa-event-details">`;
        html += `<span class="ssa-event-name-wrapper">`;
        
        // Info icon for description or URL
        const hasDescription = event.description && event.description.trim();
        html += `<span class="ssa-icon-group">`;
        if (hasDescription || hasWebsiteUrl) {
          const descriptionAttr = hasDescription ? `data-description="${event.description.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"` : '';
          const urlAttr = hasWebsiteUrl ? `data-website-url="${eventUrl}"` : '';
          const titleText = hasDescription ? 'Hover to view description' : 'Click to open event website';
          html += `<span class="ssa-info-icon" data-event-id="${eventId}" ${descriptionAttr} ${urlAttr} title="${titleText}"></span>`;
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
          html += `<div class="ssa-event-meta-item"><strong>Date:</strong> ${dateTimeDisplay}</div>`;
        }
        if (event.location) {
          html += `<div class="ssa-event-meta-item"><strong>Location:</strong> <span class="ssa-location" data-location="${event.location.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" title="Click to get directions">${event.location}</span></div>`;
        }
        if (event.host_org) {
          html += `<div class="ssa-event-meta-item"><strong>Host:</strong> ${event.host_org}</div>`;
        }
        html += `</div>`;
        html += `</div>`;
        
        // Keywords on their own line
        const eventKeywords = getEventKeywords(event);
        if (eventKeywords.length > 0) {
          html += `<div class="ssa-event-keywords">`;
          html += eventKeywords.map(kw => {
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

  function formatFilterDateLabel(dateString) {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    if (!date) return dateString;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getLayoutSummary(layout, groupBy) {
    if (layout === LAYOUTS.GRID) return 'Grid view · 3 columns';
    if (layout === LAYOUTS.CALENDAR) return 'Calendar view';
    return `List view · grouped by ${groupBy || 'day'}`;
  }

  function getLayoutButtonLabel(layout) {
    if (layout === LAYOUTS.GRID) return 'Grid view';
    if (layout === LAYOUTS.CALENDAR) return 'Calendar view';
    return 'List view';
  }

  function getLayoutSupplementLabel(layout, groupBy) {
    if (layout === LAYOUTS.GRID) return '3 columns';
    if (layout === LAYOUTS.CALENDAR) return 'Calendar';
    return `Grouped by ${groupBy || 'day'}`;
  }

  function getNextLayout(layout) {
    if (layout === LAYOUTS.LIST) return LAYOUTS.GRID;
    if (layout === LAYOUTS.GRID) return LAYOUTS.CALENDAR;
    return LAYOUTS.LIST;
  }

  function renderActiveFilters(state, extraClass = '') {
    const chips = [];
    (state.selectedKeywords || []).forEach(kw => {
      chips.push(`<button class="ssa-active-filter-chip" data-chip-type="keyword" data-keyword="${kw}">${kw}<span aria-hidden="true">×</span></button>`);
    });
    if (state.fromDate) {
      chips.push(`<button class="ssa-active-filter-chip" data-chip-type="from">From ${formatFilterDateLabel(state.fromDate)}<span aria-hidden="true">×</span></button>`);
    }
    if (state.toDate) {
      chips.push(`<button class="ssa-active-filter-chip" data-chip-type="to">To ${formatFilterDateLabel(state.toDate)}<span aria-hidden="true">×</span></button>`);
    }
    if (!chips.length) return '';
    return `<div class="ssa-active-filters${extraClass ? ` ${extraClass}` : ''}"><span>Showing:</span>${chips.join('')}</div>`;
  }

  function syncStickyControlOffsets(mount) {
    const update = () => {
      const compactShell = mount.querySelector('.ssa-compact-filter-shell');
      const dateSection = mount.querySelector('.ssa-sticky-date-section');
      const viewSection = mount.querySelector('.ssa-sticky-view-section');
      const keywordSection = mount.querySelector('.ssa-sticky-keyword-section');
      if (!dateSection) return;
      const compactShellRect = compactShell ? compactShell.getBoundingClientRect() : null;
      const compactShellIsStuck = !!compactShellRect && compactShellRect.top <= 1;
      if (compactShell) compactShell.classList.toggle('ssa-is-stuck', compactShellIsStuck);
      const dateRect = dateSection.getBoundingClientRect();
      const dateIsStuck = compactShellIsStuck || dateRect.top <= 1;
      dateSection.classList.toggle('ssa-is-stuck', dateIsStuck);

      const height = Math.ceil(dateSection.getBoundingClientRect().height);
      mount.style.setProperty('--ssa-sticky-date-height', `${height}px`);

      if (viewSection) {
        const viewRect = viewSection.getBoundingClientRect();
        const isLargeCompact = window.matchMedia && window.matchMedia('(min-width: 1120px)').matches;
        const viewStickyTop = isLargeCompact ? 0 : height + 8;
        viewSection.classList.toggle('ssa-is-stuck', compactShellIsStuck || viewRect.top <= viewStickyTop + 1);
        const viewHeight = Math.ceil(viewSection.getBoundingClientRect().height);
        mount.style.setProperty('--ssa-sticky-view-height', `${viewHeight}px`);

        if (keywordSection) {
          const keywordRect = keywordSection.getBoundingClientRect();
          const keywordStickyTop = height + (isLargeCompact ? 0 : viewHeight) + 16;
          keywordSection.classList.toggle('ssa-is-stuck', keywordRect.top <= keywordStickyTop + 1);
        }
      }

      syncStickyCurrentDate(mount, dateIsStuck || compactShellIsStuck);
      if (viewSection) {
        mount.style.setProperty('--ssa-sticky-view-height', `${Math.ceil(viewSection.getBoundingClientRect().height)}px`);
      }
    };
    const scheduleUpdate = () => requestAnimationFrame(update);
    scheduleUpdate();
    clearTimeout(mount._stickyOffsetStabilizeTimer1);
    clearTimeout(mount._stickyOffsetStabilizeTimer2);
    clearTimeout(mount._stickyOffsetStabilizeTimer3);
    mount._stickyOffsetStabilizeTimer1 = setTimeout(scheduleUpdate, 90);
    mount._stickyOffsetStabilizeTimer2 = setTimeout(scheduleUpdate, 190);
    mount._stickyOffsetStabilizeTimer3 = setTimeout(scheduleUpdate, 340);
    if (!mount._stickyOffsetResizeHandler) {
      mount._stickyOffsetResizeHandler = scheduleUpdate;
      window.addEventListener('resize', mount._stickyOffsetResizeHandler, { passive: true });
    }
    if (!mount._stickyOffsetScrollHandler) {
      mount._stickyOffsetScrollHandler = scheduleUpdate;
      window.addEventListener('scroll', mount._stickyOffsetScrollHandler, { passive: true });
    }
  }

  function syncStickyCurrentDate(mount, controlsAreStuck) {
    const state = mount._currentState || {};
    const readout = mount.querySelector('.ssa-sticky-current-date');
    if (!readout) return;

    const isListView = (state.layout || LAYOUTS.LIST) === LAYOUTS.LIST;
    if (!controlsAreStuck || !isListView) {
      readout.innerHTML = '';
      readout.classList.remove('ssa-sticky-current-date-visible');
      return;
    }

    const headers = Array.from(mount.querySelectorAll('.ssa-list-date-anchor'));
    if (!headers.length) {
      readout.innerHTML = '';
      readout.classList.remove('ssa-sticky-current-date-visible');
      return;
    }

    const shell = mount.querySelector('.ssa-compact-filter-shell');
    const anchorY = shell ? shell.getBoundingClientRect().bottom + 8 : 120;
    let activeHeader = headers[0];
    headers.forEach(header => {
      if (header.getBoundingClientRect().top <= anchorY) {
        activeHeader = header;
      }
    });

    const label = activeHeader.dataset.currentDateLabel || activeHeader.textContent.trim();
    const dateKey = activeHeader.dataset.dateKey;
    if (!label) {
      readout.innerHTML = '';
      readout.classList.remove('ssa-sticky-current-date-visible');
      return;
    }

    const weather = dateKey && mount._weatherByDate ? mount._weatherByDate[dateKey] : null;
    if (weather) {
      const weatherBadge = renderStickyWeatherBadge(weather, mount._weatherRegion, false);
      const labelText = `${label}. ${weather.condition || 'Weather forecast'}. Open detailed weather forecast`;
      readout.innerHTML = `<a class="ssa-sticky-current-date-link" ${getWeatherLinkAttributes(mount._weatherRegion)} aria-label="${escapeHtml(labelText)}"><span class="ssa-sticky-current-date-label">${escapeHtml(label)}</span>${weatherBadge}</a>`;
    } else {
      readout.innerHTML = `<span class="ssa-sticky-current-date-label">${escapeHtml(label)}</span>`;
    }
    readout.classList.add('ssa-sticky-current-date-visible');
  }

  function renderGridLayout(events, state) {
    if (events.length === 0) {
      return '<div class="ssa-empty">No events found.</div>';
    }

    const selectedKeywords = state?.selectedKeywords || [];
    const showImages = state?.showImages !== undefined ? state.showImages : true;
    const cards = events.map(ev => {
      const hasImageUrl = ev.image_url && ev.image_url.trim();
      const showImage = hasImageUrl && showImages;
      const imageUrl = hasImageUrl ? ev.image_url.trim() : '';
      const imageStyle = showImage ? `style="--card-bg-image: url('${imageUrl.replace(/'/g, "\\'")}');"` : '';
      const eventId = ev.id ? `event-${ev.id}` : `event-${btoa(ev.name + (ev.start_date || '')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`;
      const hasDescription = ev.description && ev.description.trim();
      const hasWebsiteUrl = ev.website_url && ev.website_url.trim();
      let eventUrl = hasWebsiteUrl ? ev.website_url.trim() : '';
      if (eventUrl && !eventUrl.match(/^https?:\/\//i)) {
        eventUrl = 'https://' + eventUrl;
      }
      if (eventUrl) {
        eventUrl = eventUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }
      return `
      <article class="ssa-card" ${showImage ? `data-has-image="true"` : ''} ${imageStyle}>
        <div class="ssa-card-content">
        <header class="ssa-card-head">
          ${showImage ? `<div class="ssa-card-image-icon" data-event-id="${eventId}" data-image-url="${imageUrl}" title="Click to preview image"><img src="${imageUrl}" alt="${ev.name}" class="ssa-card-icon-thumb" /></div>` : ''}
          <h3 class="ssa-title">
            <span class="ssa-icon-group">
              ${hasDescription || hasWebsiteUrl ? (() => {
                const descriptionAttr = hasDescription ? `data-description="${ev.description.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"` : '';
                const urlAttr = hasWebsiteUrl ? `data-website-url="${eventUrl}"` : '';
                const titleText = hasDescription ? 'Hover to view description' : 'Click to open event website';
                return `<span class="ssa-info-icon" data-event-id="${eventId}" ${descriptionAttr} ${urlAttr} title="${titleText}"></span>`;
              })() : ''}
              ${hasImageUrl ? `<span class="ssa-image-icon-btn" data-event-id="${eventId}" data-image-url="${imageUrl}" title="Tap to view image">🖼️</span>` : ''}
                ${ev.location ? `<span class="ssa-location-icon-btn" data-location="${ev.location.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" title="Tap to view map">📍</span>` : ''}
              </span>
              ${ev.website_url ? (() => {
                let url = ev.website_url.trim();
                // Normalize URL: if it doesn't start with http:// or https://, prepend https://
                if (!url.match(/^https?:\/\//i)) {
                  url = 'https://' + url;
                }
                // Escape for HTML
                url = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                return `<a href="${url}" class="ssa-event-link" target="_blank" rel="noopener">${ev.name}</a>`;
              })() : `<span class="ssa-event-name">${ev.name}</span>`}
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
          ${(() => {
            const eventKeywords = getEventKeywords(ev);
            return eventKeywords.length > 0 ? `<p class="ssa-keywords">${eventKeywords.map(kw => {
            const isSelected = selectedKeywords.includes(kw);
            return `<span class="ssa-tag-clickable ${isSelected ? 'ssa-tag-active' : ''}" data-keyword="${kw}">${kw}</span>`;
            }).join('')}</p>` : '';
          })()}
        </div>
      </article>
    `;
    }).join('');

    return `<div class="ssa-grid">${cards}</div>`;
  }

  function renderCalendarLayout(events, state) {
    const { fromDate = null, toDate = null } = state;
    const normalizedFromDate = normalizeDateString(fromDate);
    const normalizedToDate = normalizeDateString(toDate);
    const rangeStart = normalizedFromDate ? parseLocalDate(normalizedFromDate) : null;
    const rangeEnd = normalizedToDate ? parseLocalDate(normalizedToDate) : null;
    const eventsByDate = {};
    let firstEventDate = null;
    let lastEventDate = null;

    function rememberEventDate(date) {
      if (!firstEventDate || date < firstEventDate) firstEventDate = new Date(date);
      if (!lastEventDate || date > lastEventDate) lastEventDate = new Date(date);
    }

    events.forEach(event => {
      if (!event.start_date) return;

      const startDate = parseLocalDate(event.start_date);
      const endDate = event.end_date ? parseLocalDate(event.end_date) : startDate;
      if (!startDate) return;

      const clippedStart = rangeStart && startDate < rangeStart ? new Date(rangeStart) : new Date(startDate);
      const clippedEnd = rangeEnd && endDate > rangeEnd ? new Date(rangeEnd) : new Date(endDate);
      if (clippedEnd < clippedStart) return;

      const currentDate = new Date(clippedStart);
      while (currentDate <= clippedEnd) {
        const dateKey = formatLocalDateString(currentDate);
        if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
        if (!eventsByDate[dateKey].some(e => e.id === event.id)) {
          eventsByDate[dateKey].push({
            ...event,
            _dateKey: dateKey
          });
        }
        rememberEventDate(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    let firstMonthDate = firstEventDate;
    let lastMonthDate = lastEventDate;

    if (!firstMonthDate || !lastMonthDate) {
      if (rangeStart) {
        firstMonthDate = rangeStart;
        lastMonthDate = rangeEnd || rangeStart;
      } else if (rangeEnd) {
        firstMonthDate = rangeEnd;
        lastMonthDate = rangeEnd;
      } else {
        firstMonthDate = new Date();
        lastMonthDate = firstMonthDate;
      }
    }

    const firstMonth = new Date(firstMonthDate.getFullYear(), firstMonthDate.getMonth(), 1);
    const lastMonth = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
    const monthDates = [];
    const cursor = new Date(firstMonth);
    while (cursor <= lastMonth) {
      monthDates.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    function renderCalendarMonth(displayDate) {
      const year = displayDate.getFullYear();
      const month = displayDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday

      const monthName = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      let html = `<div class="ssa-calendar-container">`;
      html += `<h3 class="ssa-calendar-month-header">${monthName}</h3>`;
      html += `<div class="ssa-calendar-grid">`;

      const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      dayHeaders.forEach(day => {
        html += `<div class="ssa-calendar-day-header">${day}</div>`;
      });

      for (let i = 0; i < startingDayOfWeek; i++) {
        html += `<div class="ssa-calendar-day ssa-calendar-day-empty"></div>`;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isBeforeRange = normalizedFromDate && dateKey < normalizedFromDate;
        const isAfterRange = normalizedToDate && dateKey > normalizedToDate;
        const isOutOfRange = Boolean(isBeforeRange || isAfterRange);
        const dayEvents = isOutOfRange ? [] : (eventsByDate[dateKey] || []);
        const outOfRangeClass = isOutOfRange ? ' ssa-calendar-day-out-of-range' : '';
        const hasEventsClass = dayEvents.length > 0 ? ' ssa-calendar-day-has-events' : '';

        html += `<div class="ssa-calendar-day${outOfRangeClass}${hasEventsClass}" data-date="${dateKey}">`;
        html += `<div class="ssa-calendar-day-number">${day}</div>`;

        if (dayEvents.length > 0) {
          const previewEvents = dayEvents.slice(0, 2);
          html += `<button class="ssa-calendar-day-agenda-trigger" data-date="${dateKey}" type="button" aria-label="Open ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'} on ${formatDayHeader(dateKey)}">`;
          html += `<span class="ssa-calendar-event-count">${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}</span>`;
          html += `<span class="ssa-calendar-event-preview-list">`;
          previewEvents.forEach(event => {
            html += `<span class="ssa-calendar-event-preview">${escapeHtml(event.name || 'Untitled event')}</span>`;
          });
          if (dayEvents.length > previewEvents.length) {
            html += `<span class="ssa-calendar-event-more">+${dayEvents.length - previewEvents.length} more</span>`;
          }
          html += `</span></button>`;
        }

        html += `</div>`;
      }

      const totalCells = startingDayOfWeek + daysInMonth;
      const remainingCells = 42 - totalCells; // 6 rows * 7 days = 42 cells
      for (let i = 0; i < remainingCells && totalCells + i < 42; i++) {
        html += `<div class="ssa-calendar-day ssa-calendar-day-empty"></div>`;
      }

      html += `</div></div>`;
      return html;
    }

    return monthDates.map(renderCalendarMonth).join('');
  }

  async function renderEvents(mount, rows, state) {
    const { layout = LAYOUTS.LIST, selectedKeywords = [], fromDate = null, toDate = null, groupBy = 'day', showImages = true } = state;
    
    // Store state on mount for handlers
    mount._currentState = state;
    
    // Use the rows parameter (most recent data) if it has events, otherwise fall back to mount._allRows
    // Always prefer the rows parameter since it's the most recent data passed to renderEvents
    // Update mount._allRows to keep it in sync for event handlers
    const sourceRows = rows && rows.length > 0 ? rows : (mount._allRows || []);
    const allAvailableRows = dedupeEventsBySchedule(sourceRows);
    
    // Keep mount._allRows in sync if rows is provided and different
    if (allAvailableRows.length > 0 && allAvailableRows !== mount._allRows) {
      mount._allRows = allAvailableRows;
    }
    
    // Apply all filters to get the final set of displayed events
    const dateFilteredRows = filterEventsByDateRange(allAvailableRows, fromDate, toDate);
    let filteredRows = filterEventsByKeywords(dateFilteredRows, selectedKeywords);
    
    // Get keywords only from events that match the date filters (not keyword filters)
    // This allows users to see what keywords are available to filter by for the selected date range
    // If we used filteredRows (after keyword filtering), users would only see keywords that co-occur
    // with already-selected keywords, which would be confusing
    const allKeywords = getAllKeywords(dateFilteredRows);
    const weatherByDate = layout === LAYOUTS.LIST && groupBy === 'day'
      ? await fetchRegionalWeather(mount._weatherRegion)
      : {};
    mount._weatherByDate = weatherByDate;
    
    // Debug logging to help diagnose keyword cloud updates
    console.log('🔍 Keyword cloud update:', {
      rowsParamLength: rows.length,
      allAvailableRowsLength: allAvailableRows.length,
      dateFilteredRowsLength: dateFilteredRows.length,
      filteredRowsLength: filteredRows.length,
      allKeywordsCount: allKeywords.length,
      allKeywords: allKeywords,
      fromDate,
      toDate,
      hasMountAllRows: !!mount._allRows,
      mountAllRowsLength: mount._allRows ? mount._allRows.length : 0,
      sampleEventKeywords: dateFilteredRows.length > 0 ? getEventKeywords(dateFilteredRows[0]) : 'no keywords',
      sampleEventName: dateFilteredRows.length > 0 ? dateFilteredRows[0].name : 'no events',
      eventsWithKeywords: dateFilteredRows.filter(ev => getEventKeywords(ev).length > 0).length
    });
    
    // Render page intro and controls
    const pageHeaderHTML = `
      <section class="ssa-page-intro">
        <div class="ssa-page-intro-head">
          <div class="ssa-brand-block">
            <a class="ssa-brand-mark" href="${SSA_HOME_URL}" aria-label="Visit the Sports Car Adventures home page">
              <img src="${SSA_LOGO_URL}" alt="Sports Car Adventures" width="72" height="72" loading="lazy" decoding="async" />
            </a>
            <p class="ssa-brand-tagline">Drive the Sierra like a local.</p>
          </div>
          <div class="ssa-page-intro-copy">
            <h1>Gold Country Events</h1>
            <p>Drive-worthy happenings in Amador, El Dorado, and nearby foothill country.</p>
            <p class="ssa-page-intro-credit">Brought to you by <a href="${SSA_HOME_URL}" target="_blank" rel="noopener noreferrer">Sports Car Adventures</a></p>
          </div>
        </div>
      </section>
    `;

    const isDarkMode = document.body && document.body.classList.contains('dark-mode');

    let controlsHTML = '<section class="ssa-controls ssa-controls-intro" aria-label="Event filters">';
    controlsHTML += '<div class="ssa-controls-heading">';
    controlsHTML += '<div class="ssa-controls-heading-top">';
    controlsHTML += '<span>Filters</span>';
    controlsHTML += '<button class="ssa-dark-mode-toggle" title="Toggle dark mode" aria-label="Toggle dark mode"><span class="ssa-theme-icon" aria-hidden="true"></span><span class="ssa-theme-text">' + (isDarkMode ? 'Light' : 'Dark') + '</span></button>';
    controlsHTML += '</div>';
    controlsHTML += '<h2>Narrow the calendar</h2>';
    controlsHTML += `<p>Use date presets, keywords, or layout options. ${layout === LAYOUTS.CALENDAR ? 'Click a day to see events.' : 'Active filters appear above the results.'}</p>`;
    controlsHTML += '</div>';
    controlsHTML += '</section>';

    // Date range filters (prominent section)
    let dateControlsHTML = '<section class="ssa-control-panel ssa-date-filters-section ssa-sticky-control-section ssa-sticky-date-section" aria-label="Date filters">';
    dateControlsHTML += '<div class="ssa-date-filters">';
    dateControlsHTML += '<div class="ssa-date-labels-row">';
    dateControlsHTML += '<span class="ssa-date-label">From</span>';
    dateControlsHTML += '<span class="ssa-date-label">To</span>';
    dateControlsHTML += `<button type="button" class="ssa-date-clear-btn ssa-clear-to-date" title="Clear To date and edit From date" aria-label="Clear To date and edit From date"></button>`;
    dateControlsHTML += '</div>';
    dateControlsHTML += '<div class="ssa-date-inputs-row">';
    dateControlsHTML += `<input type="date" class="ssa-date-input ssa-from-date-input" id="ssa-from-date" aria-label="From date" value="${fromDate || ''}">`;
    dateControlsHTML += `<input type="date" class="ssa-date-input ssa-to-date-input" id="ssa-to-date" aria-label="To date" value="${toDate || ''}" placeholder="Open">`;
    dateControlsHTML += '</div>';
    dateControlsHTML += '</div>';
    dateControlsHTML += '</section>';

    const selectedKeywordSet = new Set(selectedKeywords);
    const selectedKeywordRows = allKeywords.filter(kw => selectedKeywordSet.has(kw));
    const layoutLabel = layout === LAYOUTS.GRID ? 'Grid' : layout === LAYOUTS.CALENDAR ? 'Calendar' : 'List';
    const groupLabel = (groupBy || 'day') === 'month' ? 'Group by Month' : 'Group by Day';
    const keywordLabel = selectedKeywordRows.length ? `Keywords ${selectedKeywordRows.length}` : 'Keywords';

    let viewControlsHTML = '<section class="ssa-control-panel ssa-view-controls-section ssa-sticky-control-section ssa-sticky-view-section" aria-label="Filter controls">';
    viewControlsHTML += '<div class="ssa-filter-toolbar">';
    viewControlsHTML += '<details class="ssa-filter-menu ssa-preset-menu">';
    viewControlsHTML += '<summary>Date Presets</summary>';
    viewControlsHTML += '<div class="ssa-filter-menu-panel">';
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-this-weekend-btn" title="Set date range to upcoming weekend">This Weekend</button>`;
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-next-weekend-btn" title="Set date range to next weekend">Next Weekend</button>`;
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-this-week-btn" title="Set date range to current week (Monday to Sunday)">This Week</button>`;
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-clear-dates" title="Clear all filters" aria-label="Clear all filters">Clear Filters</button>`;
    viewControlsHTML += '</div>';
    viewControlsHTML += '</details>';
    viewControlsHTML += '<details class="ssa-filter-menu ssa-view-menu">';
    viewControlsHTML += `<summary>${layoutLabel} View</summary>`;
    viewControlsHTML += '<div class="ssa-filter-menu-panel">';
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-layout-btn ${layout === LAYOUTS.LIST ? 'ssa-active' : ''}" data-layout="${LAYOUTS.LIST}"><span class="ssa-layout-icon ssa-layout-icon-list" aria-hidden="true"></span>List</button>`;
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-layout-btn ${layout === LAYOUTS.GRID ? 'ssa-active' : ''}" data-layout="${LAYOUTS.GRID}"><span class="ssa-layout-icon ssa-layout-icon-grid" aria-hidden="true"></span>Grid</button>`;
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-layout-btn ${layout === LAYOUTS.CALENDAR ? 'ssa-active' : ''}" data-layout="${LAYOUTS.CALENDAR}"><span class="ssa-layout-icon ssa-layout-icon-calendar" aria-hidden="true"></span>Calendar</button>`;
    viewControlsHTML += '</div>';
    viewControlsHTML += '</details>';
    viewControlsHTML += '<details class="ssa-filter-menu ssa-group-menu">';
    viewControlsHTML += `<summary>${groupLabel}</summary>`;
    viewControlsHTML += '<div class="ssa-filter-menu-panel">';
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-group-btn ${groupBy === 'day' ? 'ssa-active' : ''}" data-group="day"><span class="ssa-group-icon ssa-group-icon-day" aria-hidden="true"></span>Group by Day</button>`;
    viewControlsHTML += `<button class="ssa-filter-menu-item ssa-group-btn ${groupBy === 'month' ? 'ssa-active' : ''}" data-group="month"><span class="ssa-group-icon ssa-group-icon-month" aria-hidden="true"></span>Group by Month</button>`;
    viewControlsHTML += '</div>';
    viewControlsHTML += '</details>';
    if (allKeywords.length > 0) {
      viewControlsHTML += '<details class="ssa-filter-menu ssa-keyword-menu">';
      viewControlsHTML += `<summary>${keywordLabel}</summary>`;
      viewControlsHTML += '<div class="ssa-filter-menu-panel ssa-keyword-menu-panel">';
      allKeywords.forEach(kw => {
        const isSelected = selectedKeywordSet.has(kw);
        viewControlsHTML += `<button class="ssa-filter-menu-item ssa-keyword-btn ${isSelected ? 'ssa-keyword-active' : ''}" data-keyword="${kw}"><span class="ssa-menu-check" aria-hidden="true">${isSelected ? '✓' : ''}</span>${kw}</button>`;
      });
      viewControlsHTML += '</div>';
      viewControlsHTML += '</details>';
    }
    viewControlsHTML += '</div>';
    viewControlsHTML += '</section>';

    let stickyMetaHTML = '<div class="ssa-sticky-meta-stack">';
    stickyMetaHTML += '<section class="ssa-sticky-filter-summary" aria-label="Current filter summary">';
    stickyMetaHTML += `<p class="ssa-sticky-status" aria-label="${filteredRows.length} ${filteredRows.length === 1 ? 'event' : 'events'} in current selection"><span class="ssa-sticky-current-date" aria-live="polite"></span><span class="ssa-selection-count">${filteredRows.length} ${filteredRows.length === 1 ? 'event' : 'events'}</span></p>`;
    stickyMetaHTML += '<div class="ssa-selected-keyword-row ssa-sticky-selected-keywords" aria-label="Selected keywords">';
    if (selectedKeywordRows.length > 0) {
      selectedKeywordRows.forEach(kw => {
        stickyMetaHTML += `<button class="ssa-keyword-btn ssa-keyword-active ssa-keyword-remove-btn" data-keyword="${kw}">${kw}<span class="ssa-keyword-remove-icon" aria-hidden="true">×</span></button>`;
      });
    }
    stickyMetaHTML += '</div>';
    stickyMetaHTML += '</section>';
    stickyMetaHTML += '</div>';

    const footerHTML = '<p class="ssa-events-footnote">Confirm dates and ticketing with organizers before driving out.</p>';
    
    // Render events based on layout
    let eventsHTML = '';
    if (layout === LAYOUTS.LIST) {
      eventsHTML = renderListLayout(filteredRows, state, weatherByDate, mount._weatherRegion);
    } else if (layout === LAYOUTS.GRID) {
      eventsHTML = renderGridLayout(filteredRows, state);
    } else if (layout === LAYOUTS.CALENDAR) {
      eventsHTML = renderCalendarLayout(filteredRows, state);
    }
    
    mount.innerHTML = pageHeaderHTML + controlsHTML + `<div class="ssa-compact-filter-shell">${dateControlsHTML + viewControlsHTML + stickyMetaHTML}</div>` + eventsHTML + footerHTML;
    syncStickyControlOffsets(mount);
    
    // Verify keyword cloud was rendered
    const keywordCloud = mount.querySelector('.ssa-keyword-filters');
    console.log('✅ Keyword cloud rendered:', keywordCloud ? 'YES' : 'NO', keywordCloud ? `(${keywordCloud.querySelectorAll('.ssa-keyword-btn').length} buttons)` : '');
    
    // Initialize dark mode toggle (wrap in try-catch to prevent breaking event loading)
    try {
      initDarkModeToggle();
    } catch (e) {
      console.error('Error initializing dark mode toggle:', e);
    }
    
    // Attach event handlers
    // Use mount._allRows if available (contains all fetched events), otherwise use the rows parameter
    // This ensures event handlers have access to all events for filtering
    const allRowsForHandlers = mount._allRows || rows;
    attachEventHandlers(mount, allRowsForHandlers, state);
    
    // Inject styles if not already present
    injectStyles();
  }

  function attachEventHandlers(mount, rows, state) {
    const getState = () => mount._currentState || state
    const commitState = (nextState) => {
      mount._currentState = nextState
      return nextState
    }

    mount.querySelectorAll('.ssa-filter-menu').forEach(menu => {
      menu.addEventListener('toggle', function() {
        if (!this.open) return;
        mount.querySelectorAll('.ssa-filter-menu[open]').forEach(otherMenu => {
          if (otherMenu !== this) otherMenu.open = false;
        });
      });
    });

    mount.querySelectorAll('.ssa-filter-menu button').forEach(btn => {
      btn.addEventListener('click', function() {
        const menu = this.closest('.ssa-filter-menu');
        if (menu) menu.open = false;
      });
    });

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

    mount.querySelectorAll('.ssa-sticky-layout-cycle').forEach(btn => {
      btn.addEventListener('click', async function() {
        const newLayout = getNextLayout(state.layout || LAYOUTS.LIST);
        await renderEvents(mount, rows, { ...state, layout: newLayout });
      });
    });

    mount.querySelectorAll('.ssa-sticky-group-cycle').forEach(btn => {
      btn.addEventListener('click', async function() {
        const newGroupBy = (state.groupBy || 'day') === 'day' ? 'month' : 'day';
        await renderEvents(mount, rows, { ...state, groupBy: newGroupBy });
      });
    });
    
    // Keyword filter buttons
    mount.querySelectorAll('.ssa-keyword-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        // Normalize keyword to lowercase for consistent storage and comparison
        const keyword = (this.dataset.keyword || '').toLowerCase().trim();
        if (!keyword) return;
        
        const isCurrentlySelected = state.selectedKeywords.includes(keyword);
        
        const newSelected = isCurrentlySelected
          ? state.selectedKeywords.filter(k => k !== keyword)
          : [...state.selectedKeywords, keyword];
        this.blur();
        await renderEvents(mount, rows, { ...state, selectedKeywords: newSelected });
      });
    });

    // Active filter chips
    mount.querySelectorAll('.ssa-active-filter-chip').forEach(chip => {
      chip.addEventListener('click', async function() {
        const chipType = this.dataset.chipType;
        const currentState = getState();
        let newState = { ...currentState };
        if (chipType === 'keyword') {
          const keyword = (this.dataset.keyword || '').toLowerCase().trim();
          newState.selectedKeywords = (currentState.selectedKeywords || []).filter(k => k !== keyword);
        } else if (chipType === 'from') {
          newState.fromDate = null;
        } else if (chipType === 'to') {
          newState.toDate = null;
        }
        newState = commitState(newState);
        if (chipType === 'from' || chipType === 'to') {
          await rerenderForDateChange(newState);
        } else {
          await renderEvents(mount, rows, newState);
        }
      });
    });
    
    // Date inputs
    const fromInputs = Array.from(mount.querySelectorAll('.ssa-from-date-input'));
    const toInputs = Array.from(mount.querySelectorAll('.ssa-to-date-input'));
    const fromInput = fromInputs[0];
    const toInput = toInputs[0];
    const setFromInputs = value => fromInputs.forEach(input => { input.value = value || ''; });
    const setToInputs = value => toInputs.forEach(input => { input.value = value || ''; });
    const clampToDate = nextState => {
      const normalizedFrom = normalizeDateString(nextState.fromDate);
      const normalizedTo = normalizeDateString(nextState.toDate);
      if (normalizedFrom && normalizedTo && normalizedTo < normalizedFrom) {
        return { ...nextState, toDate: normalizedFrom };
      }
      return nextState;
    };
    const openFromDatePicker = () => {
      const nextFromInput = mount.querySelector('.ssa-from-date-input');
      if (!nextFromInput) return;
      nextFromInput.focus({ preventScroll: true });
      if (typeof nextFromInput.showPicker === 'function') {
        try {
          nextFromInput.showPicker();
          return;
        } catch (err) {
          console.debug('Date picker could not be opened programmatically:', err);
        }
      }
      nextFromInput.click();
    };
    const rerenderForDateChange = async (newState, sourceRows = rows) => {
      if (mount._widgetOpts) {
        await reloadEvents(mount, newState, mount._widgetOpts);
      } else {
        await renderEvents(mount, sourceRows, newState);
      }
      scrollToResultsStart(mount);
    };
    
    fromInputs.forEach(input => {
      input.addEventListener('change', async function() {
        const newFromDate = this.value || null;
        const newState = commitState(clampToDate({ ...getState(), fromDate: newFromDate }));
        setToInputs(newState.toDate);
        await rerenderForDateChange(newState);
      });
    });
    
    toInputs.forEach(input => {
      input.addEventListener('change', async function() {
        const newToDate = this.value || null;
        const newState = commitState(clampToDate({ ...getState(), toDate: newToDate }));
        setToInputs(newState.toDate);
        await rerenderForDateChange(newState);
      });
    });
    
    mount.querySelectorAll('.ssa-clear-to-date').forEach(clearToDateBtn => {
      clearToDateBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const currentState = getState();
        const newState = commitState({ ...currentState, toDate: null });
        await rerenderForDateChange(newState);
        openFromDatePicker();
      });
    });
    
    mount.querySelectorAll('.ssa-clear-dates').forEach(clearDatesBtn => {
      clearDatesBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        const newState = commitState({ ...getState(), toDate: null, selectedKeywords: [] });
        await rerenderForDateChange(newState);
      });
    });
    
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
    // Weekend button handlers
    mount.querySelectorAll('.ssa-this-weekend-btn').forEach(weekendBtn => {
      weekendBtn.addEventListener('click', async function() {
        const weekend = getUpcomingWeekend();
        const newState = { ...state, fromDate: weekend.from, toDate: weekend.to };
        console.log('📅 This Weekend clicked:', { weekend, newState, hasWidgetOpts: !!mount._widgetOpts });
        // Update the input values
        setFromInputs(weekend.from);
        setToInputs(weekend.to);
        // Reload events with weekend filter
        console.log('🔄 Calling date-range render');
        await rerenderForDateChange(newState, mount._allRows || rows);
      });
    });
    
    // Next weekend button handler
    mount.querySelectorAll('.ssa-next-weekend-btn').forEach(nextWeekendBtn => {
      nextWeekendBtn.addEventListener('click', async function() {
        const weekend = getNextWeekend();
        console.log('📅 Next Weekend clicked:', { weekend, calculatedDates: weekend });
        const newState = { ...state, fromDate: weekend.from, toDate: weekend.to };
        console.log('📅 Next Weekend state:', { newState, fromDate: newState.fromDate, toDate: newState.toDate });
        // Update the input values
        setFromInputs(weekend.from);
        setToInputs(weekend.to);
        // Reload events with next weekend filter
        console.log('🔄 Calling date-range render for Next Weekend');
        await rerenderForDateChange(newState, mount._allRows || rows);
      });
    });
    
    // This Week button handler
    mount.querySelectorAll('.ssa-this-week-btn').forEach(thisWeekBtn => {
      thisWeekBtn.addEventListener('click', async function() {
        const week = getUpcomingWeek();
        const newState = { ...state, fromDate: week.from, toDate: week.to };
        console.log('📆 This Week clicked:', { week, newState, hasWidgetOpts: !!mount._widgetOpts });
        // Update the input values
        setFromInputs(week.from);
        setToInputs(week.to);
        // Reload events with week filter
        console.log('🔄 Calling date-range render');
        await rerenderForDateChange(newState, mount._allRows || rows);
      });
    });
    
    // Keyword tag clicks in list view
    if (state.layout === LAYOUTS.LIST) {
      mount.querySelectorAll('.ssa-keyword-tag-clickable').forEach(tag => {
        tag.addEventListener('click', async function() {
          // Normalize keyword to lowercase for consistent storage and comparison
          const keyword = (this.dataset.keyword || '').toLowerCase().trim();
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
          // Normalize keyword to lowercase for consistent storage and comparison
          const keyword = (this.dataset.keyword || '').toLowerCase().trim();
          if (!keyword) return;
          
          // Toggle keyword in selected keywords
          const newSelected = state.selectedKeywords.includes(keyword)
            ? state.selectedKeywords.filter(k => k !== keyword)
            : [...state.selectedKeywords, keyword];
          
          await renderEvents(mount, rows, { ...state, selectedKeywords: newSelected });
        });
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
        box-sizing: border-box;
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
        max-width: 100%;
        max-height: ${Math.max(120, maxH - 18)}px;
        border-radius: 6px;
        display: block;
        cursor: pointer;
        touch-action: manipulation;
      `;
      const closePreviewFromImage = function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeImagePreview();
      };
      img.addEventListener('click', closePreviewFromImage);
      img.addEventListener('pointerup', closePreviewFromImage);
      img.addEventListener('touchend', closePreviewFromImage, { passive: false });
      
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
    
    // Image hover preview for list view (similar to info icon hover)
    let activeImagePopover = null;
    let imagePopoverTimeout = null;
    
    if (state.layout === LAYOUTS.LIST) {
      mount.querySelectorAll('.ssa-event-image-wrapper[data-image-url]').forEach(wrapper => {
        const eventId = wrapper.dataset.eventId;
        const imageUrl = wrapper.dataset.imageUrl;
        if (!imageUrl || !imageUrl.trim()) return;
        
        wrapper.addEventListener('mouseenter', function(e) {
          if (imagePopoverTimeout) clearTimeout(imagePopoverTimeout);
          
          // Remove any existing image popover
          if (activeImagePopover) {
            activeImagePopover.remove();
            activeImagePopover = null;
          }
          
          // Get element position
          const rect = wrapper.getBoundingClientRect();
          
          // Create image popover element
          const popover = document.createElement('div');
          popover.className = 'ssa-image-popover';
          popover.dataset.eventId = eventId;
          
          const gap = 8;
          const viewportH = window.innerHeight;
          const viewportW = window.innerWidth;
          const maxH = Math.min(800, viewportH - gap * 2);
          const maxW = Math.min(800, viewportW - gap * 2);
          
          // Create image element
          const img = document.createElement('img');
          img.src = imageUrl;
          img.alt = 'Event preview';
          img.style.cssText = `
            width: auto;
            height: auto;
            max-width: ${maxW}px;
            max-height: ${maxH}px;
            border-radius: 6px;
            display: block;
          `;
          
          popover.appendChild(img);
          document.body.appendChild(popover);
          
          // Get popover dimensions and viewport info
          const popoverRect = popover.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          const minGapFromEdge = 10;
          
          // Calculate horizontal position - prefer to the right, fall back to left, otherwise center
          let left = rect.right + gap;
          const spaceRight = viewportWidth - rect.right - gap;
          const spaceLeft = rect.left - gap;
          
          if (spaceRight >= popoverRect.width) {
            left = rect.right + gap;
          } else if (spaceLeft >= popoverRect.width) {
            left = rect.left - gap - popoverRect.width;
          } else {
            // Center horizontally within viewport
            left = Math.max(minGapFromEdge, Math.min(rect.left + rect.width / 2 - popoverRect.width / 2, viewportWidth - popoverRect.width - minGapFromEdge));
          }
          
          // Calculate vertical position - prefer to align with thumbnail, but keep within viewport
          let top = rect.top;
          if (rect.top < 120) {
            // near top – align tops
            top = Math.max(minGapFromEdge, rect.top);
          } else if (rect.bottom > viewportHeight - 120) {
            // near bottom – align bottoms
            top = Math.max(minGapFromEdge, rect.bottom - popoverRect.height);
          } else {
            // middle – center vertically relative to thumbnail
            top = rect.top + rect.height / 2 - popoverRect.height / 2;
          }
          
          // Clamp inside viewport
          top = Math.max(minGapFromEdge, Math.min(top, viewportHeight - popoverRect.height - minGapFromEdge));
          
          popover.style.cssText = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            z-index: 10002;
            padding: 6px;
            background: rgba(255,255,255,0.98);
            border: 1px solid #d1d5db;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,.25);
            display: block;
          `;
          
          activeImagePopover = popover;
        });
        
        wrapper.addEventListener('mouseleave', function() {
          if (imagePopoverTimeout) clearTimeout(imagePopoverTimeout);
          imagePopoverTimeout = setTimeout(() => {
            if (activeImagePopover) {
              activeImagePopover.remove();
              activeImagePopover = null;
            }
          }, 100);
        });
        
        // Also handle mouseenter on popover itself to keep it open
        document.addEventListener('mouseenter', function(e) {
          const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
          if (target && target.closest && target.closest('.ssa-image-popover')) {
            if (imagePopoverTimeout) clearTimeout(imagePopoverTimeout);
          }
        }, true);
        
        // Handle mouseleave on popover
        document.addEventListener('mouseleave', function(e) {
          const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
          if (target && target.closest && target.closest('.ssa-image-popover')) {
            if (imagePopoverTimeout) clearTimeout(imagePopoverTimeout);
            imagePopoverTimeout = setTimeout(() => {
              if (activeImagePopover) {
                activeImagePopover.remove();
                activeImagePopover = null;
              }
            }, 100);
          }
        }, true);
      });
      
      // Image icon button handlers for list view (keep as click for mobile)
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

    function closeDayAgenda() {
      const activeAgenda = document.querySelector('.ssa-day-agenda-backdrop');
      if (activeAgenda) {
        activeAgenda.classList.remove('ssa-day-agenda-open');
        window.setTimeout(() => activeAgenda.remove(), 180);
      }
      document.removeEventListener('keydown', handleDayAgendaEscape);
    }

    function handleDayAgendaEscape(e) {
      if (e.key === 'Escape') {
        closeDayAgenda();
      }
    }

    function renderDayAgendaEvent(event, index, totalEvents) {
      const eventId = event.id ? `event-${event.id}` : `event-${btoa((event.name || '') + (event.start_date || '')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`;
      const name = escapeHtml(event.name || 'Untitled event');
      const time = escapeHtml(formatAgendaTime(event));
      const location = escapeHtml(event.location || '');
      const description = escapeHtml(event.description || '');
      const websiteUrl = normalizeEventUrl(event.website_url);
      const imageUrl = (event.image_url || '').trim();
      const eventKeywords = getEventKeywords(event);
      const mapsUrl = event.location ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location)}` : '';
      const shouldOpen = totalEvents === 1 || index === 0;

      return `
        <details class="ssa-day-agenda-event" ${shouldOpen ? 'open' : ''}>
          <summary class="ssa-day-agenda-summary">
            ${imageUrl ? `
              <span class="ssa-day-agenda-thumb" data-event-id="${escapeHtml(eventId)}" data-image-url="${escapeHtml(imageUrl)}">
                <img src="${escapeHtml(imageUrl)}" alt="${name}" loading="lazy" />
              </span>
            ` : '<span class="ssa-day-agenda-thumb ssa-day-agenda-thumb-empty" aria-hidden="true"></span>'}
            <span class="ssa-day-agenda-main">
              <span class="ssa-day-agenda-name">${name}</span>
              <span class="ssa-day-agenda-meta">${time}${location ? ` · ${location}` : ''}</span>
            </span>
          </summary>
          <div class="ssa-day-agenda-details">
            ${description ? `<p>${description}</p>` : `<p class="ssa-day-agenda-muted">No additional description is available.</p>`}
            ${eventKeywords.length ? `<div class="ssa-day-agenda-tags">${eventKeywords.map(keyword => `<span>${escapeHtml(keyword)}</span>`).join('')}</div>` : ''}
            <div class="ssa-day-agenda-actions">
              ${websiteUrl ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Event website</a>` : ''}
              ${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer">Directions</a>` : ''}
            </div>
          </div>
        </details>
      `;
    }

    function showDayAgenda(dateKey) {
      const dayEvents = getCalendarEventsForDate(rows, state, dateKey);
      if (!dayEvents.length) return;

      closeDayAgenda();

      const backdrop = document.createElement('div');
      backdrop.className = 'ssa-day-agenda-backdrop';
      backdrop.innerHTML = `
        <section class="ssa-day-agenda-panel" role="dialog" aria-modal="true" aria-label="Events for ${escapeHtml(formatDayHeader(dateKey))}">
          <header class="ssa-day-agenda-header">
            <div>
              <p>${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}</p>
              <h3>${escapeHtml(formatDayHeader(dateKey))}</h3>
            </div>
            <button class="ssa-day-agenda-close" type="button" aria-label="Close event details">×</button>
          </header>
          <div class="ssa-day-agenda-list">
            ${dayEvents.map((event, index) => renderDayAgendaEvent(event, index, dayEvents.length)).join('')}
          </div>
        </section>
      `;

      backdrop.addEventListener('click', function(e) {
        if (e.target === backdrop) {
          closeDayAgenda();
        }
      });

      const closeBtn = backdrop.querySelector('.ssa-day-agenda-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeDayAgenda);
      }

      backdrop.querySelectorAll('.ssa-day-agenda-thumb[data-image-url]').forEach(thumb => {
        thumb.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          showImagePreview(this.dataset.eventId, this.dataset.imageUrl, this);
        });
      });

      document.body.appendChild(backdrop);
      // Force the inserted state to register before adding the open class.
      backdrop.getBoundingClientRect();
      backdrop.classList.add('ssa-day-agenda-open');
      document.addEventListener('keydown', handleDayAgendaEscape);
    }

    mount.querySelectorAll('.ssa-calendar-day-has-events').forEach(dayCell => {
      dayCell.addEventListener('click', function(e) {
        if (e.target.closest('a')) return;
        showDayAgenda(this.dataset.date);
      });
    });
    
    // Description popover on hover for info icons (list and grid views)
    let activePopover = null;
    let popoverTimeout = null;
    
    mount.querySelectorAll('.ssa-info-icon').forEach(element => {
      const description = element.dataset.description;
      const websiteUrl = element.dataset.websiteUrl;
      const isCalendarView = element.dataset.calendarView === 'true';
      
      // Check if we have description or URL
      const hasDescription = description && description.trim();
      const hasUrl = websiteUrl && websiteUrl.trim();
      
      // For calendar view, always show popover even without description
      // For other views, if no description and no URL, skip (shouldn't happen, but safety check)
      if (!isCalendarView && !hasDescription && !hasUrl) return;
      
      // If no description but has URL, add click handler to open URL
      if (!hasDescription && hasUrl) {
        element.style.cursor = 'pointer';
        element.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          // Unescape the URL
          const unescapedUrl = websiteUrl.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          window.open(unescapedUrl, '_blank', 'noopener,noreferrer');
        });
        // Skip hover behavior for URL-only icons (unless it's calendar view which always shows popover)
        if (!isCalendarView) {
          return;
        }
      }
      
      // Decode HTML entities
      let decodedDescription = '';
      if (hasDescription) {
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
            locationLink.style.cssText = 'color: #0f172a !important; text-decoration: none; cursor: pointer;';
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
                      this.style.background = 'transparent';
                      this.style.borderColor = '#9a9288';
                      this.style.color = '#d4cec6';
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
                    this.style.color = '';
                  }
                });
                
                // Click handler to toggle keyword filter
                keywordTag.addEventListener('click', async function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (!mount || !mount._currentState) return;
                  
                  const state = mount._currentState;
                  const rows = mount._allRows || [];
                  // Normalize keyword to lowercase for consistent storage and comparison
                  const keyword = (this.dataset.keyword || '').toLowerCase().trim();
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
      .ssa-controls{display:flex;flex-direction:column;gap:20px;margin-bottom:32px;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb}
      body.dark-mode .ssa-controls{background:#1f2937!important;border-color:#374151!important}
      .ssa-view-controls-section{display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;padding:16px;background:#fff;border-radius:8px;border:1px solid #e5e7eb}
      body.dark-mode .ssa-view-controls-section{background:#111827!important;border-color:#374151!important}
      .ssa-view-controls-left{display:flex;flex-wrap:wrap;gap:20px;align-items:center;flex:1}
      .ssa-layout-switcher-wrapper{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .ssa-group-switcher-wrapper{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{padding-left:20px;border-left:1px solid #e5e7eb}
      body.dark-mode .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{border-left-color:#374151!important}
      .ssa-display-options-wrapper{display:flex;align-items:center;justify-content:flex-end;flex-shrink:0}
      .ssa-display-options-switcher{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}
      .ssa-control-label{font-size:0.875rem;font-weight:600;color:#374151;white-space:nowrap;text-transform:uppercase;letter-spacing:0.5px}
      body.dark-mode .ssa-control-label{color:#f9fafb!important}
      .ssa-layout-switcher{display:flex;gap:6px}
      .ssa-layout-btn{padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer;font-size:1.2rem;transition:all 0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
      .ssa-layout-btn:hover{background:#f9fafb;border-color:#9ca3af;transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .ssa-layout-btn.ssa-active{background:#3b82f6;border-color:#3b82f6;color:#fff;box-shadow:0 2px 4px rgba(59,130,246,0.3)}
      body.dark-mode .ssa-layout-btn{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-layout-btn:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-layout-btn.ssa-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-layout-btn.ssa-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-group-switcher{display:flex;gap:6px}
      .ssa-group-btn{padding:8px 16px;border:1px solid #d1d5db;border-radius:8px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
      .ssa-group-btn:hover{background:#f9fafb!important;border-color:#9ca3af;transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .ssa-group-btn.ssa-active{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important;box-shadow:0 2px 4px rgba(59,130,246,0.3)}
      body.dark-mode .ssa-group-btn{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-group-btn:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-group-btn.ssa-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-group-btn.ssa-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-date-filters-section{display:flex;flex-direction:column;gap:12px;padding:16px;background:#fff;border-radius:8px;border:1px solid #e5e7eb}
      body.dark-mode .ssa-date-filters-section{background:#111827!important;border-color:#374151!important}
      .ssa-date-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center}
      .ssa-date-inputs-row{display:flex;gap:12px;align-items:center}
      .ssa-date-filters label{display:flex;align-items:center;gap:6px;font-size:0.875rem;color:#374151;font-weight:500}
      .ssa-date-input{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.875rem;background:#fff;transition:all 0.2s}
      .ssa-date-input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
      .ssa-clear-dates{padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
      .ssa-clear-dates:hover{background:#f9fafb!important;transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .ssa-weekend-btn{padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;white-space:nowrap;transition:all 0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
      .ssa-weekend-btn:hover{background:#f9fafb!important;border-color:#9ca3af;transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .ssa-show-images-toggle{padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
      .ssa-show-images-toggle:hover{background:#f9fafb;border-color:#9ca3af;transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .ssa-show-images-toggle.ssa-active{background:#3b82f6;border-color:#3b82f6;color:#fff;box-shadow:0 2px 4px rgba(59,130,246,0.3)}
      .ssa-show-images-toggle.ssa-active:hover{background:#2563eb;border-color:#2563eb}
      body.dark-mode .ssa-show-images-toggle{background:#374151;border-color:#4b5563;color:#f9fafb}
      body.dark-mode .ssa-show-images-toggle:hover{background:#4b5563;border-color:#6b7280}
      body.dark-mode .ssa-show-images-toggle.ssa-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-show-images-toggle.ssa-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-signature-events-toggle{padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
      .ssa-signature-events-toggle:hover{background:#f9fafb;border-color:#9ca3af;transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .ssa-signature-events-toggle.ssa-active{background:#3b82f6;border-color:#3b82f6;color:#fff;box-shadow:0 2px 4px rgba(59,130,246,0.3)}
      .ssa-signature-events-toggle.ssa-active:hover{background:#2563eb;border-color:#2563eb}
      body.dark-mode .ssa-signature-events-toggle{background:#374151;border-color:#4b5563;color:#f9fafb}
      body.dark-mode .ssa-signature-events-toggle:hover{background:#4b5563;border-color:#6b7280}
      body.dark-mode .ssa-signature-events-toggle.ssa-active{background:transparent!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-signature-events-toggle.ssa-active:hover{background:transparent!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-dark-mode-toggle{padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
      .ssa-dark-mode-toggle:hover{background:#f9fafb;border-color:#9ca3af;transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      body.dark-mode .ssa-dark-mode-toggle{background:#374151;border-color:#4b5563;color:#f9fafb}
      body.dark-mode .ssa-dark-mode-toggle:hover{background:#4b5563;border-color:#6b7280}
      .ssa-keyword-filters-section{display:flex;flex-direction:column;gap:12px;padding:16px;background:#fff;border-radius:8px;border:1px solid #e5e7eb}
      body.dark-mode .ssa-keyword-filters-section{background:#111827!important;border-color:#374151!important}
      .ssa-keyword-filters{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
      .ssa-keyword-btn{padding:8px 16px;border:2px solid #d1d5db;border-radius:20px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s}
      .ssa-keyword-btn:hover{background:#f9fafb!important;border-color:#9ca3af!important;color:#374151!important}
      .ssa-keyword-active{background:#fff!important;border-color:#3b82f6!important;color:#3b82f6!important}
      .ssa-keyword-active:hover{background:#f0f9ff!important;border-color:#2563eb!important;color:#2563eb!important}
      body.dark-mode .ssa-keyword-filters{background:transparent!important}
      body.dark-mode .ssa-keyword-active{background:var(--ssa-control-bg, #374151)!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-keyword-active:hover{background:#4b5563!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-empty{color:#6b7280;padding:20px;text-align:center}
      .ssa-skel{height:110px;border-radius:14px;background:linear-gradient(90deg,#f4f4f5,#f9fafb,#f4f4f5);background-size:200% 100%;animation:ssaShimmer 1.1s linear infinite}
      @keyframes ssaShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .ssa-ad-container-top{width:100%;min-height:100px;margin-bottom:32px;padding:16px;background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;display:flex;align-items:center;justify-content:center}
      .ssa-ad-container-top:empty{display:none}
      .ssa-ad-placeholder{color:#9ca3af;font-size:0.875rem;text-align:center;font-style:italic}
      body.dark-mode .ssa-ad-placeholder{color:#6b7280!important}
      .ssa-ad-slot{width:100%;min-height:120px;margin:24px 0;padding:16px;background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;display:none}
      .ssa-ad-slot:not(:empty){display:block}
      body.dark-mode .ssa-ad-container-top{background:#1f2937!important;border-color:#4b5563!important}
      body.dark-mode .ssa-ad-slot{background:#1f2937!important;border-color:#4b5563!important}
      @media(max-width:768px){.ssa-ad-container-top{margin-bottom:24px;padding:12px;min-height:80px}}
      .ssa-month-header{margin:20px 0 10px;font-size:1.4rem;font-weight:700;color:#1f2937;letter-spacing:-0.02em}
      .ssa-day-header,.ssa-day-header *,#events-list .ssa-day-header,#events-list .ssa-day-header *{margin:20px 0 10px;font-size:1.4rem;font-weight:700;color:#000000!important;padding-bottom:10px;border-bottom:2px solid #e0e7ff;letter-spacing:-0.02em}
      @media(min-width:640px){
        .ssa-month-header{margin:22px 0 11px;font-size:1.6rem}
        .ssa-day-header,.ssa-day-header *,#events-list .ssa-day-header,#events-list .ssa-day-header *{margin:22px 0 11px;font-size:1.6rem;padding-bottom:11px}
      }
      @media(min-width:1024px){
        .ssa-month-header{margin:24px 0 12px;font-size:1.75rem}
        .ssa-day-header,.ssa-day-header *,#events-list .ssa-day-header,#events-list .ssa-day-header *{margin:24px 0 12px;font-size:1.75rem;padding-bottom:12px}
      }
      h3.ssa-day-header,h3.ssa-day-header *{color:#000000!important}
      .ssa-events-list{list-style:none;padding:0;margin:0 0 32px}
      .ssa-event-item{margin-bottom:16px;padding:12px;background:#fff;border:1px solid #e0e7ff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:all 0.3s ease}
      .ssa-event-item:hover{box-shadow:0 4px 12px rgba(0,0,0,0.1);background:#fafbff;transform:translateY(-1px)}
      .ssa-event-item:last-child{margin-bottom:0}
      .ssa-event-content{display:flex;gap:12px;align-items:flex-start}
      .ssa-event-image-wrapper{flex-shrink:0;width:60px;height:60px;border-radius:8px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s ease;box-shadow:0 2px 4px rgba(0,0,0,0.08)}
      .ssa-event-image-wrapper:hover{box-shadow:0 4px 8px rgba(0,0,0,0.12);transform:scale(1.02)}
      .ssa-event-image-wrapper:active{opacity:0.7;transform:scale(0.98)}
      .ssa-event-image-wrapper.ssa-event-image-placeholder{background:#f9fafb;border:1px dashed #d1d5db;cursor:default}
      .ssa-event-image{width:100%;height:100%;object-fit:cover;display:block}
      .ssa-event-details{flex:1;min-width:0}
      .ssa-event-name-wrapper{display:inline-flex;align-items:center;gap:6px}
      .ssa-event-name-wrapper strong{font-size:1.1rem;font-weight:600;line-height:1.4;color:#1f2937}
      .ssa-event-link{font-size:1.1rem;font-weight:600;line-height:1.4;color:#3b82f6;text-decoration:none;cursor:pointer;transition:color 0.2s ease}
      .ssa-event-link:hover{color:#2563eb;text-decoration:underline}
      .ssa-event-name{cursor:default;color:#1f2937}
      .ssa-event-meta{margin-top:10px;display:flex;flex-direction:column;gap:4px}
      .ssa-event-meta-item,.ssa-event-meta-item *,#events-list .ssa-event-meta-item,#events-list .ssa-event-meta-item *{font-size:0.9rem;line-height:1.5;color:#374151!important}
      .ssa-event-meta-item strong,#events-list .ssa-event-meta-item strong,.ssa-event-meta-item strong *,#events-list .ssa-event-meta-item strong *{color:#1f2937!important;margin-right:6px;font-weight:600}
      div.ssa-event-meta-item,div.ssa-event-meta-item *{color:#374151!important}
      @media(min-width:640px){
        .ssa-event-item{margin-bottom:18px;padding:14px;border-radius:7px}
        .ssa-event-content{gap:16px}
        .ssa-event-image-wrapper{width:70px;height:70px;border-radius:9px}
        .ssa-event-name-wrapper strong{font-size:1.15rem}
        .ssa-event-link{font-size:1.15rem}
        .ssa-event-meta{margin-top:11px;gap:5px}
        .ssa-event-meta-item,.ssa-event-meta-item *,#events-list .ssa-event-meta-item,#events-list .ssa-event-meta-item *{font-size:0.925rem;line-height:1.55}
      }
      @media(min-width:1024px){
        .ssa-event-item{margin-bottom:20px;padding:16px;border-radius:8px}
        .ssa-event-content{gap:20px}
        .ssa-event-image-wrapper{width:80px;height:80px;border-radius:10px}
        .ssa-event-name-wrapper strong{font-size:1.25rem}
        .ssa-event-link{font-size:1.25rem}
        .ssa-event-meta{margin-top:12px;gap:6px}
        .ssa-event-meta-item,.ssa-event-meta-item *,#events-list .ssa-event-meta-item,#events-list .ssa-event-meta-item *{font-size:0.95rem;line-height:1.6}
      }
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
      .ssa-info-popover{padding:12px;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:200px;max-width:300px;max-height:400px;font-size:0.875rem;line-height:1.5;color:#374151;white-space:normal;word-wrap:break-word;pointer-events:auto;position:relative}
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
      .ssa-location{cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;color:#0f172a!important;transition:color 0.2s}
      .ssa-location:hover{color:#0f172a!important;text-decoration-style:solid}
      .ssa-card .ssa-location,.ssa-meta .ssa-location{color:#0f172a!important}
      .ssa-card .ssa-location:hover,.ssa-meta .ssa-location:hover{color:#0f172a!important}
      .ssa-map-popover{width:400px;height:300px;padding:0;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);overflow:hidden;pointer-events:auto;position:fixed;z-index:10003}
      .ssa-map-popover::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#fff;z-index:1}
      .ssa-map-popover::before{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#d1d5db;margin-top:-1px;z-index:0}
      .ssa-keywords-inline{display:inline-flex;flex-wrap:wrap;gap:4px;margin-left:8px}
      .ssa-tag{display:inline-block;padding:2px 8px;background:#f3f4f6;border-radius:12px;font-size:0.75rem;color:#6b7280}
      .ssa-event-keywords{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
      .ssa-keyword-tag-clickable{display:inline-block;padding:8px 16px;border:2px solid #d1d5db;border-radius:20px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;line-height:1.2;transition:all 0.2s}
      .ssa-keyword-tag-clickable:hover{background:#f9fafb!important;border-color:#9ca3af!important}
      .ssa-keyword-tag-clickable.ssa-keyword-tag-active{background:#fff!important;border-color:#3b82f6!important;color:#3b82f6!important}
      .ssa-keyword-tag-clickable.ssa-keyword-tag-active:hover{background:#f0f9ff!important;border-color:#2563eb!important;color:#2563eb!important}
      body.dark-mode .ssa-keyword-tag-clickable{background:var(--ssa-control-bg, #374151)!important;border-color:var(--ssa-control-border, #4b5563)!important;color:var(--ssa-text, #f9fafb)!important}
      body.dark-mode .ssa-keyword-tag-clickable:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-keyword-tag-clickable.ssa-keyword-tag-active{background:var(--ssa-control-bg, #374151)!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-keyword-tag-clickable.ssa-keyword-tag-active:hover{background:#4b5563!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-grid{display:grid;gap:16px;grid-template-columns:1fr}
      @media(min-width:640px){.ssa-grid{grid-template-columns:repeat(2,1fr);gap:20px}}
      @media(min-width:1024px){.ssa-grid{grid-template-columns:repeat(3,1fr);gap:24px}}
      .ssa-calendar-container{margin:24px 0}
      .ssa-calendar-month-header{margin:0 0 20px;font-size:1.5rem;font-weight:700;color:#1f2937;text-align:center;letter-spacing:-0.02em}
      .ssa-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:#e0e7ff;border:1px solid #e0e7ff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
      .ssa-calendar-day-header{background:#f8f9fa;padding:8px 4px;text-align:center;font-size:0.75rem;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:0.05em}
      .ssa-calendar-day{background:#fff;min-height:70px;padding:4px;display:flex;flex-direction:column;position:relative;transition:background-color 0.2s ease}
      .ssa-calendar-day:hover{background:#fafbff}
      .ssa-calendar-day-empty{background:#f9fafb;opacity:0.5}
      .ssa-calendar-day-out-of-range{opacity:0.4;background:#f3f4f6}
      .ssa-calendar-day-out-of-range .ssa-calendar-day-number{color:#9ca3af}
      .ssa-calendar-day-number{font-size:0.85rem;font-weight:600;color:#1f2937;margin-bottom:4px}
      .ssa-calendar-day-events{display:flex;flex-wrap:wrap;gap:2px;align-items:flex-start}
      .ssa-calendar-info-icon{width:14px;height:14px;min-width:14px;min-height:14px;font-size:0.55rem;margin:0}
      .ssa-calendar-event-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#3b82f6;opacity:0.7}
      @media(min-width:640px){
        .ssa-calendar-month-header{font-size:1.65rem;margin:0 0 24px}
        .ssa-calendar-grid{gap:2px;border-radius:10px}
        .ssa-calendar-day-header{padding:10px 4px;font-size:0.8rem}
        .ssa-calendar-day{min-height:80px;padding:6px}
        .ssa-calendar-day-number{font-size:0.9rem;margin-bottom:6px}
        .ssa-calendar-info-icon{width:16px;height:16px;min-width:16px;min-height:16px;font-size:0.6rem}
        .ssa-calendar-event-dot{width:8px;height:8px}
      }
      @media(min-width:1024px){
        .ssa-calendar-month-header{font-size:1.75rem;margin:0 0 20px}
        .ssa-calendar-grid{gap:2px;border-radius:12px}
        .ssa-calendar-day-header{padding:10px 4px;font-size:0.8rem}
        .ssa-calendar-day{min-height:85px;padding:6px}
        .ssa-calendar-day-number{font-size:0.9rem;margin-bottom:6px}
        .ssa-calendar-info-icon{width:16px;height:16px;min-width:16px;min-height:16px;font-size:0.6rem}
        .ssa-calendar-event-dot{width:8px;height:8px}
      }
      .ssa-card{border:1px solid #e0e7ff;border-radius:12px;padding:0;background:#fff;position:relative;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);transition:all 0.3s ease}
      .ssa-card:hover{box-shadow:0 6px 18px rgba(0,0,0,0.1);transform:translateY(-2px);border-color:#c7d2fe}
      .ssa-card[data-has-image="true"]{background-color:#fff}
      .ssa-card[data-has-image="true"]::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background-image:var(--card-bg-image);background-size:cover;background-position:center;background-repeat:no-repeat;opacity:0.2;z-index:0}
      .ssa-card[data-has-image="true"]::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,rgba(255,255,255,0.6) 0%,rgba(255,255,255,0.4) 50%,rgba(255,255,255,0.3) 100%);z-index:1}
      .ssa-card[data-has-image="true"] .ssa-card-content{position:relative;z-index:2;padding:14px}
      .ssa-card:not([data-has-image="true"]) .ssa-card-content{padding:14px}
      .ssa-card-content{min-height:120px}
      .ssa-card-head{display:flex;align-items:center;gap:6px;position:relative}
      .ssa-card-image-icon{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;overflow:hidden;cursor:pointer;opacity:0.8;transition:opacity 0.2s;flex-shrink:0;z-index:10;border:2px solid rgba(0,0,0,0.1)}
      .ssa-card-image-icon:hover{opacity:0.9;border-color:rgba(0,0,0,0.15)}
      .ssa-card-image-icon:active{opacity:0.7}
      .ssa-card-icon-thumb{width:100%;height:100%;object-fit:cover;display:block}
      .ssa-title{margin:0;font-size:1.05rem;line-height:1.35;color:#1f2937;font-weight:600;flex:1;display:inline-flex;align-items:center;gap:4px;letter-spacing:-0.01em}
      .ssa-meta{margin:.4rem 0;color:#000000!important;font-weight:500;font-size:0.9rem;line-height:1.5}
      .ssa-meta .ssa-location{color:#0f172a!important}
      @media(min-width:640px){
        .ssa-card{border-radius:14px;box-shadow:0 2px 7px rgba(0,0,0,0.055)}
        .ssa-card:hover{box-shadow:0 7px 21px rgba(0,0,0,0.11)}
        .ssa-card[data-has-image="true"] .ssa-card-content{padding:16px}
        .ssa-card:not([data-has-image="true"]) .ssa-card-content{padding:16px}
        .ssa-card-content{min-height:130px}
        .ssa-card-head{gap:7px}
        .ssa-card-image-icon{width:38px;height:38px}
        .ssa-title{font-size:1.1rem;gap:5px}
        .ssa-meta{font-size:0.925rem;line-height:1.55}
      }
      @media(min-width:1024px){
        .ssa-card{border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
        .ssa-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.12)}
        .ssa-card[data-has-image="true"] .ssa-card-content{padding:18px}
        .ssa-card:not([data-has-image="true"]) .ssa-card-content{padding:18px}
        .ssa-card-content{min-height:140px}
        .ssa-card-head{gap:8px}
        .ssa-card-image-icon{width:40px;height:40px}
        .ssa-title{font-size:1.15rem;gap:6px}
        .ssa-meta{font-size:0.95rem;line-height:1.6}
      }
      .ssa-keywords{margin:.5rem 0;display:flex;flex-wrap:wrap;gap:4px}
      .ssa-tag-clickable{display:inline-block;padding:8px 16px;border:2px solid #d1d5db;border-radius:20px;background:#fff!important;color:#374151!important;cursor:pointer;font-size:0.875rem;font-weight:500;line-height:1.2;transition:all 0.2s}
      .ssa-tag-clickable:hover{background:#f9fafb!important;border-color:#9ca3af!important}
      .ssa-tag-clickable.ssa-tag-active{background:#fff!important;border-color:#3b82f6!important;color:#3b82f6!important}
      .ssa-tag-clickable.ssa-tag-active:hover{background:#f0f9ff!important;border-color:#2563eb!important;color:#2563eb!important}
      body.dark-mode .ssa-tag-clickable{background:var(--ssa-control-bg, #374151)!important;border-color:var(--ssa-control-border, #4b5563)!important;color:var(--ssa-text, #f9fafb)!important}
      body.dark-mode .ssa-tag-clickable:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .ssa-tag-clickable.ssa-tag-active{background:var(--ssa-control-bg, #374151)!important;border-color:#3b82f6!important;color:#3b82f6!important}
      body.dark-mode .ssa-tag-clickable.ssa-tag-active:hover{background:#4b5563!important;border-color:#60a5fa!important;color:#60a5fa!important}
      .ssa-link{text-decoration:underline;color:#3b82f6;font-weight:500}
      @media(max-width:639px){
        #events-list{padding:0 12px;box-sizing:border-box;max-width:100%;overflow-x:hidden}
        *{box-sizing:border-box}
        .ssa-controls{padding:12px;gap:12px;margin:0 -12px 20px}
        .ssa-view-controls-section{padding:10px;flex-direction:row;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
        .ssa-view-controls-left{flex-direction:row;flex-wrap:wrap;gap:8px;flex:1;min-width:0}
        .ssa-layout-switcher-wrapper{flex-direction:row;align-items:center;gap:6px;flex:1;min-width:0}
        .ssa-group-switcher-wrapper{flex-direction:row;align-items:center;gap:6px;flex:1;min-width:0}
        .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{border-left:1px solid #e5e7eb;padding-left:8px;margin-left:0;border-top:none;padding-top:0;margin-top:0}
        body.dark-mode .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{border-left-color:#374151!important}
        .ssa-display-options-wrapper{flex-shrink:0;justify-content:flex-end}
        .ssa-display-options-switcher{flex-direction:row;flex-wrap:wrap;gap:6px;justify-content:flex-end}
        .ssa-date-filters-section{padding:10px}
        .ssa-date-filters{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px}
        .ssa-date-inputs-row{display:flex;flex-direction:row;gap:6px;width:100%;flex-basis:100%}
        .ssa-date-filters label{flex-direction:row;align-items:center;gap:4px;font-size:0.8rem;flex:1;min-width:0}
        .ssa-date-input{flex:1;padding:8px;font-size:0.85rem;min-height:40px;min-width:0}
        .ssa-clear-dates{width:100%;padding:8px;font-size:0.85rem;min-height:40px;flex-basis:100%}
        .ssa-weekend-btn{flex:1;min-width:calc(33.333% - 4px);padding:8px 4px;font-size:0.75rem;min-height:40px;white-space:normal;line-height:1.2;text-align:center}
        .ssa-keyword-filters-section{padding:10px}
        .ssa-control-label{font-size:0.75rem;margin-bottom:0;white-space:nowrap}
        .ssa-layout-switcher{display:flex;gap:6px;flex-wrap:wrap}
        .ssa-layout-btn{padding:8px 10px;font-size:1rem;min-height:40px}
        .ssa-group-switcher{gap:6px;flex:1;min-width:0}
        .ssa-group-btn{padding:8px 10px;font-size:0.85rem;min-height:40px;flex:1}
        .ssa-show-images-toggle,.ssa-signature-events-toggle,.ssa-dark-mode-toggle{flex:1;min-width:calc(33.333% - 4px);padding:8px 4px;font-size:0.75rem;min-height:40px;white-space:normal;line-height:1.2;text-align:center}
        .ssa-keyword-filters{gap:6px;justify-content:center}
        .ssa-keyword-btn{padding:8px 12px;font-size:0.8rem;min-height:36px;border-radius:18px}
        .ssa-event-item{padding:16px;margin-bottom:16px;max-width:100%;overflow-x:hidden}
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
        .ssa-event-keywords{margin-top:12px;padding-top:0;display:flex;flex-wrap:wrap;gap:6px;max-width:100%}
        .ssa-keyword-tag-clickable{padding:10px 14px;font-size:0.9rem;min-height:44px;border-radius:22px}
        .ssa-info-popover{max-width:calc(100vw - 20px);width:calc(100vw - 20px);left:10px!important;right:10px;font-size:1rem;line-height:1.6;max-height:60vh;padding:16px}
        .ssa-popover-close{width:32px;height:32px;font-size:24px;top:8px;right:8px}
        .ssa-card-content{padding:16px!important;min-height:auto;max-width:100%;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-title{font-size:1rem;line-height:1.4;flex-wrap:wrap;gap:6px;max-width:100%;overflow-wrap:break-word;word-wrap:break-word}
        .ssa-title .ssa-info-icon{margin-bottom:4px}
        .ssa-meta{font-size:0.9rem;line-height:1.5;margin:8px 0}
        .ssa-keywords{margin:8px 0;gap:6px}
        .ssa-tag-clickable{padding:10px 14px;font-size:0.9rem;min-height:44px;border-radius:22px}
        .ssa-map-popover{width:calc(100vw - 20px)!important;height:250px;left:10px!important;right:10px}
      }
      @media(min-width:640px) and (max-width:1023px){
        #events-list{padding:0 16px;box-sizing:border-box;max-width:100%}
        .ssa-controls{padding:20px;gap:16px}
        .ssa-view-controls-section{padding:14px;flex-direction:row;flex-wrap:wrap;justify-content:space-between}
        .ssa-view-controls-left{flex-direction:row;flex-wrap:wrap;gap:16px;flex:1}
        .ssa-layout-switcher-wrapper{flex-direction:row;align-items:center;gap:10px}
        .ssa-group-switcher-wrapper{flex-direction:row;align-items:center;gap:10px}
        .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{padding-left:16px;border-left:1px solid #e5e7eb;border-top:none;padding-top:0;margin-top:0}
        body.dark-mode .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{border-left-color:#374151!important}
        .ssa-display-options-wrapper{flex-shrink:0;justify-content:flex-end}
        .ssa-display-options-switcher{flex-direction:row;flex-wrap:wrap;gap:10px;justify-content:flex-end}
        .ssa-date-filters-section{padding:14px}
        .ssa-date-filters{flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px}
        .ssa-date-inputs-row{display:flex;flex-direction:row;gap:10px}
        .ssa-date-filters label{font-size:0.875rem;flex-direction:row}
        .ssa-date-input{padding:8px 10px;font-size:0.9rem;min-height:40px}
        .ssa-clear-dates{padding:8px 12px;font-size:0.875rem;min-height:40px}
        .ssa-weekend-btn{padding:8px 12px;font-size:0.875rem;min-height:40px}
        .ssa-keyword-filters-section{padding:14px}
        .ssa-control-label{font-size:0.875rem}
        .ssa-layout-btn{padding:9px 13px;font-size:1.15rem;min-height:42px}
        .ssa-group-btn{padding:9px 13px;font-size:0.875rem;min-height:42px}
        .ssa-show-images-toggle,.ssa-signature-events-toggle,.ssa-dark-mode-toggle{padding:8px 14px;font-size:0.875rem;min-height:40px}
        .ssa-keyword-btn{padding:9px 15px;font-size:0.875rem;min-height:40px}
        .ssa-keyword-tag-clickable,.ssa-tag-clickable{padding:9px 15px;font-size:0.875rem;line-height:1.2}
        .ssa-event-item{padding:14px;margin-bottom:18px}
        .ssa-event-content{flex-direction:row;gap:16px}
        .ssa-event-image-wrapper{width:70px;height:70px}
        .ssa-event-name-wrapper strong{font-size:1.15rem}
        .ssa-event-link{font-size:1.15rem}
        .ssa-event-meta{margin-top:11px;gap:5px}
        .ssa-event-meta-item{font-size:0.925rem}
        .ssa-card-content{padding:16px!important}
        .ssa-title{font-size:1.1rem}
        .ssa-meta{font-size:0.925rem}
        .ssa-map-popover{width:380px!important;height:280px!important}
      }
      @media(min-width:1024px){
        #events-list{padding:0 24px;box-sizing:border-box;max-width:1400px;margin:0 auto}
        .ssa-controls{padding:24px;gap:20px}
        .ssa-view-controls-section{padding:16px;justify-content:space-between}
        .ssa-view-controls-left{flex-direction:row;flex-wrap:wrap;gap:20px;flex:1}
        .ssa-layout-switcher-wrapper{flex-direction:row;align-items:center;gap:10px}
        .ssa-group-switcher-wrapper{flex-direction:row;align-items:center;gap:10px}
        .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{padding-left:20px;border-left:1px solid #e5e7eb;border-top:none;padding-top:0;margin-top:0}
        body.dark-mode .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{border-left-color:#374151!important}
        .ssa-display-options-wrapper{flex-shrink:0;justify-content:flex-end}
        .ssa-display-options-switcher{flex-direction:row;gap:10px;justify-content:flex-end}
        .ssa-date-filters-section{padding:16px}
        .ssa-date-filters{flex-direction:row;flex-wrap:wrap;align-items:center;gap:12px}
        .ssa-date-inputs-row{display:flex;flex-direction:row;gap:12px}
        .ssa-date-filters label{font-size:0.875rem;flex-direction:row}
        .ssa-date-input{padding:8px 12px;font-size:0.875rem;min-height:36px}
        .ssa-clear-dates{padding:8px 16px;font-size:0.875rem;min-height:36px}
        .ssa-weekend-btn{padding:8px 16px;font-size:0.875rem;min-height:36px}
        .ssa-keyword-filters-section{padding:16px}
        .ssa-control-label{font-size:0.875rem}
        .ssa-layout-btn{padding:10px 14px;font-size:1.2rem;min-height:40px}
        .ssa-group-btn{padding:8px 16px;font-size:0.875rem;min-height:40px}
        .ssa-show-images-toggle,.ssa-signature-events-toggle,.ssa-dark-mode-toggle{padding:8px 16px;font-size:0.875rem;min-height:36px}
        .ssa-keyword-btn{padding:8px 16px;font-size:0.875rem;min-height:36px}
        .ssa-keyword-tag-clickable,.ssa-tag-clickable{padding:8px 16px;font-size:0.875rem;line-height:1.2}
        .ssa-event-item{padding:16px;margin-bottom:20px}
        .ssa-event-content{flex-direction:row;gap:20px}
        .ssa-event-image-wrapper{width:80px;height:80px}
        .ssa-event-name-wrapper strong{font-size:1.25rem}
        .ssa-event-link{font-size:1.25rem}
        .ssa-event-meta{margin-top:12px;gap:6px}
        .ssa-event-meta-item{font-size:0.95rem}
        .ssa-card-content{padding:18px!important}
        .ssa-title{font-size:1.15rem}
        .ssa-meta{font-size:0.95rem}
        .ssa-map-popover{width:400px!important;height:300px!important}
      }
      .ssa-dark-mode-toggle{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.2s;white-space:nowrap}
      .ssa-dark-mode-toggle:hover{background:#f9fafb;border-color:#9ca3af}
      body.dark-mode .ssa-dark-mode-toggle{background:#374151;border-color:#4b5563;color:#f9fafb}
      body.dark-mode .ssa-dark-mode-toggle:hover{background:#4b5563;border-color:#6b7280}
      body.dark-mode{background:#111827!important;color:#f9fafb!important}
      html body.dark-mode{background:#111827!important;color:#f9fafb!important}
      html.dark-mode,html body.dark-mode{background:#111827!important;color:#f9fafb!important}
      html.dark-mode body,html body.dark-mode{background:#111827!important;color:#f9fafb!important}
      body.dark-mode #events-list{background:#111827!important;color:#f9fafb!important}
      body.dark-mode #events-list *{color:inherit}
      body.dark-mode .Main-content{background:#111827!important}
      body.dark-mode .sqs-block{background:transparent!important}
      html.dark-mode .Main-content,html body.dark-mode .Main-content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Main,html body.dark-mode .Main{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Main-inner,html body.dark-mode .Main-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Content,html body.dark-mode .Content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Content-inner,html body.dark-mode .Content-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .page,html body.dark-mode .page{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .page-content,html body.dark-mode .page-content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-layout,html body.dark-mode .sqs-layout{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Site,html body.dark-mode .Site{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Site-inner,html body.dark-mode .Site-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #siteWrapper,html body.dark-mode #siteWrapper{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #site,html body.dark-mode #site{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #mainContent,html body.dark-mode #mainContent{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #content,html body.dark-mode #content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-wrapper,html body.dark-mode .sqs-wrapper{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-container,html body.dark-mode .sqs-container{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-row,html body.dark-mode .sqs-row{background:transparent!important}
      html.dark-mode .sqs-col,html body.dark-mode .sqs-col{background:transparent!important}
      html.dark-mode .sqs-block,html body.dark-mode .sqs-block{background:transparent!important}
      html.dark-mode .sqs-block-content,html body.dark-mode .sqs-block-content{background:transparent!important}
      html.dark-mode h1,html body.dark-mode h1,html.dark-mode h2,html body.dark-mode h2,html.dark-mode h3,html body.dark-mode h3,html.dark-mode h4,html body.dark-mode h4,html.dark-mode h5,html body.dark-mode h5,html.dark-mode h6,html body.dark-mode h6{color:#f9fafb!important}
      html.dark-mode p,html body.dark-mode p{color:#e5e7eb!important}
      html.dark-mode a,html body.dark-mode a{color:#60a5fa!important}
      html.dark-mode a:hover,html body.dark-mode a:hover{color:#93c5fd!important}
      body.dark-mode .Main{background:#111827!important}
      body.dark-mode .Main-inner{background:#111827!important}
      body.dark-mode .Content{background:#111827!important}
      body.dark-mode .Content-inner{background:#111827!important}
      body.dark-mode .page{background:#111827!important}
      body.dark-mode .page-content{background:#111827!important}
      body.dark-mode .sqs-layout{background:#111827!important}
      body.dark-mode .sqs-row{background:transparent!important}
      body.dark-mode .sqs-col{background:transparent!important}
      body.dark-mode .sqs-block-content{background:transparent!important}
      body.dark-mode .sqs-block-html{background:transparent!important}
      body.dark-mode .sqs-block-code{background:transparent!important}
      body.dark-mode .sqs-block-markdown{background:transparent!important}
      body.dark-mode .sqs-block-embed{background:transparent!important}
      body.dark-mode .sqs-block-image{background:transparent!important}
      body.dark-mode .sqs-block-video{background:transparent!important}
      body.dark-mode .sqs-block-summary-v2{background:transparent!important}
      body.dark-mode .sqs-block-form{background:transparent!important}
      body.dark-mode .sqs-block-button{background:transparent!important}
      body.dark-mode .sqs-block-spacer{background:transparent!important}
      body.dark-mode .sqs-block-divider{background:transparent!important}
      body.dark-mode .sqs-block-menu{background:transparent!important}
      body.dark-mode .sqs-block-socialaccountlinks{background:transparent!important}
      body.dark-mode .sqs-block-twitter{background:transparent!important}
      body.dark-mode .sqs-block-instagram{background:transparent!important}
      body.dark-mode .sqs-block-facebook{background:transparent!important}
      body.dark-mode .sqs-block-youtube{background:transparent!important}
      body.dark-mode .sqs-block-pinterest{background:transparent!important}
      body.dark-mode .sqs-block-tumblr{background:transparent!important}
      body.dark-mode .sqs-block-foursquare{background:transparent!important}
      body.dark-mode .sqs-block-vimeo{background:transparent!important}
      body.dark-mode .sqs-block-soundcloud{background:transparent!important}
      body.dark-mode .sqs-block-rss{background:transparent!important}
      body.dark-mode .sqs-block-linkedin{background:transparent!important}
      body.dark-mode .sqs-block-snapchat{background:transparent!important}
      body.dark-mode .sqs-block-medium{background:transparent!important}
      body.dark-mode .sqs-block-newsletter{background:transparent!important}
      body.dark-mode .sqs-block-calendar{background:transparent!important}
      body.dark-mode .sqs-block-gallery{background:transparent!important}
      body.dark-mode .sqs-block-map{background:transparent!important}
      body.dark-mode .sqs-block-audio{background:transparent!important}
      body.dark-mode .sqs-block-quote{background:transparent!important}
      body.dark-mode .sqs-block-animation{background:transparent!important}
      body.dark-mode .sqs-block-shape{background:transparent!important}
      body.dark-mode .sqs-block-chart{background:transparent!important}
      body.dark-mode .sqs-block-table{background:transparent!important}
      body.dark-mode .sqs-block-tagcloud{background:transparent!important}
      body.dark-mode .sqs-block-search{background:transparent!important}
      body.dark-mode .sqs-block-comments{background:transparent!important}
      body.dark-mode .sqs-block-blog{background:transparent!important}
      body.dark-mode .sqs-block-events{background:transparent!important}
      body.dark-mode .sqs-block-products{background:transparent!important}
      body.dark-mode .sqs-block-cart{background:transparent!important}
      body.dark-mode .sqs-block-newsletter{background:transparent!important}
      body.dark-mode .sqs-block-newsletter .newsletter-form{background:transparent!important}
      body.dark-mode .sqs-block-newsletter .newsletter-form-field-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-newsletter .newsletter-form-field-wrapper input{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-newsletter .newsletter-form-field-wrapper input::placeholder{color:#9ca3af!important}
      body.dark-mode .sqs-block-newsletter .newsletter-form-button{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .sqs-block-newsletter .newsletter-form-button:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .sqs-block-form .form-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list{background:transparent!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field{background:transparent!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field input{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field input::placeholder{color:#9ca3af!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field textarea{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field textarea::placeholder{color:#9ca3af!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field select{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field label{color:#f9fafb!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field .caption{color:#9ca3af!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field .field-error{color:#ef4444!important}
      body.dark-mode .sqs-block-form .form-wrapper .field-list .field .field-help{color:#9ca3af!important}
      body.dark-mode .sqs-block-form .form-wrapper .button{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .sqs-block-form .form-wrapper .button:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .sqs-block-button .sqs-block-button-element{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .sqs-block-button .sqs-block-button-element:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .sqs-block-button .sqs-block-button-element--primary{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .sqs-block-button .sqs-block-button-element--primary:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .sqs-block-button .sqs-block-button-element--secondary{background:transparent!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-button .sqs-block-button-element--secondary:hover{background:#374151!important;border-color:#6b7280!important}
      body.dark-mode .sqs-block-menu .menu{background:transparent!important}
      body.dark-mode .sqs-block-menu .menu .menu-item{background:transparent!important}
      body.dark-mode .sqs-block-menu .menu .menu-item a{color:#f9fafb!important}
      body.dark-mode .sqs-block-menu .menu .menu-item a:hover{color:#60a5fa!important}
      body.dark-mode .sqs-block-menu .menu .menu-item.active a{color:#60a5fa!important}
      body.dark-mode .sqs-block-menu .menu .menu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-menu .menu .menu-item .submenu{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-menu .menu .menu-item .submenu .menu-item{background:transparent!important}
      body.dark-mode .sqs-block-menu .menu .menu-item .submenu .menu-item a{color:#f9fafb!important}
      body.dark-mode .sqs-block-menu .menu .menu-item .submenu .menu-item a:hover{color:#60a5fa!important;background:#374151!important}
      body.dark-mode .sqs-block-menu .menu .menu-item .submenu .menu-item.active a{color:#60a5fa!important}
      body.dark-mode .sqs-block-menu .menu .menu-item .submenu .menu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-socialaccountlinks .sqs-svg-icon--wrapper{background:transparent!important}
      body.dark-mode .sqs-block-socialaccountlinks .sqs-svg-icon--wrapper svg{fill:#f9fafb!important}
      body.dark-mode .sqs-block-socialaccountlinks .sqs-svg-icon--wrapper:hover svg{fill:#60a5fa!important}
      body.dark-mode .sqs-block-image .image-block-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-image .image-block-wrapper img{opacity:0.95}
      body.dark-mode .sqs-block-image .image-block-wrapper:hover img{opacity:1}
      body.dark-mode .sqs-block-video .video-block-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-video .video-block-wrapper video{opacity:0.95}
      body.dark-mode .sqs-block-video .video-block-wrapper:hover video{opacity:1}
      body.dark-mode .sqs-block-gallery .gallery-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-gallery .gallery-wrapper .gallery-item{background:transparent!important}
      body.dark-mode .sqs-block-gallery .gallery-wrapper .gallery-item img{opacity:0.95}
      body.dark-mode .sqs-block-gallery .gallery-wrapper .gallery-item:hover img{opacity:1}
      body.dark-mode .sqs-block-quote .quote-block{background:transparent!important}
      body.dark-mode .sqs-block-quote .quote-block .quote-content{color:#f9fafb!important}
      body.dark-mode .sqs-block-quote .quote-block .quote-author{color:#9ca3af!important}
      body.dark-mode .sqs-block-quote .quote-block .quote-author::before{color:#4b5563!important}
      body.dark-mode .sqs-block-quote .quote-block .quote-author::after{color:#4b5563!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item .summary-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item .summary-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item .summary-metadata{color:#9ca3af!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item .summary-metadata a{color:#60a5fa!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item .summary-metadata a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-summary-v2 .summary-item .summary-thumbnail img{opacity:0.95}
      body.dark-mode .sqs-block-summary-v2 .summary-item:hover .summary-thumbnail img{opacity:1}
      body.dark-mode .sqs-block-blog .blog-item{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-blog .blog-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-blog .blog-item .blog-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-blog .blog-item .blog-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-blog .blog-item .blog-metadata{color:#9ca3af!important}
      body.dark-mode .sqs-block-blog .blog-item .blog-metadata a{color:#60a5fa!important}
      body.dark-mode .sqs-block-blog .blog-item .blog-metadata a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-blog .blog-item .blog-thumbnail img{opacity:0.95}
      body.dark-mode .sqs-block-blog .blog-item:hover .blog-thumbnail img{opacity:1}
      body.dark-mode .sqs-block-events .event-item{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-events .event-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-events .event-item .event-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-events .event-item .event-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-events .event-item .event-metadata{color:#9ca3af!important}
      body.dark-mode .sqs-block-events .event-item .event-metadata a{color:#60a5fa!important}
      body.dark-mode .sqs-block-events .event-item .event-metadata a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-events .event-item .event-thumbnail img{opacity:0.95}
      body.dark-mode .sqs-block-events .event-item:hover .event-thumbnail img{opacity:1}
      body.dark-mode .sqs-block-products .product-item{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-products .product-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-products .product-item .product-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-products .product-item .product-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-products .product-item .product-price{color:#f9fafb!important}
      body.dark-mode .sqs-block-products .product-item .product-price .product-price-on-sale{color:#ef4444!important}
      body.dark-mode .sqs-block-products .product-item .product-price .product-price-original{color:#9ca3af!important;text-decoration:line-through}
      body.dark-mode .sqs-block-products .product-item .product-metadata{color:#9ca3af!important}
      body.dark-mode .sqs-block-products .product-item .product-metadata a{color:#60a5fa!important}
      body.dark-mode .sqs-block-products .product-item .product-metadata a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-products .product-item .product-thumbnail img{opacity:0.95}
      body.dark-mode .sqs-block-products .product-item:hover .product-thumbnail img{opacity:1}
      body.dark-mode .sqs-block-cart .cart-item{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-cart .cart-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-cart .cart-item .cart-item-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-cart .cart-item .cart-item-price{color:#f9fafb!important}
      body.dark-mode .sqs-block-cart .cart-item .cart-item-quantity{color:#f9fafb!important}
      body.dark-mode .sqs-block-cart .cart-item .cart-item-total{color:#f9fafb!important}
      body.dark-mode .sqs-block-cart .cart-item .cart-item-remove{color:#ef4444!important}
      body.dark-mode .sqs-block-cart .cart-item .cart-item-remove:hover{color:#dc2626!important}
      body.dark-mode .sqs-block-cart .cart-total{color:#f9fafb!important}
      body.dark-mode .sqs-block-cart .cart-total .cart-total-label{color:#9ca3af!important}
      body.dark-mode .sqs-block-cart .cart-total .cart-total-amount{color:#f9fafb!important}
      body.dark-mode .sqs-block-cart .cart-checkout-button{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .sqs-block-cart .cart-checkout-button:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .sqs-block-search .search-input{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-search .search-input::placeholder{color:#9ca3af!important}
      body.dark-mode .sqs-block-search .search-button{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .sqs-block-search .search-button:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .sqs-block-search .search-results{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-search .search-results .search-result-item{background:transparent!important;border-color:#374151!important}
      body.dark-mode .sqs-block-search .search-results .search-result-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-search .search-results .search-result-item .search-result-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-search .search-results .search-result-item .search-result-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-search .search-results .search-result-item .search-result-metadata{color:#9ca3af!important}
      body.dark-mode .sqs-block-search .search-results .search-result-item .search-result-metadata a{color:#60a5fa!important}
      body.dark-mode .sqs-block-search .search-results .search-result-item .search-result-metadata a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-comments .comment-item{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-comments .comment-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-comments .comment-item .comment-author{color:#f9fafb!important}
      body.dark-mode .sqs-block-comments .comment-item .comment-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-comments .comment-item .comment-metadata{color:#9ca3af!important}
      body.dark-mode .sqs-block-comments .comment-item .comment-metadata a{color:#60a5fa!important}
      body.dark-mode .sqs-block-comments .comment-item .comment-metadata a:hover{color:#93c5fd!important}
      body.dark-mode .sqs-block-comments .comment-form{background:transparent!important}
      body.dark-mode .sqs-block-comments .comment-form .comment-form-field{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-comments .comment-form .comment-form-field::placeholder{color:#9ca3af!important}
      body.dark-mode .sqs-block-comments .comment-form .comment-form-button{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .sqs-block-comments .comment-form .comment-form-button:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .sqs-block-table .table-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-table .table-wrapper table{background:transparent!important;border-color:#374151!important}
      body.dark-mode .sqs-block-table .table-wrapper table th{background:#1f2937!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-table .table-wrapper table td{background:transparent!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-table .table-wrapper table tr:hover td{background:#374151!important}
      body.dark-mode .sqs-block-table .table-wrapper table tr:nth-child(even) td{background:#1f2937!important}
      body.dark-mode .sqs-block-table .table-wrapper table tr:nth-child(even):hover td{background:#374151!important}
      body.dark-mode .sqs-block-chart .chart-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-chart .chart-wrapper .chart-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-chart .chart-wrapper .chart-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-tagcloud .tagcloud-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-tagcloud .tagcloud-wrapper .tagcloud-item{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-tagcloud .tagcloud-wrapper .tagcloud-item:hover{background:#4b5563!important;border-color:#6b7280!important;color:#60a5fa!important}
      body.dark-mode .sqs-block-divider .divider-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-divider .divider-wrapper .divider-line{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-spacer .spacer-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-shape .shape-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-shape .shape-wrapper svg{fill:#f9fafb!important;stroke:#f9fafb!important}
      body.dark-mode .sqs-block-animation .animation-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-audio .audio-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-audio .audio-wrapper .audio-player{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-audio .audio-wrapper .audio-player .audio-controls{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-audio .audio-wrapper .audio-player .audio-controls:hover{color:#60a5fa!important}
      body.dark-mode .sqs-block-audio .audio-wrapper .audio-player .audio-progress{background:#4b5563!important}
      body.dark-mode .sqs-block-audio .audio-wrapper .audio-player .audio-progress .audio-progress-bar{background:#3b82f6!important}
      body.dark-mode .sqs-block-audio .audio-wrapper .audio-player .audio-time{color:#9ca3af!important}
      body.dark-mode .sqs-block-map .map-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-controls{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-controls:hover{background:#4b5563!important;border-color:#6b7280!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-marker{background:#3b82f6!important;border-color:#2563eb!important;color:#fff!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-marker:hover{background:#2563eb!important;border-color:#1d4ed8!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-popup{background:#1f2937!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-popup .map-popup-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-popup .map-popup-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-popup .map-popup-close{color:#9ca3af!important}
      body.dark-mode .sqs-block-map .map-wrapper .map-container .map-popup .map-popup-close:hover{color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper{background:transparent!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-header{background:#1f2937!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-header .calendar-nav{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-header .calendar-nav:hover{background:#374151!important;color:#60a5fa!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-header .calendar-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid{background:transparent!important;border-color:#374151!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day-header{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day{background:#1f2937!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.today{background:#3b82f6!important;border-color:#2563eb!important;color:#fff!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.today:hover{background:#2563eb!important;border-color:#1d4ed8!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.other-month{background:transparent!important;border-color:#374151!important;color:#6b7280!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.other-month:hover{background:#1f2937!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.has-events{background:#1f2937!important;border-color:#3b82f6!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.has-events:hover{background:#374151!important;border-color:#60a5fa!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.has-events .calendar-day-number{color:#3b82f6!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-grid .calendar-day.has-events:hover .calendar-day-number{color:#60a5fa!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events .calendar-event-item{background:transparent!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events .calendar-event-item:hover{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events .calendar-event-item .calendar-event-title{color:#f9fafb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events .calendar-event-item .calendar-event-content{color:#e5e7eb!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events .calendar-event-item .calendar-event-metadata{color:#9ca3af!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events .calendar-event-item .calendar-event-metadata a{color:#60a5fa!important}
      body.dark-mode .sqs-block-calendar .calendar-wrapper .calendar-events .calendar-event-item .calendar-event-metadata a:hover{color:#93c5fd!important}
      body.dark-mode .Header{background:#111827!important;border-color:#374151!important}
      body.dark-mode .Header-inner{background:#111827!important}
      body.dark-mode .Header-nav{background:transparent!important}
      body.dark-mode .Header-nav .Header-nav-item{background:transparent!important}
      body.dark-mode .Header-nav .Header-nav-item a{color:#f9fafb!important}
      body.dark-mode .Header-nav .Header-nav-item a:hover{color:#60a5fa!important}
      body.dark-mode .Header-nav .Header-nav-item.active a{color:#60a5fa!important}
      body.dark-mode .Header-nav .Header-nav-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Header-nav .Header-nav-item .Header-nav-submenu{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .Header-nav .Header-nav-item .Header-nav-submenu .Header-nav-submenu-item{background:transparent!important}
      body.dark-mode .Header-nav .Header-nav-item .Header-nav-submenu .Header-nav-submenu-item a{color:#f9fafb!important}
      body.dark-mode .Header-nav .Header-nav-item .Header-nav-submenu .Header-nav-submenu-item a:hover{color:#60a5fa!important;background:#374151!important}
      body.dark-mode .Header-nav .Header-nav-item .Header-nav-submenu .Header-nav-submenu-item.active a{color:#60a5fa!important}
      body.dark-mode .Header-nav .Header-nav-item .Header-nav-submenu .Header-nav-submenu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Header-logo{background:transparent!important}
      body.dark-mode .Header-logo img{opacity:0.95}
      body.dark-mode .Header-logo:hover img{opacity:1}
      body.dark-mode .Header-actions{background:transparent!important}
      body.dark-mode .Header-actions .Header-action{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .Header-actions .Header-action:hover{background:#374151!important;color:#60a5fa!important}
      body.dark-mode .Header-actions .Header-action.active{background:#3b82f6!important;color:#fff!important}
      body.dark-mode .Header-actions .Header-action.active:hover{background:#2563eb!important}
      body.dark-mode .Header-actions .Header-action .Header-action-icon{color:#f9fafb!important}
      body.dark-mode .Header-actions .Header-action:hover .Header-action-icon{color:#60a5fa!important}
      body.dark-mode .Header-actions .Header-action.active .Header-action-icon{color:#fff!important}
      body.dark-mode .Header-actions .Header-action.active:hover .Header-action-icon{color:#fff!important}
      body.dark-mode .Header-mobileNav{background:#111827!important;border-color:#374151!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-toggle{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-toggle:hover{background:#374151!important;color:#60a5fa!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item{background:transparent!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item a{color:#f9fafb!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item a:hover{color:#60a5fa!important;background:#374151!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item.active a{color:#60a5fa!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item .Header-mobileNav-submenu{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item .Header-mobileNav-submenu .Header-mobileNav-submenu-item{background:transparent!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item .Header-mobileNav-submenu .Header-mobileNav-submenu-item a{color:#f9fafb!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item .Header-mobileNav-submenu .Header-mobileNav-submenu-item a:hover{color:#60a5fa!important;background:#4b5563!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item .Header-mobileNav-submenu .Header-mobileNav-submenu-item.active a{color:#60a5fa!important}
      body.dark-mode .Header-mobileNav .Header-mobileNav-menu .Header-mobileNav-menu-item .Header-mobileNav-submenu .Header-mobileNav-submenu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Footer{background:#111827!important;border-color:#374151!important}
      body.dark-mode .Footer-inner{background:#111827!important}
      body.dark-mode .Footer-content{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .Footer-content a{color:#60a5fa!important}
      body.dark-mode .Footer-content a:hover{color:#93c5fd!important}
      body.dark-mode .Footer-nav{background:transparent!important}
      body.dark-mode .Footer-nav .Footer-nav-item{background:transparent!important}
      body.dark-mode .Footer-nav .Footer-nav-item a{color:#f9fafb!important}
      body.dark-mode .Footer-nav .Footer-nav-item a:hover{color:#60a5fa!important}
      body.dark-mode .Footer-nav .Footer-nav-item.active a{color:#60a5fa!important}
      body.dark-mode .Footer-nav .Footer-nav-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Footer-social{background:transparent!important}
      body.dark-mode .Footer-social .Footer-social-item{background:transparent!important}
      body.dark-mode .Footer-social .Footer-social-item a{color:#f9fafb!important}
      body.dark-mode .Footer-social .Footer-social-item a:hover{color:#60a5fa!important}
      body.dark-mode .Footer-social .Footer-social-item .Footer-social-icon{color:#f9fafb!important}
      body.dark-mode .Footer-social .Footer-social-item:hover .Footer-social-icon{color:#60a5fa!important}
      body.dark-mode .Footer-copyright{background:transparent!important;color:#9ca3af!important}
      body.dark-mode .Footer-copyright a{color:#60a5fa!important}
      body.dark-mode .Footer-copyright a:hover{color:#93c5fd!important}
      body.dark-mode .Site{background:#111827!important}
      body.dark-mode .Site-inner{background:#111827!important}
      body.dark-mode .Site-header{background:#111827!important}
      body.dark-mode .Site-header-inner{background:#111827!important}
      body.dark-mode .Site-header-nav{background:transparent!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item{background:transparent!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item a{color:#f9fafb!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item a:hover{color:#60a5fa!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item.active a{color:#60a5fa!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item .Site-header-nav-submenu{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item .Site-header-nav-submenu .Site-header-nav-submenu-item{background:transparent!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item .Site-header-nav-submenu .Site-header-nav-submenu-item a{color:#f9fafb!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item .Site-header-nav-submenu .Site-header-nav-submenu-item a:hover{color:#60a5fa!important;background:#374151!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item .Site-header-nav-submenu .Site-header-nav-submenu-item.active a{color:#60a5fa!important}
      body.dark-mode .Site-header-nav .Site-header-nav-item .Site-header-nav-submenu .Site-header-nav-submenu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Site-header-logo{background:transparent!important}
      body.dark-mode .Site-header-logo img{opacity:0.95}
      body.dark-mode .Site-header-logo:hover img{opacity:1}
      body.dark-mode .Site-header-actions{background:transparent!important}
      body.dark-mode .Site-header-actions .Site-header-action{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .Site-header-actions .Site-header-action:hover{background:#374151!important;color:#60a5fa!important}
      body.dark-mode .Site-header-actions .Site-header-action.active{background:#3b82f6!important;color:#fff!important}
      body.dark-mode .Site-header-actions .Site-header-action.active:hover{background:#2563eb!important}
      body.dark-mode .Site-header-actions .Site-header-action .Site-header-action-icon{color:#f9fafb!important}
      body.dark-mode .Site-header-actions .Site-header-action:hover .Site-header-action-icon{color:#60a5fa!important}
      body.dark-mode .Site-header-actions .Site-header-action.active .Site-header-action-icon{color:#fff!important}
      body.dark-mode .Site-header-actions .Site-header-action.active:hover .Site-header-action-icon{color:#fff!important}
      body.dark-mode .Site-header-mobileNav{background:#111827!important;border-color:#374151!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-toggle{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-toggle:hover{background:#374151!important;color:#60a5fa!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu{background:#1f2937!important;border-color:#374151!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item{background:transparent!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item a{color:#f9fafb!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item a:hover{color:#60a5fa!important;background:#374151!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item.active a{color:#60a5fa!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item .Site-header-mobileNav-submenu{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item .Site-header-mobileNav-submenu .Site-header-mobileNav-submenu-item{background:transparent!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item .Site-header-mobileNav-submenu .Site-header-mobileNav-submenu-item a{color:#f9fafb!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item .Site-header-mobileNav-submenu .Site-header-mobileNav-submenu-item a:hover{color:#60a5fa!important;background:#4b5563!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item .Site-header-mobileNav-submenu .Site-header-mobileNav-submenu-item.active a{color:#60a5fa!important}
      body.dark-mode .Site-header-mobileNav .Site-header-mobileNav-menu .Site-header-mobileNav-menu-item .Site-header-mobileNav-submenu .Site-header-mobileNav-submenu-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Site-footer{background:#111827!important}
      body.dark-mode .Site-footer-inner{background:#111827!important}
      body.dark-mode .Site-footer-content{background:transparent!important;color:#f9fafb!important}
      body.dark-mode .Site-footer-content a{color:#60a5fa!important}
      body.dark-mode .Site-footer-content a:hover{color:#93c5fd!important}
      body.dark-mode .Site-footer-nav{background:transparent!important}
      body.dark-mode .Site-footer-nav .Site-footer-nav-item{background:transparent!important}
      body.dark-mode .Site-footer-nav .Site-footer-nav-item a{color:#f9fafb!important}
      body.dark-mode .Site-footer-nav .Site-footer-nav-item a:hover{color:#60a5fa!important}
      body.dark-mode .Site-footer-nav .Site-footer-nav-item.active a{color:#60a5fa!important}
      body.dark-mode .Site-footer-nav .Site-footer-nav-item.active a:hover{color:#93c5fd!important}
      body.dark-mode .Site-footer-social{background:transparent!important}
      body.dark-mode .Site-footer-social .Site-footer-social-item{background:transparent!important}
      body.dark-mode .Site-footer-social .Site-footer-social-item a{color:#f9fafb!important}
      body.dark-mode .Site-footer-social .Site-footer-social-item a:hover{color:#60a5fa!important}
      body.dark-mode .Site-footer-social .Site-footer-social-item .Site-footer-social-icon{color:#f9fafb!important}
      body.dark-mode .Site-footer-social .Site-footer-social-item:hover .Site-footer-social-icon{color:#60a5fa!important}
      body.dark-mode .Site-footer-copyright{background:transparent!important;color:#9ca3af!important}
      body.dark-mode .Site-footer-copyright a{color:#60a5fa!important}
      body.dark-mode .Site-footer-copyright a:hover{color:#93c5fd!important}
      body.dark-mode h1,body.dark-mode h2,body.dark-mode h3,body.dark-mode h4,body.dark-mode h5,body.dark-mode h6{color:#f9fafb!important}
      body.dark-mode p{color:#e5e7eb!important}
      body.dark-mode a{color:#60a5fa!important}
      body.dark-mode a:hover{color:#93c5fd!important}
      body.dark-mode ul,body.dark-mode ol{color:#e5e7eb!important}
      body.dark-mode li{color:#e5e7eb!important}
      body.dark-mode blockquote{background:#1f2937!important;border-color:#374151!important;color:#e5e7eb!important}
      body.dark-mode code{background:#1f2937!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode pre{background:#1f2937!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode pre code{background:transparent!important;border-color:transparent!important;color:#f9fafb!important}
      body.dark-mode table{background:transparent!important;border-color:#374151!important}
      body.dark-mode table th{background:#1f2937!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode table td{background:transparent!important;border-color:#374151!important;color:#f9fafb!important}
      body.dark-mode table tr:hover td{background:#374151!important}
      body.dark-mode table tr:nth-child(even) td{background:#1f2937!important}
      body.dark-mode table tr:nth-child(even):hover td{background:#374151!important}
      body.dark-mode hr{background:#374151!important;border-color:#4b5563!important}
      body.dark-mode img{opacity:0.95}
      body.dark-mode img:hover{opacity:1}
      body.dark-mode svg{fill:#f9fafb!important;stroke:#f9fafb!important}
      body.dark-mode svg:hover{fill:#60a5fa!important;stroke:#60a5fa!important}
      body.dark-mode input[type="text"],body.dark-mode input[type="email"],body.dark-mode input[type="password"],body.dark-mode input[type="number"],body.dark-mode input[type="tel"],body.dark-mode input[type="url"],body.dark-mode input[type="search"],body.dark-mode input[type="date"],body.dark-mode input[type="time"],body.dark-mode input[type="datetime-local"],body.dark-mode input[type="month"],body.dark-mode input[type="week"],body.dark-mode textarea,body.dark-mode select{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode input[type="text"]::placeholder,body.dark-mode input[type="email"]::placeholder,body.dark-mode input[type="password"]::placeholder,body.dark-mode input[type="number"]::placeholder,body.dark-mode input[type="tel"]::placeholder,body.dark-mode input[type="url"]::placeholder,body.dark-mode input[type="search"]::placeholder,body.dark-mode input[type="date"]::placeholder,body.dark-mode input[type="time"]::placeholder,body.dark-mode input[type="datetime-local"]::placeholder,body.dark-mode input[type="month"]::placeholder,body.dark-mode input[type="week"]::placeholder,body.dark-mode textarea::placeholder{color:#9ca3af!important}
      body.dark-mode input[type="text"]:focus,body.dark-mode input[type="email"]:focus,body.dark-mode input[type="password"]:focus,body.dark-mode input[type="number"]:focus,body.dark-mode input[type="tel"]:focus,body.dark-mode input[type="url"]:focus,body.dark-mode input[type="search"]:focus,body.dark-mode input[type="date"]:focus,body.dark-mode input[type="time"]:focus,body.dark-mode input[type="datetime-local"]:focus,body.dark-mode input[type="month"]:focus,body.dark-mode input[type="week"]:focus,body.dark-mode textarea:focus,body.dark-mode select:focus{background:#4b5563!important;border-color:#60a5fa!important;color:#f9fafb!important;outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode input[type="checkbox"],body.dark-mode input[type="radio"]{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode input[type="checkbox"]:checked,body.dark-mode input[type="radio"]:checked{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode input[type="checkbox"]:focus,body.dark-mode input[type="radio"]:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode button{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode button:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode button:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode button.secondary{background:transparent!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode button.secondary:hover{background:#374151!important;border-color:#6b7280!important}
      body.dark-mode button.secondary:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode button.danger{background:#ef4444!important;border-color:#ef4444!important;color:#fff!important}
      body.dark-mode button.danger:hover{background:#dc2626!important;border-color:#dc2626!important}
      body.dark-mode button.danger:focus{outline:none!important;box-shadow:0 0 0 3px rgba(239,68,68,0.1)!important}
      body.dark-mode button.success{background:#10b981!important;border-color:#10b981!important;color:#fff!important}
      body.dark-mode button.success:hover{background:#059669!important;border-color:#059669!important}
      body.dark-mode button.success:focus{outline:none!important;box-shadow:0 0 0 3px rgba(16,185,129,0.1)!important}
      body.dark-mode button.warning{background:#f59e0b!important;border-color:#f59e0b!important;color:#fff!important}
      body.dark-mode button.warning:hover{background:#d97706!important;border-color:#d97706!important}
      body.dark-mode button.warning:focus{outline:none!important;box-shadow:0 0 0 3px rgba(245,158,11,0.1)!important}
      body.dark-mode button.info{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode button.info:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode button.info:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode button.link{background:transparent!important;border-color:transparent!important;color:#60a5fa!important}
      body.dark-mode button.link:hover{background:transparent!important;border-color:transparent!important;color:#93c5fd!important;text-decoration:underline}
      body.dark-mode button.link:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode .btn{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .btn:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .btn:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode .btn-secondary{background:transparent!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .btn-secondary:hover{background:#374151!important;border-color:#6b7280!important}
      body.dark-mode .btn-secondary:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode .btn-danger{background:#ef4444!important;border-color:#ef4444!important;color:#fff!important}
      body.dark-mode .btn-danger:hover{background:#dc2626!important;border-color:#dc2626!important}
      body.dark-mode .btn-danger:focus{outline:none!important;box-shadow:0 0 0 3px rgba(239,68,68,0.1)!important}
      body.dark-mode .btn-success{background:#10b981!important;border-color:#10b981!important;color:#fff!important}
      body.dark-mode .btn-success:hover{background:#059669!important;border-color:#059669!important}
      body.dark-mode .btn-success:focus{outline:none!important;box-shadow:0 0 0 3px rgba(16,185,129,0.1)!important}
      body.dark-mode .btn-warning{background:#f59e0b!important;border-color:#f59e0b!important;color:#fff!important}
      body.dark-mode .btn-warning:hover{background:#d97706!important;border-color:#d97706!important}
      body.dark-mode .btn-warning:focus{outline:none!important;box-shadow:0 0 0 3px rgba(245,158,11,0.1)!important}
      body.dark-mode .btn-info{background:#3b82f6!important;border-color:#3b82f6!important;color:#fff!important}
      body.dark-mode .btn-info:hover{background:#2563eb!important;border-color:#2563eb!important}
      body.dark-mode .btn-info:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode .btn-link{background:transparent!important;border-color:transparent!important;color:#60a5fa!important}
      body.dark-mode .btn-link:hover{background:transparent!important;border-color:transparent!important;color:#93c5fd!important;text-decoration:underline}
      body.dark-mode .btn-link:focus{outline:none!important;box-shadow:0 0 0 3px rgba(59,130,246,0.1)!important}
      body.dark-mode .ssa-controls{border-bottom-color:#374151!important}
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
      body.dark-mode .ssa-date-clear-btn,body.dark-mode .ssa-date-clear-btn:hover{background:transparent!important;border-color:transparent!important;color:#f9fafb!important}
      body.dark-mode .ssa-date-input{background:#374151!important;border-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-date-filters label{color:#f9fafb!important}
      body.dark-mode .ssa-month-header{color:#f9fafb!important}
      body.dark-mode .ssa-day-header,body.dark-mode .ssa-day-header *,body.dark-mode #events-list .ssa-day-header,body.dark-mode #events-list .ssa-day-header *{color:#f9fafb!important}
      body.dark-mode h3.ssa-day-header,body.dark-mode h3.ssa-day-header *{color:#f9fafb!important}
      body.dark-mode .ssa-calendar-month-header{color:#f9fafb!important}
      body.dark-mode .ssa-event-item{background:#1f2937!important;border-color:#374151!important;box-shadow:0 1px 3px rgba(0,0,0,0.2)!important}
      body.dark-mode .ssa-event-item:hover{background:#374151!important;box-shadow:0 4px 12px rgba(0,0,0,0.3)!important}
      body.dark-mode .ssa-event-name-wrapper strong{color:#f9fafb!important}
      body.dark-mode .ssa-event-name{color:#f9fafb!important}
      body.dark-mode .ssa-event-name,.ssa-event-meta-item{color:#e5e7eb!important}
      body.dark-mode .ssa-event-meta-item,.ssa-event-meta-item *{color:#e5e7eb!important}
      body.dark-mode #events-list .ssa-event-meta-item,#events-list .ssa-event-meta-item *{color:#e5e7eb!important}
      body.dark-mode div.ssa-event-meta-item,div.ssa-event-meta-item *{color:#e5e7eb!important}
      body.dark-mode .ssa-event-meta-item strong{color:#f9fafb!important}
      body.dark-mode #events-list .ssa-event-meta-item strong,.ssa-event-meta-item strong *,#events-list .ssa-event-meta-item strong *{color:#f9fafb!important}
      body.dark-mode .ssa-card{background:#1f2937!important;border-color:#374151!important;box-shadow:0 2px 8px rgba(0,0,0,0.2)!important}
      body.dark-mode .ssa-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.4)!important;border-color:#4b5563!important}
      body.dark-mode .ssa-card *{color:#f9fafb!important}
      body.dark-mode .ssa-title,.ssa-meta{color:#f9fafb!important}
      body.dark-mode .ssa-card .ssa-location{color:#60a5fa!important}
      body.dark-mode .ssa-card .ssa-location:hover{color:#93c5fd!important}
      body.dark-mode .ssa-card h3{color:#f9fafb!important}
      body.dark-mode .ssa-card p{color:#f9fafb!important}
      body.dark-mode .ssa-card span{color:#f9fafb!important}
      body.dark-mode .ssa-card strong{color:#f9fafb!important}
      body.dark-mode .ssa-card a{color:#60a5fa!important}
      body.dark-mode .ssa-card a:hover{color:#93c5fd!important}
      body.dark-mode .ssa-calendar-day{background:#1f2937!important}
      body.dark-mode .ssa-calendar-day:hover{background:#374151!important}
      body.dark-mode .ssa-calendar-day-empty{background:#111827!important}
      body.dark-mode .ssa-calendar-day-out-of-range{opacity:0.3;background:#1f2937!important}
      body.dark-mode .ssa-calendar-day-out-of-range .ssa-calendar-day-number{color:#6b7280!important}
      body.dark-mode .ssa-calendar-day-header{background:#374151!important;color:#d1d5db!important}
      body.dark-mode .ssa-calendar-day-number{color:#f9fafb!important}
      body.dark-mode .ssa-calendar-grid{background:#374151!important;border-color:#374151!important;box-shadow:0 2px 8px rgba(0,0,0,0.3)!important}
      body.dark-mode .ssa-day-header{border-bottom-color:#4b5563!important;color:#f9fafb!important}
      body.dark-mode .ssa-day-header *,body.dark-mode #events-list .ssa-day-header,body.dark-mode #events-list .ssa-day-header *{color:#f9fafb!important}
      body.dark-mode h3.ssa-day-header,body.dark-mode h3.ssa-day-header *{color:#f9fafb!important}
      body.dark-mode .ssa-month-header{color:#f9fafb!important}
      body.dark-mode .ssa-calendar-month-header{color:#f9fafb!important}
      body.dark-mode #events-list .ssa-keyword-tag-clickable,body.dark-mode #events-list .ssa-tag-clickable,html.dark-mode #events-list .ssa-keyword-tag-clickable,html.dark-mode #events-list .ssa-tag-clickable{color:var(--ssa-keyword-tag-fg,#d4cec6)!important;border-color:var(--ssa-keyword-tag-border,#9a9288)!important;-webkit-text-fill-color:var(--ssa-keyword-tag-fg,#d4cec6)!important;background:transparent!important}
      body.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,body.dark-mode #events-list .ssa-keywords .ssa-tag-clickable,html.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,html.dark-mode #events-list .ssa-keywords .ssa-tag-clickable{color:var(--ssa-keyword-tag-fg,#d4cec6)!important;border-color:var(--ssa-keyword-tag-border,#9a9288)!important;-webkit-text-fill-color:var(--ssa-keyword-tag-fg,#d4cec6)!important;background:transparent!important}
    `;
    document.head.appendChild(css);
    
    // Inject additional dark mode styles with maximum specificity for Squarespace
    const sqsDarkModeCSS = document.createElement('style');
    sqsDarkModeCSS.id = 'ssa-sqs-dark-mode';
    sqsDarkModeCSS.textContent = `
      html.dark-mode,html body.dark-mode,body.dark-mode{background:#111827!important;color:#f9fafb!important}
      html.dark-mode body,html body.dark-mode body,body.dark-mode{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #siteWrapper,html body.dark-mode #siteWrapper,body.dark-mode #siteWrapper{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #site,html body.dark-mode #site,body.dark-mode #site{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #mainContent,html body.dark-mode #mainContent,body.dark-mode #mainContent{background:#111827!important;color:#f9fafb!important}
      html.dark-mode #content,html body.dark-mode #content,body.dark-mode #content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Main-content,html body.dark-mode .Main-content,body.dark-mode .Main-content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Main,html body.dark-mode .Main,body.dark-mode .Main{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Main-inner,html body.dark-mode .Main-inner,body.dark-mode .Main-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Content,html body.dark-mode .Content,body.dark-mode .Content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Content-inner,html body.dark-mode .Content-inner,body.dark-mode .Content-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .page,html body.dark-mode .page,body.dark-mode .page{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .page-content,html body.dark-mode .page-content,body.dark-mode .page-content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-layout,html body.dark-mode .sqs-layout,body.dark-mode .sqs-layout{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-wrapper,html body.dark-mode .sqs-wrapper,body.dark-mode .sqs-wrapper{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-container,html body.dark-mode .sqs-container,body.dark-mode .sqs-container{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Site,html body.dark-mode .Site,body.dark-mode .Site{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Site-inner,html body.dark-mode .Site-inner,body.dark-mode .Site-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Header,html body.dark-mode .Header,body.dark-mode .Header{background:#111827!important;color:#f9fafb!important;border-color:#374151!important}
      html.dark-mode .Header-inner,html body.dark-mode .Header-inner,body.dark-mode .Header-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Header-nav,html body.dark-mode .Header-nav,body.dark-mode .Header-nav{background:transparent!important}
      html.dark-mode .Header-nav-item,html body.dark-mode .Header-nav-item,body.dark-mode .Header-nav-item{background:transparent!important}
      html.dark-mode .Header-nav-item a,html body.dark-mode .Header-nav-item a,body.dark-mode .Header-nav-item a{color:#f9fafb!important}
      html.dark-mode .Header-nav-item a:hover,html body.dark-mode .Header-nav-item a:hover,body.dark-mode .Header-nav-item a:hover{color:#60a5fa!important}
      html.dark-mode .Header-logo,html body.dark-mode .Header-logo,body.dark-mode .Header-logo{background:transparent!important}
      html.dark-mode .Footer,html body.dark-mode .Footer,body.dark-mode .Footer{background:#111827!important;color:#f9fafb!important;border-color:#374151!important}
      html.dark-mode .Footer-inner,html body.dark-mode .Footer-inner,body.dark-mode .Footer-inner{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .Footer-nav,html body.dark-mode .Footer-nav,body.dark-mode .Footer-nav{background:transparent!important}
      html.dark-mode .Footer-nav-item,html body.dark-mode .Footer-nav-item,body.dark-mode .Footer-nav-item{background:transparent!important}
      html.dark-mode .Footer-nav-item a,html body.dark-mode .Footer-nav-item a,body.dark-mode .Footer-nav-item a{color:#f9fafb!important}
      html.dark-mode .Footer-nav-item a:hover,html body.dark-mode .Footer-nav-item a:hover,body.dark-mode .Footer-nav-item a:hover{color:#60a5fa!important}
      html.dark-mode .sqs-row,html body.dark-mode .sqs-row,body.dark-mode .sqs-row{background:transparent!important}
      html.dark-mode .sqs-col,html body.dark-mode .sqs-col,body.dark-mode .sqs-col{background:transparent!important}
      html.dark-mode .sqs-block,html body.dark-mode .sqs-block,body.dark-mode .sqs-block{background:transparent!important}
      html.dark-mode .sqs-block-content,html body.dark-mode .sqs-block-content,body.dark-mode .sqs-block-content{background:transparent!important}
      html.dark-mode .section,html body.dark-mode .section,body.dark-mode .section{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-section,html body.dark-mode .sqs-section,body.dark-mode .sqs-section{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-section-content,html body.dark-mode .sqs-section-content,body.dark-mode .sqs-section-content{background:#111827!important;color:#f9fafb!important}
      html.dark-mode .sqs-block-alignment-wrapper,html body.dark-mode .sqs-block-alignment-wrapper,body.dark-mode .sqs-block-alignment-wrapper{background:transparent!important}
      html.dark-mode .sqs-block-html,html body.dark-mode .sqs-block-html,body.dark-mode .sqs-block-html{background:transparent!important}
      html.dark-mode .sqs-block-code,html body.dark-mode .sqs-block-code,body.dark-mode .sqs-block-code{background:transparent!important}
      html.dark-mode .sqs-block-markdown,html body.dark-mode .sqs-block-markdown,body.dark-mode .sqs-block-markdown{background:transparent!important}
      html.dark-mode .sqs-block-embed,html body.dark-mode .sqs-block-embed,body.dark-mode .sqs-block-embed{background:transparent!important}
      html.dark-mode header,html body.dark-mode header,body.dark-mode header{background:#111827!important;color:#f9fafb!important}
      html.dark-mode footer,html body.dark-mode footer,body.dark-mode footer{background:#111827!important;color:#f9fafb!important}
      html.dark-mode nav,html body.dark-mode nav,body.dark-mode nav{background:transparent!important;color:#f9fafb!important}
      html.dark-mode nav a,html body.dark-mode nav a,body.dark-mode nav a{color:#f9fafb!important}
      html.dark-mode nav a:hover,html body.dark-mode nav a:hover,body.dark-mode nav a:hover{color:#60a5fa!important}
      html.dark-mode h1,html body.dark-mode h1,body.dark-mode h1,html.dark-mode h2,html body.dark-mode h2,body.dark-mode h2,html.dark-mode h3,html body.dark-mode h3,body.dark-mode h3,html.dark-mode h4,html body.dark-mode h4,body.dark-mode h4,html.dark-mode h5,html body.dark-mode h5,body.dark-mode h5,html.dark-mode h6,html body.dark-mode h6,body.dark-mode h6{color:#f9fafb!important}
      html.dark-mode p,html body.dark-mode p,body.dark-mode p{color:#e5e7eb!important}
      html.dark-mode a,html body.dark-mode a,body.dark-mode a{color:#60a5fa!important}
      html.dark-mode a:hover,html body.dark-mode a:hover,body.dark-mode a:hover{color:#93c5fd!important}
      html.dark-mode .ssa-day-header,html body.dark-mode .ssa-day-header,body.dark-mode .ssa-day-header{color:#f9fafb!important}
      html.dark-mode .ssa-day-header *,html body.dark-mode .ssa-day-header *,body.dark-mode .ssa-day-header *{color:#f9fafb!important}
      html.dark-mode #events-list .ssa-day-header,html body.dark-mode #events-list .ssa-day-header,body.dark-mode #events-list .ssa-day-header{color:#f9fafb!important}
      html.dark-mode #events-list .ssa-day-header *,html body.dark-mode #events-list .ssa-day-header *,body.dark-mode #events-list .ssa-day-header *{color:#f9fafb!important}
      html.dark-mode h3.ssa-day-header,html body.dark-mode h3.ssa-day-header,body.dark-mode h3.ssa-day-header{color:#f9fafb!important}
      html.dark-mode h3.ssa-day-header *,html body.dark-mode h3.ssa-day-header *,body.dark-mode h3.ssa-day-header *{color:#f9fafb!important}
      html.dark-mode .ssa-month-header,html body.dark-mode .ssa-month-header,body.dark-mode .ssa-month-header{color:#f9fafb!important}
      html.dark-mode .ssa-calendar-month-header,html body.dark-mode .ssa-calendar-month-header,body.dark-mode .ssa-calendar-month-header{color:#f9fafb!important}
      html.dark-mode #events-list .ssa-keyword-tag-clickable,html.dark-mode #events-list .ssa-tag-clickable,html body.dark-mode #events-list .ssa-keyword-tag-clickable,html body.dark-mode #events-list .ssa-tag-clickable,body.dark-mode #events-list .ssa-keyword-tag-clickable,body.dark-mode #events-list .ssa-tag-clickable{color:var(--ssa-keyword-tag-fg,#d4cec6)!important;border-color:var(--ssa-keyword-tag-border,#9a9288)!important;-webkit-text-fill-color:var(--ssa-keyword-tag-fg,#d4cec6)!important;background:transparent!important}
      html.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,html.dark-mode #events-list .ssa-keywords .ssa-tag-clickable,html body.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,html body.dark-mode #events-list .ssa-keywords .ssa-tag-clickable,body.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,body.dark-mode #events-list .ssa-keywords .ssa-tag-clickable{color:var(--ssa-keyword-tag-fg,#d4cec6)!important;border-color:var(--ssa-keyword-tag-border,#9a9288)!important;-webkit-text-fill-color:var(--ssa-keyword-tag-fg,#d4cec6)!important;background:transparent!important}
      html.dark-mode div:not(.sqs-block):not(.sqs-block-content):not(.sqs-block-html):not(.sqs-block-code):not(.sqs-block-markdown):not(.sqs-block-embed),html body.dark-mode div:not(.sqs-block):not(.sqs-block-content):not(.sqs-block-html):not(.sqs-block-code):not(.sqs-block-markdown):not(.sqs-block-embed),body.dark-mode div:not(.sqs-block):not(.sqs-block-content):not(.sqs-block-html):not(.sqs-block-code):not(.sqs-block-markdown):not(.sqs-block-embed){background-color:inherit!important}
      html.dark-mode *:not(.ssa-keyword-tag-clickable):not(.ssa-tag-clickable),html body.dark-mode *:not(.ssa-keyword-tag-clickable):not(.ssa-tag-clickable){color:inherit}
    `;
    document.head.appendChild(sqsDarkModeCSS);

    const designCSS = document.createElement('style');
    designCSS.id = 'ssa-events-design-v2';
    designCSS.textContent = `
      :root{
        --ssa-bg:#f6f2ec;
        --ssa-surface:#fffdfb;
        --ssa-surface-soft:#f4efe8;
        --ssa-text:#1f2633;
        --ssa-muted:#6f7b91;
        --ssa-border:#ddd4c8;
        --ssa-border-soft:#eee7de;
        --ssa-control-border:#c4b8aa;
        --ssa-accent:#a93326;
        --ssa-accent-soft:#e4b8ae;
        --ssa-event-title:#8f2c22;
        --ssa-shadow:0 18px 36px rgba(75,55,32,.09);
        --ssa-sticky-bar-shadow:0 12px 30px rgba(26,19,15,.12);
        --ssa-sticky-bar-bg:#ede6dc;
        --ssa-sticky-control-fill:#f8f4ee;
        --ssa-font:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      }
      html.dark-mode,body.dark-mode{
        --ssa-bg:#1a130f;
        --ssa-surface:#241d16;
        --ssa-surface-soft:#19120e;
        --ssa-text:#fbf7ef;
        --ssa-muted:#b6aa9d;
        --ssa-border:#42372d;
        --ssa-border-soft:#302821;
        --ssa-control-border:#6f6356;
        --ssa-accent:#f07961;
        --ssa-accent-soft:#7c3d30;
        --ssa-event-title:#ffad9b;
        --ssa-keyword-tag-fg:#d4cec6;
        --ssa-keyword-tag-border:#9a9288;
        --ssa-shadow:none;
        --ssa-sticky-bar-shadow:0 16px 42px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.10);
        --ssa-sticky-bar-bg:#524538;
        --ssa-sticky-panel-border:#c9b8a4;
        --ssa-sticky-control-fill:#1a130f;
        --ssa-sticky-control-fg:#fbf7ef;
        --ssa-sticky-control-border:#d9cbb8;
      }
      #events-list,#events-list *{box-sizing:border-box;font-family:var(--ssa-font);letter-spacing:0}
      #events-list{--ssa-content-max:1536px;--ssa-content-gutter:clamp(24px,3vw,64px)}
      #events-list{max-width:100%;margin:0 auto;padding:48px 0 28px;color:var(--ssa-text)!important;background:var(--ssa-bg)!important}
      #events-list .ssa-page-intro{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 42px;padding:0}
      #events-list .ssa-page-intro-head{display:flex;align-items:flex-start;gap:24px}
      #events-list .ssa-brand-block{flex:0 0 auto;width:min(18vw,132px);display:flex;flex-direction:column;align-items:center;gap:9px}
      #events-list .ssa-brand-mark{position:relative;z-index:1;flex:0 0 auto;display:block;line-height:0;margin-top:2px;cursor:pointer}
      #events-list .ssa-brand-mark img{width:100%;height:auto;display:block;border-radius:8px}
      #events-list .ssa-brand-tagline{margin:0!important;color:var(--ssa-accent)!important;font-size:15px!important;line-height:1.18!important;font-weight:800!important;text-align:center}
      #events-list .ssa-page-intro-copy{min-width:0}
      #events-list .ssa-page-intro h1{margin:0 0 16px;color:var(--ssa-text)!important;font-size:64px;line-height:1.05;font-weight:800;letter-spacing:.01em}
      #events-list .ssa-page-intro p{margin:0;color:var(--ssa-muted)!important;font-size:25px;line-height:1.35;font-weight:400}
      #events-list .ssa-page-intro-credit{margin:14px 0 0!important;font-size:18px!important;line-height:1.4!important;font-weight:600!important}
      #events-list .ssa-page-intro-credit a{color:var(--ssa-accent)!important;text-decoration:none;font-weight:800}
      #events-list .ssa-page-intro-credit a:hover,#events-list .ssa-page-intro-credit a:focus-visible{text-decoration:underline}
      #events-list .ssa-controls{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 18px;padding:34px 32px 30px;display:flex;flex-direction:column;gap:26px;background:var(--ssa-surface)!important;border:1px solid var(--ssa-border)!important;border-radius:12px;box-shadow:var(--ssa-shadow)}
      #events-list .ssa-control-panel{max-width:var(--ssa-content-max);margin:0 auto 18px;padding:20px 32px;background:color-mix(in srgb,var(--ssa-surface) 96%,transparent)!important;border:1px solid var(--ssa-border)!important;border-radius:12px;box-shadow:var(--ssa-shadow);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
      #events-list .ssa-sticky-control-section{position:sticky;z-index:38}
      #events-list .ssa-sticky-date-section{top:0;z-index:40}
      #events-list .ssa-sticky-view-section{top:calc(var(--ssa-sticky-date-height,156px) + 8px);z-index:39}
      #events-list .ssa-sticky-keyword-section{top:calc(var(--ssa-sticky-date-height,156px) + var(--ssa-sticky-view-height,96px) + 16px);z-index:38}
      #events-list .ssa-sticky-control-section.ssa-is-stuck{background:var(--ssa-sticky-bar-bg)!important;border:1px solid var(--ssa-border)!important;box-shadow:var(--ssa-sticky-bar-shadow)!important;backdrop-filter:blur(16px) saturate(1.08)!important;-webkit-backdrop-filter:blur(16px) saturate(1.08)!important}
      html.dark-mode #events-list .ssa-sticky-control-section.ssa-is-stuck,body.dark-mode #events-list .ssa-sticky-control-section.ssa-is-stuck{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border:2px solid var(--ssa-sticky-panel-border)!important;box-shadow:var(--ssa-sticky-bar-shadow)!important}
      html.dark-mode #events-list .ssa-sticky-control-section,body.dark-mode #events-list .ssa-sticky-control-section{background:var(--ssa-sticky-bar-bg)!important;border:2px solid var(--ssa-sticky-panel-border)!important;box-shadow:var(--ssa-sticky-bar-shadow)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      html.dark-mode #events-list .ssa-sticky-view-section,body.dark-mode #events-list .ssa-sticky-view-section{background:var(--ssa-sticky-bar-bg)!important;border:2px solid var(--ssa-sticky-panel-border)!important;box-shadow:var(--ssa-sticky-bar-shadow)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      #events-list .ssa-sticky-control-section.ssa-is-stuck .ssa-filter-menu summary,#events-list .ssa-sticky-control-section.ssa-is-stuck .ssa-date-input{background:var(--ssa-sticky-control-fill)!important}
      #events-list .ssa-sticky-date-section.ssa-is-stuck{z-index:41}
      #events-list .ssa-sticky-view-section.ssa-is-stuck{z-index:40}
      #events-list .ssa-sticky-keyword-section.ssa-is-stuck{z-index:39}
      #events-list .ssa-controls-heading-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 8px}
      #events-list .ssa-controls-heading span,#events-list .ssa-results-summary span,#events-list .ssa-control-label{display:block;margin:0 0 8px;color:var(--ssa-muted)!important;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      #events-list .ssa-sticky-date-section .ssa-date-label,#events-list .ssa-sticky-view-section .ssa-layout-switcher-wrapper,#events-list .ssa-sticky-view-section .ssa-group-switcher-wrapper{transition:opacity .18s ease,transform .24s ease}
      #events-list .ssa-sticky-date-section .ssa-date-label,#events-list .ssa-sticky-view-section .ssa-control-label,#events-list .ssa-sticky-keyword-section .ssa-control-label{max-height:22px;overflow:hidden;opacity:1;transform:translateY(0);transition:opacity .18s ease,transform .24s ease,max-height .24s ease,margin .24s ease}
      #events-list .ssa-sticky-date-section.ssa-is-stuck .ssa-date-label,#events-list .ssa-sticky-view-section.ssa-is-stuck .ssa-control-label,#events-list .ssa-sticky-keyword-section.ssa-is-stuck .ssa-control-label{max-height:0!important;margin:0!important;opacity:0!important;transform:translateY(-5px)!important;pointer-events:none}
      #events-list .ssa-sticky-view-section.ssa-is-stuck .ssa-layout-switcher-wrapper,#events-list .ssa-sticky-view-section.ssa-is-stuck .ssa-group-switcher-wrapper{gap:0}
      #events-list .ssa-controls-heading-top > span{margin:0}
      #events-list .ssa-controls-heading h2{margin:0 0 8px;color:var(--ssa-text)!important;font-size:32px;line-height:1.15;font-weight:800}
      #events-list .ssa-controls-heading p{margin:0;color:var(--ssa-muted)!important;font-size:21px;line-height:1.35}
      #events-list .ssa-date-filters-section,#events-list .ssa-view-controls-section,#events-list .ssa-keyword-filters-section{background:color-mix(in srgb,var(--ssa-surface) 96%,transparent)!important}
      #events-list .ssa-view-controls-section:not(.ssa-is-stuck){background:color-mix(in srgb,var(--ssa-surface) 96%,transparent)!important;border-color:var(--ssa-border)!important;box-shadow:var(--ssa-shadow)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important}
      #events-list .ssa-compact-filter-shell{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);min-width:0;margin:0 auto 18px;position:sticky;top:0;z-index:42;overflow:visible}
      #events-list .ssa-compact-filter-shell > .ssa-sticky-control-section{position:static;min-width:0;max-width:100%}
      #events-list .ssa-date-filters{display:flex;flex-direction:column;align-items:stretch;gap:8px;justify-content:flex-start}
      #events-list .ssa-date-labels-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 58px;gap:16px;align-items:center;width:100%}
      #events-list .ssa-date-label{display:block;padding-left:2px;color:var(--ssa-muted)!important;font-size:17px;font-weight:700;line-height:1.2}
      #events-list .ssa-date-inputs-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:flex-end;width:100%;min-width:0}
      #events-list .ssa-date-input{width:190px;height:58px;padding:0 14px;background:var(--ssa-surface-soft)!important;border:1px solid var(--ssa-control-border)!important;border-radius:10px;color:var(--ssa-text)!important;font-size:19px;font-weight:700;box-shadow:0 1px 0 rgba(255,255,255,.35) inset!important}
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-date-input,body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-input{box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 2px 10px rgba(0,0,0,.22)!important}
      #events-list button{font-family:var(--ssa-font);letter-spacing:0}
      #events-list .ssa-weekend-btn,#events-list .ssa-clear-dates,#events-list .ssa-date-clear-btn,#events-list .ssa-layout-btn,#events-list .ssa-group-btn,#events-list .ssa-show-images-toggle,#events-list .ssa-signature-events-toggle,#events-list .ssa-dark-mode-toggle,#events-list .ssa-keyword-btn{height:52px;padding:0 22px;display:inline-flex;align-items:center;justify-content:center;background:var(--ssa-surface)!important;border:1px solid var(--ssa-border-soft)!important;border-radius:10px;color:var(--ssa-muted)!important;font-size:20px;font-weight:700;line-height:1;box-shadow:none!important;transform:none!important;white-space:nowrap}
      #events-list .ssa-date-clear-btn{width:58px;height:32px;padding:0;border-color:transparent!important;border-radius:999px;background:transparent!important;font-size:0;color:transparent!important;align-self:center;justify-self:center}
      #events-list .ssa-date-clear-btn::before{content:'×';display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;border:1px solid currentColor;color:var(--ssa-muted)!important;font-size:18px;font-weight:800;line-height:1;transition:transform .22s ease,border-color .22s ease,color .22s ease,box-shadow .22s ease}
      #events-list .ssa-dark-mode-toggle{width:auto!important;flex:0 0 auto;height:36px;min-width:92px;padding:0 10px 0 8px;gap:7px;border-radius:999px;background:var(--ssa-surface-soft)!important;color:var(--ssa-text)!important;font-size:13px;font-weight:800;text-transform:none}
      #events-list .ssa-theme-icon{position:relative;width:20px;min-width:20px;height:20px;flex:0 0 20px;display:inline-flex!important;align-items:center;justify-content:center;border-radius:999px;background:var(--ssa-accent)!important;box-shadow:inset -5px 0 0 rgba(0,0,0,.18)}
      #events-list .ssa-theme-icon::after{content:'';width:6px;height:6px;border-radius:999px;background:var(--ssa-surface)!important;box-shadow:6px 3px 0 -1px var(--ssa-surface),2px 8px 0 -2px var(--ssa-surface)}
      #events-list .ssa-theme-text{display:inline!important;margin:0!important;color:inherit!important;font-size:inherit!important;font-weight:inherit!important;text-transform:none!important;letter-spacing:0!important}
      body.dark-mode #events-list .ssa-theme-icon{background:#f2d58c!important;box-shadow:0 0 0 4px rgba(240,121,97,.12)}
      body.dark-mode #events-list .ssa-theme-icon::after{width:10px;height:10px;background:#f2d58c!important;box-shadow:0 0 0 2px rgba(255,255,255,.18)}
      #events-list .ssa-layout-btn.ssa-active,#events-list .ssa-group-btn.ssa-active,#events-list .ssa-keyword-btn.ssa-keyword-active,#events-list .ssa-show-images-toggle.ssa-active,#events-list .ssa-signature-events-toggle.ssa-active{background:rgba(169,51,38,.06)!important;border-color:var(--ssa-accent-soft)!important;color:var(--ssa-accent)!important}
      #events-list .ssa-weekend-btn:hover,#events-list .ssa-clear-dates:hover,#events-list .ssa-date-clear-btn:hover,#events-list .ssa-layout-btn:hover,#events-list .ssa-group-btn:hover,#events-list .ssa-show-images-toggle:hover,#events-list .ssa-signature-events-toggle:hover,#events-list .ssa-dark-mode-toggle:hover,#events-list .ssa-keyword-btn:hover{border-color:var(--ssa-accent-soft)!important;color:var(--ssa-accent)!important;background:rgba(169,51,38,.035)!important}
      #events-list .ssa-date-clear-btn:hover{border-color:transparent!important;background:transparent!important}
      #events-list .ssa-date-clear-btn:hover::before,#events-list .ssa-date-clear-btn:focus-visible::before{color:var(--ssa-accent)!important;transform:rotate(90deg) scale(1.08);box-shadow:0 0 0 5px rgba(169,51,38,.08)}
      #events-list .ssa-date-clear-btn:active::before{transform:rotate(90deg) scale(.92)}
      #events-list .ssa-view-controls-section{position:relative;z-index:2;display:flex;flex-direction:column;gap:12px;overflow:visible}
      #events-list .ssa-view-controls-section:has(.ssa-filter-menu[open]){z-index:6}
      #events-list .ssa-filter-toolbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.95fr) minmax(180px,1.2fr) minmax(0,1fr) auto;gap:12px;align-items:center;min-width:0;max-width:100%}
      #events-list .ssa-sticky-meta-stack{position:relative;z-index:1;width:100%;min-width:0;align-self:stretch;display:flex;flex:0 0 auto;flex-direction:column;gap:8px;clear:both}
      #events-list .ssa-sticky-filter-summary{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:10px;width:100%;min-width:0;padding:10px 18px;background:color-mix(in srgb,var(--ssa-surface) 96%,transparent)!important;border:1px solid var(--ssa-border)!important;border-radius:12px;box-shadow:var(--ssa-shadow)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important}
      #events-list .ssa-sticky-status{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;max-width:100%;min-width:0;margin:0;color:var(--ssa-muted)!important;font-size:16px;font-weight:800;line-height:1.2;white-space:nowrap}
      #events-list .ssa-sticky-selected-keywords{width:100%;max-width:100%;min-width:0;margin:0;padding:0;justify-content:flex-start;overflow-x:auto;overflow-y:hidden}
      #events-list .ssa-sticky-selected-keywords:empty{display:none}
      #events-list .ssa-sticky-current-date{display:flex;align-items:center;gap:8px;max-width:0;max-height:0;overflow:hidden;opacity:0;color:var(--ssa-accent)!important;font-size:14px;font-weight:900;line-height:1.15;transition:max-width .18s ease,max-height .18s ease,opacity .18s ease}
      #events-list .ssa-sticky-current-date-visible{max-width:100%;max-height:22px;opacity:1}
      #events-list .ssa-sticky-current-date-link{display:inline-flex;align-items:center;gap:8px;min-width:0;color:inherit!important;text-decoration:none!important;border-radius:999px}
      #events-list .ssa-sticky-current-date-link:hover,#events-list .ssa-sticky-current-date-link:focus-visible{color:var(--ssa-accent)!important;outline:none}
      #events-list .ssa-sticky-current-date-label{display:inline-block;min-width:0;overflow:hidden;text-overflow:ellipsis}
      #events-list .ssa-sticky-weather-badge{min-width:34px;height:28px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1px solid rgba(169,51,38,.26)!important;border-radius:999px;background:rgba(247,200,115,.22)!important;color:var(--ssa-accent)!important;font-size:17px;font-weight:900;line-height:1;text-decoration:none!important;box-shadow:0 2px 8px rgba(15,23,42,.08)}
      #events-list .ssa-sticky-weather-badge:hover,#events-list .ssa-sticky-weather-badge:focus-visible{border-color:var(--ssa-accent)!important;background:rgba(247,200,115,.34)!important;outline:none}
      #events-list .ssa-sticky-weather-chance{font-size:12px;font-weight:900;line-height:1}
      #events-list .ssa-filter-menu{position:relative;z-index:1;min-width:0}
      #events-list .ssa-group-menu{min-width:0}
      #events-list .ssa-filter-menu summary{position:relative;height:48px;padding:0 42px 0 16px;display:flex;align-items:center;justify-content:flex-start;gap:12px;min-width:0;overflow:hidden;border:1px solid var(--ssa-control-border)!important;border-radius:10px;background:var(--ssa-surface)!important;color:var(--ssa-muted)!important;font-size:17px;font-weight:800;line-height:1;list-style:none;cursor:pointer;white-space:nowrap;box-shadow:0 1px 0 rgba(255,255,255,.35) inset!important}
      html.dark-mode #events-list .ssa-filter-menu summary,body.dark-mode #events-list .ssa-filter-menu summary{box-shadow:0 1px 0 rgba(255,255,255,.07) inset,0 2px 10px rgba(0,0,0,.24)!important}
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-filter-menu summary,body.dark-mode #events-list .ssa-sticky-control-section .ssa-filter-menu summary{color:var(--ssa-sticky-control-fg)!important;background:var(--ssa-sticky-control-fill)!important;border:2px solid var(--ssa-sticky-control-border)!important;-webkit-text-fill-color:var(--ssa-sticky-control-fg)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important}
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-date-input,body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-input{color:var(--ssa-sticky-control-fg)!important;background:var(--ssa-sticky-control-fill)!important;border:2px solid var(--ssa-sticky-control-border)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important;-webkit-text-fill-color:var(--ssa-sticky-control-fg)!important}
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-date-label,body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-label{color:var(--ssa-sticky-control-fg)!important}
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-date-clear-btn::before,body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-clear-btn::before{color:var(--ssa-sticky-control-fg)!important;border:2px solid var(--ssa-sticky-control-border)!important}
      html.dark-mode #events-list .ssa-sticky-control-section.ssa-is-stuck .ssa-filter-menu summary,body.dark-mode #events-list .ssa-sticky-control-section.ssa-is-stuck .ssa-filter-menu summary{border:2px solid var(--ssa-sticky-control-border)!important}
      #events-list .ssa-filter-menu summary::-webkit-details-marker{display:none}
      #events-list .ssa-filter-menu summary::after{content:'';position:absolute;right:16px;top:50%;width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-65%) rotate(45deg);transform-origin:center;opacity:.95;pointer-events:none;transition:transform .18s ease,opacity .18s ease}
      #events-list .ssa-filter-menu[open] summary{border-color:var(--ssa-accent-soft)!important;color:var(--ssa-accent)!important;background:rgba(169,51,38,.045)!important}
      #events-list .ssa-filter-menu[open] summary::after{transform:translateY(-35%) rotate(225deg)}
      #events-list .ssa-filter-menu[open]{z-index:4}
      #events-list .ssa-filter-menu-panel{position:absolute;z-index:5;top:calc(100% + 8px);left:0;min-width:100%;width:max-content;max-width:min(340px,calc(100vw - 36px));padding:8px;display:flex;flex-direction:column;gap:4px;border:1px solid var(--ssa-border)!important;border-radius:10px;background:var(--ssa-surface)!important;box-shadow:0 18px 46px rgba(15,23,42,.22)}
      #events-list .ssa-keyword-menu-panel{left:auto;right:0;width:min(300px,calc(100vw - 36px));min-width:100%;max-width:min(300px,calc(100vw - 36px));max-height:min(410px,58vh);overflow:auto}
      #events-list .ssa-filter-menu-item,#events-list .ssa-filter-menu .ssa-clear-dates,#events-list .ssa-filter-menu .ssa-layout-btn,#events-list .ssa-filter-menu .ssa-group-btn,#events-list .ssa-filter-menu .ssa-keyword-btn{width:100%;height:42px;min-width:0;overflow:hidden;text-overflow:ellipsis;padding:0 12px;display:flex;align-items:center;justify-content:flex-start;gap:10px;border:0!important;border-radius:8px;background:transparent!important;color:var(--ssa-muted)!important;font-size:15px;font-weight:800;line-height:1;text-align:left;box-shadow:none!important;white-space:nowrap}
      #events-list .ssa-filter-menu-item:hover,#events-list .ssa-filter-menu-item:focus-visible,#events-list .ssa-filter-menu .ssa-keyword-btn:hover{background:rgba(169,51,38,.055)!important;color:var(--ssa-accent)!important}
      #events-list .ssa-filter-menu-item.ssa-active,#events-list .ssa-filter-menu .ssa-keyword-active{background:rgba(169,51,38,.08)!important;color:var(--ssa-accent)!important}
      #events-list .ssa-filter-menu .ssa-clear-dates::before{display:none!important;content:none!important}
      #events-list .ssa-filter-menu .ssa-layout-icon,#events-list .ssa-filter-menu .ssa-group-icon{width:22px;height:22px;flex:0 0 22px}
      #events-list .ssa-menu-check{width:18px;flex:0 0 18px;color:var(--ssa-accent)!important;font-weight:900;text-align:center}
      #events-list .ssa-selected-keywords-section{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 18px;padding:16px 32px}
      #events-list .ssa-selected-keyword-row{display:flex;gap:10px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;padding-top:2px;scrollbar-width:none}
      #events-list .ssa-selected-keyword-row::-webkit-scrollbar{display:none}
      #events-list .ssa-selected-keyword-row .ssa-keyword-btn{flex:0 0 auto;width:auto;height:42px}
      #events-list .ssa-selected-keywords-section .ssa-selected-keyword-row{width:100%;padding:0}
      #events-list .ssa-view-controls-left{display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap}
      #events-list .ssa-layout-switcher-wrapper,#events-list .ssa-group-switcher-wrapper{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      #events-list .ssa-layout-switcher-wrapper ~ .ssa-group-switcher-wrapper{padding-left:0;border-left:0}
      #events-list .ssa-layout-switcher,#events-list .ssa-group-switcher,#events-list .ssa-display-options-switcher,#events-list .ssa-keyword-filters{display:flex;gap:12px;flex-wrap:wrap}
      #events-list .ssa-layout-icon-btn{width:64px;min-width:64px;padding:0}
      #events-list .ssa-layout-icon{position:relative;width:26px;height:26px;display:inline-block;color:currentColor}
      #events-list .ssa-layout-icon-list::before{content:'';position:absolute;left:8px;top:5px;width:15px;height:3px;border-radius:999px;background:currentColor;box-shadow:0 7px 0 currentColor,0 14px 0 currentColor}
      #events-list .ssa-layout-icon-list::after{content:'';position:absolute;left:3px;top:5px;width:3px;height:3px;border-radius:999px;background:currentColor;box-shadow:0 7px 0 currentColor,0 14px 0 currentColor}
      #events-list .ssa-layout-icon-grid::before{content:'';position:absolute;left:4px;top:4px;width:7px;height:7px;border-radius:2px;background:currentColor;box-shadow:11px 0 0 currentColor,0 11px 0 currentColor,11px 11px 0 currentColor}
      #events-list .ssa-layout-icon-grid::after{content:'';position:absolute;left:15px;top:15px;width:7px;height:7px;border-radius:2px;background:transparent}
      #events-list .ssa-layout-icon-calendar{border:2px solid currentColor;border-radius:6px}
      #events-list .ssa-layout-icon-calendar::before{content:'';position:absolute;left:-2px;right:-2px;top:6px;height:2px;background:currentColor}
      #events-list .ssa-layout-icon-calendar::after{content:'';position:absolute;left:5px;top:-5px;width:3px;height:7px;border-radius:999px;background:currentColor;box-shadow:10px 0 0 currentColor,0 14px 0 -1px currentColor,7px 14px 0 -1px currentColor,14px 14px 0 -1px currentColor}
      #events-list .ssa-control-separator{width:1px;height:44px;align-self:flex-end;background:var(--ssa-border-soft)}
      #events-list .ssa-group-icon-btn{width:64px;min-width:64px;padding:0}
      #events-list .ssa-group-icon{position:relative;width:26px;height:26px;display:inline-block;color:currentColor}
      #events-list .ssa-group-icon-day{border:2px solid currentColor;border-radius:999px}
      #events-list .ssa-group-icon-day::before{content:'';position:absolute;left:50%;top:50%;width:2px;height:8px;border-radius:999px;background:currentColor;transform:translate(-50%,-100%)}
      #events-list .ssa-group-icon-day::after{content:'';position:absolute;left:50%;top:50%;width:7px;height:2px;border-radius:999px;background:currentColor;transform-origin:left center;transform:rotate(28deg)}
      #events-list .ssa-group-icon-month{border:2px solid currentColor;border-radius:6px}
      #events-list .ssa-group-icon-month::before{content:'';position:absolute;left:-2px;right:-2px;top:6px;height:2px;background:currentColor}
      #events-list .ssa-group-icon-month::after{content:'';position:absolute;left:5px;top:-5px;width:3px;height:7px;border-radius:999px;background:currentColor;box-shadow:10px 0 0 currentColor,0 14px 0 -1px currentColor,7px 14px 0 -1px currentColor,14px 14px 0 -1px currentColor,0 20px 0 -1px currentColor,7px 20px 0 -1px currentColor,14px 20px 0 -1px currentColor}
      #events-list .ssa-selection-count{margin:0;padding:0;color:var(--ssa-muted)!important;font-size:16px;font-weight:800;line-height:1.2;white-space:nowrap}
      html.dark-mode #events-list .ssa-filter-toolbar .ssa-selection-count,body.dark-mode #events-list .ssa-filter-toolbar .ssa-selection-count{color:var(--ssa-text)!important}
      html.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-btn.ssa-keyword-active,html.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-remove-btn,body.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-btn.ssa-keyword-active,body.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-remove-btn{color:var(--ssa-text)!important;border-color:var(--ssa-text)!important;background:transparent!important}
      html.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-btn.ssa-keyword-active:hover,html.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-remove-btn:hover,body.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-btn.ssa-keyword-active:hover,body.dark-mode #events-list .ssa-selected-keyword-row .ssa-keyword-remove-btn:hover{color:var(--ssa-text)!important;border-color:var(--ssa-text)!important;background:rgba(251,247,239,.08)!important}
      #events-list .ssa-display-options-switcher .ssa-signature-events-toggle:only-child{min-width:180px}
      #events-list .ssa-display-options-wrapper{margin-left:auto}
      #events-list .ssa-keyword-filters-section .ssa-control-label{margin-bottom:12px}
      #events-list .ssa-sticky-keyword-section.ssa-is-stuck .ssa-control-label{margin-bottom:0}
      #events-list .ssa-keyword-filter-rows{display:flex;flex-direction:column;gap:10px;min-width:0}
      #events-list .ssa-keyword-row{flex-wrap:nowrap!important;justify-content:flex-start;overflow-x:auto;overflow-y:hidden;padding-bottom:2px;scrollbar-width:none}
      #events-list .ssa-keyword-row::-webkit-scrollbar{display:none}
      #events-list .ssa-keyword-row-selected:empty{display:none}
      #events-list .ssa-keyword-btn{flex:0 0 auto;width:auto}
      #events-list .ssa-keyword-remove-btn{gap:8px;padding-right:12px}
      #events-list .ssa-keyword-remove-icon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:1px solid currentColor;border-radius:999px;font-size:17px;font-weight:900;line-height:1}
      #events-list .ssa-keyword-row-available .ssa-keyword-btn:hover,#events-list .ssa-keyword-row-available .ssa-keyword-btn:focus,#events-list .ssa-keyword-row-available .ssa-keyword-btn:focus-visible,#events-list .ssa-keyword-row-available .ssa-keyword-btn:active,#events-list .ssa-keyword-row-available .ssa-keyword-btn.ssa-keyword-active{background:var(--ssa-surface)!important;border-color:var(--ssa-border-soft)!important;color:var(--ssa-muted)!important;box-shadow:none!important}
      #events-list .ssa-keyword-btn{border-radius:10px}
      #events-list .ssa-sticky-filter-bar{display:none}
      #events-list .ssa-active-filters{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 38px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--ssa-muted)!important;font-size:21px;font-weight:600}
      #events-list .ssa-active-filter-chip{height:46px;padding:0 16px;display:inline-flex;gap:10px;align-items:center;background:rgba(169,51,38,.04)!important;border:1px solid var(--ssa-accent-soft)!important;border-radius:999px;color:var(--ssa-accent)!important;font-size:17px;font-weight:800}
      #events-list .ssa-results-summary{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 26px;color:var(--ssa-muted)!important}
      #events-list .ssa-results-summary p{margin:0;color:var(--ssa-muted)!important;font-size:21px;line-height:1.4}
      #events-list .ssa-day-header,#events-list h3.ssa-day-header,#events-list .ssa-month-header{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:28px auto 18px;padding:0 0 20px;border-bottom:3px solid rgba(169,51,38,.14);color:var(--ssa-accent)!important;font-size:34px!important;line-height:1.15;font-weight:800!important}
      #events-list .ssa-day-weather{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:-8px auto 18px;padding:12px 16px;display:flex;align-items:center;gap:10px;border:1px solid var(--ssa-border-soft)!important;border-radius:12px;background:color-mix(in srgb,var(--ssa-surface) 92%,#f7c873 8%)!important;color:var(--ssa-text)!important;font-size:16px;font-weight:700;line-height:1.35;text-decoration:none!important;box-shadow:0 8px 22px rgba(15,23,42,.08)}
      #events-list .ssa-day-weather:hover,#events-list .ssa-day-weather:focus-visible{border-color:var(--ssa-accent-soft)!important;color:var(--ssa-text)!important;outline:none;box-shadow:0 10px 28px rgba(15,23,42,.12),0 0 0 4px rgba(247,200,115,.18)}
      #events-list .ssa-weather-icon-link{width:34px;height:34px;flex:0 0 34px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;text-decoration:none!important}
      #events-list .ssa-weather-icon{width:28px;height:28px;flex:0 0 28px;border-radius:999px;background:#f7c873;box-shadow:0 0 0 4px rgba(247,200,115,.22),10px 4px 0 -4px rgba(169,51,38,.32)}
      html.dark-mode #events-list .ssa-day-weather,body.dark-mode #events-list .ssa-day-weather{background:rgba(247,200,115,.10)!important;border-color:rgba(247,200,115,.36)!important;color:var(--ssa-text)!important;box-shadow:0 10px 28px rgba(0,0,0,.24)}
      #events-list .ssa-events-list{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 34px;padding:0;display:flex;flex-direction:column;gap:18px}
      #events-list .ssa-event-item{margin:0;padding:26px 24px;background:var(--ssa-surface)!important;border:1px solid var(--ssa-border-soft)!important;border-radius:10px;box-shadow:none!important}
      #events-list .ssa-event-content{display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start}
      #events-list .ssa-event-image-wrapper{width:112px;height:112px;border-radius:10px;background:var(--ssa-surface-soft)!important;border:1px solid var(--ssa-border-soft)!important;box-shadow:none!important}
      #events-list .ssa-event-image-placeholder{cursor:default!important}
      #events-list .ssa-event-details{min-width:0}
      #events-list .ssa-event-name-wrapper{display:flex;align-items:center;gap:10px;margin:0 0 12px}
      #events-list .ssa-event-name-wrapper > .ssa-icon-group,#events-list .ssa-title > .ssa-icon-group{display:none!important}
      #events-list .ssa-info-icon{width:22px;height:22px;min-width:22px;min-height:22px;background:var(--ssa-accent)!important;color:#fff!important;opacity:.9}
      #events-list .ssa-event-link,#events-list .ssa-event-name-wrapper strong,#events-list .ssa-event-name,#events-list .ssa-title{color:var(--ssa-event-title)!important;font-size:26px!important;line-height:1.25;font-weight:800!important;text-decoration:none}
      #events-list .ssa-event-meta{margin:0;display:flex;flex-direction:column;gap:6px}
      #events-list .ssa-event-meta-item,#events-list .ssa-event-meta-item *,#events-list .ssa-meta{color:color-mix(in srgb,var(--ssa-muted) 78%,transparent)!important;font-size:20px!important;line-height:1.45;font-weight:500!important}
      #events-list .ssa-event-meta-item strong{display:none}
      #events-list .ssa-location{color:inherit!important;text-decoration:none}
      #events-list .ssa-event-keywords,#events-list .ssa-keywords{margin:16px 0 0;display:flex;gap:8px;flex-wrap:wrap}
      #events-list .ssa-keyword-tag-clickable,#events-list .ssa-tag-clickable{height:42px;padding:0 18px;display:inline-flex;align-items:center;border:1px solid var(--ssa-text)!important;border-radius:10px;background:transparent!important;color:var(--ssa-text)!important;font-size:18px;font-weight:700;cursor:pointer}
      html.dark-mode #events-list .ssa-keyword-tag-clickable,html.dark-mode #events-list .ssa-tag-clickable,html body.dark-mode #events-list .ssa-keyword-tag-clickable,html body.dark-mode #events-list .ssa-tag-clickable,body.dark-mode #events-list .ssa-keyword-tag-clickable,body.dark-mode #events-list .ssa-tag-clickable,body.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,body.dark-mode #events-list .ssa-keywords .ssa-tag-clickable{color:var(--ssa-keyword-tag-fg,#d4cec6)!important;border-color:var(--ssa-keyword-tag-border,#9a9288)!important;-webkit-text-fill-color:var(--ssa-keyword-tag-fg,#d4cec6)!important;background:transparent!important}
      #events-list .ssa-keyword-tag-clickable:hover,#events-list .ssa-tag-clickable:hover{border-color:var(--ssa-accent)!important;color:var(--ssa-accent)!important;-webkit-text-fill-color:var(--ssa-accent)!important;background:color-mix(in srgb,var(--ssa-accent) 10%,transparent)!important}
      #events-list .ssa-keyword-tag-clickable.ssa-keyword-tag-active,#events-list .ssa-tag-clickable.ssa-tag-active{border-color:var(--ssa-accent)!important;color:var(--ssa-accent)!important;-webkit-text-fill-color:var(--ssa-accent)!important;background:color-mix(in srgb,var(--ssa-accent) 14%,transparent)!important}
      #events-list .ssa-grid{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 34px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
      #events-list .ssa-card{min-height:440px;display:flex;align-items:stretch;background:var(--ssa-surface)!important;border:1px solid var(--ssa-border-soft)!important;border-radius:10px;box-shadow:none!important;overflow:hidden}
      #events-list .ssa-card::before{display:none}
      #events-list .ssa-card[data-has-image="true"]::after{content:'';position:absolute;inset:0;display:block;background-image:var(--card-bg-image);background-size:cover;background-position:center;background-repeat:no-repeat;opacity:.52;z-index:0}
      #events-list .ssa-card[data-has-image="true"]::before{content:'';position:absolute;inset:0;display:block;background:linear-gradient(180deg,color-mix(in srgb,var(--ssa-surface) 70%,transparent) 0%,color-mix(in srgb,var(--ssa-surface) 58%,transparent) 42%,color-mix(in srgb,var(--ssa-surface) 86%,transparent) 100%);z-index:1}
      #events-list .ssa-card-content{position:relative;z-index:1;width:100%;min-height:440px;padding:26px 24px!important;background:var(--ssa-surface)!important}
      #events-list .ssa-card[data-has-image="true"] .ssa-card-content{z-index:2;background:transparent!important}
      #events-list .ssa-card-head{display:block;background:transparent!important;box-shadow:none!important}
      #events-list .ssa-card-image-icon{display:none!important}
      #events-list .ssa-title,#events-list .ssa-title *{background:transparent!important;box-shadow:none!important}
      #events-list .ssa-title{display:block;margin:0 0 12px}
      #events-list .ssa-calendar-container{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:0 auto 34px;border:1px solid var(--ssa-border)!important;border-radius:10px;overflow:hidden;background:var(--ssa-surface)!important}
      #events-list .ssa-calendar-month-header{margin:0;padding:26px 28px;background:linear-gradient(180deg,rgba(169,51,38,.12),rgba(169,51,38,.04));color:var(--ssa-accent)!important;text-align:left;font-size:32px!important;font-weight:800!important}
      #events-list .ssa-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0;background:var(--ssa-border)!important;border:0!important;border-radius:0;box-shadow:none!important}
      #events-list .ssa-calendar-day-header{min-width:0;padding:16px 8px;background:var(--ssa-surface)!important;color:var(--ssa-muted)!important;font-size:16px;font-weight:800;text-transform:none}
      #events-list .ssa-calendar-day{min-width:0;min-height:150px;padding:18px;background:var(--ssa-surface)!important;border-top:1px solid var(--ssa-border)!important;border-left:1px solid var(--ssa-border)!important}
      #events-list .ssa-calendar-day-has-events{cursor:pointer}
      #events-list .ssa-calendar-day-has-events:hover{background:color-mix(in srgb,var(--ssa-accent) 4%,var(--ssa-surface))!important}
      #events-list .ssa-calendar-day-number{color:var(--ssa-text)!important;font-size:20px;font-weight:800}
      #events-list .ssa-calendar-day-agenda-trigger{width:100%;margin-top:10px;padding:0;border:0!important;background:transparent!important;color:inherit!important;text-align:left;cursor:pointer;box-shadow:none!important}
      #events-list .ssa-calendar-event-count{display:inline-flex;height:28px;padding:0 10px;align-items:center;justify-content:center;box-sizing:border-box;text-align:center;border:1px solid var(--ssa-accent-soft)!important;border-radius:12px;background:rgba(169,51,38,.07)!important;color:var(--ssa-accent)!important;font-size:13px;font-weight:800}
      #events-list .ssa-calendar-event-preview-list{display:flex;flex-direction:column;gap:5px;margin-top:10px}
      #events-list .ssa-calendar-event-preview,#events-list .ssa-calendar-event-more{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ssa-muted)!important;font-size:14px;font-weight:700;line-height:1.25}
      html.dark-mode #events-list .ssa-calendar-day-agenda-trigger,body.dark-mode #events-list .ssa-calendar-day-agenda-trigger,html.dark-mode #events-list .ssa-calendar-day-agenda-trigger:hover,body.dark-mode #events-list .ssa-calendar-day-agenda-trigger:hover,html.dark-mode #events-list .ssa-calendar-day-agenda-trigger:focus,body.dark-mode #events-list .ssa-calendar-day-agenda-trigger:focus{background:transparent!important;border-color:transparent!important;color:inherit!important;box-shadow:none!important}
      html.dark-mode #events-list .ssa-calendar-event-preview,body.dark-mode #events-list .ssa-calendar-event-preview,html.dark-mode #events-list .ssa-calendar-event-more,body.dark-mode #events-list .ssa-calendar-event-more{background:transparent!important;color:var(--ssa-muted)!important}
      #events-list .ssa-calendar-info-icon{width:10px;height:10px;min-width:10px;min-height:10px;background:var(--ssa-accent)!important}
      #events-list .ssa-calendar-info-icon::before{content:''}
      .ssa-day-agenda-backdrop{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(15,23,42,.42);opacity:0;transition:opacity .18s ease}
      .ssa-day-agenda-backdrop.ssa-day-agenda-open{opacity:1}
      .ssa-day-agenda-panel{width:min(760px,100%);max-height:min(82vh,780px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--ssa-border-soft,#e5e7eb);border-radius:14px;background:var(--ssa-surface,#fff);box-shadow:0 28px 80px rgba(15,23,42,.26);color:var(--ssa-text,#111827);transform:translateY(10px) scale(.985);transition:transform .18s ease}
      .ssa-day-agenda-open .ssa-day-agenda-panel{transform:translateY(0) scale(1)}
      .ssa-day-agenda-backdrop.ssa-day-agenda-open .ssa-day-agenda-panel{transform:translateY(0) scale(1)!important}
      .ssa-day-agenda-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid var(--ssa-border-soft,#e5e7eb)}
      .ssa-day-agenda-header p{margin:0 0 6px;color:var(--ssa-accent,#a93326);font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .ssa-day-agenda-header h3{margin:0;color:var(--ssa-text,#111827);font-size:28px;line-height:1.1;font-weight:900}
      .ssa-day-agenda-close{width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;border:1px solid var(--ssa-border-soft,#e5e7eb);border-radius:999px;background:transparent;color:var(--ssa-muted,#6b7280);font-size:27px;line-height:1;cursor:pointer}
      .ssa-day-agenda-close:hover{color:var(--ssa-accent,#a93326);border-color:var(--ssa-accent-soft,#c66b60)}
      .ssa-day-agenda-list{overflow:auto;padding:12px}
      .ssa-day-agenda-event{border:1px solid var(--ssa-border-soft,#e5e7eb);border-radius:10px;background:var(--ssa-surface,#fff)}
      .ssa-day-agenda-event + .ssa-day-agenda-event{margin-top:10px}
      .ssa-day-agenda-summary{display:grid;grid-template-columns:64px minmax(0,1fr);gap:14px;align-items:center;padding:12px;cursor:pointer;list-style:none}
      .ssa-day-agenda-summary::-webkit-details-marker{display:none}
      .ssa-day-agenda-thumb{width:64px;height:64px;display:block;overflow:hidden;border:1px solid var(--ssa-border-soft,#e5e7eb);border-radius:8px;background:var(--ssa-surface-soft,#f8fafc);cursor:pointer}
      .ssa-day-agenda-thumb img{width:100%;height:100%;display:block;object-fit:cover}
      .ssa-day-agenda-thumb-empty{cursor:default}
      .ssa-day-agenda-main{min-width:0;display:flex;flex-direction:column;gap:5px}
      .ssa-day-agenda-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ssa-event-title,var(--ssa-accent,#a93326));font-size:19px;font-weight:900;line-height:1.2}
      .ssa-day-agenda-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ssa-muted,#6b7280);font-size:15px;font-weight:700;line-height:1.35}
      .ssa-day-agenda-details{padding:0 14px 16px 90px;color:var(--ssa-muted,#6b7280);font-size:15px;line-height:1.55}
      .ssa-day-agenda-details p{margin:0 0 12px}
      .ssa-day-agenda-muted{font-style:italic}
      .ssa-day-agenda-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
      .ssa-day-agenda-tags span{height:30px;padding:0 10px;display:inline-flex;align-items:center;border:1px solid var(--ssa-border-soft,#e5e7eb);border-radius:999px;color:var(--ssa-muted,#6b7280);font-size:13px;font-weight:800}
      .ssa-day-agenda-actions{display:flex;flex-wrap:wrap;gap:10px}
      .ssa-day-agenda-actions a{height:38px;padding:0 14px;display:inline-flex;align-items:center;border:1px solid var(--ssa-accent-soft,#c66b60);border-radius:999px;background:rgba(169,51,38,.06);color:var(--ssa-accent,#a93326)!important;text-decoration:none;font-size:14px;font-weight:900}
      .ssa-day-agenda-actions a:hover{background:rgba(169,51,38,.1)}
      #events-list .ssa-events-footnote{width:calc(100% - (var(--ssa-content-gutter) * 2));max-width:var(--ssa-content-max);margin:36px auto 0;color:var(--ssa-muted)!important;font-size:21px;line-height:1.45}
      @media(min-width:821px){
        #events-list .ssa-event-content{grid-template-columns:112px minmax(0,1fr) minmax(240px,340px)}
        #events-list .ssa-event-keywords{grid-column:3;grid-row:1;width:100%;max-width:340px;align-self:start;justify-content:flex-start;margin:0;overflow:hidden}
      }
      @media(min-width:960px){
        #events-list .ssa-sticky-view-section{top:calc(var(--ssa-sticky-date-height,150px) + 8px)}
        #events-list .ssa-sticky-keyword-section{top:calc(var(--ssa-sticky-date-height,150px) + var(--ssa-sticky-view-height,96px) + 16px)}
        #events-list .ssa-date-filters{display:flex;flex-direction:column;gap:8px;align-items:stretch;width:100%}
        #events-list .ssa-date-labels-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 44px;column-gap:16px}
        #events-list .ssa-date-inputs-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:16px;width:100%;min-width:0}
        #events-list .ssa-date-label{min-width:0;width:100%;font-size:17px}
        #events-list .ssa-date-input{width:100%;min-width:0}
        #events-list .ssa-weekend-btn{width:100%;min-width:0;height:58px;padding:0 18px}
        #events-list .ssa-date-clear-btn{width:44px;min-width:44px;height:28px;justify-self:center}
        #events-list .ssa-clear-dates{width:44px;min-width:44px;height:58px;padding:0;border-color:transparent!important;border-radius:999px;background:transparent!important;font-size:0;color:transparent!important;white-space:nowrap;justify-self:center}
        #events-list .ssa-clear-dates:hover{border-color:transparent!important;background:transparent!important}
        #events-list .ssa-clear-dates::before{content:'×';display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;border:1px solid currentColor;color:var(--ssa-muted)!important;font-size:18px;font-weight:800;line-height:1;transition:transform .22s ease,border-color .22s ease,color .22s ease,box-shadow .22s ease}
        #events-list .ssa-clear-dates:hover::before,#events-list .ssa-clear-dates:focus-visible::before{color:var(--ssa-accent)!important;transform:rotate(90deg) scale(1.08);box-shadow:0 0 0 5px rgba(169,51,38,.08)}
        #events-list .ssa-clear-dates:active::before{transform:rotate(90deg) scale(.92)}
      }
      @media(min-width:1120px){
        #events-list .ssa-compact-filter-shell{display:grid;grid-template-columns:minmax(0,.68fr) minmax(0,1.32fr);gap:14px;align-items:stretch}
        #events-list .ssa-compact-filter-shell > .ssa-sticky-meta-stack{grid-column:1/-1;grid-row:2;width:100%;max-width:none}
        #events-list .ssa-compact-filter-shell > .ssa-control-panel{max-width:none;width:100%;min-width:0;margin:0;overflow:visible}
        #events-list .ssa-compact-filter-shell .ssa-date-filters-section,#events-list .ssa-compact-filter-shell .ssa-view-controls-section{padding:16px 18px}
        #events-list .ssa-compact-filter-shell .ssa-date-filters{display:flex;flex-direction:column;gap:6px;width:100%}
        #events-list .ssa-compact-filter-shell .ssa-date-labels-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 40px;column-gap:14px}
        #events-list .ssa-compact-filter-shell .ssa-date-inputs-row{grid-column:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:14px;align-items:end;width:100%;min-width:0;overflow:visible}
        #events-list .ssa-compact-filter-shell .ssa-date-inputs-row > *{min-width:0}
        #events-list .ssa-compact-filter-shell .ssa-date-label{min-width:0;width:100%;overflow:visible;margin:0;padding-left:1px;font-size:13px;line-height:1.15}
        #events-list .ssa-compact-filter-shell .ssa-date-clear-btn{width:40px;min-width:40px;height:26px;align-self:center;justify-self:center}
        #events-list .ssa-compact-filter-shell .ssa-date-input{width:100%;max-width:100%;min-width:0;min-inline-size:0;height:48px;padding:0 10px;box-sizing:border-box;font-size:16px}
        #events-list .ssa-compact-filter-shell .ssa-view-controls-section{display:flex;align-items:stretch;justify-content:stretch}
        #events-list .ssa-compact-filter-shell .ssa-filter-toolbar{position:relative;width:100%;height:100%;grid-template-columns:minmax(0,1fr) minmax(0,.92fr) minmax(190px,1.35fr) minmax(190px,1fr);grid-template-rows:48px;gap:8px 10px;align-items:center;align-content:center}
        #events-list .ssa-compact-filter-shell .ssa-filter-menu{grid-row:1;transform:none}
        #events-list .ssa-compact-filter-shell .ssa-keyword-menu{min-width:190px}
        #events-list .ssa-compact-filter-shell .ssa-filter-menu summary{height:48px;padding:0 34px 0 12px;font-size:14px}
        #events-list .ssa-compact-filter-shell .ssa-keyword-menu summary{padding-right:44px}
        #events-list .ssa-compact-filter-shell .ssa-filter-menu summary::after{right:12px;width:8px;height:8px}
        #events-list .ssa-compact-filter-shell .ssa-keyword-menu summary::after{right:16px}
        #events-list .ssa-compact-filter-shell .ssa-selection-count{height:auto;display:flex;align-items:center;justify-content:flex-start;flex:0 0 auto;padding:0;background:transparent!important;white-space:nowrap;font-size:13px;line-height:1.15;text-align:left}
        #events-list .ssa-compact-filter-shell.ssa-is-stuck .ssa-view-controls-section{align-items:stretch}
        #events-list .ssa-compact-filter-shell.ssa-is-stuck .ssa-filter-toolbar{grid-template-rows:48px;align-content:center;align-items:center}
        #events-list .ssa-compact-filter-shell.ssa-is-stuck .ssa-filter-menu{grid-row:1;transform:none}
        #events-list .ssa-compact-filter-shell.ssa-is-stuck .ssa-selection-count{padding:0;background:transparent!important}
        #events-list .ssa-sticky-view-section{top:0}
        #events-list .ssa-sticky-keyword-section{top:calc(var(--ssa-sticky-date-height,92px) + 16px)}
      }
      @media(max-width:820px){
        #events-list{--ssa-content-gutter:0px}
        #events-list{padding:0 12px 22px;overflow-x:visible}
        #events-list .ssa-page-intro{width:calc(100% + 24px);margin:0 -12px 18px;padding:0}
        #events-list .ssa-page-intro-head{flex-direction:column;gap:18px}
        #events-list .ssa-brand-block{width:100%;align-items:stretch;gap:10px}
        #events-list .ssa-brand-mark{width:100%;margin:0}
        #events-list .ssa-brand-mark img{width:100%;max-width:none;border-radius:0}
        #events-list .ssa-brand-tagline{padding:0 12px;font-size:18px!important;line-height:1.25!important;text-align:left}
        #events-list .ssa-page-intro-copy{padding:0 12px}
        #events-list .ssa-page-intro h1{font-size:30px;line-height:1.08;margin-bottom:10px}
        #events-list .ssa-page-intro p{font-size:16px;line-height:1.35;max-width:330px}
        #events-list .ssa-page-intro-credit{font-size:14px!important;margin-top:10px!important;max-width:330px}
        #events-list .ssa-controls{margin:0 0 18px;padding:18px 16px;gap:22px;border-radius:9px}
        #events-list .ssa-control-panel{margin:0 0 12px;padding:10px;border-radius:9px;box-shadow:0 12px 26px rgba(15,23,42,.10)}
        #events-list .ssa-sticky-date-section{top:0}
        #events-list .ssa-sticky-view-section{top:calc(var(--ssa-sticky-date-height,108px) + 8px)}
        #events-list .ssa-sticky-keyword-section{top:calc(var(--ssa-sticky-date-height,108px) + var(--ssa-sticky-view-height,128px) + 16px)}
        #events-list .ssa-controls-heading-top{gap:10px;margin-bottom:10px}
        #events-list .ssa-controls-heading span,#events-list .ssa-results-summary span,#events-list .ssa-control-label{font-size:13px;line-height:1.2}
        #events-list .ssa-controls-heading-top > span{margin:0}
        #events-list .ssa-controls-heading h2{font-size:24px;line-height:1.12}
        #events-list .ssa-controls-heading p{font-size:15px;line-height:1.35}
        #events-list .ssa-date-filters{display:flex;flex-direction:column;gap:7px;width:100%;align-items:stretch}
        #events-list .ssa-date-labels-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 46px;column-gap:10px}
        #events-list .ssa-date-inputs-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:10px;width:100%;min-width:0}
        #events-list .ssa-date-label{min-width:0;font-size:13px;line-height:1.2}
        #events-list .ssa-date-input{width:100%;min-width:0;height:48px;font-size:15px;padding:0 10px;-webkit-appearance:none;appearance:none}
        #events-list .ssa-date-clear-btn{width:46px;height:26px;align-self:center;justify-self:center}
        #events-list .ssa-weekend-btn,#events-list .ssa-clear-dates,#events-list .ssa-layout-btn,#events-list .ssa-group-btn,#events-list .ssa-show-images-toggle,#events-list .ssa-signature-events-toggle,#events-list .ssa-dark-mode-toggle,#events-list .ssa-keyword-btn{width:100%;min-width:0;height:46px;padding:0 12px;font-size:14px;border-radius:8px;white-space:normal;text-align:center;line-height:1.15}
        #events-list .ssa-weekend-btn{padding:0 6px;font-size:12px;white-space:nowrap}
        #events-list .ssa-clear-dates{width:46px;padding:0;border-color:transparent!important;border-radius:999px;background:transparent!important;font-size:0;color:transparent!important;white-space:nowrap;justify-self:center}
        #events-list .ssa-clear-dates:hover{border-color:transparent!important;background:transparent!important}
        #events-list .ssa-clear-dates::before{content:'×';display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;border:1px solid currentColor;color:var(--ssa-muted)!important;font-size:18px;font-weight:800;line-height:1;transition:transform .22s ease,border-color .22s ease,color .22s ease,box-shadow .22s ease}
        #events-list .ssa-clear-dates:hover::before,#events-list .ssa-clear-dates:focus-visible::before{color:var(--ssa-accent)!important;transform:rotate(90deg) scale(1.08);box-shadow:0 0 0 5px rgba(169,51,38,.08)}
        #events-list .ssa-clear-dates:active::before{transform:rotate(90deg) scale(.92)}
        #events-list .ssa-view-controls-section{display:flex;flex-direction:column;align-items:stretch;gap:16px}
        #events-list .ssa-view-controls-left{display:grid;grid-template-columns:minmax(0,1.5fr) 1px minmax(0,1fr);align-items:end;gap:8px;width:100%}
        #events-list .ssa-layout-switcher-wrapper,#events-list .ssa-group-switcher-wrapper{display:flex;flex-direction:column;align-items:stretch;gap:8px;width:100%}
        #events-list .ssa-layout-switcher-wrapper{grid-column:1}
        #events-list .ssa-control-separator{grid-column:2;width:1px;height:46px;margin-bottom:0;align-self:end}
        #events-list .ssa-group-switcher-wrapper{grid-column:3}
        #events-list .ssa-layout-switcher{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%}
        #events-list .ssa-layout-icon-btn{width:100%;min-width:0}
        #events-list .ssa-group-switcher{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}
        #events-list .ssa-group-icon-btn{width:100%;min-width:0}
        #events-list .ssa-selection-count{font-size:12px}
        #events-list .ssa-display-options-wrapper{margin-left:0;width:100%}
        #events-list .ssa-display-options-switcher{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}
        #events-list .ssa-display-options-switcher .ssa-signature-events-toggle:only-child{grid-column:1/-1;min-width:0}
        #events-list .ssa-dark-mode-toggle{width:auto;min-width:84px;height:34px;padding:0 9px 0 7px;font-size:12px}
        #events-list .ssa-theme-icon{width:18px;height:18px}
        #events-list .ssa-keyword-filters{display:flex;flex-wrap:wrap;gap:10px;overflow:visible;padding-bottom:0}
        #events-list .ssa-keyword-btn{width:auto;min-width:0;flex:1 1 calc(50% - 10px);padding:0 12px}
        #events-list .ssa-keyword-row{flex-wrap:nowrap!important;overflow-x:auto;overflow-y:hidden}
        #events-list .ssa-keyword-row .ssa-keyword-btn{flex:0 0 auto;width:auto;min-width:max-content}
        #events-list .ssa-sticky-filter-bar{display:none}
        #events-list .ssa-sticky-date-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 42px;gap:8px;align-items:center;width:100%}
        #events-list .ssa-sticky-preset-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 42px;gap:8px;width:100%}
        #events-list .ssa-sticky-summary-row{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1fr) minmax(0,1.15fr);gap:8px;width:100%;align-items:center}
        #events-list .ssa-sticky-count,#events-list .ssa-sticky-supplement,#events-list .ssa-sticky-summary-btn{height:40px;min-width:0;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;background:var(--ssa-surface)!important;border:1px solid var(--ssa-border-soft)!important;border-radius:8px;color:var(--ssa-muted)!important;font-size:12px;font-weight:800;line-height:1.15;text-align:center;white-space:nowrap}
        #events-list .ssa-sticky-summary-btn{cursor:pointer}
        #events-list .ssa-sticky-summary-btn:hover,#events-list .ssa-sticky-summary-btn:focus-visible{border-color:var(--ssa-accent-soft)!important;color:var(--ssa-accent)!important;background:rgba(169,51,38,.035)!important}
        #events-list .ssa-sticky-layout-cycle,#events-list .ssa-sticky-group-cycle{background:rgba(169,51,38,.06)!important;border-color:var(--ssa-accent-soft)!important;color:var(--ssa-accent)!important}
        #events-list .ssa-sticky-filter-bar .ssa-sticky-date-input{height:42px;font-size:13px;padding:0 8px;border-radius:8px}
        #events-list .ssa-sticky-filter-bar .ssa-weekend-btn{height:40px;font-size:12px;padding:0 6px;white-space:nowrap}
        #events-list .ssa-sticky-filter-bar .ssa-clear-dates,#events-list .ssa-sticky-filter-bar .ssa-date-clear-btn{width:42px;min-width:42px;height:40px;padding:0;border-color:transparent!important;background:transparent!important}
        #events-list .ssa-sticky-filter-bar .ssa-date-clear-btn{height:42px}
        #events-list .ssa-sticky-filter-bar .ssa-clear-dates::before,#events-list .ssa-sticky-filter-bar .ssa-date-clear-btn::before{width:22px;height:22px}
        #events-list .ssa-sticky-active-filters{margin:0!important;padding:2px 0 0;display:flex;align-items:center;gap:8px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;font-size:12px;scrollbar-width:none}
        #events-list .ssa-sticky-active-filters::-webkit-scrollbar{display:none}
        #events-list .ssa-sticky-active-filters > span{flex:0 0 auto;margin:0;color:var(--ssa-muted)!important;font-size:12px;font-weight:800;line-height:1.1;text-transform:none;letter-spacing:0}
        #events-list .ssa-sticky-active-filters .ssa-active-filter-chip{flex:0 0 auto;height:32px;padding:0 10px;gap:6px;font-size:12px;white-space:nowrap}
        #events-list .ssa-active-filters,#events-list .ssa-results-summary,#events-list .ssa-events-footnote{margin-left:0;margin-right:0;font-size:14px}
        #events-list .ssa-active-filters{margin-bottom:22px}
        #events-list .ssa-active-filter-chip{height:38px;font-size:14px;padding:0 12px}
        #events-list .ssa-results-summary p{font-size:14px}
        #events-list .ssa-day-header,#events-list h3.ssa-day-header,#events-list .ssa-month-header{margin:20px 0 12px;padding-bottom:12px;font-size:20px!important}
        #events-list .ssa-day-weather{width:100%;margin:-4px 0 14px;padding:10px 12px;font-size:13px;border-radius:10px}
        #events-list .ssa-weather-icon{width:22px;height:22px;flex-basis:22px}
        #events-list .ssa-events-list{margin:0 0 26px;gap:14px}
        #events-list .ssa-event-item{padding:14px;border-radius:7px}
        #events-list .ssa-event-content{display:flex;flex-direction:column;gap:14px}
        #events-list .ssa-event-image-wrapper{width:100%;height:174px}
        #events-list .ssa-event-link,#events-list .ssa-event-name-wrapper strong,#events-list .ssa-event-name,#events-list .ssa-title{font-size:17px!important}
        #events-list .ssa-event-meta-item,#events-list .ssa-event-meta-item *,#events-list .ssa-meta{font-size:15px!important}
        #events-list .ssa-keyword-tag-clickable,#events-list .ssa-tag-clickable{height:34px;font-size:13px;padding:0 12px}
        #events-list .ssa-grid{grid-template-columns:1fr;gap:14px;margin:0 0 26px}
        #events-list .ssa-card{min-height:370px}
        #events-list .ssa-card-content{min-height:370px;padding:18px 14px!important}
        #events-list .ssa-calendar-container{margin:0 0 26px;overflow:hidden}
        #events-list .ssa-calendar-month-header{font-size:21px!important;padding:18px 16px}
        #events-list .ssa-calendar-grid{width:100%;min-width:0;grid-template-columns:repeat(7,minmax(0,1fr))}
        #events-list .ssa-calendar-day-header{padding:10px 2px;font-size:11px;line-height:1.1}
        #events-list .ssa-calendar-day{min-height:72px;padding:6px 4px}
        #events-list .ssa-calendar-day-number{font-size:14px;line-height:1}
        #events-list .ssa-calendar-day-agenda-trigger{margin-top:8px;display:flex;justify-content:center;text-align:center}
        #events-list .ssa-calendar-event-count{min-height:26px;max-width:calc(100% - 8px);padding:4px 8px;font-size:10px;line-height:1.08;border-radius:10px;white-space:normal}
        #events-list .ssa-calendar-event-preview-list{display:none}
        .ssa-day-agenda-backdrop{align-items:flex-end;padding:0;background:rgba(15,23,42,.36)}
        .ssa-day-agenda-panel{position:fixed;left:0;right:0;bottom:0;width:100%;max-height:82vh;border-right:0;border-bottom:0;border-left:0;border-radius:18px 18px 0 0;transform:none!important;transition:opacity .18s ease}
        .ssa-day-agenda-open .ssa-day-agenda-panel{transform:none!important}
        .ssa-day-agenda-backdrop.ssa-day-agenda-open .ssa-day-agenda-panel{transform:none!important}
        .ssa-day-agenda-header{padding:18px 16px 14px}
        .ssa-day-agenda-header h3{font-size:22px}
        .ssa-day-agenda-list{padding:10px}
        .ssa-day-agenda-summary{grid-template-columns:54px minmax(0,1fr);gap:12px;padding:10px}
        .ssa-day-agenda-thumb{width:54px;height:54px}
        .ssa-day-agenda-name{font-size:16px}
        .ssa-day-agenda-meta{font-size:13px}
        .ssa-day-agenda-details{padding:0 12px 14px 76px;font-size:14px}
        #events-list .ssa-events-footnote{font-size:14px;margin-top:22px}
      }
      @media(max-width:560px){
        #events-list{padding:22px 10px}
        #events-list .ssa-page-intro h1{font-size:29px}
        #events-list .ssa-controls{padding:18px 14px}
        #events-list .ssa-date-labels-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 38px;column-gap:8px}
        #events-list .ssa-date-inputs-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:8px}
        #events-list .ssa-date-input{height:46px;font-size:13.5px;padding:0 8px}
        #events-list .ssa-date-clear-btn{width:38px;height:24px;justify-self:center}
        #events-list .ssa-weekend-btn{height:44px;font-size:10.5px;padding:0 3px}
        #events-list .ssa-clear-dates{width:38px;height:44px}
        #events-list .ssa-layout-switcher{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        #events-list .ssa-layout-btn{height:44px;padding:0 8px;font-size:13px;white-space:nowrap}
      }
      @media(max-width:360px){
        #events-list .ssa-layout-switcher{gap:6px}
        #events-list .ssa-layout-btn{font-size:12px;padding:0 6px}
        #events-list .ssa-date-labels-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 38px;column-gap:6px}
        #events-list .ssa-weekend-btn{font-size:10px}
        #events-list .ssa-clear-dates{width:38px}
        #events-list .ssa-display-options-switcher,#events-list .ssa-group-switcher{grid-template-columns:1fr}
        #events-list .ssa-keyword-btn{flex-basis:100%}
        #events-list .ssa-keyword-row .ssa-keyword-btn{flex:0 0 auto;width:auto;min-width:max-content}
      }
      @media(max-width:700px){
        #events-list .ssa-sticky-filter-summary{gap:10px}
        #events-list .ssa-sticky-status{width:100%;min-width:0}
        #events-list .ssa-sticky-current-date-visible{max-height:38px;white-space:normal}
        #events-list .ssa-sticky-selected-keywords{width:100%}
      }
      #events-list .ssa-filter-menu .ssa-clear-dates,#events-list .ssa-filter-menu .ssa-layout-btn,#events-list .ssa-filter-menu .ssa-group-btn,#events-list .ssa-filter-menu .ssa-keyword-btn{width:100%!important;min-width:0!important;height:42px!important;padding:0 12px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:var(--ssa-muted)!important;font-size:15px!important;text-align:left!important;justify-content:flex-start!important;white-space:nowrap!important}
      #events-list .ssa-filter-menu .ssa-clear-dates::before{display:none!important;content:none!important}
      #events-list .ssa-filter-menu .ssa-layout-btn.ssa-active,#events-list .ssa-filter-menu .ssa-group-btn.ssa-active,#events-list .ssa-filter-menu .ssa-keyword-btn.ssa-keyword-active{background:rgba(169,51,38,.08)!important;color:var(--ssa-accent)!important}
      @media(max-width:1280px){
        #events-list .ssa-compact-filter-shell{grid-template-columns:1fr}
      }
      @media(max-width:920px){
        #events-list .ssa-filter-toolbar{grid-template-columns:minmax(0,1fr) minmax(0,.95fr) minmax(174px,1.25fr) minmax(180px,1fr);gap:8px}
        #events-list .ssa-filter-toolbar .ssa-selection-count{grid-column:1/-1}
        #events-list .ssa-keyword-menu{min-width:180px}
        #events-list .ssa-filter-menu summary{height:44px;padding:0 34px 0 12px;font-size:14px}
        #events-list .ssa-keyword-menu summary{padding-right:44px}
        #events-list .ssa-filter-menu summary::after{right:12px;width:8px;height:8px}
        #events-list .ssa-keyword-menu summary::after{right:16px}
      }
      @media(max-width:560px){
        #events-list .ssa-filter-toolbar{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        #events-list .ssa-keyword-menu{min-width:0}
        #events-list .ssa-view-controls-section:has(.ssa-keyword-menu[open]){padding-bottom:min(410px,58vh)}
        #events-list .ssa-keyword-menu-panel{left:auto;right:0;width:min(300px,calc(100vw - 44px));max-width:calc(100vw - 44px)}
        #events-list .ssa-filter-menu-panel{max-width:calc(100vw - 44px)}
      }
      @media(max-height:520px) and (orientation:landscape){
        #events-list .ssa-controls{padding:18px 24px;margin-bottom:10px}
        #events-list .ssa-control-panel{padding:10px 16px;margin-bottom:8px}
        #events-list .ssa-date-input{height:42px;font-size:16px}
        #events-list .ssa-date-clear-btn{height:42px}
        #events-list .ssa-filter-toolbar{grid-template-columns:minmax(0,1fr) minmax(0,.95fr) minmax(174px,1.25fr) minmax(180px,1fr);gap:8px}
        #events-list .ssa-filter-toolbar .ssa-selection-count{grid-column:auto}
        #events-list .ssa-filter-menu summary{height:38px;font-size:13px;padding:0 30px 0 10px}
        #events-list .ssa-keyword-menu summary{padding-right:40px}
        #events-list .ssa-filter-menu summary::after{right:10px;width:7px;height:7px}
        #events-list .ssa-keyword-menu summary::after{right:14px}
        #events-list .ssa-selection-count{font-size:13px}
        #events-list .ssa-selected-keyword-row .ssa-keyword-btn{height:36px;font-size:13px}
      }
    `;
    document.head.appendChild(designCSS);

    const keywordContrastCSS = document.createElement('style');
    keywordContrastCSS.id = 'ssa-event-keyword-contrast';
    keywordContrastCSS.textContent = `
      html.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,
      html.dark-mode #events-list .ssa-keywords .ssa-tag-clickable,
      html body.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,
      html body.dark-mode #events-list .ssa-keywords .ssa-tag-clickable,
      body.dark-mode #events-list .ssa-event-keywords .ssa-keyword-tag-clickable,
      body.dark-mode #events-list .ssa-keywords .ssa-tag-clickable,
      body.dark-mode #events-list .ssa-keyword-tag-clickable,
      body.dark-mode #events-list .ssa-tag-clickable {
        color: var(--ssa-keyword-tag-fg, #d4cec6) !important;
        border-color: var(--ssa-keyword-tag-border, #9a9288) !important;
        -webkit-text-fill-color: var(--ssa-keyword-tag-fg, #d4cec6) !important;
        background: transparent !important;
      }
      html.dark-mode #events-list .ssa-keyword-tag-clickable.ssa-keyword-tag-active,
      html.dark-mode #events-list .ssa-tag-clickable.ssa-tag-active,
      body.dark-mode #events-list .ssa-keyword-tag-clickable.ssa-keyword-tag-active,
      body.dark-mode #events-list .ssa-tag-clickable.ssa-tag-active {
        color: var(--ssa-accent, #f07961) !important;
        border-color: var(--ssa-accent, #f07961) !important;
        -webkit-text-fill-color: var(--ssa-accent, #f07961) !important;
      }
      html.dark-mode #events-list .ssa-sticky-view-section,
      html body.dark-mode #events-list .ssa-sticky-view-section,
      body.dark-mode #events-list .ssa-sticky-view-section,
      html.dark-mode #events-list .ssa-sticky-date-section,
      html body.dark-mode #events-list .ssa-sticky-date-section,
      body.dark-mode #events-list .ssa-sticky-date-section {
        background: var(--ssa-sticky-bar-bg, #524538) !important;
        border: 2px solid var(--ssa-sticky-panel-border, #c9b8a4) !important;
        box-shadow: var(--ssa-sticky-bar-shadow) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      html.dark-mode #events-list .ssa-sticky-control-section,
      html body.dark-mode #events-list .ssa-sticky-control-section,
      body.dark-mode #events-list .ssa-sticky-control-section {
        background: var(--ssa-sticky-bar-bg, #524538) !important;
        border: 2px solid var(--ssa-sticky-panel-border, #c9b8a4) !important;
        box-shadow: var(--ssa-sticky-bar-shadow) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-filter-menu summary,
      html body.dark-mode #events-list .ssa-sticky-control-section .ssa-filter-menu summary,
      body.dark-mode #events-list .ssa-sticky-control-section .ssa-filter-menu summary {
        color: var(--ssa-sticky-control-fg, #fbf7ef) !important;
        background: var(--ssa-sticky-control-fill, #1a130f) !important;
        border: 2px solid var(--ssa-sticky-control-border, #d9cbb8) !important;
        -webkit-text-fill-color: var(--ssa-sticky-control-fg, #fbf7ef) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.05) !important;
      }
      html.dark-mode #events-list .ssa-sticky-control-section.ssa-is-stuck,
      html body.dark-mode #events-list .ssa-sticky-control-section.ssa-is-stuck,
      body.dark-mode #events-list .ssa-sticky-control-section.ssa-is-stuck {
        background: var(--ssa-sticky-bar-bg, #524538) !important;
        border: 2px solid var(--ssa-sticky-panel-border, #c9b8a4) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-date-input,
      html body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-input,
      body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-input {
        color: var(--ssa-sticky-control-fg, #fbf7ef) !important;
        background: var(--ssa-sticky-control-fill, #1a130f) !important;
        border: 2px solid var(--ssa-sticky-control-border, #d9cbb8) !important;
        -webkit-text-fill-color: var(--ssa-sticky-control-fg, #fbf7ef) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.05) !important;
      }
      html.dark-mode #events-list .ssa-sticky-control-section .ssa-date-clear-btn::before,
      html body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-clear-btn::before,
      body.dark-mode #events-list .ssa-sticky-control-section .ssa-date-clear-btn::before {
        color: var(--ssa-sticky-control-fg, #fbf7ef) !important;
        border: 2px solid var(--ssa-sticky-control-border, #d9cbb8) !important;
      }
    `;
    document.head.appendChild(keywordContrastCSS);
  }

  // Helper function to reload events when filters change
  function scrollToResultsStart(mount) {
    if (!mount) return;
    const target = mount.querySelector('.ssa-list-date-anchor, .ssa-events-list, .ssa-grid, .ssa-calendar-container, .ssa-empty');
    if (!target) return;
    const stickyShell = mount.querySelector('.ssa-compact-filter-shell');
    const stickyOffset = stickyShell ? Math.min(stickyShell.getBoundingClientRect().height || 0, 260) : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset - 14;
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: Math.max(top, 0),
        behavior: 'smooth'
      });
    });
  }

  async function reloadEvents(mount, state, opts) {
    if (!opts || !opts.url || !opts.key) {
      console.error('reloadEvents: Missing required opts (url, key)', opts);
      // Fallback: try to use existing rows and filter client-side
      const existingRows = mount._allRows || [];
      await renderEvents(mount, existingRows, state);
      return;
    }
    
    try {
      // ALWAYS fetch ALL events (no date filters) to ensure we have complete data for keyword extraction
      // Client-side filtering will handle date ranges - this avoids API filter complexity issues
      console.log('🔄 reloadEvents: Fetching ALL events (no date filters)');
      const fetchOpts = {
        url: opts.url,
        key: opts.key,
        from: null,  // Explicitly null - fetch all events
        to: null,    // Explicitly null - fetch all events
        limit: opts.limit || 200
      };
      const key = `ssa_events_v20260618:${opts.url}:all:${opts.limit||200}`;
      const rows = await fetchEvents(fetchOpts);
      mount._allRows = rows; // Store for fallback
      sessionStorage.setItem(key, JSON.stringify(rows));
      console.log('✅ reloadEvents: Fetched', rows.length, 'events for keyword cloud');
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
    
    // Normalize initial keywords to lowercase for consistent comparison
    const normalizedKeywords = (opts.selectedKeywords || []).map(kw => (kw || '').toLowerCase().trim()).filter(kw => kw);
    
    // Initialize state - default fromDate to today
    const state = {
      layout: opts.layout || LAYOUTS.LIST,
      selectedKeywords: normalizedKeywords,
      fromDate: opts.fromDate !== undefined ? opts.fromDate : todayISO(),
      toDate: opts.toDate || null,
      showImages: opts.showImages !== undefined ? opts.showImages : true,
      groupBy: opts.groupBy || 'day'
    };
    
    // Store opts for reloadEvents
    mount._widgetOpts = opts;
    mount._weatherRegion = getWeatherRegion(opts);
    
    mount.innerHTML = `<div class="ssa-grid"><div class="ssa-skel"></div><div class="ssa-skel"></div><div class="ssa-skel"></div></div>`;
    
    try {
      // Fetch events with fromDate (or null if cleared)
      const fetchOpts = {
        ...opts,
        from: state.fromDate || null,
        to: state.toDate || null
      };
      const key = `ssa_events_v20260618:${opts.url}:${fetchOpts.from || 'all'}:${fetchOpts.to || ''}:${opts.limit||200}`;
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
    const pullThreshold = 125; // High-contrast indicator needs a little more travel before refresh.
    
    // Create refresh indicator element - attach to body for page-level pull-to-refresh
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'ssa-pull-to-refresh';
    refreshIndicator.style.cssText = `
      position: fixed;
      top: -132px;
      left: 50%;
      transform: translateX(-50%);
      width: 112px;
      height: 112px;
      border-radius: 50%;
      background: #f97316;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 64px;
      font-weight: 900;
      line-height: 1;
      border: 6px solid #ffffff;
      opacity: 0;
      transition: opacity 0.2s, top 0.2s;
      pointer-events: none;
      z-index: 10000;
      text-shadow: 0 2px 6px rgba(0,0,0,0.35);
      box-shadow: 0 0 0 5px #2563eb, 0 10px 30px rgba(0,0,0,0.45);
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
        refreshIndicator.style.top = `${pullDistance - 132}px`;
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
        refreshIndicator.style.top = '28px';
        refreshIndicator.style.opacity = '1';
        
        // Clear cache and reload events
        const fetchOpts = {
          ...opts,
          from: state.fromDate || null,
          to: state.toDate || null
        };
        const key = `ssa_events_v20260618:${opts.url}:${fetchOpts.from || 'all'}:${fetchOpts.to || ''}:${opts.limit||200}`;
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
      refreshIndicator.style.top = '-132px';
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

  function setDarkModeButtonContent(button, isDark) {
    if (!button) return;
    button.innerHTML = '<span class="ssa-theme-icon" aria-hidden="true"></span><span class="ssa-theme-text">' + (isDark ? 'Light' : 'Dark') + '</span>';
  }

  // Dark mode toggle functionality
  function toggleDarkMode() {
    const body = document.body;
    const html = document.documentElement;
    const isDark = body.classList.toggle('dark-mode');
    html.classList.toggle('dark-mode', isDark);
    const button = document.querySelector('.ssa-dark-mode-toggle');
    
    setDarkModeButtonContent(button, isDark);
    
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
        document.documentElement.classList.add('dark-mode');
        setDarkModeButtonContent(button, true);
      } else {
        setDarkModeButtonContent(button, false);
      }
    }
  }

  window.SSWidgets = window.SSWidgets || {};
  window.SSWidgets.renderEvents = renderEventsWidget;
})();
