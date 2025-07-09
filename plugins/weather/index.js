import blessed from "blessed";
import contrib from "blessed-contrib";
import axios from "axios";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const {
    location = "Tokyo,JP",
    updateInterval = 300000,
    credentials = {},
  } = options;
  const apiKey = credentials.token;

  const weatherBox = grid.set(row, col, rowSpan, colSpan, blessed.box, {
    label: `Weather Forecast (${location})`,
    border: { type: "line" },
    style: {
      border: { fg: "green" },
      fg: "white",
    },
  });

  const forecastLine = contrib.line({
    label: "Weather Forecast (Temp, Precip, Wind)",
    showLegend: true,
    legend: { width: 18 },
    top: "20%", // 上20%はテキスト用に空ける
    left: "0%",
    width: "90%",
    height: "75%",
    style: {
      line: "yellow",
      text: "white",
      baseline: "black",
    },
  });
  weatherBox.append(forecastLine);

  // 現在の天気詳細表示用テキストボックス
  const currentWeatherBox = blessed.box({
    parent: weatherBox,
    top: "0%",
    left: "2.5%",
    width: "90%",
    height: "20%",
    tags: true,
    style: {
      fg: "white",
    },
  });

  async function updateWeather() {
    try {
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location
      )}&appid=${apiKey}&units=metric&lang=ja`;
      const currentResp = await axios.get(currentUrl);
      const { main, wind, weather, dt } = currentResp.data;

      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
        location
      )}&appid=${apiKey}&units=metric&lang=ja`;
      const forecastResp = await axios.get(forecastUrl);
      const forecastData = forecastResp.data.list;

      const hours = [];
      const temps = [];
      const pops = [];
      const winds = [];

      for (let i = 0; i < Math.min(forecastData.length, 8); i++) {
        const item = forecastData[i];
        const date = new Date(item.dt * 1000);
        hours.push(
          `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}h`
        );
        temps.push(Math.round(item.main.temp));
        pops.push(Math.round((item.pop || 0) * 100));
        winds.push(Math.round(item.wind.speed * 10)); // 10倍して100%近くで扱うイメージ
      }

      forecastLine.setData([
        {
          title: "Temp (°C)",
          x: hours,
          y: temps,
          style: { line: "green" },
        },
        {
          title: "Precip (%)",
          x: hours,
          y: pops,
          style: { line: "blue" },
        },
        {
          title: "Wind (m/s x10)",
          x: hours,
          y: winds,
          style: { line: "cyan" },
        },
      ]);

      // 現在の天気詳細テキスト作成
      const weatherDesc = weather[0]?.description || "";
      const currentTime = new Date(dt * 1000).toLocaleString();
      currentWeatherBox.setContent(
        `{bold}${location} - ${currentTime}{/bold}\n` +
          `Weather: ${weatherDesc}\n` +
          `Temp: ${main.temp.toFixed(
            1
          )}°C (Feels like ${main.feels_like.toFixed(1)}°C)\n` +
          `Humidity: ${main.humidity}%\n` +
          `Wind Speed: ${wind.speed} m/s`
      );

      weatherBox.screen.render();
    } catch (e) {
      forecastLine.setData([]);
      currentWeatherBox.setContent("Error loading weather data");
      weatherBox.screen.render();
    }
  }

  updateWeather();
  const timer = setInterval(updateWeather, updateInterval);
  weatherBox.on("destroy", () => clearInterval(timer));

  return weatherBox;
}
