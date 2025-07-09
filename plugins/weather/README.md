# Weather Plugin

This plugin displays the current weather information for a specified location.

## Configuration

```json
{
  "name": "weather",
  "options": {
    "location": "Tokyo,JP",
    "updateInterval": 300000,
    "credentials": {
      "token": "your-openweathermap-api-key"
    }
  }
}
```

## Usage

1. **Location**: Specify the location for which you want to display the weather. The default is `Tokyo,JP`.
2. **Update Interval**: The weather information will be updated every 5 minutes (300000 ms) by default.
3. **API Key**: You must provide a valid OpenWeatherMap API key in the `credentials` section.

## Caution

- It may take a few hours to fetch the weather data on the first load.
