import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { conditionLabel, ForecastConsensus, Place, placeLabel, searchLocations } from "./weather";

export type WeatherPlan = { id: string; title: string; place: string; date: string; start: string; end: string };
const WORKER = "https://weatherglass.d8bff7ph8r.workers.dev";

function average(values: Array<number | undefined>): number | undefined {
  const usable = values.filter((value): value is number => typeof value === "number");
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : undefined;
}
function value(v?: number, suffix = "") { return typeof v === "number" ? Math.round(v) + suffix : "—"; }
function Card({ children }: { children: React.ReactNode }) { return <View style={s.card}>{children}</View>; }
function Metric({ label, value: metric, hint }: { label: string; value: string; hint: string }) {
  return <View style={s.metric}><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{metric}</Text><Text style={s.muted}>{hint}</Text></View>;
}

export function DetailsScreen({ place, data }: { place: Place; data: ForecastConsensus | null }) {
  const models = data?.models ?? [];
  const humidity = average(models.map((m) => m.current.relative_humidity_2m));
  const feels = average(models.map((m) => m.current.apparent_temperature));
  const wind = average(models.map((m) => m.current.wind_speed_10m));
  const rain = average(models.map((m) => m.hourly.precipitation_probability?.[0]));
  const codes = models.map((m) => m.current.weather_code).filter((n): n is number => typeof n === "number");
  const conditionCode = codes.length ? codes.sort((a, b) => codes.filter((n) => n === b).length - codes.filter((n) => n === a).length)[0] : undefined;
  return <ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>LOCATION DETAILS</Text><Text style={s.title}>{place.name}</Text><Text style={s.subtitle}>{placeLabel(place)}</Text>
    <Card><Text style={s.section}>Current conditions</Text><Text style={s.big}>{value(average(models.map((m) => m.current.temperature_2m)), "°")}</Text><Text style={s.subtitle}>{conditionLabel(conditionCode)} · Equal-weight model blend</Text></Card>
    <View style={s.grid}>
      <Metric label="FEELS LIKE" value={value(feels, "°")} hint="Apparent temperature blend" />
      <Metric label="HUMIDITY" value={value(humidity, "%")} hint="Relative humidity" />
      <Metric label="WIND" value={value(wind, " mph")} hint="Sustained wind blend" />
      <Metric label="RAIN CHANCE" value={value(rain, "%")} hint="Current hour model mean" />
    </View>
    <Card><Text style={s.section}>Model comparison</Text>{models.map((m, i) => <View key={m.label} style={[s.row, i > 0 && s.rule]}><View><Text style={s.rowTitle}>{m.label}</Text><Text style={s.muted}>{conditionLabel(m.current.weather_code)}</Text></View><Text style={s.rowValue}>{value(m.current.temperature_2m, "°")}</Text></View>)}
      {!models.length && <Text style={s.muted}>Forecast data will appear after the first refresh.</Text>}
    </Card>
    <Text style={s.footnote}>The blend reflects available forecast models. Local observations and official alerts may differ.</Text>
  </ScrollView>;
}

function radarHtml(place: Place) {
  const lat = Number(place.latitude), lon = Number(place.longitude);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>*{box-sizing:border-box}html,body,#map{height:100%;width:100%;margin:0;background:#09121f;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.leaflet-control-attribution{font-size:9px!important}.controls{position:absolute;z-index:1000;top:12px;left:12px;right:12px;display:flex;gap:7px;align-items:center}.pill{border:1px solid #ffffff35;background:#101d2ce8;color:#eff8f5;border-radius:20px;padding:10px 13px;font-size:12px}.active{color:#9debd5;border-color:#9debd5}.spacer{flex:1}.bottom{position:absolute;z-index:1000;left:12px;right:12px;bottom:16px;border-radius:18px;background:#101d2cf0;border:1px solid #ffffff35;padding:10px 14px;color:#eff8f5}.timeline{display:flex;align-items:center;gap:10px}.timeline input{flex:1;accent-color:#9debd5}.status{display:flex;justify-content:space-between;color:#b5c5d1;font-size:11px;margin-top:6px}.play{color:#9debd5;font-size:17px;border:0;background:transparent;padding:3px 8px}.leaflet-control-zoom a{background:#101d2c!important;color:#eff8f5!important;border-color:#ffffff25!important}</style></head><body><div id="map"></div>
<div class="controls"><button class="pill active" id="mapBtn">Map</button><button class="pill" id="satBtn">Satellite</button><span class="spacer"></span><button class="pill" id="centerBtn">⌖ Center</button></div>
<div class="bottom"><div class="timeline"><button class="play" id="playBtn">▶</button><input id="frame" type="range" min="0" max="12" value="12"><span id="time"></span></div><div class="status"><span>Xweather precipitation radar</span><span id="mode">LIVE</span></div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const lat=${lat},lon=${lon}, map=L.map('map',{zoomControl:true,attributionControl:true}).setView([lat,lon],10);
map.createPane('radarPane');map.getPane('radarPane').style.zIndex='450';map.getPane('radarPane').style.pointerEvents='none';
map.createPane('labelPane');map.getPane('labelPane').style.zIndex='500';map.getPane('labelPane').style.pointerEvents='none';
const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
const imagery=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'});let labels=null,base=streets,satellite=false;
const marker=L.circleMarker([lat,lon],{radius:6,color:'#ffffff',weight:2,fillColor:'#98efd7',fillOpacity:1}).addTo(map);
const frames=Array.from({length:13},(_,i)=>Math.floor((Date.now()-300000)/300000)*300000-(12-i)*300000);
const radar=L.tileLayer('',{pane:'radarPane',maxNativeZoom:12,maxZoom:19,opacity:.82,attribution:'Radar © Xweather',keepBuffer:1}).addTo(map);
const range=document.getElementById('frame'),time=document.getElementById('time'),play=document.getElementById('playBtn'),mode=document.getElementById('mode');let index=12,timer=null;
radar.on('tileerror',()=>{mode.textContent='RADAR TILE ERROR'});radar.on('tileload',()=>{if(mode.textContent==='RADAR TILE ERROR')mode.textContent=index===12?'LATEST':'PAST FRAME'});
function render(){index=Number(range.value);radar.setUrl('/api/radar/xweather/{z}/{x}/{y}/'+frames[index]+'.png');time.textContent=new Date(frames[index]).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});mode.textContent=index===12?'LATEST':'PAST FRAME'}
range.addEventListener('input',render);play.addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;play.textContent='▶';return}play.textContent='Ⅱ';if(index>=12){index=0;range.value='0';render()}timer=setInterval(()=>{index=(index+1)%13;range.value=String(index);render()},700)});
function setBase(sat){satellite=sat;if(base)map.removeLayer(base);if(labels){map.removeLayer(labels);labels=null}base=(sat?imagery:streets).addTo(map);if(sat)labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{pane:'labelPane',maxZoom:19,attribution:'Place labels © Esri'}).addTo(map);document.getElementById('mapBtn').className='pill'+(sat?'':' active');document.getElementById('satBtn').className='pill'+(sat?' active':'')}
document.getElementById('mapBtn').onclick=()=>setBase(false);document.getElementById('satBtn').onclick=()=>setBase(true);document.getElementById('centerBtn').onclick=()=>{map.setView([lat,lon],10);marker.openPopup?.()};render();
</script></body></html>`;
}

export function RadarScreen({ place }: { place: Place }) {
  const html = useMemo(() => radarHtml(place), [place.latitude, place.longitude, place.name]);
  return <View style={s.radar}><Text style={s.radarTitle}>Radar · {place.name}</Text><WebView source={{ html, baseUrl: WORKER + "/" }} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled style={s.webview} /></View>;
}

export function PlansScreen({ place, plans, onAdd, onRemove }: { place: Place; plans: WeatherPlan[]; onAdd: (plan: WeatherPlan) => void; onRemove: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const add = () => {
    if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !start.trim() || !end.trim()) {
      Alert.alert("Add the plan details", "Enter a title, date (YYYY-MM-DD), and a start and end time.");
      return;
    }
    onAdd({ id: String(Date.now()), title: title.trim(), date, start: start.trim(), end: end.trim(), place: placeLabel(place) });
    setTitle(""); setDate(""); setStart(""); setEnd("");
  };
  return <ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>PLAN AROUND THE WEATHER</Text><Text style={s.title}>Make the forecast useful</Text><Text style={s.subtitle}>Choose when and where. Save more than one plan.</Text>
    <Card><Text style={s.section}>New plan · {place.name}</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="What are you planning?" placeholderTextColor="#8191a4" />
      <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="Date · YYYY-MM-DD" placeholderTextColor="#8191a4" />
      <View style={s.inputRow}><TextInput style={[s.input,s.inputHalf]} value={start} onChangeText={setStart} placeholder="Start · 9:00 AM" placeholderTextColor="#8191a4" /><TextInput style={[s.input,s.inputHalf]} value={end} onChangeText={setEnd} placeholder="End · 12:00 PM" placeholderTextColor="#8191a4" /></View>
      <Pressable onPress={add} style={s.primary}><Text style={s.primaryText}>Save plan</Text></Pressable>
    </Card>
    <Text style={s.section}>Your saved plans · {plans.length}</Text>
    {plans.map((plan) => <Card key={plan.id}><View style={s.planHead}><View style={{flex:1}}><Text style={s.rowTitle}>{plan.title}</Text><Text style={s.muted}>{plan.place}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={"Remove " + plan.title} onPress={() => onRemove(plan.id)}><Text style={s.remove}>Remove</Text></Pressable></View><Text style={s.planTime}>{plan.date} · {plan.start}–{plan.end}</Text><Text style={s.muted}>Forecast outlook will appear here for the selected time.</Text></Card>)}
    {!plans.length && <Card><Text style={s.muted}>Your plans will stay on this device.</Text></Card>}
  </ScrollView>;
}

export function FavoritesScreen({ favorites, current, onSelect, onAdd, onRemove }: { favorites: Place[]; current: Place; onSelect: (place: Place) => void; onAdd: (place: Place) => void; onRemove: (place: Place) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const runSearch = async () => {
    if (query.trim().length < 2) { setError("Enter at least two characters."); return; }
    setBusy(true); setError("");
    try { const found = await searchLocations(query); setResults(found); if (!found.length) setError("No matching places found."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Location search failed."); }
    finally { setBusy(false); }
  };
  return <ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>YOUR PLACES</Text><Text style={s.title}>Weather, where you need it</Text><Text style={s.subtitle}>Saved locations stay on this device.</Text>
    <Card><Text style={s.section}>Find a location</Text><View style={s.inputRow}><TextInput style={[s.input,s.searchInput]} value={query} onChangeText={setQuery} placeholder="City or town" placeholderTextColor="#8191a4" returnKeyType="search" onSubmitEditing={() => void runSearch()} /><Pressable onPress={() => void runSearch()} style={s.searchButton}><Text style={s.primaryText}>{busy ? "…" : "Search"}</Text></Pressable></View>{error ? <Text style={s.error}>{error}</Text> : null}
      {results.map((place, i) => <View key={place.name+place.latitude+i} style={[s.row, i>0&&s.rule]}><Pressable style={{flex:1}} onPress={()=>{onSelect(place);setQuery("");setResults([])}}><Text style={s.rowTitle}>{place.name}</Text><Text style={s.muted}>{placeLabel(place)}</Text></Pressable><Pressable onPress={()=>onAdd(place)} style={s.addButton}><Text style={s.addText}>＋ Save</Text></Pressable></View>)}
    </Card>
    <Text style={s.section}>Saved locations · {favorites.length}</Text>
    {favorites.map((place,i)=><Card key={place.name+place.latitude}><View style={s.planHead}><Pressable style={{flex:1}} onPress={()=>onSelect(place)}><Text style={s.rowTitle}>{place.name}{place.latitude===current.latitude?"  · CURRENT":""}</Text><Text style={s.muted}>{placeLabel(place)}</Text></Pressable>{i>0&&<Pressable onPress={()=>onRemove(place)}><Text style={s.remove}>Remove</Text></Pressable>}</View></Card>)}
  </ScrollView>;
}

export const featureStyles = s;
const s = StyleSheet.create({
  content:{padding:18,paddingBottom:28}, eyebrow:{color:"#91a3b8",fontSize:10,fontWeight:"700",letterSpacing:1.6,marginTop:8},title:{color:"#f4f7fb",fontSize:25,fontWeight:"600",letterSpacing:-.5,marginTop:5},subtitle:{color:"#aebaca",fontSize:13,lineHeight:19,marginTop:5,marginBottom:16},
  card:{backgroundColor:"rgba(255,255,255,.075)",borderColor:"rgba(255,255,255,.14)",borderWidth:1,borderRadius:22,padding:17,marginTop:10},section:{color:"#f4f7fb",fontSize:15,fontWeight:"600",marginBottom:10},big:{color:"#f4f7fb",fontSize:56,fontWeight:"300",marginTop:2},grid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:10},metric:{width:"48%",minHeight:116,backgroundColor:"rgba(255,255,255,.07)",borderWidth:1,borderColor:"rgba(255,255,255,.11)",borderRadius:18,padding:14},metricLabel:{fontSize:9,color:"#91a3b8",fontWeight:"700",letterSpacing:1.2},metricValue:{color:"#a9f0dc",fontSize:24,fontWeight:"700",marginTop:8},muted:{color:"#9eacbd",fontSize:11,lineHeight:16,marginTop:3},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12},rule:{borderTopWidth:1,borderTopColor:"rgba(255,255,255,.1)"},rowTitle:{color:"#eef3f7",fontSize:13,fontWeight:"600"},rowValue:{color:"#f4f7fb",fontSize:18,fontWeight:"600"},footnote:{color:"#718196",fontSize:10,lineHeight:15,margin:5,marginTop:14},
  radar:{flex:1,backgroundColor:"#07111e"},radarTitle:{color:"#eaf8f3",fontSize:15,fontWeight:"600",paddingHorizontal:18,paddingTop:8,paddingBottom:10},webview:{flex:1,backgroundColor:"#09121f"},
  input:{backgroundColor:"rgba(255,255,255,.06)",borderWidth:1,borderColor:"rgba(255,255,255,.12)",borderRadius:13,color:"#f4f7fb",paddingHorizontal:13,paddingVertical:12,fontSize:13,marginTop:8},inputRow:{flexDirection:"row",alignItems:"center",gap:8},inputHalf:{flex:1},searchInput:{flex:1},searchButton:{backgroundColor:"#2c7566",paddingHorizontal:15,paddingVertical:13,borderRadius:13,marginTop:8},primary:{backgroundColor:"#2c7566",padding:14,alignItems:"center",borderRadius:14,marginTop:12},primaryText:{color:"#effff9",fontSize:12,fontWeight:"700"},error:{color:"#ffc2b8",fontSize:11,marginTop:8},planHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},planTime:{color:"#a9f0dc",fontSize:12,fontWeight:"600",marginTop:12},remove:{color:"#ffb2a7",fontSize:11,padding:6},addButton:{borderRadius:12,backgroundColor:"rgba(152,239,215,.13)",paddingHorizontal:12,paddingVertical:8},addText:{color:"#a9f0dc",fontWeight:"700",fontSize:11},
});
