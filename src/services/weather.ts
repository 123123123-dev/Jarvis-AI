export interface WeatherRequest {
  location: string;
  temperatureUnit: 'celsius' | 'fahrenheit';
}

export function getWeatherRequest(prompt: string): WeatherRequest | null {
  const cleanedPrompt = prompt.trim().replace(/[?!]+$/, '');
  const locationAfterWeatherTerm = cleanedPrompt.match(
    /\b(?:weather|temperature|temp)\b[\s\S]{0,80}?\b(?:in|at|for|of)\s+(.+)/i
  );
  const locationBeforeWeatherTerm = cleanedPrompt.match(
    /^(?:(?:what(?:'s|\s+is)|tell me|show me|give me)\s+)?(.+?)\s+(?:weather|temperature|temp)\b/i
  );
  const rawLocation = locationAfterWeatherTerm?.[1] || locationBeforeWeatherTerm?.[1];
  if (!rawLocation) return null;

  const location = rawLocation
    .replace(/^(?:(?:the|current|currently|today'?s|right now|now)\s+)+/i, '')
    .replace(/\b(?:right now|currently|today|tonight|tomorrow|now|in fahrenheit|in celsius|fahrenheit|celsius)\b.*$/i, '')
    .replace(/\bdegrees?\s+[cf]\b.*$/i, '')
    .replace(/[.,;]+$/, '')
    .trim();
  if (
    !location ||
    location.length > 100 ||
    /^(?:what|what is|what's|is|the|current|temperature|temp|weather)$/i.test(location)
  ) {
    return null;
  }

  return {
    location,
    temperatureUnit: /\bfahrenheit\b|°\s?f/i.test(cleanedPrompt) ? 'fahrenheit' : 'celsius',
  };
}
