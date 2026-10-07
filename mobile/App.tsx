import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  conditionLabel,
  ForecastConsensus,
  loadConsensus,
  ModelForecast,
} from "./src/weather";

const HOME = { name: "Warner Robins", latitude: 32.613, longitude: -83.624 };

type Tab = "Forecast" | "Radar" | "Plans" | "Settings";

function average(values: Array<number | undefined>): number | undefined {
  const usable = values.filter((value): value is number => typeof value === "number");
  if (!usable.length) return undefined;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function weatherGlyph(code?: number, isDay = true): string {
  if (code === undefined) return "◌";
  if (code === 0) return isDay ? "☀" : "☾";
  if (code === 1 || code === 2) return isDay ? "⛅" : "☁";
  if (code === 3 || code === 45 || code === 48) return "☁";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "ϟ";
  return "◌";
}

function rounded(value?: number): string {
  return typeof value === "number" ? String(Math.round(value)) : "—";
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: import("react-native").StyleProp<import("react-native").ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function ForecastHome({
  data,
  loading,
  error,
  refresh,
}: {
  data: ForecastConsensus | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}) {
  const models = data?.models ?? [];
  const current = average(models.map((model) => model.current.temperature_2m));
  const feelsLike = average(models.map((model) => model.current.apparent_temperature));
  const high = average(models.map((model) => model.daily.temperature_2m_max?.[0]));
  const low = average(models.map((model) => model.daily.temperature_2m_min?.[0]));
  const codeCounts = new Map<number, number>();
  for (const model of models) {
    const value = model.current.weather_code;
    if (typeof value === "number") codeCounts.set(value, (codeCounts.get(value) ?? 0) + 1);
  }
  const code = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const isDay = models[0]?.current.is_day !== 0;
  const hourly = models[0]?.hourly;
  const condition = conditionLabel(code);
  const isWet = ["Rain", "Drizzle", "Snow", "Thunderstorms"].includes(condition);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#a9f0dc" />}
    >
      <View style={styles.locationRow}>
        <View>
          <Text style={styles.kicker}>YOUR LOCATION</Text>
          <Text style={styles.city}>{HOME.name}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh forecast" onPress={refresh} style={styles.refresh}>
          <Text style={styles.refreshGlyph}>↻</Text>
        </Pressable>
      </View>

      <GlassCard style={styles.hero}>
        <Text style={styles.kicker}>MODEL CONSENSUS · {models.length ? models.length + " FEEDS" : loading ? "CHECKING MODELS" : "NO FEEDS"}</Text>
        {loading && !data ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#a9f0dc" />
            <Text style={styles.muted}>Gathering forecasts…</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroLine}>
              <Text style={styles.temperature}>{rounded(current)}°</Text>
              <View style={styles.conditionBlock}>
                <Text style={styles.weatherGlyph}>{weatherGlyph(code, isDay)}</Text>
                <Text style={styles.condition}>{condition}</Text>
              </View>
            </View>
            <Text style={styles.feels}>Feels like {rounded(feelsLike)}°</Text>
            <Text style={styles.range}>Today · Low {rounded(low)}°  /  High {rounded(high)}°</Text>
            {data && (
              <View style={styles.consensusStrip}>
                <View>
                  <Text style={styles.kicker}>MODEL SPREAD</Text>
                  <Text style={styles.consensusValue}>{data.modelSpread.toFixed(1)}°</Text>
                </View>
                <Text style={styles.explain}>Difference between the warmest and coolest model</Text>
              </View>
            )}
          </>
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hourly outlook</Text>
        <Text style={styles.sectionAction}>Temperature · Rain chance</Text>
      </View>
      <GlassCard>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyRow}>
          {(hourly?.time ?? []).slice(0, 12).map((time, index) => (
            <View key={time} style={styles.hour}>
              <Text style={styles.hourTime}>{index === 0 ? "NOW" : time.slice(11, 16)}</Text>
              <Text style={styles.hourGlyph}>◌</Text>
              <Text style={styles.hourTemp}>{rounded(average(models.map((model) => model.hourly.temperature_2m?.[index])))}°</Text>
              <Text style={styles.hourRain}>{rounded(average(models.map((model) => model.hourly.precipitation_probability?.[index])))}%</Text>
            </View>
          ))}
          {!hourly?.time?.length && <Text style={styles.muted}>Hourly forecast appears when data loads.</Text>}
        </ScrollView>
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>What the models say</Text>
        <Text style={styles.sectionAction}>Equal-weight average</Text>
      </View>
      <GlassCard>
        {models.map((model: ModelForecast, index) => (
          <View key={model.label} style={[styles.modelRow, index > 0 && styles.divider]}>
            <View>
              <Text style={styles.modelName}>{model.label}</Text>
              <Text style={styles.modelCondition}>{conditionLabel(model.current.weather_code)}</Text>
            </View>
            <Text style={styles.modelTemperature}>{rounded(model.current.temperature_2m)}°</Text>
          </View>
        ))}
        {!models.length && !loading && (
          <Text style={styles.muted}>Pull down to load the latest forecast consensus.</Text>
        )}
      </GlassCard>
      <Text style={styles.footer}>Consensus blends available model forecasts. It is not a guarantee.</Text>
    </ScrollView>
  );
}

function Placeholder({ tab }: { tab: Exclude<Tab, "Forecast"> }) {
  const content = {
    Radar: ["Live radar", "Radar playback, precipitation layers, and map controls will connect to the WeatherGlass Worker."],
    Plans: ["Plan around the weather", "Choose a place and time window to see whether the forecast is a good fit."],
    Settings: ["Make it yours", "Saved places, temperature units, glass themes, and alert preferences."],
  }[tab];
  return (
    <View style={styles.placeholderWrap}>
      <GlassCard style={styles.placeholder}>
        <Text style={styles.weatherGlyph}>✧</Text>
        <Text style={styles.sectionTitle}>{content[0]}</Text>
        <Text style={styles.placeholderText}>{content[1]}</Text>
      </GlassCard>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Forecast");
  const [data, setData] = useState<ForecastConsensus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appWeatherCode = data?.models[0]?.current.weather_code;
  const appIsDay = data?.models[0]?.current.is_day !== 0;
  const appIsWet = ["Rain", "Drizzle", "Snow", "Thunderstorms"].includes(conditionLabel(appWeatherCode));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadConsensus(HOME.latitude, HOME.longitude));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Forecast is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.backgroundGlow, appIsWet && styles.rainGlow, !appIsDay && styles.nightGlow]} />
      <View style={styles.header}>
        <View style={styles.brandIcon}><Text style={styles.brandIconText}>◒</Text></View>
        <View>
          <Text style={styles.brand}>WeatherGlass</Text>
          <Text style={styles.tagline}>YOUR TRANSPARENT FORECAST</Text>
        </View>
      </View>
      {tab === "Forecast" ? (
        <ForecastHome data={data} loading={loading} error={error} refresh={() => void refresh()} />
      ) : (
        <Placeholder tab={tab} />
      )}
      <View style={styles.tabBar}>
        {(["Forecast", "Radar", "Plans", "Settings"] as Tab[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            style={[styles.tabButton, tab === item && styles.tabActive]}
          >
            <Text style={[styles.tabGlyph, tab === item && styles.tabSelectedGlyph]}>
              {{ Forecast: "◉", Radar: "◈", Plans: "⌖", Settings: "⚙" }[item]}
            </Text>
            <Text style={[styles.tabLabel, tab === item && styles.tabSelectedLabel]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#07111e" },
  backgroundGlow: {
    position: "absolute", top: -100, left: -60, width: 360, height: 330, borderRadius: 220,
    backgroundColor: "#123c4a", opacity: 0.55,
  },
  rainGlow: { backgroundColor: "#17435a" },
  nightGlow: { backgroundColor: "#1b2747", opacity: 0.46 },
  header: { height: 76, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: {
    width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(190,235,241,0.12)",
    borderColor: "rgba(255,255,255,0.26)", borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  brandIconText: { color: "#c9f5eb", fontSize: 24 },
  brand: { color: "#f4f7fb", fontSize: 18, fontWeight: "700", letterSpacing: -0.5 },
  tagline: { color: "#9cabbc", fontSize: 8, letterSpacing: 1.7, marginTop: 3 },
  content: { paddingHorizontal: 18, paddingBottom: 30 },
  locationRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 15 },
  kicker: { color: "#91a3b8", fontSize: 9, letterSpacing: 1.6, fontWeight: "700" },
  city: { color: "#f4f7fb", fontSize: 21, fontWeight: "600", marginTop: 4, letterSpacing: -0.4 },
  refresh: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  refreshGlyph: { color: "#c9f5eb", fontSize: 25 },
  card: {
    backgroundColor: "rgba(255,255,255,0.075)", borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderRadius: 23, padding: 18, marginBottom: 12,
  },
  hero: { minHeight: 250, padding: 21, backgroundColor: "rgba(255,255,255,0.09)" },
  heroLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  temperature: { color: "#fbfcfe", fontSize: 82, fontWeight: "300", letterSpacing: -6 },
  conditionBlock: { alignItems: "center", minWidth: 115 },
  weatherGlyph: { color: "#ffd38e", fontSize: 36 },
  condition: { color: "#e4eaf0", fontSize: 14, marginTop: 3 },
  feels: { color: "#bcc8d5", fontSize: 14, marginTop: 0 },
  range: { color: "#9eacbd", fontSize: 12, marginTop: 8 },
  consensusStrip: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.11)", marginTop: 18, paddingTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  consensusValue: { color: "#a9f0dc", fontSize: 20, fontWeight: "700", marginTop: 3 },
  explain: { flex: 1, textAlign: "right", color: "#aebaca", fontSize: 11, lineHeight: 16 },
  loading: { height: 165, alignItems: "center", justifyContent: "center", gap: 11 },
  muted: { color: "#9eacbd", fontSize: 12, lineHeight: 18 },
  error: { color: "#ffc2b8", fontSize: 12, marginTop: 12 },
  sectionHeader: { marginTop: 18, marginBottom: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  sectionTitle: { color: "#f4f7fb", fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  sectionAction: { color: "#91a3b8", fontSize: 10 },
  hourlyRow: { gap: 19, paddingVertical: 3 },
  hour: { alignItems: "center", minWidth: 38 },
  hourTime: { color: "#9eacbd", fontSize: 9, fontWeight: "600" },
  hourGlyph: { color: "#a9f0dc", fontSize: 23, marginVertical: 8 },
  hourTemp: { color: "#f4f7fb", fontSize: 14, fontWeight: "600" },
  hourRain: { color: "#79d6ef", fontSize: 10, marginTop: 5 },
  modelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  divider: { borderTopColor: "rgba(255,255,255,0.1)", borderTopWidth: 1 },
  modelName: { color: "#eef3f7", fontSize: 13, fontWeight: "600" },
  modelCondition: { color: "#91a3b8", fontSize: 10, marginTop: 3 },
  modelTemperature: { color: "#f4f7fb", fontSize: 19, fontWeight: "600" },
  footer: { color: "#718196", fontSize: 10, lineHeight: 15, paddingHorizontal: 3, paddingTop: 4 },
  placeholderWrap: { flex: 1, justifyContent: "center", padding: 18 },
  placeholder: { alignItems: "center", padding: 26, gap: 10 },
  placeholderText: { color: "#aebaca", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 4 },
  tabBar: {
    flexDirection: "row", marginHorizontal: 15, marginBottom: 10, padding: 6, borderRadius: 25,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(19,30,44,0.9)",
  },
  tabButton: { flex: 1, minHeight: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", gap: 2 },
  tabActive: { backgroundColor: "rgba(255,255,255,0.1)" },
  tabGlyph: { color: "#a5b2c1", fontSize: 17 },
  tabSelectedGlyph: { color: "#a9f0dc" },
  tabLabel: { color: "#a5b2c1", fontSize: 9 },
  tabSelectedLabel: { color: "#eaf8f3", fontWeight: "600" },
});
