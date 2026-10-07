import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Storage from "expo-sqlite/kv-store";
import { conditionLabel, ForecastConsensus, loadConsensus, ModelForecast, Place, placeLabel } from "./src/weather";
import { DetailsScreen, FavoritesScreen, PlansScreen, RadarScreen, WeatherPlan } from "./src/MobileFeatures";

const HOME: Place = { name: "Warner Robins", region: "Georgia", country: "United States", latitude: 32.613, longitude: -83.624 };
type Tab = "Forecast" | "Radar" | "Details" | "Plans" | "Favorites";
function average(values: Array<number | undefined>): number | undefined { const usable=values.filter((v):v is number=>typeof v==="number"); return usable.length?usable.reduce((a,b)=>a+b,0)/usable.length:undefined; }
function rounded(value?:number):string{return typeof value==="number"?String(Math.round(value)):"—"}
function weatherGlyph(code?:number,isDay=true):string{if(code===undefined)return"◌";if(code===0)return isDay?"☀":"☾";if(code===1||code===2)return isDay?"⛅":"☁";if(code===3||code===45||code===48)return"☁";if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return"☂";if([71,73,75,77,85,86].includes(code))return"❄";if([95,96,99].includes(code))return"ϟ";return"◌"}
function GlassCard({children,style}:{children:React.ReactNode;style?:import("react-native").StyleProp<import("react-native").ViewStyle>}){return<View style={[styles.card,style]}>{children}</View>}
function WeatherAtmosphere({kind}:{kind:"rain"|"snow"|"wind"|"none"}) {
 const {width,height}=useWindowDimensions();
 const count=kind==="wind"?7:kind==="none"?0:14;
 const motionValues=useRef(Array.from({length:14},()=>new Animated.Value(0))).current;
 useEffect(()=>{
  if(kind==="none")return;
  const loops=motionValues.slice(0,count).map((value,index)=>{
   value.setValue(0);
   const duration=kind==="rain"?1150+(index%5)*130:kind==="snow"?4200+(index%6)*500:2600+(index%5)*350;
   const loop=Animated.loop(Animated.sequence([Animated.delay(index*(kind==="wind"?240:115)),Animated.timing(value,{toValue:1,duration,easing:Easing.linear,useNativeDriver:true})]));
   loop.start();return loop;
  });
  return()=>loops.forEach(loop=>loop.stop());
 },[kind,count,motionValues]);
 if(kind==="none")return null;
 const color=kind==="rain"?"rgba(132,197,233,.33)":kind==="snow"?"rgba(226,245,255,.52)":"rgba(169,240,220,.13)";
 return <View pointerEvents="none" style={styles.atmosphere}>{motionValues.slice(0,count).map((value,index)=>{
  const translateX=kind==="wind"?value.interpolate({inputRange:[0,1],outputRange:[-width,width*1.1]}):value.interpolate({inputRange:[0,1],outputRange:[0,(index%2?1:-1)*22]});
  const translateY=kind==="wind"?0:value.interpolate({inputRange:[0,1],outputRange:[-24,height+36]});
  const opacity=value.interpolate({inputRange:[0,.12,.82,1],outputRange:[0,.8,.65,0]});
  return <Animated.View key={index} style={[styles.particle,{left:kind==="wind"?0:(index*67+23)%Math.max(1,width),top:kind==="wind"?((index*97+45)%Math.max(1,height)):0,width:kind==="rain"?2:kind==="snow"?5:30,height:kind==="rain"?18:kind==="snow"?5:2,borderRadius:kind==="snow"?4:2,backgroundColor:color,opacity,transform:[{translateX},{translateY},...(kind==="rain"?[{rotate:"18deg"}]:[])]}]} />;
 })}</View>;
}

function ForecastHome({data,loading,error,refresh,place}:{data:ForecastConsensus|null;loading:boolean;error:string|null;refresh:()=>void;place:Place}){
 const models=data?.models??[],current=average(models.map(m=>m.current.temperature_2m)),feels=average(models.map(m=>m.current.apparent_temperature)),high=average(models.map(m=>m.daily.temperature_2m_max?.[0])),low=average(models.map(m=>m.daily.temperature_2m_min?.[0]));
 const counts=new Map<number,number>();for(const m of models){const n=m.current.weather_code;if(typeof n==="number")counts.set(n,(counts.get(n)??0)+1)}const code=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0],isDay=models[0]?.current.is_day!==0;
 return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#a9f0dc"/>}>
  <View style={styles.locationRow}><View><Text style={styles.kicker}>YOUR LOCATION</Text><Text style={styles.city}>{place.name}</Text><Text style={styles.sub}>{placeLabel(place)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh forecast" onPress={refresh} style={styles.refresh}><Text style={styles.refreshGlyph}>↻</Text></Pressable></View>
  <GlassCard style={styles.hero}><Text style={styles.kicker}>MODEL CONSENSUS · {models.length?models.length+" FEEDS":loading?"CHECKING MODELS":"NO FEEDS"}</Text>
   {loading&&!data?<View style={styles.loading}><ActivityIndicator color="#a9f0dc"/><Text style={styles.muted}>Gathering forecasts…</Text></View>:<><View style={styles.heroLine}><Text style={styles.temperature}>{rounded(current)}°</Text><View style={styles.conditionBlock}><Text style={styles.weatherGlyph}>{weatherGlyph(code,isDay)}</Text><Text style={styles.condition}>{conditionLabel(code)}</Text></View></View>
   <Text style={styles.feels}>Feels like {rounded(feels)}°</Text><Text style={styles.range}>Today · Low {rounded(low)}° / High {rounded(high)}°</Text>
   {data&&<View style={styles.consensusStrip}><View><Text style={styles.kicker}>MODEL SPREAD</Text><Text style={styles.consensusValue}>{data.modelSpread.toFixed(1)}°</Text></View><Text style={styles.explain}>Difference between warmest and coolest model</Text></View>}</>}
   {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}</GlassCard>
  <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Hourly outlook</Text><Text style={styles.sectionAction}>Temperature · Rain chance</Text></View>
  <GlassCard><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyRow}>{(models[0]?.hourly.time??[]).slice(0,12).map((time,index)=><View key={time} style={styles.hour}><Text style={styles.hourTime}>{index===0?"NOW":time.slice(11,16)}</Text><Text style={styles.hourGlyph}>{weatherGlyph(models[0]?.hourly.weather_code?.[index],true)}</Text><Text style={styles.hourTemp}>{rounded(average(models.map(m=>m.hourly.temperature_2m?.[index])))}°</Text><Text style={styles.hourRain}>{rounded(average(models.map(m=>m.hourly.precipitation_probability?.[index])))}%</Text></View>)}</ScrollView></GlassCard>
  <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>What the models say</Text><Text style={styles.sectionAction}>Equal-weight average</Text></View>
  <GlassCard>{models.map((model:ModelForecast,index)=><View key={model.label} style={[styles.modelRow,index>0&&styles.divider]}><View><Text style={styles.modelName}>{model.label}</Text><Text style={styles.modelCondition}>{conditionLabel(model.current.weather_code)}</Text></View><Text style={styles.modelTemperature}>{rounded(model.current.temperature_2m)}°</Text></View>)}{!models.length&&!loading?<Text style={styles.muted}>Pull down to load the latest consensus.</Text>:null}</GlassCard>
  <Text style={styles.footer}>Consensus blends available model forecasts; it is not a guarantee.</Text>
 </ScrollView>
}
export default function App(){
 const [tab,setTab]=useState<Tab>("Forecast"),[place,setPlace]=useState<Place>(HOME),[favorites,setFavorites]=useState<Place[]>([HOME]),[plans,setPlans]=useState<WeatherPlan[]>([]),[storageReady,setStorageReady]=useState(false);
 const [data,setData]=useState<ForecastConsensus|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let alive=true;(async()=>{try{const savedPlaces=await Storage.getItem("wg.favoritePlaces"),savedPlans=await Storage.getItem("wg.plans"),savedCurrent=await Storage.getItem("wg.currentPlace");if(!alive)return;if(savedPlaces){const parsed=JSON.parse(savedPlaces) as Place[];if(parsed.length)setFavorites(parsed)}if(savedPlans)setPlans(JSON.parse(savedPlans) as WeatherPlan[]);if(savedCurrent)setPlace(JSON.parse(savedCurrent) as Place)}catch{}finally{if(alive)setStorageReady(true)}})();return()=>{alive=false}},[]);
 useEffect(()=>{if(!storageReady)return;void Storage.setItem("wg.favoritePlaces",JSON.stringify(favorites));void Storage.setItem("wg.plans",JSON.stringify(plans));void Storage.setItem("wg.currentPlace",JSON.stringify(place))},[favorites,plans,place,storageReady]);
 const refresh=useCallback(async()=>{setLoading(true);setError(null);try{setData(await loadConsensus(place.latitude,place.longitude))}catch(reason){setError(reason instanceof Error?reason.message:"Forecast is temporarily unavailable.")}finally{setLoading(false)}},[place.latitude,place.longitude]);
 useEffect(()=>{void refresh()},[refresh]);
 const addFavorite=(p:Place)=>setFavorites(curr=>curr.some(v=>v.latitude===p.latitude&&v.longitude===p.longitude)?curr:[...curr,p]);
 const removeFavorite=(p:Place)=>setFavorites(curr=>curr.filter(v=>v.latitude!==p.latitude||v.longitude!==p.longitude));
 const selectPlace=(p:Place)=>{setPlace(p);setTab("Forecast")};
 const screen=tab==="Forecast"?<ForecastHome data={data} loading={loading} error={error} refresh={()=>void refresh()} place={place}/>:tab==="Radar"?<RadarScreen place={place}/>:tab==="Details"?<DetailsScreen place={place} data={data}/>:tab==="Plans"?<PlansScreen place={place} plans={plans} onAdd={p=>setPlans(curr=>[p,...curr])} onRemove={id=>setPlans(curr=>curr.filter(p=>p.id!==id))}/>:<FavoritesScreen favorites={favorites} current={place} onSelect={selectPlace} onAdd={addFavorite} onRemove={removeFavorite}/>;
 const weatherCode=data?.models[0]?.current.weather_code;
 const condition=conditionLabel(weatherCode);
 const night=data?.models[0]?.current.is_day===0;
 const storm=condition==="Thunderstorms",snow=condition==="Snow",rain=condition==="Rain"||condition==="Drizzle",cloudy=condition==="Cloudy"||condition==="Fog";
 const windSpeed=average(data?.models.map(model=>model.current.wind_speed_10m)??[]);
 const windy=typeof windSpeed==="number"&&windSpeed>=20;
 const atmosphereKind=storm||rain?"rain":snow?"snow":windy?"wind":"none";
 const sunny=!night&&(condition==="Clear"||condition==="Mostly clear");
 const backgroundColor=night?(storm?"#111521":snow?"#101b29":rain?"#0a1b2a":cloudy?"#111d2b":"#091426"):storm?"#17192d":snow?"#1b3947":rain?"#15354a":cloudy?"#263744":sunny?"#17465b":"#15384c";
 return <SafeAreaView style={[styles.safe,{backgroundColor}]}><StatusBar barStyle="light-content"/><WeatherAtmosphere kind={atmosphereKind}/>
  <View style={styles.header}><View style={styles.brandIcon}><Image source={require("./assets/weatherglass-brand.jpg")} style={styles.brandImage} resizeMode="cover" accessibilityLabel="WeatherGlass glass sun and cloud"/></View><View><Text style={styles.brand}>WeatherGlass</Text><Text style={styles.tagline}>YOUR TRANSPARENT FORECAST</Text></View></View>
  <View style={styles.screen}>{screen}</View>
  <View style={styles.tabBar}>{(["Forecast","Radar","Details","Plans","Favorites"] as Tab[]).map(item=><Pressable key={item} accessibilityRole="tab" accessibilityState={{selected:tab===item}} onPress={()=>setTab(item)} style={[styles.tabButton,tab===item&&styles.tabActive]}><Text style={[styles.tabGlyph,tab===item&&styles.tabSelectedGlyph]}>{({Forecast:"◉",Radar:"◈",Details:"⌖",Plans:"▤",Favorites:"☆"} as Record<Tab,string>)[item]}</Text><Text style={[styles.tabLabel,tab===item&&styles.tabSelectedLabel]}>{item}</Text></Pressable>)}</View>
 </SafeAreaView>
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#07111e"},atmosphere:{...StyleSheet.absoluteFillObject,zIndex:0},particle:{position:"absolute"},header:{height:72,paddingHorizontal:17,flexDirection:"row",alignItems:"center",gap:9},brandIcon:{width:35,height:35,borderRadius:12,backgroundColor:"rgba(190,235,241,.12)",borderColor:"rgba(255,255,255,.26)",borderWidth:1,overflow:"hidden"},brandImage:{width:"100%",height:"100%"},brand:{color:"#f4f7fb",fontSize:16,fontWeight:"700",letterSpacing:-.4},tagline:{color:"#9cabbc",fontSize:7,letterSpacing:1.25,marginTop:3},screen:{flex:1},content:{paddingHorizontal:17,paddingBottom:26},locationRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:13},kicker:{color:"#91a3b8",fontSize:9,letterSpacing:1.5,fontWeight:"700"},city:{color:"#f4f7fb",fontSize:22,fontWeight:"600",marginTop:4},sub:{color:"#91a3b8",fontSize:9,marginTop:3},refresh:{width:37,height:37,borderRadius:19,backgroundColor:"rgba(255,255,255,.08)",alignItems:"center",justifyContent:"center"},refreshGlyph:{color:"#c9f5eb",fontSize:24},card:{backgroundColor:"rgba(255,255,255,.075)",borderColor:"rgba(255,255,255,.14)",borderWidth:1,borderRadius:22,padding:17,marginBottom:11},hero:{minHeight:222,backgroundColor:"rgba(255,255,255,.09)"},heroLine:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:4},temperature:{color:"#fbfcfe",fontSize:76,fontWeight:"300",letterSpacing:-5},conditionBlock:{alignItems:"center",minWidth:95},weatherGlyph:{color:"#ffd38e",fontSize:32},condition:{color:"#e4eaf0",fontSize:13,marginTop:3},feels:{color:"#bcc8d5",fontSize:13},range:{color:"#9eacbd",fontSize:11,marginTop:7},consensusStrip:{borderTopWidth:1,borderTopColor:"rgba(255,255,255,.11)",marginTop:15,paddingTop:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},consensusValue:{color:"#a9f0dc",fontSize:19,fontWeight:"700",marginTop:3},explain:{flex:1,textAlign:"right",color:"#aebaca",fontSize:10,lineHeight:15},loading:{height:150,alignItems:"center",justifyContent:"center",gap:10},muted:{color:"#9eacbd",fontSize:11,lineHeight:16},error:{color:"#ffc2b8",fontSize:11,marginTop:9},sectionHeader:{marginTop:12,marginBottom:8,flexDirection:"row",justifyContent:"space-between",alignItems:"baseline",gap:8},sectionTitle:{color:"#f4f7fb",fontSize:15,fontWeight:"600"},sectionAction:{color:"#91a3b8",fontSize:9},hourlyRow:{gap:16,paddingVertical:3},hour:{alignItems:"center",minWidth:37},hourTime:{color:"#9eacbd",fontSize:9,fontWeight:"600"},hourGlyph:{color:"#a9f0dc",fontSize:20,marginVertical:6},hourTemp:{color:"#f4f7fb",fontSize:13,fontWeight:"600"},hourRain:{color:"#79d6ef",fontSize:9,marginTop:4},modelRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:10},divider:{borderTopColor:"rgba(255,255,255,.1)",borderTopWidth:1},modelName:{color:"#eef3f7",fontSize:12,fontWeight:"600"},modelCondition:{color:"#91a3b8",fontSize:9,marginTop:3},modelTemperature:{color:"#f4f7fb",fontSize:18,fontWeight:"600"},footer:{color:"#718196",fontSize:9,lineHeight:14,paddingHorizontal:3,paddingTop:2},tabBar:{flexDirection:"row",marginHorizontal:10,marginBottom:8,padding:4,borderRadius:24,borderWidth:1,borderColor:"rgba(255,255,255,.18)",backgroundColor:"rgba(19,30,44,.94)"},tabButton:{flex:1,minHeight:50,borderRadius:18,alignItems:"center",justifyContent:"center",gap:1},tabActive:{backgroundColor:"rgba(255,255,255,.1)"},tabGlyph:{color:"#a5b2c1",fontSize:16},tabSelectedGlyph:{color:"#a9f0dc"},tabLabel:{color:"#a5b2c1",fontSize:10},tabSelectedLabel:{color:"#eaf8f3",fontWeight:"600"}
});
